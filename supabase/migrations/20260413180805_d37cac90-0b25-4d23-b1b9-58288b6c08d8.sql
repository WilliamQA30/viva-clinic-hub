
-- Create recurring_bills table
CREATE TABLE public.recurring_bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT,
  notes TEXT,
  payment_method TEXT,
  frequency TEXT NOT NULL DEFAULT 'mensal',
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_generated_date DATE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view recurring bills"
  ON public.recurring_bills FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert recurring bills"
  ON public.recurring_bills FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update recurring bills"
  ON public.recurring_bills FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete recurring bills"
  ON public.recurring_bills FOR DELETE TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_recurring_bills_updated_at
  BEFORE UPDATE ON public.recurring_bills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add recurring_bill_id to bills_to_pay
ALTER TABLE public.bills_to_pay
  ADD COLUMN recurring_bill_id UUID REFERENCES public.recurring_bills(id) ON DELETE SET NULL;
