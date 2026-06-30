-- Remove the old modality check constraint FIRST
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_modality_check;