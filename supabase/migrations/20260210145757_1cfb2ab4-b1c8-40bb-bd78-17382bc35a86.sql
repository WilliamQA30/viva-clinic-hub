
-- Novos campos para profissionais
ALTER TABLE public.professionals
ADD COLUMN IF NOT EXISTS crp text,
ADD COLUMN IF NOT EXISTS mini_curriculum text,
ADD COLUMN IF NOT EXISTS education text,
ADD COLUMN IF NOT EXISTS target_audience text,
ADD COLUMN IF NOT EXISTS approach text,
ADD COLUMN IF NOT EXISTS services text[],
ADD COLUMN IF NOT EXISTS address text;

-- Novos campos para pacientes
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS referral_source text,
ADD COLUMN IF NOT EXISTS emergency_contact text;

-- Tabela de contas a pagar
CREATE TABLE public.bills_to_pay (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description text NOT NULL,
  amount numeric NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  payment_method text,
  paid_at timestamp with time zone,
  category text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.bills_to_pay ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bills" ON public.bills_to_pay FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert bills" ON public.bills_to_pay FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update bills" ON public.bills_to_pay FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete bills" ON public.bills_to_pay FOR DELETE USING (true);

CREATE TRIGGER update_bills_to_pay_updated_at
BEFORE UPDATE ON public.bills_to_pay
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
