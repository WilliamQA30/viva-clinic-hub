-- Add new constraint for room values
ALTER TABLE public.appointments ADD CONSTRAINT appointments_modality_check 
CHECK (modality IS NULL OR modality IN ('Harmonia', 'Serenidade', 'Florescer', 'Online'));