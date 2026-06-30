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
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error("Evolution API credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get reminder settings
    const { data: settings } = await supabase
      .from("reminder_settings")
      .select("*")
      .eq("is_active", true)
      .single();

    const hoursBefore = settings?.hours_before || 1;
    const messageTemplate = settings?.message_template || 
      "Olá {nome}, lembramos que você tem uma consulta agendada para {data} às {hora}. Confirme sua presença respondendo esta mensagem.";

    // Calculate target time: 1 hour from now in BRT (UTC-3)
    const now = new Date();
    // Convert to BRT
    const brtOffset = -3 * 60 * 60 * 1000;
    const nowBRT = new Date(now.getTime() + brtOffset);
    const targetBRT = new Date(nowBRT.getTime() + hoursBefore * 60 * 60 * 1000);
    
    const targetDate = targetBRT.toISOString().split("T")[0];
    const targetHour = targetBRT.getUTCHours().toString().padStart(2, "0");
    const targetMinute = targetBRT.getUTCMinutes().toString().padStart(2, "0");
    const targetTimeStr = `${targetHour}:${targetMinute}:00`;
    
    // Window of 10 minutes to match cron frequency
    const windowEnd = new Date(targetBRT.getTime() + 10 * 60 * 1000);
    const endHour = windowEnd.getUTCHours().toString().padStart(2, "0");
    const endMinute = windowEnd.getUTCMinutes().toString().padStart(2, "0");
    const endTimeStr = `${endHour}:${endMinute}:00`;

    console.log(`Checking reminders: now BRT=${nowBRT.toISOString()}, target=${targetDate} ${targetTimeStr}-${endTimeStr}`);

    // Find appointments scheduled for the target time
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        appointment_time,
        status,
        patients (
          name,
          phone
        ),
        professionals (
          name
        )
      `)
      .eq("appointment_date", targetDate)
      .gte("appointment_time", targetTimeStr)
      .lt("appointment_time", endTimeStr)
      .in("status", ["agendado", "confirmado"]);

    if (error) throw error;

    console.log(`Found ${appointments?.length || 0} appointments for reminders`);

    const results = [];

    for (const appointment of appointments || []) {
      const patient = appointment.patients as any;
      const professional = appointment.professionals as any;

      if (!patient?.phone) {
        console.log(`Skipping appointment ${appointment.id}: no phone number`);
        continue;
      }

      // Format message
      const formattedDate = new Date(appointment.appointment_date + "T00:00:00")
        .toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      const formattedTime = appointment.appointment_time.slice(0, 5);

      const message = messageTemplate
        .replace("{nome}", patient.name)
        .replace("{data}", formattedDate)
        .replace("{hora}", formattedTime)
        .replace("{profissional}", professional?.name || "");

      // Format phone
      let formattedPhone = patient.phone.replace(/\D/g, "");
      if (!formattedPhone.startsWith("55")) {
        formattedPhone = "55" + formattedPhone;
      }

      try {
        // Send via Evolution API
        const response = await fetch(`${evolutionApiUrl.replace(/\/+$/, "")}/message/sendText/EspacoEssentia`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": evolutionApiKey,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: message,
          }),
        });

        const result = await response.json();

        // Log the reminder
        await supabase.from("system_logs").insert({
          action: "reminder_sent",
          entity_type: "appointment",
          entity_id: appointment.id,
          description: `Lembrete enviado para ${patient.name}`,
          metadata: { 
            phone: formattedPhone, 
            hours_before: hoursBefore,
            appointment_time: `${appointment.appointment_date} ${appointment.appointment_time}`,
          },
        });

        results.push({
          appointmentId: appointment.id,
          patientName: patient.name,
          success: response.ok,
        });
      } catch (err: any) {
        console.error(`Error sending reminder for appointment ${appointment.id}:`, err);
        results.push({
          appointmentId: appointment.id,
          patientName: patient.name,
          success: false,
          error: err?.message || String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error processing reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});