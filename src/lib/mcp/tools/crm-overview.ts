import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, fail } from "../supabase";

export default defineTool({
  name: "crm_overview",
  title: "Panorama do CRM",
  description:
    "Distribuição dos pacientes por status de CRM (lead novo, em acompanhamento, risco de abandono, inativo, perdido...) e por tags automáticas, com opção de listar os pacientes de um status.",
  inputSchema: {
    crm_status: z.string().trim().optional().describe("Se informado, lista os pacientes deste status."),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ crm_status, limit }, ctx) => {
    try {
      const supabase = requireAuth(ctx);

      const { data, error } = await supabase
        .from("patients")
        .select("id,name,phone,crm_status,crm_tags,crm_status_updated_at,is_active")
        .eq("is_active", true);
      if (error) return fail(error.message);

      const byStatus: Record<string, number> = {};
      const byTag: Record<string, number> = {};
      for (const p of data ?? []) {
        const s = p.crm_status ?? "sem_status";
        byStatus[s] = (byStatus[s] ?? 0) + 1;
        for (const tag of p.crm_tags ?? []) byTag[tag] = (byTag[tag] ?? 0) + 1;
      }

      const patients = crm_status
        ? (data ?? [])
            .filter((p) => p.crm_status === crm_status)
            .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
            .slice(0, limit ?? 50)
        : undefined;

      return ok({ total_active: data?.length ?? 0, by_status: byStatus, by_tag: byTag, patients });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
});
