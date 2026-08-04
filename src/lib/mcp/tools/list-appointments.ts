import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, fail } from "../supabase";

export default defineTool({
  name: "list_appointments",
  title: "Listar consultas",
  description:
    "Lista consultas da agenda por período, profissional, paciente ou status.",
  inputSchema: {
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial AAAA-MM-DD."),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final AAAA-MM-DD."),
    professional_id: z.string().uuid().optional(),
    patient_id: z.string().uuid().optional(),
    status: z.string().trim().optional().describe("ex.: agendado, confirmado, atendido, cancelado, Cliente Faltou."),
    limit: z.number().int().min(1).max(500).default(100),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date_from, date_to, professional_id, patient_id, status, limit }, ctx) => {
    try {
      const supabase = requireAuth(ctx);
      let query = supabase
        .from("appointments")
        .select(
          "id,appointment_date,appointment_time,duration_minutes,type,status,modality,appointment_mode,consultation_value,payment_method,payment_status,clinic_percentage,is_package,package_session_number,package_total_sessions,notes,patients(id,name,phone),professionals(id,name,specialty)"
        )
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: true })
        .limit(limit ?? 100);

      if (date_from) query = query.gte("appointment_date", date_from);
      if (date_to) query = query.lte("appointment_date", date_to);
      if (professional_id) query = query.eq("professional_id", professional_id);
      if (patient_id) query = query.eq("patient_id", patient_id);
      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) return fail(error.message);
      return ok({ count: data?.length ?? 0, appointments: data });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
});
