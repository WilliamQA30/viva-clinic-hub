# CRM de Pacientes — Plano de Implementação

Novo módulo paralelo ao existente "Pacientes". Nada da aba atual é alterado: cadastro, status Ativo/Inativo, agenda, histórico, anexos e edição continuam idênticos. Adicionamos uma camada de relacionamento.

## 1. Banco de dados (migration única)

**Novas colunas em `patients`:**
- `crm_status` text — valor calculado/manual (ver enum abaixo)
- `crm_status_locked` boolean default false — quando true, cálculo automático não sobrescreve
- `crm_status_updated_at` timestamptz
- `inactivation_reason` text — motivo padronizado
- `inactivation_reason_other` text — descrição livre quando motivo = "Outros"
- `inactivated_at` timestamptz
- `crm_tags` text[] default '{}'
- `crm_notes` text — observações de relacionamento (separadas do `notes` clínico)

**Função SQL `recompute_patient_crm_status(patient_id)`** — calcula o status com base em agendamentos:
- 0 agendamentos → `lead_novo`
- agendamentos mas 0 atendidos → `primeiro_agendamento`
- 1 atendido → `primeiro_atendimento`
- ≥2 atendidos + última ≤30d → `em_acompanhamento`
- 31–60d → `risco_abandono`
- 61–90d → `inativo_recente`
- 91–180d → `inativo_prolongado`
- >180d → `perdido`
- detecção de "faltas recorrentes" (≥3 status `Cliente Faltou` nos últimos 90 dias) — flag adicional via tag automática
- detecção de "pacote ativo" (appointment com `is_package=true` e sessões restantes) — flag via tag automática
- só sobrescreve se `crm_status_locked = false` e status atual ≠ `encerrado`

**Trigger** em `appointments` (insert/update/delete) que chama `recompute_patient_crm_status` para os pacientes afetados (via `appointment_patients` para casais).

**Job de backfill no fim da migration:**
- roda recompute para todos os pacientes
- para pacientes com `is_active=false` e sem `inactivation_reason` → seta `inactivation_reason='outros'` e `inactivated_at=updated_at`

GRANTs e RLS mantêm o padrão já usado em `patients`.

## 2. Menu lateral

Adiciona item **"CRM"** (ícone `HeartHandshake`) em `Sidebar.tsx`, rota `/crm`. Registra rota protegida em `App.tsx`.

## 3. Páginas/Componentes novos

```text
src/pages/CRM.tsx                            ← página principal
src/components/crm/
  CRMStatusBadge.tsx                         ← cor + label por status
  CRMKpiCards.tsx                            ← cards com contagem por status
  CRMFilters.tsx                             ← filtros (status CRM, ativo/inativo, motivo, profissional, origem, dias sem consulta, tags)
  CRMPatientTable.tsx                        ← tabela com nome/telefone/profissional/última consulta/qtd/status CRM/ativo/motivo/tags
  CRMPatientDetailDialog.tsx                 ← visualização + edição rápida (status CRM, lock, tags, motivo, observações)
  InactivationReasonDialog.tsx               ← dialog obrigatório ao inativar
src/lib/crm.ts                               ← constantes (lista de status, cores, lista de motivos, tags sugeridas) + helpers
```

## 4. Integração com fluxo de inativação existente

Quando o usuário desmarca "Ativo" no `PatientEditDialog`, abrir `InactivationReasonDialog` antes de salvar. Salva motivo + `inactivated_at` junto. Reativar limpa o motivo. **Nada mais muda no PatientEditDialog**.

## 5. Status CRM — comportamento

- Recalculado automaticamente via trigger ao mexer em consultas
- Editável manualmente no detalhe do CRM (select)
- Checkbox "Fixar status manualmente" → seta `crm_status_locked`
- Tags "Faltas recorrentes" e "Pacote ativo" são automáticas (recomputadas), demais tags são livres/manuais

## 6. Filtros do CRM

Status CRM • Ativo/Inativo • Motivo inativação • Profissional (via última consulta) • Origem (`referral_source`) • Período última consulta • "Sem agendamento" • "X dias sem consulta" • Tags (multi-select)

## 7. Observações de relacionamento

Campo `crm_notes` editável só no dialog do CRM. Não aparece no cadastro clínico.

## 8. Não inclui

- Disparos automáticos / WhatsApp / e-mail
- Alteração da aba Pacientes (apenas adicionamos o passo do motivo de inativação ao editar)
- Exportações (vetadas no projeto)

## Validação final

- Build limpo
- Backfill aplica "Outros" aos inativos existentes
- Recompute roda para toda a base
- Smoke check: criar paciente → vira `lead_novo`; agendar → `primeiro_agendamento`; etc.
- Confirmar que Agenda, Histórico, Anexos seguem funcionando (sem mudanças nesses arquivos)
