/**
 * Motor único de regras de negócio.
 *
 * Fonte da verdade para Dashboard, Financeiro e Relatórios.
 * Regras acordadas com o usuário (jun/2026):
 *  - Faturamento RECEBIDO  → soma de `transactions.type='entrada'` no período (caixa).
 *  - Faturamento PRODUZIDO → soma de `professional_payments.total_value` cujas
 *    consultas tenham status realizado (`atendido`/`concluido`/`concluído`).
 *  - Consulta REALIZADA    → status ∈ {atendido, concluido, concluído}.
 *    Confirmado sozinho NÃO conta. Faltas NÃO contam.
 *  - Piso do profissional  → comparar contra a comissão da clínica
 *    EFETIVAMENTE RECEBIDA no mês (ver `isClinicCommissionReceived`).
 *
 * Não altere estes valores sem alinhar com o usuário — eles refletem
 * decisão de negócio e qualquer mudança quebra a conferência histórica.
 */

export type AppointmentStatus =
  | "agendado"
  | "confirmado"
  | "atendido"
  | "concluido"
  | "concluído"
  | "cancelado"
  | "Cliente Faltou"
  | "cliente_faltou"
  | "faltou"
  | "Profissional Faltou"
  | "profissional_faltou";

/** Status que contam como "consulta realizada". */
export const REALIZED_STATUSES: ReadonlySet<string> = new Set([
  "atendido",
  "concluido",
  "concluído",
]);

/** Status que indicam falta (não conta para piso/quantidade). */
export const NO_SHOW_STATUSES: ReadonlySet<string> = new Set([
  "Cliente Faltou",
  "cliente_faltou",
  "faltou",
  "Profissional Faltou",
  "profissional_faltou",
]);

/** Status que mantêm registro financeiro vivo (não cancelado). */
export const ACTIVE_FINANCIAL_STATUSES: ReadonlySet<string> = new Set([
  "agendado",
  "confirmado",
  "atendido",
  "concluido",
  "concluído",
]);

const norm = (s: unknown) => String(s ?? "").trim();

export const isRealized = (status: unknown): boolean =>
  REALIZED_STATUSES.has(norm(status));

export const isCanceled = (status: unknown): boolean =>
  norm(status) === "cancelado";

export const isNoShow = (status: unknown): boolean =>
  NO_SHOW_STATUSES.has(norm(status));

export const countsForFinancial = (status: unknown): boolean =>
  ACTIVE_FINANCIAL_STATUSES.has(norm(status));

/* ------------------------------------------------------------------ */
/* Faturamento                                                         */
/* ------------------------------------------------------------------ */

export interface TransactionLike {
  amount: number | string | null;
  type?: string | null;
}

/** Receita RECEBIDA (caixa) — soma de entradas em transactions. */
export const sumReceivedRevenue = (txs: TransactionLike[] | null | undefined): number =>
  (txs ?? [])
    .filter((t) => t.type === "entrada")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

export interface PaymentLike {
  total_value?: number | string | null;
  clinic_amount?: number | string | null;
  professional_amount?: number | string | null;
  is_paid?: boolean | null;
  payment_destination?: string | null;
  appointments?: { status?: string | null; appointment_date?: string | null } | null;
}

/** Receita PRODUZIDA — total_value de pagamentos cujas consultas foram realizadas. */
export const sumProducedRevenue = (payments: PaymentLike[] | null | undefined): number =>
  (payments ?? [])
    .filter((p) => isRealized(p.appointments?.status))
    .reduce((sum, p) => sum + Number(p.total_value || 0), 0);

/* ------------------------------------------------------------------ */
/* Piso (comissão da clínica EFETIVAMENTE recebida)                    */
/* ------------------------------------------------------------------ */

/**
 * Regra: a parte da clínica em um payment é considerada recebida quando:
 *  - foi paga diretamente no caixa da clínica (`payment_destination = 'clinic'`), OU
 *  - foi recebida pelo profissional e este já repassou (`is_paid = true`).
 * Pagamentos de consultas canceladas NÃO contam.
 */
export const isClinicCommissionReceived = (p: PaymentLike): boolean => {
  if (isCanceled(p.appointments?.status)) return false;
  const dest = norm(p.payment_destination).toLowerCase();
  if (dest === "clinic" || dest === "clinica" || dest === "clínica") return true;
  if (dest === "professional" || dest === "profissional") return p.is_paid === true;
  // Sem destination definido: trata como recebido somente se is_paid=true.
  return p.is_paid === true;
};

/** Soma a comissão da clínica EFETIVAMENTE recebida. Base para piso. */
export const sumReceivedClinicCommission = (
  payments: PaymentLike[] | null | undefined,
): number =>
  (payments ?? [])
    .filter(isClinicCommissionReceived)
    .reduce((sum, p) => sum + Number(p.clinic_amount || 0), 0);

export interface DirectEntryLike {
  professional_id?: string | null;
  amount: number | string | null;
  appointment_id?: string | null;
  /** "YYYY-MM-DD" — dia real do caixa, não necessariamente o mês que a
   * entrada quita (ver reference_month). */
  transaction_date: string;
  /** "YYYY-MM" — mês de piso que esta entrada manual quita, desacoplado
   * de transaction_date. NULL em registros antigos, anteriores a essa
   * coluna existir. */
  reference_month?: string | null;
}

/**
 * Uma entrada manual (sem appointment_id) conta pro piso do mês
 * `monthKey` ("YYYY-MM") se `reference_month` bater explicitamente —
 * ou, pra registros antigos sem essa coluna preenchida, se o mês do
 * `transaction_date` bater (fallback que preserva o comportamento
 * histórico, de antes de reference_month existir).
 */
export const matchesFloorMonth = (t: DirectEntryLike, monthKey: string): boolean =>
  matchesFloorMonthRange(t, monthKey, monthKey);

/** Mesma regra de matchesFloorMonth, mas pra um intervalo de meses
 * ("YYYY-MM", inclusive nas duas pontas) — útil pra Relatórios com
 * período trimestral/anual, onde o piso soma vários meses de uma vez.
 * Comparação lexicográfica funciona porque "YYYY-MM" ordena igual a
 * data. */
export const matchesFloorMonthRange = (
  t: DirectEntryLike,
  startMonthKey: string,
  endMonthKey: string,
): boolean => {
  const key = t.reference_month || norm(t.transaction_date).slice(0, 7);
  return key >= startMonthKey && key <= endMonthKey;
};

/** Soma as entradas manuais de piso (sem appointment_id) que contam
 * pro mês `monthKey`, usando reference_month com fallback pro mês de
 * transaction_date. Base para `directEntries` em computeFloor. */
export const sumDirectFloorEntries = (
  txs: DirectEntryLike[] | null | undefined,
  monthKey: string,
): number => sumDirectFloorEntriesInRange(txs, monthKey, monthKey);

/** Igual sumDirectFloorEntries, mas somando um intervalo de meses. */
export const sumDirectFloorEntriesInRange = (
  txs: DirectEntryLike[] | null | undefined,
  startMonthKey: string,
  endMonthKey: string,
): number =>
  (txs ?? [])
    .filter((t) => !t.appointment_id && matchesFloorMonthRange(t, startMonthKey, endMonthKey))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

export interface FloorInput {
  shifts: number;
  floorPerShift: number;
  receivedClinicCommission: number;
  /** Lançamentos manuais (transactions com professional_id sem appointment_id). */
  directEntries?: number;
}

export interface FloorResult {
  floorTotal: number;
  achieved: number;
  gapToFloor: number;
  reached: boolean;
}

export const computeFloor = ({
  shifts,
  floorPerShift,
  receivedClinicCommission,
  directEntries = 0,
}: FloorInput): FloorResult => {
  const floorTotal = shifts * floorPerShift;
  const achieved = receivedClinicCommission + directEntries;
  const gapToFloor = Math.max(0, floorTotal - achieved);
  return { floorTotal, achieved, gapToFloor, reached: achieved >= floorTotal && floorTotal > 0 };
};

/* ------------------------------------------------------------------ */
/* Contadores de consultas                                             */
/* ------------------------------------------------------------------ */

export interface AppointmentLike {
  status?: string | null;
}

export const countRealized = (appts: AppointmentLike[] | null | undefined): number =>
  (appts ?? []).filter((a) => isRealized(a.status)).length;

export const countCanceled = (appts: AppointmentLike[] | null | undefined): number =>
  (appts ?? []).filter((a) => isCanceled(a.status)).length;

export const countNoShows = (appts: AppointmentLike[] | null | undefined): number =>
  (appts ?? []).filter((a) => isNoShow(a.status)).length;
