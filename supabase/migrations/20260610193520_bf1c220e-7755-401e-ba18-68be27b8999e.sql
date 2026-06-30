
-- Birthday automation settings (singleton row via key)
-- Reuse clinic_settings for simple config + new birthday_messages_log table

CREATE TABLE public.birthday_messages_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name text NOT NULL,
  phone text NOT NULL,
  sent_year int NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT true,
  error_message text,
  message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, sent_year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.birthday_messages_log TO authenticated;
GRANT ALL ON public.birthday_messages_log TO service_role;

ALTER TABLE public.birthday_messages_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view birthday logs"
  ON public.birthday_messages_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role inserts birthday logs"
  ON public.birthday_messages_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_birthday_log_patient_year ON public.birthday_messages_log(patient_id, sent_year);
CREATE INDEX idx_birthday_log_sent_at ON public.birthday_messages_log(sent_at DESC);

-- Seed default settings
INSERT INTO public.clinic_settings (key, value) VALUES
  ('birthday_message_enabled', 'true'),
  ('birthday_message_time', '09:00'),
  ('birthday_message_text', 'Olá, {nome},

Hoje é um dia especial e toda a nossa equipe quer celebrar com você!

Desejamos um feliz aniversário repleto de saúde, felicidade, sucesso e grandes realizações.

É um privilégio ter você conosco nessa jornada. Aproveite muito o seu dia!

Abraços,
Espaço Essentia')
ON CONFLICT (key) DO NOTHING;
