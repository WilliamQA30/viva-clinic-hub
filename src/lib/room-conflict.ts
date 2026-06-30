import { supabase } from "@/integrations/supabase/client";

interface ConflictCheckParams {
  room: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  excludeAppointmentId?: string;
}

interface Appointment {
  id: string;
  appointment_time: string;
  duration_minutes: number | null;
}

/**
 * Converts time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Checks if two time ranges overlap
 */
function rangesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Checks for room conflicts on a specific date
 * Returns the conflicting appointment if found, null otherwise
 */
export async function checkRoomConflict(
  params: ConflictCheckParams
): Promise<{ hasConflict: boolean; conflictingTime?: string }> {
  const { room, date, startTime, durationMinutes, excludeAppointmentId } = params;

  // Get all appointments for this room and date that are not cancelled
  let query = supabase
    .from("appointments")
    .select("id, appointment_time, duration_minutes")
    .eq("modality", room)
    .eq("appointment_date", date)
    .neq("status", "cancelado");

  // Exclude the current appointment if editing
  if (excludeAppointmentId) {
    query = query.neq("id", excludeAppointmentId);
  }

  const { data: existingAppointments, error } = await query;

  if (error) {
    console.error("Error checking room conflicts:", error);
    throw new Error("Erro ao verificar conflitos de horário");
  }

  if (!existingAppointments || existingAppointments.length === 0) {
    return { hasConflict: false };
  }

  const newStartMinutes = timeToMinutes(startTime);
  const newEndMinutes = newStartMinutes + durationMinutes;

  for (const existing of existingAppointments as Appointment[]) {
    const existingStartMinutes = timeToMinutes(existing.appointment_time);
    const existingDuration = existing.duration_minutes || 50;
    const existingEndMinutes = existingStartMinutes + existingDuration;

    if (rangesOverlap(newStartMinutes, newEndMinutes, existingStartMinutes, existingEndMinutes)) {
      return {
        hasConflict: true,
        conflictingTime: existing.appointment_time.slice(0, 5),
      };
    }
  }

  return { hasConflict: false };
}
