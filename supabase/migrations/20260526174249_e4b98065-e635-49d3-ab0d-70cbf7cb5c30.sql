
-- 1) New CRM columns on patients
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS crm_status text,
  ADD COLUMN IF NOT EXISTS crm_status_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS crm_status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS inactivation_reason text,
  ADD COLUMN IF NOT EXISTS inactivation_reason_other text,
  ADD COLUMN IF NOT EXISTS inactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS crm_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS crm_notes text;

CREATE INDEX IF NOT EXISTS idx_patients_crm_status ON public.patients(crm_status);
CREATE INDEX IF NOT EXISTS idx_patients_inactivation_reason ON public.patients(inactivation_reason);

-- 2) Recompute function
CREATE OR REPLACE FUNCTION public.recompute_patient_crm_status(_patient_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked boolean;
  v_current text;
  v_total_appts int;
  v_attended int;
  v_last_attended date;
  v_days int;
  v_new_status text;
  v_no_show_count int;
  v_has_active_package boolean;
  v_tags text[];
BEGIN
  SELECT crm_status_locked, crm_status INTO v_locked, v_current
  FROM public.patients WHERE id = _patient_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- count appointments via appointment_patients (couples) + direct patient_id
  SELECT COUNT(*) INTO v_total_appts
  FROM public.appointments a
  WHERE (a.patient_id = _patient_id
         OR EXISTS (SELECT 1 FROM public.appointment_patients ap WHERE ap.appointment_id = a.id AND ap.patient_id = _patient_id))
    AND a.status <> 'cancelado';

  SELECT COUNT(*), MAX(a.appointment_date)
    INTO v_attended, v_last_attended
  FROM public.appointments a
  WHERE (a.patient_id = _patient_id
         OR EXISTS (SELECT 1 FROM public.appointment_patients ap WHERE ap.appointment_id = a.id AND ap.patient_id = _patient_id))
    AND a.status IN ('atendido','realizado','concluido','concluído');

  SELECT COUNT(*) INTO v_no_show_count
  FROM public.appointments a
  WHERE (a.patient_id = _patient_id
         OR EXISTS (SELECT 1 FROM public.appointment_patients ap WHERE ap.appointment_id = a.id AND ap.patient_id = _patient_id))
    AND a.status IN ('Cliente Faltou','cliente_faltou','faltou')
    AND a.appointment_date >= (CURRENT_DATE - INTERVAL '90 days');

  SELECT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE (a.patient_id = _patient_id
           OR EXISTS (SELECT 1 FROM public.appointment_patients ap WHERE ap.appointment_id = a.id AND ap.patient_id = _patient_id))
      AND a.is_package = true
      AND a.package_total_sessions IS NOT NULL
      AND COALESCE(a.package_session_number,0) < a.package_total_sessions
  ) INTO v_has_active_package;

  IF v_attended = 0 THEN
    IF v_total_appts = 0 THEN
      v_new_status := 'lead_novo';
    ELSE
      v_new_status := 'primeiro_agendamento';
    END IF;
  ELSIF v_attended = 1 THEN
    v_new_status := 'primeiro_atendimento';
  ELSE
    v_days := CURRENT_DATE - v_last_attended;
    IF v_days <= 30 THEN v_new_status := 'em_acompanhamento';
    ELSIF v_days <= 60 THEN v_new_status := 'risco_abandono';
    ELSIF v_days <= 90 THEN v_new_status := 'inativo_recente';
    ELSIF v_days <= 180 THEN v_new_status := 'inativo_prolongado';
    ELSE v_new_status := 'perdido';
    END IF;
  END IF;

  -- recompute auto tags (preserve manual tags, replace only auto ones)
  SELECT COALESCE(array_agg(t), '{}') INTO v_tags
  FROM (
    SELECT unnest(crm_tags) AS t FROM public.patients WHERE id = _patient_id
  ) sub
  WHERE t NOT IN ('faltas_recorrentes','pacote_ativo');

  IF v_no_show_count >= 3 THEN
    v_tags := array_append(v_tags, 'faltas_recorrentes');
  END IF;
  IF v_has_active_package THEN
    v_tags := array_append(v_tags, 'pacote_ativo');
  END IF;

  IF v_locked OR v_current = 'encerrado' THEN
    UPDATE public.patients
      SET crm_tags = v_tags
    WHERE id = _patient_id;
  ELSE
    UPDATE public.patients
      SET crm_status = v_new_status,
          crm_status_updated_at = now(),
          crm_tags = v_tags
    WHERE id = _patient_id;
  END IF;
END;
$$;

-- 3) Trigger on appointments
CREATE OR REPLACE FUNCTION public.trg_recompute_crm_on_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.patient_id IS NOT NULL THEN
      PERFORM public.recompute_patient_crm_status(OLD.patient_id);
    END IF;
    FOR v_pid IN SELECT patient_id FROM public.appointment_patients WHERE appointment_id = OLD.id LOOP
      PERFORM public.recompute_patient_crm_status(v_pid);
    END LOOP;
    RETURN OLD;
  ELSE
    IF NEW.patient_id IS NOT NULL THEN
      PERFORM public.recompute_patient_crm_status(NEW.patient_id);
    END IF;
    FOR v_pid IN SELECT patient_id FROM public.appointment_patients WHERE appointment_id = NEW.id LOOP
      PERFORM public.recompute_patient_crm_status(v_pid);
    END LOOP;
    IF TG_OP = 'UPDATE' AND OLD.patient_id IS DISTINCT FROM NEW.patient_id AND OLD.patient_id IS NOT NULL THEN
      PERFORM public.recompute_patient_crm_status(OLD.patient_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS appointments_recompute_crm ON public.appointments;
CREATE TRIGGER appointments_recompute_crm
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_crm_on_appointment();

CREATE OR REPLACE FUNCTION public.trg_recompute_crm_on_appointment_patient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_patient_crm_status(OLD.patient_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_patient_crm_status(NEW.patient_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS appointment_patients_recompute_crm ON public.appointment_patients;
CREATE TRIGGER appointment_patients_recompute_crm
AFTER INSERT OR UPDATE OR DELETE ON public.appointment_patients
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_crm_on_appointment_patient();

-- 4) Backfill: inactivation reason for already-inactive patients
UPDATE public.patients
SET inactivation_reason = 'outros',
    inactivated_at = COALESCE(inactivated_at, updated_at)
WHERE is_active = false AND inactivation_reason IS NULL;

-- 5) Backfill: recompute CRM status for all patients
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.patients LOOP
    PERFORM public.recompute_patient_crm_status(r.id);
  END LOOP;
END$$;
