-- Create junction table to support appointments with multiple patients (e.g. couple therapy)
CREATE TABLE public.appointment_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, patient_id)
);

CREATE INDEX idx_appointment_patients_appointment_id ON public.appointment_patients(appointment_id);
CREATE INDEX idx_appointment_patients_patient_id ON public.appointment_patients(patient_id);

ALTER TABLE public.appointment_patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view appointment patients"
ON public.appointment_patients
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert appointment patients"
ON public.appointment_patients
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update appointment patients"
ON public.appointment_patients
FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete appointment patients"
ON public.appointment_patients
FOR DELETE
USING (true);

-- Backfill existing appointments with their primary patient
INSERT INTO public.appointment_patients (appointment_id, patient_id)
SELECT id, patient_id
FROM public.appointments
ON CONFLICT (appointment_id, patient_id) DO NOTHING;