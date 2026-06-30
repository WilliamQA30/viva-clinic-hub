-- Add new columns to appointments table for appointment mode, payment method, and payment status
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS appointment_mode text DEFAULT 'presencial' CHECK (appointment_mode IN ('presencial', 'online')),
ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'convenio', NULL)),
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pendente' CHECK (payment_status IN ('pendente', 'pago', 'parcial'));

-- Create table for professional schedule blocks (vacations, leaves, etc.)
CREATE TABLE IF NOT EXISTS public.professional_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  block_type TEXT NOT NULL DEFAULT 'ferias' CHECK (block_type IN ('ferias', 'folga', 'licenca', 'outro')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Enable RLS on professional_blocks
ALTER TABLE public.professional_blocks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for professional_blocks
CREATE POLICY "Authenticated users can view professional blocks" 
ON public.professional_blocks 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert professional blocks" 
ON public.professional_blocks 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update professional blocks" 
ON public.professional_blocks 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete professional blocks" 
ON public.professional_blocks 
FOR DELETE 
USING (true);

-- Create reminder_settings table for storing reminder configurations
CREATE TABLE IF NOT EXISTS public.reminder_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email')),
  hours_before INTEGER NOT NULL DEFAULT 24,
  message_template TEXT NOT NULL DEFAULT 'Olá {nome}, lembramos que você tem uma consulta agendada para {data} às {hora}. Confirme sua presença respondendo esta mensagem.',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on reminder_settings
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for reminder_settings
CREATE POLICY "Authenticated users can view reminder settings" 
ON public.reminder_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert reminder settings" 
ON public.reminder_settings 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update reminder settings" 
ON public.reminder_settings 
FOR UPDATE 
USING (true);

-- Insert default reminder settings
INSERT INTO public.reminder_settings (channel, hours_before, message_template, is_active)
VALUES ('whatsapp', 24, 'Olá {nome}, lembramos que você tem uma consulta agendada para {data} às {hora}. Confirme sua presença respondendo esta mensagem.', true)
ON CONFLICT DO NOTHING;