import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, fail } from "../supabase";

export default defineTool({
  name: "update_patient",
  title: "Atualizar paciente",
  description:
    "Atualiza dados cadastrais, status de CRM, tags ou situação (ativo/inativo) de um paciente.",
  inputSchema: {
    patient_id: z.string().uuid(),
    name: z.string().trim().min(2).optional(),
    phone: z.string().trim().optional(),
    email: z.string().email().optional(),
    address: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    is_active: z.boolean().optional(),
    crm_status: z.string().trim().optional(),
    crm_status_locked: z.boolean().optional(),
    crm_notes: z.string().trim().optional(),
    crm_tags: z.array(z.string()).optional(),
    inactivation_reason: z.string().trim().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ patient_id, ...fields }, ctx) => {
    try {
      const supabase = requireAuth(ctx);
      const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      if (Object.keys(patch).length === 0) return fail("Nenhum campo informado para atualização.");
      const { data, error } = await supabase
        .from("patients")
        .update(patch)
        .eq("id", patient_id)
        .select()
        .single();
      if (error) return fail(error.message);
      return ok({ patient: data });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
});
