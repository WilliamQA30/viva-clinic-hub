import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, fail } from "../supabase";

export default defineTool({
  name: "list_transactions",
  title: "Listar transações",
  description:
    "Lista as movimentações financeiras (entradas e saídas) do período, opcionalmente filtradas por tipo ou profissional.",
  inputSchema: {
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    type: z.string().trim().optional().describe("ex.: entrada, saida."),
    professional_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(500).default(100),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date_from, date_to, type, professional_id, limit }, ctx) => {
    try {
      const supabase = requireAuth(ctx);
      let query = supabase
        .from("transactions")
        .select("id,type,description,amount,payment_method,transaction_date,transaction_time,professionals(name)")
        .gte("transaction_date", date_from)
        .lte("transaction_date", date_to)
        .order("transaction_date", { ascending: false })
        .limit(limit ?? 100);

      if (type) query = query.eq("type", type);
      if (professional_id) query = query.eq("professional_id", professional_id);

      const { data, error } = await query;
      if (error) return fail(error.message);
      return ok({ count: data?.length ?? 0, transactions: data });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
});
