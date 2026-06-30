-- Add consultation value and clinic percentage to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS consultation_value DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS clinic_percentage INTEGER DEFAULT 30;

-- Create table for professional payments tracking
CREATE TABLE public.professional_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID REFERENCES public.professionals(id) NOT NULL,
  appointment_id UUID REFERENCES public.appointments(id) NOT NULL,
  total_value DECIMAL(10,2) NOT NULL,
  professional_amount DECIMAL(10,2) NOT NULL,
  clinic_amount DECIMAL(10,2) NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.professional_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations on professional_payments" 
ON public.professional_payments FOR ALL USING (true) WITH CHECK (true);

-- Add comments
COMMENT ON TABLE public.professional_payments IS 'Controle de pagamentos devidos aos profissionais';
COMMENT ON COLUMN public.appointments.consultation_value IS 'Valor total da consulta';
COMMENT ON COLUMN public.appointments.clinic_percentage IS 'Porcentagem que fica com a clínica';