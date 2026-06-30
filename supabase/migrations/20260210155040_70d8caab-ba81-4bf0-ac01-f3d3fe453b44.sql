ALTER TABLE public.professional_payments 
ADD COLUMN payment_destination text NOT NULL DEFAULT 'clinic';

COMMENT ON COLUMN public.professional_payments.payment_destination IS 'clinic = patient paid clinic, professional = patient paid professional directly';