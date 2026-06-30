import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: recurringBills, error: fetchError } = await supabase
      .from("recurring_bills")
      .select("*")
      .eq("is_active", true);

    if (fetchError) throw fetchError;

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    let generated = 0;

    for (const rule of recurringBills || []) {
      // Check if end_date has passed
      if (rule.end_date && rule.end_date < todayStr) {
        await supabase
          .from("recurring_bills")
          .update({ is_active: false })
          .eq("id", rule.id);
        continue;
      }

      // Calculate which months need bills generated
      const monthsToGenerate = getMonthsToGenerate(rule, todayStr);

      const skipped: string[] = Array.isArray(rule.skipped_periods) ? rule.skipped_periods : [];

      for (const monthDate of monthsToGenerate) {
        const billingDate = clampDay(monthDate.year, monthDate.month, rule.billing_day);
        const dueDate = clampDay(monthDate.year, monthDate.month, rule.due_day);
        const monthStart = `${monthDate.year}-${String(monthDate.month).padStart(2, "0")}-01`;
        const nextMonth = monthDate.month === 12 ? { y: monthDate.year + 1, m: 1 } : { y: monthDate.year, m: monthDate.month + 1 };
        const monthEndExclusive = `${nextMonth.y}-${String(nextMonth.m).padStart(2, "0")}-01`;

        // Respect periods manually deleted by the user
        if (skipped.includes(monthStart)) continue;

        // Check if a bill already exists for this rule in this month (regardless of due_day changes)
        const { data: existing } = await supabase
          .from("bills_to_pay")
          .select("id")
          .eq("recurring_bill_id", rule.id)
          .gte("due_date", monthStart)
          .lt("due_date", monthEndExclusive)
          .maybeSingle();

        if (existing) continue;

        const { error: insertError } = await supabase
          .from("bills_to_pay")
          .insert({
            description: rule.description,
            amount: rule.amount,
            due_date: dueDate,
            category: rule.category,
            notes: rule.notes,
            payment_method: rule.payment_method,
            recurring_bill_id: rule.id,
            created_by: rule.created_by,
            status: "pendente",
          });

        if (insertError) {
          console.error(`Error creating bill for rule ${rule.id}:`, insertError);
          continue;
        }

        generated++;

        // Update last_generated_date
        await supabase
          .from("recurring_bills")
          .update({ last_generated_date: billingDate })
          .eq("id", rule.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, generated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error generating recurring bills:", error);
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Clamp a day to the last day of the given month if it exceeds the month's length.
 * Returns YYYY-MM-DD string.
 */
function clampDay(year: number, month: number, day: number): string {
  // month is 1-based
  const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
  const actualDay = Math.min(day, lastDay);
  const m = String(month).padStart(2, "0");
  const d = String(actualDay).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/**
 * Determine which months need bills generated.
 * Generates for the current month and up to 1 month ahead (horizon).
 */
function getMonthsToGenerate(
  rule: any,
  todayStr: string
): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  const today = new Date(todayStr + "T12:00:00");

  // Start from the rule's start_date month
  const startDate = new Date(rule.start_date + "T12:00:00");
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth() + 1; // 1-based

  // Horizon: current month + 1
  const horizonDate = new Date(today);
  horizonDate.setMonth(horizonDate.getMonth() + 1);
  const horizonYear = horizonDate.getFullYear();
  const horizonMonth = horizonDate.getMonth() + 1;

  // Iterate from start month to horizon month
  let year = startYear;
  let month = startMonth;

  const maxIterations = 120; // safety
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    // Stop if past horizon
    if (year > horizonYear || (year === horizonYear && month > horizonMonth)) break;

    // Stop if past end_date
    if (rule.end_date) {
      const endDate = new Date(rule.end_date + "T12:00:00");
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth() + 1;
      if (year > endYear || (year === endYear && month > endMonth)) break;
    }

    // Only include months where billing day has passed or is today (within horizon)
    const billingDate = clampDay(year, month, rule.billing_day);
    if (billingDate <= todayStr || (year === horizonYear && month === horizonMonth)) {
      // Check if this month is after or equal to start
      if (year > startYear || (year === startYear && month >= startMonth)) {
        months.push({ year, month });
      }
    }

    // Advance to next month
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}
