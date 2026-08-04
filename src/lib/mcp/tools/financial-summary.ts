import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, fail } from "../supabase";

export default defineTool({
  name: "financial_summary",
  title: "Resumo financeiro",
  description:
    "Resumo financeiro do período: entradas e saídas registradas em transações (fonte única de faturamento) e contas a pagar em aberto/pagas.",
  inputSchema: {
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date_from, date_to }, ctx) => {
    try {
      const supabase = requireAuth(ctx);

      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("type,amount,payment_method,transaction_date")
        .gte("transaction_date", date_from)
        .lte("transaction_date", date_to);
      if (error) return fail(error.message);

      let income = 0;
      let expense = 0;
      const byMethod: Record<string, number> = {};
      for (const t of transactions ?? []) {
        const amount = Number(t.amount ?? 0);
        if (t.type === "entrada" || t.type === "receita") {
          income += amount;
          const key = t.payment_method || "não informado";
          byMethod[key] = (byMethod[key] ?? 0) + amount;
        } else {
          expense += amount;
        }
      }

      const { data: bills } = await supabase
        .from("bills_to_pay")
        .select("status,amount,due_date,description,category")
        .gte("due_date", date_from)
        .lte("due_date", date_to);

      const billsPending = (bills ?? []).filter((b) => b.status !== "pago");
      const billsPaid = (bills ?? []).filter((b) => b.status === "pago");

      return ok({
        period: { date_from, date_to },
        transactions_count: transactions?.length ?? 0,
        income,
        expense,
        net: income - expense,
        income_by_payment_method: byMethod,
        bills: {
          pending_count: billsPending.length,
          pending_total: billsPending.reduce((s, b) => s + Number(b.amount ?? 0), 0),
          paid_count: billsPaid.length,
          paid_total: billsPaid.reduce((s, b) => s + Number(b.amount ?? 0), 0),
        },
      });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
});
