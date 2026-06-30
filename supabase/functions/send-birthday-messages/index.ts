import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load settings
    const { data: settingsRows } = await supabase
      .from("clinic_settings")
      .select("key, value")
      .in("key", ["birthday_message_enabled", "birthday_message_text", "birthday_message_time"]);

    const settings: Record<string, string> = {};
    (settingsRows || []).forEach((r: any) => (settings[r.key] = r.value));

    const enabled = (settings["birthday_message_enabled"] ?? "true") === "true";
    const sendTime = settings["birthday_message_time"] || "09:00";
    const template = settings["birthday_message_text"] ||
      "Olá, {nome},\n\nFeliz aniversário!\n\nEspaço Essentia";

    if (!enabled) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Compute today in BRT (UTC-3)
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const todayMonth = brt.getUTCMonth() + 1;
    const todayDay = brt.getUTCDate();
    const todayYear = brt.getUTCFullYear();
    const currentHour = brt.getUTCHours();

    // Parse configured hour; allow manual trigger to bypass
    const body = await req.json().catch(() => ({}));
    const isManual = body?.manual === true;
    const configuredHour = parseInt((sendTime.split(":")[0] || "9"), 10);
    if (!isManual && currentHour !== configuredHour) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "wrong_hour", currentHour, configuredHour }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch active patients with phone + birth_date
    const { data: patients, error: patientsError } = await supabase
      .from("patients")
      .select("id, name, phone, birth_date, is_active")
      .eq("is_active", true)
      .not("birth_date", "is", null)
      .not("phone", "is", null);

    if (patientsError) throw patientsError;

    const birthdayPatients = (patients || []).filter((p: any) => {
      if (!p.birth_date || !p.phone || !p.phone.trim()) return false;
      // birth_date is YYYY-MM-DD; parse without TZ
      const [, m, d] = p.birth_date.split("-").map((x: string) => parseInt(x, 10));
      return m === todayMonth && d === todayDay;
    });

    // Existing logs for this year
    const ids = birthdayPatients.map((p: any) => p.id);
    let alreadySent = new Set<string>();
    if (ids.length > 0) {
      const { data: logs } = await supabase
        .from("birthday_messages_log")
        .select("patient_id")
        .eq("sent_year", todayYear)
        .in("patient_id", ids);
      alreadySent = new Set((logs || []).map((l: any) => l.patient_id));
    }

    const toSend = birthdayPatients.filter((p: any) => !alreadySent.has(p.id));

    const results: any[] = [];
    for (const p of toSend) {
      const message = template.replace(/\{nome\}/gi, p.name.split(" ")[0]);
      let success = false;
      let errorMessage: string | null = null;

      try {
        const { data: waResult, error: waError } = await supabase.functions.invoke("send-whatsapp", {
          body: {
            phone: p.phone,
            message,
            patientName: p.name,
          },
        });
        if (waError) {
          errorMessage = waError.message || String(waError);
        } else if (waResult && waResult.success === false) {
          errorMessage = waResult.error || "WhatsApp send failed";
        } else {
          success = true;
        }
      } catch (e: any) {
        errorMessage = e?.message || String(e);
      }

      await supabase.from("birthday_messages_log").insert({
        patient_id: p.id,
        patient_name: p.name,
        phone: p.phone,
        sent_year: todayYear,
        success,
        error_message: errorMessage,
        message_preview: message.substring(0, 200),
      });

      results.push({ patient: p.name, success, error: errorMessage });
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: `${todayYear}-${String(todayMonth).padStart(2, "0")}-${String(todayDay).padStart(2, "0")}`,
        found: birthdayPatients.length,
        skipped_already_sent: birthdayPatients.length - toSend.length,
        sent: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Birthday function error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
