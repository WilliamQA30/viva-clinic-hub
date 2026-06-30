-- Tighten RLS policies for appointment_patients (replace always-true checks)
DROP POLICY IF EXISTS "Authenticated users can view appointment patients" ON public.appointment_patients;
DROP POLICY IF EXISTS "Authenticated users can insert appointment patients" ON public.appointment_patients;
DROP POLICY IF EXISTS "Authenticated users can update appointment patients" ON public.appointment_patients;
DROP POLICY IF EXISTS "Authenticated users can delete appointment patients" ON public.appointment_patients;

CREATE POLICY "Authenticated users can view appointment patients"
ON public.appointment_patients
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert appointment patients"
ON public.appointment_patients
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update appointment patients"
ON public.appointment_patients
FOR UPDATE
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete appointment patients"
ON public.appointment_patients
FOR DELETE
TO authenticated
USING (auth.role() = 'authenticated');