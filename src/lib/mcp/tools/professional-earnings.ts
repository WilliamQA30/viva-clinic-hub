import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, fail } from "../supabase";

export default defineTool({
  name: "professional_earnings",
  title: "Rendimento por profissional",
  description:
    "Resume, por profissional e período, quanto ficou para a clínica e quanto foi pago ao profissional, com base nos pagamentos registrados.",
  inputSchema: {
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data inicial AAAA-MM-DD."),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data final AAAA-MM-DD."),
    professional_id: z.string().uuid().optional(),
    only_paid: z.boolean().default(true).describe("Considerar apenas pagamentos já confirmados."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date_from, date_to, professional_id, only_paid }, ctx) => {
    try {
      const supabase = requireAuth(ctx);
      let query = supabase
        .from("professional_payments")
        .select(
          "professional_id,total_value,professional_amount,clinic_amount,is_paid,professionals(name,specialty),appointments!inner(appointment_date,status)"
        )
        .gte("appointments.appointment_date", date_from)
        .lte("appointments.appointment_date", date_to)
        .neq("appointments.status", "cancelado");

      if (professional_id) query = query.eq("professional_id", professional_id);
      if (only_paid !== false) query = query.eq("is_paid", true);

      const { data, error } = await query;
      if (error) return fail(error.message);

      const totals = new Map<string, { name: string; specialty: string; appointments: number; clinic_revenue: number; professional_revenue: number; total: number }>();
      for (const row of (data ?? []) as any[]) {
        const key = row.professional_id as string;
        const entry = totals.get(key) ?? {
          name: row.professionals?.name ?? "—",
          specialty: row.professionals?.specialty ?? "—",
          appointments: 0,
          clinic_revenue: 0,
          professional_revenue: 0,
          total: 0,
        };
        entry.appointments += 1;
        entry.clinic_revenue += Number(row.clinic_amount ?? 0);
        entry.professional_revenue += Number(row.professional_amount ?? 0);
        entry.total += Number(row.total_value ?? 0);
        totals.set(key, entry);
      }

      const rows = [...totals.entries()]
        .map(([professional_id, v]) => ({ professional_id, ...v }))
        .sort((a, b) => b.clinic_revenue - a.clinic_revenue);

      return ok({
        period: { date_from, date_to },
        only_paid: only_paid !== false,
        professionals: rows,
        totals: {
          clinic_revenue: rows.reduce((s, r) => s + r.clinic_revenue, 0),
          professional_revenue: rows.reduce((s, r) => s + r.professional_revenue, 0),
        },
      });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
});
