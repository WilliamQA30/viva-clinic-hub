import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, fail } from "../supabase";

export default defineTool({
  name: "create_patient",
  title: "Cadastrar paciente",
  description:
    "Cria um novo paciente. Para menores de 18 anos, informe também os dados do responsável.",
  inputSchema: {
    name: z.string().trim().min(2),
    cpf: z.string().trim().min(1),
    phone: z.string().trim().min(8).describe("Telefone com DDD; use + para números internacionais."),
    email: z.string().email().optional(),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Formato AAAA-MM-DD."),
    address: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    referral_source: z.string().trim().optional(),
    guardian_name: z.string().trim().optional(),
    guardian_cpf: z.string().trim().optional(),
    guardian_phone: z.string().trim().optional(),
    guardian_relationship: z.string().trim().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    try {
      const supabase = requireAuth(ctx);
      const { data, error } = await supabase
        .from("patients")
        .insert({ ...input, is_active: true })
        .select()
        .single();
      if (error) return fail(error.message);
      return ok({ patient: data });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
});
