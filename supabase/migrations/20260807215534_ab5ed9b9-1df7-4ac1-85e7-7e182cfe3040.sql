ALTER TABLE public.professional_payments
  ADD COLUMN IF NOT EXISTS payment_splits jsonb;

COMMENT ON COLUMN public.professional_payments.payment_splits IS
  'Array de {method: text, amount: number} quando a quitacao foi dividida em varias formas de pagamento. NULL quando forma unica.';