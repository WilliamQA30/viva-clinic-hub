import { supabase } from "@/integrations/supabase/client";

type ChangeType = "added" | "edited" | "cancelled";

interface NotifyProfessionalAgendaParams {
  professionalId: string;
  professionalName: string;
  date: string;
  changeType: ChangeType;
  changeDescription: string;
}

const changeLabels: Record<ChangeType, string> = {
  added: "📌 *Nova consulta adicionada*",
  edited: "✏️ *Consulta alterada*",
  cancelled: "❌ *Consulta cancelada*",
};

export async function notifyProfessionalAgendaChange({
  professionalId,
  professionalName,
  date,
  changeType,
  changeDescription,
}: NotifyProfessionalAgendaParams) {
  try {
    console.log("[NotifyProfessional] Starting notification for:", professionalName, "date:", date, "changeType:", changeType);
    
    // Get professional phone
    const { data: professional, error: profError } = await supabase
      .from("professionals")
      .select("phone")
      .eq("id", professionalId)
      .single();

    console.log("[NotifyProfessional] Professional phone lookup:", { phone: professional?.phone, error: profError?.message });

    if (!professional?.phone) return { success: false, error: "No phone" };

    // Get all appointments for that day
    const { data: appointments } = await supabase
      .from("appointments")
      .select(`
        appointment_time,
        type,
        status,
        is_package,
        package_session_number,
        package_total_sessions,
        patients (name),
        appointment_patients (patient_id, patients (name))
      `)
      .eq("professional_id", professionalId)
      .eq("appointment_date", date)
      .neq("status", "cancelado")
      .order("appointment_time", { ascending: true });

    // Helper to get all patient names
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

    const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    let message = `📋 *Atualização na Agenda - ${formattedDate}*\n\n`;
    message += `Olá, ${professionalName.split(" ")[0]}!\n\n`;
    message += `${changeLabels[changeType]}\n`;
    message += `${changeDescription}\n\n`;

    if (appointments && appointments.length > 0) {
      message += `*Agenda atualizada do dia:*\n\n`;
      appointments.forEach((apt: any) => {
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
        } else {
          statusEmoji = "🕐";
          statusLabel = "";
        }
        message += `${statusEmoji} *${time}* - ${patientDisplay} (${apt.type})${statusLabel}\n`;
      });
      message += `\nTotal: ${appointments.length} atendimento(s)`;
    } else {
      message += `Você não possui mais atendimentos para este dia.`;
    }

    message += `\n\n_Por favor, responda "OK" para confirmar o recebimento._ ✔️`;

    console.log("[NotifyProfessional] Sending WhatsApp to:", professional.phone, "message length:", message.length);

    // Send via edge function
    const { data: sendData, error } = await supabase.functions.invoke("send-whatsapp", {
      body: {
        phone: professional.phone,
        message,
        appointmentId: null,
        patientName: professionalName,
      },
    });

    console.log("[NotifyProfessional] WhatsApp result:", { sendData, error: error?.message });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error notifying professional agenda:", error);
    return { success: false, error };
  }
}
