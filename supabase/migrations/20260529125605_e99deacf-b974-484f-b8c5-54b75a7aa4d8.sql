-- Add referral_detail column for free-text complement to the standardized referral_source
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS referral_detail text;

-- Migrate existing free-text referral_source values into referral_detail,
-- and set referral_source to standardized 'outros' for all existing entries.
-- We only touch rows that currently have a non-empty referral_source AND
-- whose value is NOT already one of the new standardized slugs.
UPDATE public.patients
SET
  referral_detail = referral_source,
  referral_source = 'outros'
WHERE referral_source IS NOT NULL
  AND btrim(referral_source) <> ''
  AND referral_source NOT IN (
    'meta_ads','google_ads','indicacao_paciente','indicacao_profissional',
    'indicacao_medica','escola','empresa','passou_em_frente',
    'evento_palestra','material_impresso','outros'
  );