import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, fail } from "../supabase";

export default defineTool({
  name: "create_bill",
  title: "Criar conta a pagar",
  description: "Registra uma nova conta a pagar da clínica.",
  inputSchema: {
    description: z.string().trim().min(2),
    amount: z.number().positive(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    category: z.string().trim().optional(),
    payment_method: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    try {
      const supabase = requireAuth(ctx);
      const { data, error } = await supabase
        .from("bills_to_pay")
        .insert({ ...input, status: "pendente", created_by: ctx.getUserId() })
        .select()
        .single();
      if (error) return fail(error.message);
      return ok({ bill: data });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
});
