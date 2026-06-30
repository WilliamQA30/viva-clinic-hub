import { supabase } from "@/integrations/supabase/client";

interface Recipient {
  phone: string;
  name: string;
}

interface SendAppointmentMessageParams {
  /** All patient names involved in the appointment (for message body) */
  patientNames: string[];
  /** Recipients to send the message to (one message per recipient) */
  recipients: Recipient[];
  professionalName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentId: string;
  type: "scheduled" | "confirmed" | "reminder" | "cancelled" | "rescheduled";
  appointmentType?: string;
}

/**
 * Format a list of names into natural language: "A", "A e B", "A, B e C".
 */
function formatNameList(names: string[]): string {
  const clean = names.filter(Boolean);
  if (clean.length === 0) return "Paciente";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} e ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} e ${clean[clean.length - 1]}`;
}

export async function sendAppointmentWhatsApp(params: SendAppointmentMessageParams) {
  const {
    patientNames,
    recipients,
    professionalName,
    appointmentDate,
    appointmentTime,
    appointmentId,
    type,
    appointmentType = "Psicoterapia",
  } = params;

  const [year, month, day] = appointmentDate.split("-").map(Number);
  const formattedDate = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
  const formattedTime = appointmentTime.slice(0, 5);
  const namesDisplay = formatNameList(patientNames);
  const isMulti = patientNames.filter(Boolean).length > 1;
  const nameLabel = isMulti ? "Nomes" : "Nome";

  const buildMessage = (): string => {
    let message = "";
    switch (type) {
      case "scheduled":
      case "confirmed":
      case "rescheduled":
        message = `*ESPAÇO ESSENTIA*\n\n`;
        message +=
          type === "rescheduled"
            ? `Reagendamento de sessão.\n\n`
            : `Confirmação de agendamento.\n\n`;
        message += `● ${nameLabel}: ${namesDisplay}\n`;
        message += `● Procedimento: ${appointmentType}\n`;
        message += `● Profissional: ${professionalName}\n`;
        message += `● Horário Marcado: Dia ${formattedDate} às ${formattedTime}.\n\n`;
        message += `📍 Local: Espaço Essentia | Rua Maestro Quincas Bezerril, N° 333 - 2 andar, sala 202, Centro - Tianguá-CE\n\n`;
        message += `✅ As sessões são pagas em pix ou espécie, antes de iniciar a sessão.\n\n`;
        message += `🟩 ${isMulti ? "Podem confirmar a sessão" : "Podemos confirmar a sua sessão"}?\n\n`;
        message += `EM CASO DE DESISTÊNCIA, AVISAR COM ANTECEDÊNCIA\n\n`;
        message += `Atenciosamente,\n\nEspaço Essentia`;
        break;

      case "reminder":
        message = `*ESPAÇO ESSENTIA*\n\n`;
        message += `Lembrete de sessão.\n\n`;
        message += `● ${nameLabel}: ${namesDisplay}\n`;
        message += `● Procedimento: ${appointmentType}\n`;
        message += `● Profissional: ${professionalName}\n`;
        message += `● Horário Marcado: Dia ${formattedDate} às ${formattedTime}.\n\n`;
        message += `📍 Local: Espaço Essentia | Rua Maestro Quincas Bezerril, N° 333 - 2 andar, sala 202, Centro - Tianguá-CE\n\n`;
        message += `🟩 ${isMulti ? "Podem confirmar a sessão" : "Podemos confirmar a sua sessão"}?\n\n`;
        message += `EM CASO DE DESISTÊNCIA, AVISAR COM ANTECEDÊNCIA\n\n`;
        message += `Atenciosamente,\n\nEspaço Essentia`;
        break;

      case "cancelled":
        message = `*ESPAÇO ESSENTIA*\n\n`;
        message += `Cancelamento do agendamento.\n\n`;
        message += `● ${nameLabel}: ${namesDisplay}\n`;
        message += `● Profissional: ${professionalName}\n`;
        message += `● Horário Marcado: Dia ${formattedDate} às ${formattedTime}.\n\n`;
        message += `Passando para informar que ${isMulti ? "a sessão de vocês foi cancelada" : "a sua sessão foi cancelada"}. Para reagendar, entre em contato conosco!\n\n`;
        message += `Atenciosamente,\n\nEspaço Essentia`;
        break;
    }
    return message;
  };

  const message = buildMessage();
  const uniqueRecipients = recipients.filter(
    (r, idx, arr) => r.phone && arr.findIndex((x) => x.phone === r.phone) === idx
  );

  const results = await Promise.all(
    uniqueRecipients.map(async (recipient) => {
      try {
        const { data, error } = await supabase.functions.invoke("send-whatsapp", {
          body: {
            phone: recipient.phone,
            message,
            appointmentId,
            patientName: recipient.name,
          },
        });
        if (error) throw error;
        return { phone: recipient.phone, success: true, data };
      } catch (error) {
        console.error("Error sending WhatsApp to", recipient.phone, error);
        return { phone: recipient.phone, success: false, error };
      }
    })
  );

  return { success: results.every((r) => r.success), results };
}
