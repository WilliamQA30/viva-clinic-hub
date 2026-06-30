-- Add no_show_charged flag to track whether the professional charged for a no-show
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS no_show_charged BOOLEAN NOT NULL DEFAULT false;

-- Retroactive: existing 'cliente_faltou' that already have financial impact → mark as charged
UPDATE public.appointments a
SET no_show_charged = true
WHERE a.status = 'cliente_faltou'
  AND (
    a.payment_status = 'pago'
    OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.appointment_id = a.id)
    OR EXISTS (SELECT 1 FROM public.professional_payments pp WHERE pp.appointment_id = a.id AND pp.is_paid = true)
  );

-- For the remaining cliente_faltou (no charge): clean up orphan unpaid pendencies
DELETE FROM public.professional_payments
WHERE is_paid = false
  AND appointment_id IN (
    SELECT id FROM public.appointments
    WHERE status = 'cliente_faltou' AND no_show_charged = false
  );

-- Reset payment_status of those legacy not-charged no-shows to remove them from "pendente" totals
UPDATE public.appointments
SET payment_status = NULL, payment_method = NULL
WHERE status = 'cliente_faltou' AND no_show_charged = false AND payment_status = 'pendente';