import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, fail } from "../supabase";

export default defineTool({
  name: "list_bills",
  title: "Listar contas a pagar",
  description: "Lista as contas a pagar, com filtros por status, categoria e vencimento.",
  inputSchema: {
    status: z.string().trim().optional().describe("ex.: pendente, pago, atrasado."),
    category: z.string().trim().optional(),
    due_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    due_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.number().int().min(1).max(300).default(100),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, category, due_from, due_to, limit }, ctx) => {
    try {
      const supabase = requireAuth(ctx);
      let query = supabase
        .from("bills_to_pay")
        .select("id,description,amount,due_date,status,category,payment_method,paid_at,notes")
        .order("due_date")
        .limit(limit ?? 100);

      if (status) query = query.eq("status", status);
      if (category) query = query.eq("category", category);
      if (due_from) query = query.gte("due_date", due_from);
      if (due_to) query = query.lte("due_date", due_to);

      const { data, error } = await query;
      if (error) return fail(error.message);
      return ok({
        count: data?.length ?? 0,
        total: (data ?? []).reduce((s, b) => s + Number(b.amount ?? 0), 0),
        bills: data,
      });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
});
