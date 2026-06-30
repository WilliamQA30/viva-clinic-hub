import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Shift schedule: morning ends at 11:30, afternoon at 17:30, night at 21:00
const SHIFT_WINDOWS = [
  { name: "manhã", sendHour: 11, sendMinute: 30, startHour: 8, endHour: 12 },
  { name: "tarde", sendHour: 17, sendMinute: 30, startHour: 12, endHour: 18 },
  { name: "noite", sendHour: 21, sendMinute: 0, startHour: 18, endHour: 22 },
];

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

    // Get current time in BRT (UTC-3)
    const now = new Date();
    const brtOffset = -3 * 60 * 60 * 1000;
    const nowBRT = new Date(now.getTime() + brtOffset);
    const currentHour = nowBRT.getUTCHours();
    const currentMinute = nowBRT.getUTCMinutes();
    const today = nowBRT.toISOString().split("T")[0];

    console.log(`Checking shift confirmations: BRT ${currentHour}:${String(currentMinute).padStart(2, "0")}, date=${today}`);

    // Find which shift window we're in (within 10-minute cron window)
    const activeShift = SHIFT_WINDOWS.find(shift => {
      const shiftTotalMin = shift.sendHour * 60 + shift.sendMinute;
      const currentTotalMin = currentHour * 60 + currentMinute;
      return currentTotalMin >= shiftTotalMin && currentTotalMin < shiftTotalMin + 10;
    });

    if (!activeShift) {
      console.log("Not in any shift send window, skipping");
      return new Response(
        JSON.stringify({ success: true, message: "Not in shift window" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Active shift: ${activeShift.name} (${activeShift.startHour}:00-${activeShift.endHour}:00)`);

    // Build time range for the shift
    const shiftStartTime = `${String(activeShift.startHour).padStart(2, "0")}:00:00`;
    const shiftEndTime = `${String(activeShift.endHour).padStart(2, "0")}:00:00`;

    // Get all confirmed appointments for today in this shift's time range
    const { data: appointments, error: aptError } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_time,
        type,
        status,
        professional_id,
        patient_id,
        is_package,
        package_session_number,
        package_total_sessions,
        patients (name, phone),
        professionals (name, phone),
        appointment_patients (patient_id, patients (name))
      `)
      .eq("appointment_date", today)
      .gte("appointment_time", shiftStartTime)
      .lt("appointment_time", shiftEndTime)
      .order("appointment_time", { ascending: true });

    if (aptError) throw aptError;

    if (!appointments || appointments.length === 0) {
      console.log("No appointments in this shift");
      return new Response(
        JSON.stringify({ success: true, message: "No appointments in shift" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group by professional
    const byProfessional: Record<string, any[]> = {};
    for (const apt of appointments) {
      const profId = apt.professional_id;
      if (!byProfessional[profId]) byProfessional[profId] = [];
      byProfessional[profId].push(apt);
    }

    const results: any[] = [];

    for (const [profId, profAppointments] of Object.entries(byProfessional)) {
      const prof = (profAppointments[0] as any).professionals;
      if (!prof?.phone) {
        console.log(`Skipping professional ${profId}: no phone`);
        continue;
      }

      const confirmed = profAppointments.filter((a: any) => a.status === "confirmado");
      const awaiting = profAppointments.filter((a: any) => a.status === "agendado");
      const cancelled = profAppointments.filter((a: any) => a.status === "cancelado");
      const attended = profAppointments.filter((a: any) => a.status === "atendido");

      // Helper to get all patient names
      const getPatientNames = (apt: any): string => {
        const apPatients = apt.appointment_patients;
        if (apPatients && apPatients.length > 1) {
          return apPatients.map((ap: any) => ap.patients?.name).filter(Boolean).join(" / ");
        }
        return apt.patients?.name || "Paciente";
      };

      // Helper to add package info
      const getPatientDisplay = (apt: any): string => {
        let name = getPatientNames(apt);
        if (apt.is_package && apt.package_session_number && apt.package_total_sessions) {
          name += ` - Sessão ${apt.package_session_number}/${apt.package_total_sessions}`;
        }
        return name;
      };

      const dateStr = new Date(today + "T12:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
      });

      let message = `📋 *Resumo do Turno da ${activeShift.name} - ${dateStr}*\n\n`;
      message += `Olá, ${prof.name.split(" ")[0]}!\n\n`;

      if (confirmed.length > 0) {
        message += `*✅ Confirmados:*\n`;
        confirmed.forEach((apt: any) => {
          const time = apt.appointment_time.slice(0, 5);
          message += `  ✅ *${time}* - ${getPatientDisplay(apt)} (${apt.type})\n`;
        });
        message += `\n`;
      }

      if (attended.length > 0) {
        message += `*☑️ Atendidos:*\n`;
        attended.forEach((apt: any) => {
          const time = apt.appointment_time.slice(0, 5);
          message += `  ☑️ *${time}* - ${getPatientDisplay(apt)} (${apt.type})\n`;
        });
        message += `\n`;
      }

      if (awaiting.length > 0) {
        message += `*🕐 Aguardando confirmação:*\n`;
        awaiting.forEach((apt: any) => {
          const time = apt.appointment_time.slice(0, 5);
          message += `  🕐 *${time}* - ${getPatientDisplay(apt)} (${apt.type})\n`;
        });
        message += `\n`;
      }

      if (cancelled.length > 0) {
        message += `*❌ Cancelamentos:*\n`;
        cancelled.forEach((apt: any) => {
          const time = apt.appointment_time.slice(0, 5);
          message += `  ❌ *${time}* - ${getPatientDisplay(apt)}\n`;
        });
        message += `\n`;
      }

      const activeCount = confirmed.length + awaiting.length + attended.length;
      message += `📊 *Resumo:* ${activeCount} atendimento(s) | ${confirmed.length} confirmado(s) | ${cancelled.length} cancelamento(s)\n`;
      message += `\n_Mensagem automática do Espaço Essentia_ ✔️`;

      // Send via WhatsApp
      let formattedPhone = prof.phone.replace(/\D/g, "");
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
        results.push({ professional: prof.name, shift: activeShift.name, success: response.ok, result });
      } catch (fetchError: any) {
        results.push({ professional: prof.name, shift: activeShift.name, success: false, error: fetchError.message });
      }
    }

    // Log the action
    await supabase.from("system_logs").insert({
      action: "shift_confirmations_sent",
      entity_type: "system",
      description: `Resumo do turno da ${activeShift.name} enviado para ${results.filter(r => r.success).length} profissionais`,
      metadata: { shift: activeShift.name, results },
    });

    return new Response(
      JSON.stringify({ success: true, shift: activeShift.name, sent: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending shift confirmations:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
