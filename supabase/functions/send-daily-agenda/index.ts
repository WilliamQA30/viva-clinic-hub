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

    let evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionApiUrl || !evolutionApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Evolution API not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    evolutionApiUrl = evolutionApiUrl.replace(/\/+$/, "");

    // Allow overriding date for testing
    let today: string;
    try {
      const body = await req.json();
      today = body?.date || new Date().toISOString().split("T")[0];
    } catch {
      today = new Date().toISOString().split("T")[0];
    }

    // Get all active professionals with phone numbers
    const { data: professionals, error: profError } = await supabase
      .from("professionals")
      .select("id, name, phone")
      .eq("is_active", true)
      .not("phone", "is", null);

    if (profError) throw profError;

    const results: any[] = [];

    for (const prof of professionals || []) {
      // Get today's appointments for this professional (including cancelled for context)
      const { data: appointments, error: aptError } = await supabase
        .from("appointments")
        .select(`
          appointment_time,
          type,
          status,
          is_package,
          package_session_number,
          package_total_sessions,
          patients (name, phone),
          appointment_patients (patient_id, patients (name))
        `)
        .eq("professional_id", prof.id)
        .eq("appointment_date", today)
        .order("appointment_time", { ascending: true });

      if (aptError) {
        console.error(`Error fetching appointments for ${prof.name}:`, aptError);
        continue;
      }

      if (!appointments || appointments.length === 0) continue;

      // Helper to get all patient names for an appointment
      const getPatientNames = (apt: any): string => {
        const apPatients = apt.appointment_patients;
        if (apPatients && apPatients.length > 1) {
          return apPatients.map((ap: any) => ap.patients?.name).filter(Boolean).join(" / ");
        }
        return apt.patients?.name || "Paciente";
      };

      const getPatientDisplay = (apt: any): string => {
        let name = getPatientNames(apt);
        if (apt.is_package && apt.package_session_number && apt.package_total_sessions) {
          name += ` - Sessão ${apt.package_session_number}/${apt.package_total_sessions}`;
        }
        return name;
      };

      const activeAppointments = appointments.filter((a: any) => a.status !== "cancelado");
      const cancelledAppointments = appointments.filter((a: any) => a.status === "cancelado");

      // Build the message
      const dateStr = new Date(today + "T12:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
      });
      let message = `📋 *Agenda do Dia - ${dateStr}*\n\n`;
      message += `Olá, ${prof.name.split(" ")[0]}! Aqui está sua agenda para hoje:\n\n`;

      if (activeAppointments.length > 0) {
        activeAppointments.forEach((apt: any) => {
          const time = apt.appointment_time.slice(0, 5);
          const patientDisplay = getPatientDisplay(apt);
          let statusEmoji = "";
          let statusLabel = "";
          if (apt.status === "confirmado") {
            statusEmoji = "✅";
            statusLabel = " - Confirmado";
          } else if (apt.status === "agendado") {
            statusEmoji = "🕐";
            statusLabel = " - Aguardando confirmação";
          } else if (apt.status === "atendido") {
            statusEmoji = "☑️";
            statusLabel = " - Atendido";
          } else {
            statusEmoji = "🕐";
            statusLabel = "";
          }
          message += `${statusEmoji} *${time}* - ${patientDisplay} (${apt.type})${statusLabel}\n`;
        });
      }

      if (cancelledAppointments.length > 0) {
        message += `\n*Cancelamentos:*\n`;
        cancelledAppointments.forEach((apt: any) => {
          const time = apt.appointment_time.slice(0, 5);
          const patientDisplay = getPatientDisplay(apt);
        message += `❌ *${time}* - ${patientDisplay} - Desmarcou\n`;
        });
      }

      message += `\n📊 *Resumo:*\n`;
      const confirmed = activeAppointments.filter((a: any) => a.status === "confirmado").length;
      const awaiting = activeAppointments.filter((a: any) => a.status === "agendado").length;
      message += `✅ Confirmados: ${confirmed}\n`;
      message += `🕐 Aguardando resposta: ${awaiting}\n`;
      message += `❌ Desmarcaram: ${cancelledAppointments.length}\n`;
      message += `📌 Total ativo: ${activeAppointments.length} atendimento(s)\n`;
      message += `\nBom trabalho! 💪\n\n_Por favor, responda "OK" para confirmar o recebimento da agenda._ ✔️`;

      // Send via WhatsApp
      let formattedPhone = prof.phone!.replace(/\D/g, "");
      if (!formattedPhone.startsWith("55")) {
        formattedPhone = "55" + formattedPhone;
      }

      const instanceName = "EspacoEssentia";
      try {
        const response = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": evolutionApiKey,
          },
          body: JSON.stringify({ number: formattedPhone, text: message }),
        });

        const result = await response.json();
        results.push({ professional: prof.name, success: response.ok, result });
      } catch (fetchError: any) {
        results.push({ professional: prof.name, success: false, error: fetchError.message });
      }
    }

    // Log the action
    await supabase.from("system_logs").insert({
      action: "daily_agenda_sent",
      entity_type: "system",
      description: `Agenda diária enviada para ${results.filter(r => r.success).length} profissionais`,
      metadata: { results },
    });

    return new Response(
      JSON.stringify({ success: true, sent: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending daily agenda:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
