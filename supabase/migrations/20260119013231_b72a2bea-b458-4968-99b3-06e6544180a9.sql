-- Add new columns to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS modality TEXT DEFAULT 'presencial' CHECK (modality IN ('online', 'presencial')),
ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito')),
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pendente' CHECK (payment_status IN ('pago', 'pendente'));

-- Add comments for documentation
COMMENT ON COLUMN public.appointments.modality IS 'Modalidade do atendimento: online ou presencial';
COMMENT ON COLUMN public.appointments.payment_method IS 'Forma de pagamento';
COMMENT ON COLUMN public.appointments.payment_status IS 'Status do pagamento: pago ou pendente';