
-- 1. Create professional_shifts table (fixed weekly shifts per room)
CREATE TABLE public.professional_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  room TEXT NOT NULL,
  day_of_week TEXT NOT NULL,
  shift_period TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: only one professional per room+day+shift
ALTER TABLE public.professional_shifts ADD CONSTRAINT unique_room_day_shift UNIQUE (room, day_of_week, shift_period);

ALTER TABLE public.professional_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view shifts" ON public.professional_shifts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert shifts" ON public.professional_shifts FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update shifts" ON public.professional_shifts FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete shifts" ON public.professional_shifts FOR DELETE USING (true);

-- 2. Create clinic_settings table
CREATE TABLE public.clinic_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view settings" ON public.clinic_settings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert settings" ON public.clinic_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update settings" ON public.clinic_settings FOR UPDATE USING (true);

-- Insert default floor value per shift
INSERT INTO public.clinic_settings (key, value) VALUES ('floor_value_per_shift', '0');

-- 3. Add registration_date to professionals and patients
ALTER TABLE public.professionals ADD COLUMN registration_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.patients ADD COLUMN registration_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- 4. Create attachments table (references stored in DB, files in storage)
CREATE TABLE public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view attachments" ON public.attachments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert attachments" ON public.attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can delete attachments" ON public.attachments FOR DELETE USING (true);

-- 5. Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);

CREATE POLICY "Authenticated users can upload attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "Anyone can view attachments" ON storage.objects FOR SELECT USING (bucket_id = 'attachments');
CREATE POLICY "Authenticated users can delete attachments" ON storage.objects FOR DELETE USING (bucket_id = 'attachments');
