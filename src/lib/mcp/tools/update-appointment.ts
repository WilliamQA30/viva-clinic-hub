import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, fail } from "../supabase";

export default defineTool({
  name: "update_appointment",
  title: "Atualizar consulta",
  description:
    "Altera status, data, horário, valor ou observações de uma consulta existente.",
  inputSchema: {
    appointment_id: z.string().uuid(),
    status: z.string().trim().optional().describe("ex.: agendado, confirmado, atendido, cancelado, Cliente Faltou."),
    appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    appointment_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    duration_minutes: z.number().int().min(10).max(240).optional(),
    modality: z.string().trim().optional(),
    consultation_value: z.number().nonnegative().optional(),
    payment_method: z.string().trim().optional(),
    payment_status: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ appointment_id, ...fields }, ctx) => {
    try {
      const supabase = requireAuth(ctx);
      const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      if (Object.keys(patch).length === 0) return fail("Nenhum campo informado para atualização.");
      const { data, error } = await supabase
        .from("appointments")
        .update(patch)
        .eq("id", appointment_id)
        .select()
        .single();
      if (error) return fail(error.message);
      return ok({ appointment: data });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
});
