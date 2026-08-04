import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, fail } from "../supabase";

export default defineTool({
  name: "get_patient",
  title: "Detalhes do paciente",
  description:
    "Retorna o cadastro completo de um paciente e suas consultas mais recentes.",
  inputSchema: {
    patient_id: z.string().uuid().describe("ID do paciente."),
    appointments_limit: z.number().int().min(0).max(100).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ patient_id, appointments_limit }, ctx) => {
    try {
      const supabase = requireAuth(ctx);
      const { data: patient, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patient_id)
        .maybeSingle();
      if (error) return fail(error.message);
      if (!patient) return fail("Paciente não encontrado.");

      const { data: appointments } = await supabase
        .from("appointments")
        .select(
          "id,appointment_date,appointment_time,status,type,modality,consultation_value,payment_status,is_package,package_session_number,package_total_sessions,professionals(name)"
        )
        .eq("patient_id", patient_id)
        .order("appointment_date", { ascending: false })
        .limit(appointments_limit ?? 20);

      return ok({ patient, appointments });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
});
