-- Add new status values for patient/professional absence
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('agendado', 'confirmado', 'atendido', 'cancelado', 'cliente_faltou', 'profissional_faltou'));

-- Add package tracking columns to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS is_package BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS package_session_number INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS package_total_sessions INTEGER DEFAULT NULL;

-- Create daily notes table for admin observations
CREATE TABLE IF NOT EXISTS public.daily_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_notes
CREATE POLICY "Allow authenticated users to view daily notes"
ON public.daily_notes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert daily notes"
ON public.daily_notes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update daily notes"
ON public.daily_notes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete daily notes"
ON public.daily_notes FOR DELETE TO authenticated USING (true);