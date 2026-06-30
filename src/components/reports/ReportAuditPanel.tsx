import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, FileSearch, Loader2, Info } from "lucide-react";
import { formatDateBR, formatCurrencyBR } from "@/lib/export-utils";
import {
  isRealized,
  isCanceled,
  isClinicCommissionReceived,
  computeFloor,
  REALIZED_STATUSES,
} from "@/lib/business-rules";

/**
 * Painel de Auditoria — mostra a ORIGEM de cada número do relatório.
 * Para cada profissional, lista cada consulta do período com:
 *   • status                                  (regra: status define se conta)
 *   • valor da consulta + comissão da clínica
 *   • se contou para CONSULTAS REALIZADAS (e por quê / por que não)
 *   • se contou para o PISO recebido         (e por qual regra)
 * Totaliza o resultado e mostra a comparação com o piso configurado.
 */

interface Props {
  period: string;
  customMonth: string;
  floorPerShift: number;
}

interface AuditRow {
  id: string;
  date: string;
  patient: string;
  status: string;
  value: number;
  clinicAmount: number;
  isPaid: boolean;
  destination: string | null;
  countedAsRealized: boolean;
  countedForFloor: boolean;
  floorReason: string;
}

interface ProfessionalAudit {
  id: string;
  name: string;
  shifts: number;
  rows: AuditRow[];
  realizedCount: number;
  receivedClinicCommission: number;
  directEntries: number;
  floorTotal: number;
  achieved: number;
  gapToFloor: number;
  reached: boolean;
}

const REALIZED_LIST = Array.from(REALIZED_STATUSES).join(", ");

const getPeriodRange = (period: string, customMonth: string) => {
  const today = new Date();
  if (period === "custom") {
    const [y, m] = customMonth.split("-").map(Number);
    return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
  }
  if (period === "month") {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: new Date(today.getFullYear(), today.getMonth() + 1, 0),
    };
  }
  return { start: new Date(today.getFullYear(), 0, 1), end: new Date(today.getFullYear(), 11, 31) };
};

const floorReasonFor = (p: any): { counted: boolean; reason: string } => {
  if (isCanceled(p.appointments?.status)) {
    return { counted: false, reason: "Cancelada — ignorada" };
  }
  const dest = (p.payment_destination || "").toLowerCase();
  if (dest === "clinic" || dest === "clinica" || dest === "clínica") {
    return { counted: true, reason: "Recebido direto pela clínica" };
  }
  if (dest === "professional" || dest === "profissional") {
    return p.is_paid
      ? { counted: true, reason: "Profissional já repassou (is_paid=true)" }
      : { counted: false, reason: "Pendente de repasse do profissional" };
  }
  return p.is_paid
    ? { counted: true, reason: "Marcado como pago (sem destino definido)" }
    : { counted: false, reason: "Sem confirmação de recebimento" };
};

export function ReportAuditPanel({ period, customMonth, floorPerShift }: Props) {
  const [loading, setLoading] = useState(false);
  const [audits, setAudits] = useState<ProfessionalAudit[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterProfessional, setFilterProfessional] = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { start, end } = getPeriodRange(period, customMonth);
        const startStr = start.toISOString().split("T")[0];
        const endStr = end.toISOString().split("T")[0];

        const [profsRes, apptsRes, paymentsRes, shiftsRes, txRes] = await Promise.all([
          supabase.from("professionals").select("id, name").eq("is_active", true).order("name"),
          supabase
            .from("appointments")
            .select("id, appointment_date, professional_id, status, consultation_value, patients(name)")
            .gte("appointment_date", startStr)
            .lte("appointment_date", endStr),
          supabase
            .from("professional_payments")
            .select(
              "id, appointment_id, professional_id, total_value, clinic_amount, is_paid, payment_destination, appointments(appointment_date, status)",
            ),
          supabase.from("professional_shifts").select("professional_id"),
          supabase
            .from("transactions")
            .select("professional_id, amount, appointment_id")
            .eq("type", "entrada")
            .gte("transaction_date", startStr)
            .lte("transaction_date", endStr),
        ]);

        const profs = profsRes.data || [];
        const appts = apptsRes.data || [];
        const payments = (paymentsRes.data || []).filter((p: any) => {
          const d = p.appointments?.appointment_date;
          return d && d >= startStr && d <= endStr;
        });
        const shifts = shiftsRes.data || [];
        const tx = txRes.data || [];

        const shiftCounts: Record<string, number> = {};
        shifts.forEach((s: any) => {
          shiftCounts[s.professional_id] = (shiftCounts[s.professional_id] || 0) + 1;
        });
        const paymentByAppt: Record<string, any> = {};
        payments.forEach((p: any) => {
          if (p.appointment_id) paymentByAppt[p.appointment_id] = p;
        });

        const result: ProfessionalAudit[] = profs
          .map((prof: any) => {
            const profAppts = appts.filter((a: any) => a.professional_id === prof.id);
            const rows: AuditRow[] = profAppts.map((a: any) => {
              const pay = paymentByAppt[a.id];
              const { counted, reason } = pay
                ? floorReasonFor(pay)
                : { counted: false, reason: "Sem pagamento registrado" };
              return {
                id: a.id,
                date: a.appointment_date,
                patient: a.patients?.name || "—",
                status: a.status || "—",
                value: Number(pay?.total_value ?? a.consultation_value ?? 0),
                clinicAmount: Number(pay?.clinic_amount ?? 0),
                isPaid: !!pay?.is_paid,
                destination: pay?.payment_destination ?? null,
                countedAsRealized: isRealized(a.status),
                countedForFloor: counted && Number(pay?.clinic_amount ?? 0) > 0,
                floorReason: reason,
              };
            });

            const realizedCount = rows.filter((r) => r.countedAsRealized).length;
            const receivedClinicCommission = rows
              .filter((r) => r.countedForFloor)
              .reduce((s, r) => s + r.clinicAmount, 0);
            const directEntries = tx
              .filter((t: any) => t.professional_id === prof.id && !t.appointment_id)
              .reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
            const shiftsCount = shiftCounts[prof.id] || 0;
            const floor = computeFloor({
              shifts: shiftsCount,
              floorPerShift,
              receivedClinicCommission,
              directEntries,
            });

            return {
              id: prof.id,
              name: prof.name,
              shifts: shiftsCount,
              rows: rows.sort((a, b) => a.date.localeCompare(b.date)),
              realizedCount,
              receivedClinicCommission,
              directEntries,
              floorTotal: floor.floorTotal,
              achieved: floor.achieved,
              gapToFloor: floor.gapToFloor,
              reached: floor.reached,
            } as ProfessionalAudit;
          })
          .filter((p) => p.rows.length > 0 || p.shifts > 0);

        setAudits(result);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period, customMonth, floorPerShift]);

  const visible = useMemo(
    () => (filterProfessional === "all" ? audits : audits.filter((a) => a.id === filterProfessional)),
    [audits, filterProfessional],
  );

  return (
    <div className="bg-card rounded-xl border border-border/30 shadow-card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-primary" />
            Auditoria — Origem dos valores
          </h3>
          <p className="text-sm text-muted-foreground">
            Mostra exatamente quais consultas foram somadas em cada totalizador e por qual regra.
          </p>
        </div>
        <Select value={filterProfessional} onValueChange={setFilterProfessional}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Todos os profissionais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os profissionais</SelectItem>
            {audits.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg bg-muted/30 border border-border/20 p-3 text-xs text-muted-foreground flex gap-2">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
        <div className="space-y-1">
          <p>
            <strong>Consulta realizada:</strong> status ∈ {`{${REALIZED_LIST}}`}. Confirmado puro
            não conta. Faltas não contam.
          </p>
          <p>
            <strong>Piso:</strong> compara o piso configurado (turnos × valor/turno) contra a
            comissão da clínica <em>efetivamente recebida</em> + lançamentos manuais com o
            profissional vinculado.
          </p>
          <p>
            <strong>Comissão recebida:</strong> pagamento ao caixa da clínica, ou repasse já
            confirmado pelo profissional (<code>is_paid=true</code>).
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : visible.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Sem dados no período.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((a) => {
            const open = openId === a.id;
            return (
              <Collapsible
                key={a.id}
                open={open}
                onOpenChange={(v) => setOpenId(v ? a.id : null)}
              >
                <div className="rounded-lg border border-border/30 bg-card">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full p-4 flex items-center justify-between gap-3 hover:bg-muted/40 rounded-lg text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {open ? (
                          <ChevronDown className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 flex-shrink-0" />
                        )}
                        <span className="font-semibold truncate">{a.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {a.rows.length} consulta(s)
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {a.realizedCount} realizada(s)
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-[11px] text-muted-foreground">Comissão recebida</p>
                          <p className="text-sm font-semibold">
                            {formatCurrencyBR(a.receivedClinicCommission)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-muted-foreground">Piso</p>
                          <p className="text-sm font-semibold">{formatCurrencyBR(a.floorTotal)}</p>
                        </div>
                        <Badge
                          variant={a.reached ? "default" : a.floorTotal === 0 ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {a.floorTotal === 0
                            ? "Sem piso"
                            : a.reached
                              ? "Atingiu"
                              : `Falta ${formatCurrencyBR(a.gapToFloor)}`}
                        </Badge>
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="rounded bg-muted/40 p-2">
                          <p className="text-muted-foreground">Turnos no período</p>
                          <p className="font-semibold">{a.shifts}</p>
                        </div>
                        <div className="rounded bg-muted/40 p-2">
                          <p className="text-muted-foreground">Comissão recebida</p>
                          <p className="font-semibold">
                            {formatCurrencyBR(a.receivedClinicCommission)}
                          </p>
                        </div>
                        <div className="rounded bg-muted/40 p-2">
                          <p className="text-muted-foreground">Lançamentos manuais</p>
                          <p className="font-semibold">{formatCurrencyBR(a.directEntries)}</p>
                        </div>
                        <div className="rounded bg-muted/40 p-2">
                          <p className="text-muted-foreground">Total computado p/ piso</p>
                          <p className="font-semibold">{formatCurrencyBR(a.achieved)}</p>
                        </div>
                      </div>

                      <ScrollArea className="max-h-[420px]">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40">
                            <tr className="text-left">
                              <th className="p-2">Data</th>
                              <th className="p-2">Paciente</th>
                              <th className="p-2">Status</th>
                              <th className="p-2 text-right">Valor</th>
                              <th className="p-2 text-right">Comissão</th>
                              <th className="p-2 text-center">Realizada?</th>
                              <th className="p-2">Piso (regra aplicada)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {a.rows.map((r) => (
                              <tr key={r.id} className="border-t border-border/20">
                                <td className="p-2 whitespace-nowrap">{formatDateBR(r.date)}</td>
                                <td className="p-2 truncate max-w-[180px]">{r.patient}</td>
                                <td className="p-2">
                                  <Badge variant="outline" className="text-[10px]">
                                    {r.status}
                                  </Badge>
                                </td>
                                <td className="p-2 text-right">{formatCurrencyBR(r.value)}</td>
                                <td className="p-2 text-right">{formatCurrencyBR(r.clinicAmount)}</td>
                                <td className="p-2 text-center">
                                  {r.countedAsRealized ? (
                                    <Badge className="text-[10px]">Sim</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">Não</span>
                                  )}
                                </td>
                                <td className="p-2">
                                  <span
                                    className={
                                      r.countedForFloor
                                        ? "text-success font-medium"
                                        : "text-muted-foreground"
                                    }
                                  >
                                    {r.countedForFloor ? "✓ " : "✗ "}
                                    {r.floorReason}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {a.rows.length === 0 && (
                              <tr>
                                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                                  Sem consultas — apenas turnos no período.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </ScrollArea>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
