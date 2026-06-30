ALTER TABLE public.recurring_bills
ADD COLUMN IF NOT EXISTS skipped_periods date[] NOT NULL DEFAULT '{}';