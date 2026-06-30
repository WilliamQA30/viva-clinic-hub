export const CRM_STATUSES = [
  { value: "lead_novo", label: "Lead Novo", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "primeiro_agendamento", label: "Primeiro Agendamento", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "primeiro_atendimento", label: "Primeiro Atendimento", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { value: "em_acompanhamento", label: "Em acompanhamento", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "risco_abandono", label: "Risco de abandono", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "inativo_recente", label: "Inativo recente", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "inativo_prolongado", label: "Inativo prolongado", color: "bg-rose-100 text-rose-700 border-rose-200" },
  { value: "perdido", label: "Perdido", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "encerrado", label: "Encerrado", color: "bg-zinc-200 text-zinc-700 border-zinc-300" },
] as const;

export type CrmStatusValue = typeof CRM_STATUSES[number]["value"];

export const getCrmStatusMeta = (value?: string | null) =>
  CRM_STATUSES.find((s) => s.value === value) ?? {
    value: value ?? "lead_novo",
    label: value ?? "Lead Novo",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  };

export const INACTIVATION_REASONS = [
  { value: "sem_retorno", label: "Sem retorno após contato" },
  { value: "nao_respondeu", label: "Não respondeu mensagens" },
  { value: "financeiro", label: "Dificuldade financeira" },
  { value: "horarios", label: "Incompatibilidade de horários" },
  { value: "mudanca_cidade", label: "Mudança de cidade" },
  { value: "outro_local", label: "Iniciou acompanhamento em outro local" },
  { value: "nao_identificou", label: "Não se identificou com o profissional" },
  { value: "alta", label: "Alta terapêutica" },
  { value: "pausa", label: "Pausa temporária" },
  { value: "desistencia", label: "Desistência do tratamento" },
  { value: "faltas", label: "Faltas recorrentes" },
  { value: "encaminhamento", label: "Encaminhamento para outro serviço" },
  { value: "pessoal", label: "Motivo pessoal/familiar" },
  { value: "outros", label: "Outros" },
] as const;

export const getReasonLabel = (value?: string | null) =>
  INACTIVATION_REASONS.find((r) => r.value === value)?.label ?? (value ?? "—");

export const SUGGESTED_TAGS = [
  "Prioritário",
  "Reativar",
  "Alta chance de retorno",
  "Baixa chance de retorno",
  "Terapia de casal",
  "Infantil/adolescente",
  "Indicação",
  "Instagram",
] as const;

// Auto tags (managed by DB trigger). Internal slugs:
export const AUTO_TAGS: Record<string, string> = {
  faltas_recorrentes: "Faltas frequentes",
  pacote_ativo: "Pacote ativo",
};

export const tagDisplay = (tag: string) => AUTO_TAGS[tag] ?? tag;
export const isAutoTag = (tag: string) => tag in AUTO_TAGS;

// Padronização de Origem de Aquisição (campo `referral_source`)
export const REFERRAL_SOURCES = [
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "indicacao_paciente", label: "Indicação de Paciente" },
  { value: "indicacao_profissional", label: "Indicação de Profissional" },
  { value: "indicacao_medica", label: "Indicação Médica" },
  { value: "instagram", label: "Instagram" },
  { value: "escola", label: "Escola" },
  { value: "empresa", label: "Empresa" },
  { value: "passou_em_frente", label: "Passou em Frente à Clínica" },
  { value: "evento_palestra", label: "Evento/Palestra" },
  { value: "material_impresso", label: "Material Impresso" },
  { value: "outros", label: "Outros" },
] as const;

export type ReferralSourceValue = typeof REFERRAL_SOURCES[number]["value"];

export const getReferralSourceLabel = (value?: string | null) =>
  REFERRAL_SOURCES.find((r) => r.value === value)?.label ?? (value ?? "—");
