
-- Add billing_day and due_day columns to recurring_bills
ALTER TABLE public.recurring_bills
  ADD COLUMN IF NOT EXISTS billing_day integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS due_day integer NOT NULL DEFAULT 10;

-- Migrate existing data: extract day from start_date as both billing_day and due_day
UPDATE public.recurring_bills
SET billing_day = EXTRACT(DAY FROM start_date)::integer,
    due_day = EXTRACT(DAY FROM start_date)::integer,
    frequency = 'mensal';
