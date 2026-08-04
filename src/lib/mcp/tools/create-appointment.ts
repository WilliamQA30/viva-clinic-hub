import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, fail } from "../supabase";

export default defineTool({
  name: "create_appointment",
  title: "Agendar consulta",
  description:
    "Cria uma consulta na agenda. Verifica antes se o profissional já tem outro atendimento no mesmo horário.",
  inputSchema: {
    patient_id: z.string().uuid(),
    professional_id: z.string().uuid(),
    appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    appointment_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).describe("Horário HH:MM (08:00 a 21:00)."),
    duration_minutes: z.number().int().min(10).max(240).default(50),
    type: z.string().trim().default("consulta"),
    status: z.string().trim().default("agendado"),
    modality: z.string().trim().optional().describe("Presencial ou Online."),
    consultation_value: z.number().nonnegative().optional(),
    clinic_percentage: z.number().int().min(0).max(100).optional().describe("Comissão da clínica (padrão 25)."),
    is_package: z.boolean().optional(),
    package_session_number: z.number().int().min(1).optional(),
    package_total_sessions: z.number().int().min(1).optional(),
    notes: z.string().trim().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    try {
      const supabase = requireAuth(ctx);

      const { data: conflict } = await supabase
        .from("appointments")
        .select("id,appointment_time,status")
        .eq("professional_id", input.professional_id)
        .eq("appointment_date", input.appointment_date)
        .eq("appointment_time", input.appointment_time)
        .neq("status", "cancelado")
        .maybeSingle();

      if (conflict) {
        return fail(
          `Conflito de horário: o profissional já tem uma consulta em ${input.appointment_date} às ${input.appointment_time}.`
        );
      }

      const { data, error } = await supabase
        .from("appointments")
        .insert({ ...input, created_by: ctx.getUserId() })
        .select()
        .single();
      if (error) return fail(error.message);
      return ok({ appointment: data });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
});
