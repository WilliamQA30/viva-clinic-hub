import { supabase } from "@/integrations/supabase/client";

export interface AppointmentPatientInfo {
  id: string;
  name: string;
  phone: string | null;
}

/**
 * Fetch all patients linked to an appointment (supports couples/family therapy).
 * Falls back to the single `patient_id` on the appointment if no records exist
 * in `appointment_patients` yet.
 */
export async function fetchAppointmentPatients(
  appointmentId: string,
  fallbackPatientId?: string | null
): Promise<AppointmentPatientInfo[]> {
  const { data: linked } = await supabase
    .from("appointment_patients" as any)
    .select("patient_id, patients (id, name, phone)")
    .eq("appointment_id", appointmentId);

  const fromLinks = (linked || [])
    .map((row: any) => row.patients)
    .filter(Boolean)
    .map((p: any) => ({ id: p.id, name: p.name, phone: p.phone ?? null }));

  if (fromLinks.length > 0) return fromLinks;

  if (fallbackPatientId) {
    const { data: patient } = await supabase
      .from("patients")
      .select("id, name, phone")
      .eq("id", fallbackPatientId)
      .single();
    if (patient) return [{ id: patient.id, name: patient.name, phone: patient.phone ?? null }];
  }

  return [];
}
