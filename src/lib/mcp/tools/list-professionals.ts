import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, fail } from "../supabase";

export default defineTool({
  name: "list_professionals",
  title: "Listar profissionais",
  description:
    "Lista os profissionais da clínica com especialidade, valor de consulta, dias/horários de trabalho e turnos (sala, dia e período).",
  inputSchema: {
    search: z.string().trim().optional().describe("Busca por nome ou especialidade."),
    is_active: z.boolean().optional(),
    include_shifts: z.boolean().default(true),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, is_active, include_shifts }, ctx) => {
    try {
      const supabase = requireAuth(ctx);
      const columns = include_shifts === false
        ? "id,name,specialty,crp,phone,email,consultation_value,work_hours_start,work_hours_end,work_days,is_active"
        : "id,name,specialty,crp,phone,email,consultation_value,work_hours_start,work_hours_end,work_days,is_active,professional_shifts(room,day_of_week,shift_period)";

      let query = supabase.from("professionals").select(columns).order("name");
      if (search) query = query.or(`name.ilike.%${search}%,specialty.ilike.%${search}%`);
      if (typeof is_active === "boolean") query = query.eq("is_active", is_active);

      const { data, error } = await query;
      if (error) return fail(error.message);
      return ok({ count: data?.length ?? 0, professionals: data });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
});
