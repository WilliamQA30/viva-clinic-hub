-- Normalize stored room values to lowercase and relax constraint to be case-insensitive
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_modality_check;

UPDATE public.appointments
SET modality = lower(modality)
WHERE modality IS NOT NULL;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_modality_check
CHECK (modality IS NULL OR lower(modality) IN ('harmonia','serenidade','florescer','online'));