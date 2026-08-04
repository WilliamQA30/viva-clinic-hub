import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, fail } from "../supabase";

const REALIZED = ["atendido", "realizado", "concluido", "concluído"];

export default defineTool({
  name: "dashboard_stats",
  title: "Indicadores do dashboard",
  description:
    "Indicadores do período: faturamento recebido, consultas realizadas/pendentes/canceladas, taxa de realização, pacientes ativos e novos pacientes.",
  inputSchema: {
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date_from, date_to }, ctx) => {
    try {
      const supabase = requireAuth(ctx);

      const { data: appts, error } = await supabase
        .from("appointments")
        .select("status")
        .gte("appointment_date", date_from)
        .lte("appointment_date", date_to);
      if (error) return fail(error.message);

      const list = appts ?? [];
      const realized = list.filter((a) => REALIZED.includes((a.status ?? "").toLowerCase())).length;
      const pending = list.filter((a) => a.status === "agendado" || a.status === "confirmado").length;
      const canceled = list.filter((a) => (a.status ?? "").toLowerCase() === "cancelado").length;
      const noShow = list.filter((a) => ["cliente faltou", "cliente_faltou", "faltou"].includes((a.status ?? "").toLowerCase())).length;

      const { data: transactions } = await supabase
        .from("transactions")
        .select("type,amount")
        .gte("transaction_date", date_from)
        .lte("transaction_date", date_to);

      const revenue = (transactions ?? [])
        .filter((t) => t.type === "entrada" || t.type === "receita")
        .reduce((s, t) => s + Number(t.amount ?? 0), 0);

      const { count: activePatients } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      const { count: newPatients } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true })
        .gte("registration_date", date_from)
        .lte("registration_date", date_to);

      const base = realized + pending + canceled;

      return ok({
        period: { date_from, date_to },
        revenue_received: revenue,
        appointments: {
          total: list.length,
          realized,
          pending,
          canceled,
          no_show: noShow,
          realization_rate_pct: base > 0 ? Math.round((realized / base) * 100) : 0,
        },
        patients: { active: activePatients ?? 0, new_in_period: newPatients ?? 0 },
      });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
});
