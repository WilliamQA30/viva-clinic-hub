-- Add is_approved column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false;

-- Update existing users to be approved
UPDATE public.profiles SET is_approved = true WHERE is_approved IS NULL OR is_approved = false;

-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'suporte.codxis@gmail.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_user_approved()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND is_approved = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new policies for profiles
-- Users can view their own profile
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own profile (for signup)
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile (but not is_approved)
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Super admin can view all profiles
CREATE POLICY "Super admin can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_super_admin());

-- Super admin can update all profiles (for approval)
CREATE POLICY "Super admin can update all profiles" ON public.profiles
  FOR UPDATE USING (public.is_super_admin());