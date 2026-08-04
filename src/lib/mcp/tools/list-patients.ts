import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, fail } from "../supabase";

export default defineTool({
  name: "list_patients",
  title: "Listar pacientes",
  description:
    "Lista pacientes da clínica com filtros opcionais por nome/CPF/telefone, status de CRM e situação ativa.",
  inputSchema: {
    search: z.string().trim().optional().describe("Busca por nome, CPF ou telefone."),
    crm_status: z.string().trim().optional().describe("Filtra pelo status de CRM (ex.: em_acompanhamento, perdido)."),
    is_active: z.boolean().optional().describe("Filtra pacientes ativos ou inativos."),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, crm_status, is_active, limit }, ctx) => {
    try {
      const supabase = requireAuth(ctx);
      let query = supabase
        .from("patients")
        .select(
          "id,name,cpf,phone,email,birth_date,is_active,crm_status,crm_tags,registration_date,referral_source"
        )
        .order("name")
        .limit(limit ?? 50);

      if (search) query = query.or(`name.ilike.%${search}%,cpf.ilike.%${search}%,phone.ilike.%${search}%`);
      if (crm_status) query = query.eq("crm_status", crm_status);
      if (typeof is_active === "boolean") query = query.eq("is_active", is_active);

      const { data, error } = await query;
      if (error) return fail(error.message);
      return ok({ count: data?.length ?? 0, patients: data });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
});
