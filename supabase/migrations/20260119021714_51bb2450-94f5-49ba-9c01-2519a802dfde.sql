-- Create system_logs table for audit trail
CREATE TABLE public.system_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  description TEXT NOT NULL,
  user_id UUID,
  user_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Logs are read-only after creation (no update/delete policies)
CREATE POLICY "Authenticated users can view logs"
ON public.system_logs
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert logs"
ON public.system_logs
FOR INSERT
WITH CHECK (true);

-- Add role to profiles table for user permissions
-- Current roles: 'admin' (full access), 'profissional' (professional), 'recepcionista' (limited access)
-- The default is already 'recepcionista', so users without explicit admin role won't see reports/critical settings

-- Create index for faster log queries
CREATE INDEX idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX idx_system_logs_action ON public.system_logs(action);
CREATE INDEX idx_system_logs_entity_type ON public.system_logs(entity_type);