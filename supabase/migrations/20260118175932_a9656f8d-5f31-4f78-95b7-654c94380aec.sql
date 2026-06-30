-- Criar tabela de perfis de usuários
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'recepcionista' CHECK (role IN ('admin', 'profissional', 'recepcionista')),
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de profissionais
CREATE TABLE public.professionals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  cpf TEXT UNIQUE,
  phone TEXT,
  email TEXT,
  consultation_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  work_hours_start TIME NOT NULL DEFAULT '08:00',
  work_hours_end TIME NOT NULL DEFAULT '18:00',
  work_days TEXT[] DEFAULT ARRAY['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de pacientes
CREATE TABLE public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  birth_date DATE,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de consultas/agendamentos
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  type TEXT NOT NULL DEFAULT 'Consulta',
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'confirmado', 'atendido', 'cancelado')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de transações financeiras
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_time TIME NOT NULL DEFAULT CURRENT_TIME,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Professionals policies (authenticated users can read, admins can modify)
CREATE POLICY "Authenticated users can view professionals" ON public.professionals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert professionals" ON public.professionals
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update professionals" ON public.professionals
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete professionals" ON public.professionals
  FOR DELETE TO authenticated USING (true);

-- Patients policies (authenticated users can CRUD)
CREATE POLICY "Authenticated users can view patients" ON public.patients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert patients" ON public.patients
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update patients" ON public.patients
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete patients" ON public.patients
  FOR DELETE TO authenticated USING (true);

-- Appointments policies (authenticated users can CRUD)
CREATE POLICY "Authenticated users can view appointments" ON public.appointments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert appointments" ON public.appointments
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update appointments" ON public.appointments
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete appointments" ON public.appointments
  FOR DELETE TO authenticated USING (true);

-- Transactions policies (authenticated users can CRUD)
CREATE POLICY "Authenticated users can view transactions" ON public.transactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert transactions" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update transactions" ON public.transactions
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete transactions" ON public.transactions
  FOR DELETE TO authenticated USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_professionals_updated_at
  BEFORE UPDATE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create a profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();