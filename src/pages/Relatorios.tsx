import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, Calendar, DollarSign, Users, UserCog, TrendingUp, Loader2, Building2, BarChart3, AlertTriangle, ArrowUpCircle, ArrowDownCircle, Wallet, Clock, Eye, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportToPDF, formatDateBR, formatCurrencyBR } from "@/lib/export-utils";
import { exportFinancialPDF } from "@/lib/export-financial-pdf";
import { exportProfessionalPDF, ProfessionalReportData, ProfessionalAppointmentRow } from "@/lib/export-professional-pdf";
import { cn } from "@/lib/utils";
import { ReportAuditPanel } from "@/components/reports/ReportAuditPanel";
import {
  isRealized,
  isCanceled,
  countRealized,
  countCanceled,
  sumReceivedClinicCommission,
  computeFloor,
} from "@/lib/business-rules";

const reportTypes = [
  { id: "financial", name: "Relatório Financeiro", description: "Resumo de receitas e despesas", icon: DollarSign, color: "gradient-primary" },
  { id: "appointments", name: "Relatório de Agenda", description: "Consultas e atendimentos", icon: Calendar, color: "gradient-success" },
  { id: "patients", name: "Relatório de Pacientes", description: "Cadastros e histórico", icon: Users, color: "gradient-accent" },
  { id: "professionals", name: "Relatório por Profissional", description: "Performance e atendimentos", icon: UserCog, color: "bg-warning" },
];

const paymentColors = ["hsl(175, 60%, 40%)", "hsl(12, 80%, 60%)", "hsl(152, 60%, 42%)", "hsl(38, 92%, 50%)"];

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const CATEGORY_LABELS: Record<string, string> = {
  aluguel: "Aluguel",
  energia: "Energia",
  agua: "Água",
  internet: "Internet",
  material: "Material",
  manutencao: "Manutenção",
  impostos: "Impostos",
  outros: "Outros",
};

const CATEGORY_COLORS = [
  "hsl(175, 60%, 40%)",
  "hsl(38, 92%, 50%)",
  "hsl(12, 80%, 60%)",
  "hsl(210, 60%, 50%)",
  "hsl(152, 60%, 42%)",
  "hsl(280, 50%, 55%)",
  "hsl(340, 60%, 50%)",
  "hsl(0, 0%, 55%)",
];

const generateMonthOptions = () => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) {
    for (let m = 11; m >= 0; m--) {
      if (y === now.getFullYear() && m > now.getMonth()) continue;
      options.push({ value: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${MONTHS[m]} ${y}` });
    }
  }
  return options;
};

const monthOptions = generateMonthOptions();

export default function Relatorios() {
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState("month");
  const [customMonth, setCustomMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [appointmentsByProfessional, setAppointmentsByProfessional] = useState<any[]>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<any[]>([]);
  const [clinicRevenueByProfessional, setClinicRevenueByProfessional] = useState<any[]>([]);
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<any[]>([]);
  const [professionalPerformance, setProfessionalPerformance] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ 
    totalAppointments: 0, totalRevenue: 0, avgTicket: 0, cancelRate: 0,
    completedAppointments: 0, pendingPayments: 0, totalClinicRevenue: 0, activePatients: 0
  });
  // Financial dashboard state
  const [financialSummary, setFinancialSummary] = useState({ totalEntradas: 0, totalSaidas: 0, saldo: 0, contasPendentes: 0, contasVencidas: 0 });
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; percent: number; color: string }[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<any[]>([]);
  const [floorPerShiftState, setFloorPerShiftState] = useState<number>(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewReportId, setPreviewReportId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    title: string;
    subtitle: string;
    summary: { label: string; value: string; tone?: "success" | "destructive" | "warning" | "primary"; hint?: string }[];
    headers: string[];
    rows: (string | number)[][];
    financial?: {
      receita: number;
      despesa: number;
      lucro: number;
      margem: number;
      receitaPrev: number;
      despesaPrev: number;
      lucroPrev: number;
      varReceita: number | null;
      varDespesa: number | null;
      varLucro: number | null;
      ticketMedio: number;
      totalConsultas: number;
      consultasConfirmadas: number;
      consultasPagas: number;
      consultasGratuitas: number;
      clientesAReceber: number;
      profissionaisAPagar: number;
      receberProfissionaisValor: number;
      receberProfissionaisCount: number;
      receitaPorConsulta: number;
      categorias: { name: string; value: number; percent: number; color: string }[];
      trend: { label: string; receita: number; despesa: number; lucro: number }[];
      alerts: { type: "warning" | "destructive" | "success"; message: string }[];
    };
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => { fetchData(); }, [period, customMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    const today = new Date();
    const currentYear = today.getFullYear();
    let startDate: Date, endDate: Date;

    if (period === "custom") {
      const [y, m] = customMonth.split("-").map(Number);
      startDate = new Date(y, m - 1, 1);
      endDate = new Date(y, m, 0);
    } else if (period === "month") {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else {
      startDate = new Date(today.getFullYear(), 0, 1);
      endDate = new Date(today.getFullYear(), 11, 31);
    }

    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const [appointmentsRes, transactionsRes, outflowRes, professionalsRes, paymentsRes, patientsRes, shiftsRes, settingsRes, billsInPeriodRes, billsOverdueRes, upcomingBillsRes] = await Promise.all([
      supabase.from("appointments").select("*, professionals(name)").gte("appointment_date", startDateStr).lte("appointment_date", endDateStr).neq("status", "cancelado"),
      supabase.from("transactions").select("*").eq("type", "entrada").gte("transaction_date", startDateStr).lte("transaction_date", endDateStr),
      supabase.from("transactions").select("*").eq("type", "saida").gte("transaction_date", startDateStr).lte("transaction_date", endDateStr),
      supabase.from("professionals").select("id, name").eq("is_active", true),
      supabase.from("professional_payments").select("*, professionals(name), appointments(status, appointment_date)").gte("created_at", `${currentYear}-01-01`),
      supabase.from("patients").select("id").eq("is_active", true),
      supabase.from("professional_shifts").select("professional_id"),
      supabase.from("clinic_settings").select("value").eq("key", "floor_value_per_shift").maybeSingle(),
      supabase.from("bills_to_pay").select("*").gte("due_date", startDateStr).lte("due_date", endDateStr),
      supabase.from("bills_to_pay").select("*").eq("status", "pendente").lt("due_date", todayStr),
      supabase.from("bills_to_pay").select("*").eq("status", "pendente").gte("due_date", todayStr).order("due_date", { ascending: true }).limit(10),
    ]);

    const appointments = appointmentsRes.data || [];
    const transactions = transactionsRes.data || [];
    const outflowTransactions = outflowRes.data || [];
    const professionals = professionalsRes.data || [];
    const allPayments = (paymentsRes.data || []).filter(pay => pay.appointments?.status !== "cancelado");
    const periodPayments = allPayments.filter(pay => {
      const apptDate = pay.appointments?.appointment_date;
      if (!apptDate) return false;
      return apptDate >= startDateStr && apptDate <= endDateStr;
    });
    const activePatients = patientsRes.data?.length || 0;
    const shiftsData = shiftsRes.data || [];
    const floorPerShift = parseFloat(settingsRes.data?.value || "0");
    setFloorPerShiftState(floorPerShift);

    // === FINANCIAL SUMMARY ===
    const totalEntradas = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalSaidas = outflowTransactions.reduce((sum, t) => sum + t.amount, 0);
    const billsInPeriod = billsInPeriodRes.data || [];
    const billsOverdue = billsOverdueRes.data || [];

    // Pending bills in period (not overdue)
    const pendentesNoPeriodo = billsInPeriod.filter(b => b.status === "pendente" && b.due_date >= todayStr);
    // Overdue = status pendente and due_date < today
    const overdueBills = [
      ...billsInPeriod.filter(b => b.status === "pendente" && b.due_date < todayStr),
      ...billsOverdue.filter(b => !billsInPeriod.some(bp => bp.id === b.id)),
    ];

    const contasPendentesVal = pendentesNoPeriodo.reduce((sum, b) => sum + b.amount, 0);
    const contasVencidasVal = overdueBills.reduce((sum, b) => sum + b.amount, 0);

    setFinancialSummary({
      totalEntradas,
      totalSaidas,
      saldo: totalEntradas - totalSaidas,
      contasPendentes: contasPendentesVal,
      contasVencidas: contasVencidasVal,
    });

    // === CATEGORY BREAKDOWN ===
    // All bills in period + overdue bills (all statuses for complete category view)
    const allBillsForCategories = [
      ...billsInPeriod,
      ...overdueBills.filter(b => !billsInPeriod.some(bp => bp.id === b.id)),
    ];
    const categoryTotals: Record<string, number> = {};
    allBillsForCategories.forEach(b => {
      const cat = b.category || "outros";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + b.amount;
    });
    const totalDespesas = Object.values(categoryTotals).reduce((a, b) => a + b, 0) || 1;
    const catData = Object.entries(categoryTotals)
      .map(([cat, value], i) => ({
        name: CATEGORY_LABELS[cat] || cat,
        value,
        percent: Math.round((value / totalDespesas) * 100),
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
    setCategoryData(catData);

    // === UPCOMING BILLS ===
    setUpcomingBills(upcomingBillsRes.data || []);

    // Count shifts per professional
    const shiftCounts: Record<string, number> = {};
    shiftsData.forEach(s => { shiftCounts[s.professional_id] = (shiftCounts[s.professional_id] || 0) + 1; });

    // Appointments by professional
    const profData = professionals.map((p) => ({
      name: p.name.split(" ").slice(0, 2).join(" "),
      consultas: appointments.filter((a) => a.professional_id === p.id).length,
    })).filter(p => p.consultas > 0).sort((a, b) => b.consultas - a.consultas);
    setAppointmentsByProfessional(profData);

    // Clinic revenue by professional with floor column
    // Piso = comissão da clínica EFETIVAMENTE RECEBIDA no mês (motor único).
    const floorTransactions = transactions.filter((t: any) => t.professional_id);
    const clinicRevenue = professionals.map((p) => {
      const profPayments = periodPayments.filter(pay => pay.professional_id === p.id);
      const totalClinic = sumReceivedClinicCommission(profPayments as any);
      const totalProduced = profPayments.reduce((sum, pay) => sum + (pay.total_value || 0), 0);
      const professionalReceived = profPayments
        .filter((pay: any) => pay.is_paid === true && !["cancelado"].includes((pay.appointments?.status || "").toLowerCase()))
        .reduce((sum: number, pay: any) => sum + Number(pay.professional_amount || 0), 0);
      const directEntries = floorTransactions
        .filter((t: any) => t.professional_id === p.id)
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      const shifts = shiftCounts[p.id] || 0;
      const { floorTotal, gapToFloor } = computeFloor({
        shifts, floorPerShift, receivedClinicCommission: totalClinic, directEntries,
      });
      return {
        name: p.name.split(" ").slice(0, 2).join(" "),
        valor: totalClinic, professionalReceived, consultas: profPayments.length, totalProduced, floorTotal, gapToFloor, shifts,
      };
    }).filter(p => p.valor > 0 || p.shifts > 0 || p.professionalReceived > 0).sort((a, b) => b.valor - a.valor);
    setClinicRevenueByProfessional(clinicRevenue);

    // Monthly revenue data
    const monthlyData = MONTHS.map((month, idx) => {
      const monthPayments = allPayments.filter(pay => {
        const apptDate = pay.appointments?.appointment_date;
        if (!apptDate) return false;
        const date = new Date(apptDate);
        return date.getMonth() === idx && date.getFullYear() === currentYear;
      });
      const clinicTotal = monthPayments.reduce((sum, pay) => sum + (pay.clinic_amount || 0), 0);
      return { month, clinica: clinicTotal };
    });
    setMonthlyRevenueData(monthlyData);

    // Professional performance
    const { data: allAppointmentsData } = await supabase.from("appointments").select("*").gte("appointment_date", startDateStr).lte("appointment_date", endDateStr);
    const allAppointments = allAppointmentsData || [];
    
    const perfData = professionals.map((p) => {
      const profAppts = allAppointments.filter(a => a.professional_id === p.id);
      const completed = countRealized(profAppts);
      const canceled = countCanceled(profAppts);
      const profPay = periodPayments.filter(pay => pay.professional_id === p.id);
      const clinicRev = sumReceivedClinicCommission(profPay as any);
      const pendingPay = profPay.filter(pay => !pay.is_paid).reduce((sum, pay) => sum + (pay.professional_amount || 0), 0);
      const totalProduced = profPay.reduce((sum, pay) => sum + (pay.total_value || 0), 0);
      const directEntries = floorTransactions.filter((t: any) => t.professional_id === p.id).reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      const shifts = shiftCounts[p.id] || 0;
      const { floorTotal, gapToFloor } = computeFloor({
        shifts, floorPerShift, receivedClinicCommission: clinicRev, directEntries,
      });
      return {
        name: p.name.split(" ").slice(0, 2).join(" "), fullName: p.name,
        total: profAppts.length, completed, canceled, clinicRevenue: clinicRev, pendingPayments: pendingPay,
        totalProduced, floorTotal, gapToFloor,
        cancelRate: profAppts.length > 0 ? ((canceled / profAppts.length) * 100).toFixed(1) : "0",
      };
    }).filter(p => p.total > 0).sort((a, b) => b.clinicRevenue - a.clinicRevenue);
    setProfessionalPerformance(perfData);

    // Payment methods
    const paymentCounts: Record<string, number> = {};
    transactions.forEach((t) => { paymentCounts[t.payment_method || "outros"] = (paymentCounts[t.payment_method || "outros"] || 0) + 1; });
    const total = Object.values(paymentCounts).reduce((a, b) => a + b, 0) || 1;
    const paymentData = Object.entries(paymentCounts).map(([name, count], i) => ({
      name: name === "pix" ? "PIX" : name === "dinheiro" ? "Dinheiro" : name === "cartao_credito" ? "Cartão" : name === "cartao_debito" ? "Débito" : name,
      value: Math.round((count / total) * 100),
      color: paymentColors[i % paymentColors.length],
    }));
    setPaymentMethodData(paymentData.length ? paymentData : [{ name: "Sem dados", value: 100, color: "#ccc" }]);

    // Metrics
    const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
    const canceledCount = countCanceled(allAppointments);
    const completedCount = countRealized(allAppointments);
    const pendingPaymentsTotal = periodPayments.filter(pay => !pay.is_paid).reduce((sum, pay) => sum + (pay.professional_amount || 0), 0);
    
    setMetrics({
      totalAppointments: appointments.length, totalRevenue,
      avgTicket: appointments.length > 0 ? totalRevenue / appointments.length : 0,
      cancelRate: allAppointments.length > 0 ? (canceledCount / allAppointments.length) * 100 : 0,
      completedAppointments: completedCount, pendingPayments: pendingPaymentsTotal,
      totalClinicRevenue: totalRevenue, activePatients,
    });
    setIsLoading(false);
  };

  const getDateRange = () => {
    const today = new Date();
    if (period === "custom") {
      const [y, m] = customMonth.split("-").map(Number);
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
    } else if (period === "month") {
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: new Date(today.getFullYear(), today.getMonth() + 1, 0) };
    }
    return { start: new Date(today.getFullYear(), 0, 1), end: new Date(today.getFullYear(), 11, 31) };
  };

  const getPeriodLabel = () => {
    if (period === "custom") {
      const [y, m] = customMonth.split("-").map(Number);
      return `${MONTHS[m - 1]} ${y}`;
    } else if (period === "month") {
      const now = new Date();
      return `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    }
    return `Ano ${new Date().getFullYear()}`;
  };

  const handlePreview = async (reportId: string) => {
    setPreviewReportId(reportId);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewData(null);

    try {
      const { start, end } = getDateRange();
      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];
      const periodLabel = getPeriodLabel();

      if (reportId === "financial") {
        // Período anterior — mesma duração imediatamente antes
        const msDay = 86400000;
        const periodMs = end.getTime() - start.getTime();
        const prevEnd = new Date(start.getTime() - msDay);
        const prevStart = new Date(prevEnd.getTime() - periodMs);
        const prevStartStr = prevStart.toISOString().split("T")[0];
        const prevEndStr = prevEnd.toISOString().split("T")[0];

        const todayStrPrev = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
        const [txRes, txPrevRes, apptsRes, receivablesRes, profPaymentsRes, billsInPeriodRes, billsOverdueRes] = await Promise.all([
          supabase.from("transactions").select("*").gte("transaction_date", startStr).lte("transaction_date", endStr).order("transaction_date", { ascending: false }),
          supabase.from("transactions").select("type, amount, transaction_date").gte("transaction_date", prevStartStr).lte("transaction_date", prevEndStr),
          supabase.from("appointments")
            .select("id, status, appointment_date, consultation_value, payment_status, no_show_charged")
            .gte("appointment_date", startStr).lte("appointment_date", endStr),
          // Fonte de verdade: mesma query da aba Financeiro → Receber de Clientes (sem filtro de período)
          supabase.from("appointments")
            .select("id, consultation_value, payment_status, status, no_show_charged")
            .in("status", ["confirmado", "concluido", "atendido", "cliente_faltou"]),
          // Fonte de verdade: mesma query das abas Financeiro → Pagar/Receber Profissionais
          supabase.from("professional_payments")
            .select("professional_id, professional_amount, clinic_amount, is_paid, payment_destination, appointments(status)"),
          // Contas a pagar — fonte de verdade para Despesas por Categoria
          supabase.from("bills_to_pay").select("*").gte("due_date", startStr).lte("due_date", endStr),
          supabase.from("bills_to_pay").select("*").eq("status", "pendente").lt("due_date", todayStrPrev),
        ]);

        const txs = txRes.data || [];
        const txsPrev = txPrevRes.data || [];
        const apptsAll = apptsRes.data || [];
        // Apenas consultas válidas (não canceladas / sem falta-não-cobrada) para a operação
        const appts = apptsAll.filter((a: any) => {
          const s = (a.status || "").toLowerCase();
          if (s === "cancelado" || s === "profissional_faltou") return false;
          if (s === "cliente_faltou" && a.no_show_charged !== true) return false;
          return true;
        });

        // KPIs principais — fonte única de verdade: tabela transactions (mesmo critério do módulo Financeiro)
        const entradas = txs.filter((t: any) => t.type === "entrada").reduce((s: number, t: any) => s + (t.amount || 0), 0);
        const saidasTx = txs.filter((t: any) => t.type === "saida").reduce((s: number, t: any) => s + (t.amount || 0), 0);
        const despesa = saidasTx;
        const receita = entradas;
        const lucro = receita - despesa;
        const margem = receita > 0 ? (lucro / receita) * 100 : 0;

        // Período anterior — também apenas transactions
        const receitaPrev = txsPrev.filter((t: any) => t.type === "entrada").reduce((s: number, t: any) => s + (t.amount || 0), 0);
        const despesaPrev = txsPrev.filter((t: any) => t.type === "saida").reduce((s: number, t: any) => s + (t.amount || 0), 0);
        const lucroPrev = receitaPrev - despesaPrev;
        const pct = (cur: number, prev: number) => (prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100);
        const varReceita = pct(receita, receitaPrev);
        const varDespesa = pct(despesa, despesaPrev);
        const varLucro = pct(lucro, lucroPrev);

        // === Operação (período selecionado) ===
        // Total: consultas válidas no período (não canceladas / sem falta)
        const totalConsultas = appts.length;
        // Confirmadas: apenas consultas REALIZADAS (atendido/concluido) — "confirmado" sozinho não conta
        const consultasConfirmadas = countRealized(appts);
        // Pagas: payment_status = pago E valor > 0 (gratuitas não contam)
        const consultasPagasRemuneradas = appts.filter(
          (a: any) => (a.payment_status || "").toLowerCase() === "pago" && Number(a.consultation_value || 0) > 0
        );
        const consultasPagas = consultasPagasRemuneradas.length;
        // Gratuitas: valor 0 (mantido apenas para fins internos, não exibido)
        const consultasGratuitas = appts.filter((a: any) => Number(a.consultation_value || 0) === 0).length;
        // Ticket médio: receita / consultas pagas remuneradas (exclui gratuitas)
        const ticketMedio = consultasPagas > 0 ? receita / consultasPagas : 0;

        // === Pendências financeiras (mesma fonte e critérios das abas Financeiro) ===
        // Clientes a receber: igual a Financeiro → Receber de Clientes
        // status IN (confirmado, concluido, atendido) + valor > 0 + payment_status pendente/null
        // Sem filtro de período (a aba também não filtra por período)
        const clientesAReceber = (receivablesRes.data || []).filter(
          (a: any) =>
            Number(a.consultation_value || 0) > 0 &&
            (!a.payment_status || a.payment_status === "pendente")
        ).length;

        // Profissionais a pagar: igual a Financeiro → Pagar Profissionais
        // Conta profissionais distintos com pendência (payment_destination=clinic, is_paid=false, appt não cancelado)
        const validPayments = (profPaymentsRes.data || []).filter(
          (p: any) => p.appointments?.status !== "cancelado"
        );
        const pendingProfessionalIds = new Set(
          validPayments
            .filter(
              (p: any) =>
                p.payment_destination === "clinic" &&
                !p.is_paid &&
                Number(p.professional_amount || 0) > 0
            )
            .map((p: any) => p.professional_id)
        );
        const profissionaisAPagar = pendingProfessionalIds.size;

        // Receber de profissionais: igual a Financeiro → Profissionais → Receber de Profissionais
        // payment_destination === "professional" + !is_paid + appt não cancelado
        // Soma clinic_amount (valor que a clínica tem a receber do profissional)
        const receberPayments = validPayments.filter(
          (p: any) =>
            p.payment_destination === "professional" &&
            !p.is_paid &&
            Number(p.clinic_amount || 0) > 0
        );
        const receberProfissionaisValor = receberPayments.reduce(
          (sum: number, p: any) => sum + Number(p.clinic_amount || 0),
          0
        );
        const receberProfissionaisCount = new Set(
          receberPayments.map((p: any) => p.professional_id)
        ).size;

        // Categorias de despesa — fonte de verdade: contas a pagar (mesmo critério do painel resumo)
        const billsInPeriod = billsInPeriodRes.data || [];
        const catTotals: Record<string, number> = {};
        billsInPeriod.forEach((b: any) => {
          const key = b.category || "outros";
          catTotals[key] = (catTotals[key] || 0) + Number(b.amount || 0);
        });
        const totalCat = Object.values(catTotals).reduce((a, b) => a + b, 0) || 1;
        const categorias = Object.entries(catTotals)
          .filter(([, v]) => v > 0)
          .map(([cat, value], i) => ({
            name: CATEGORY_LABELS[cat] || cat,
            value,
            percent: Math.round((value / totalCat) * 100),
            color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
          }))
          .sort((a, b) => b.value - a.value);

        // Tendência — agrupa por dia se período <= 31 dias, senão por mês
        const days = Math.round(periodMs / msDay) + 1;
        const trendMap = new Map<string, { receita: number; despesa: number }>();
        const keyOf = (d: string) => {
          if (days <= 31) return d;
          const dt = new Date(d);
          return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        };
        const labelOf = (k: string) => {
          if (days <= 31) {
            const dt = new Date(k);
            return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
          }
          const [y, m] = k.split("-");
          return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`;
        };
        txs.forEach((t: any) => {
          const k = keyOf(t.transaction_date);
          const cur = trendMap.get(k) || { receita: 0, despesa: 0 };
          if (t.type === "entrada") cur.receita += t.amount || 0;
          else cur.despesa += t.amount || 0;
          trendMap.set(k, cur);
        });
        // Tendência considera apenas transactions (fonte de verdade)
        const trend = Array.from(trendMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => ({ label: labelOf(k), receita: v.receita, despesa: v.despesa, lucro: v.receita - v.despesa }));

        // Alertas inteligentes
        const alerts: { type: "warning" | "destructive" | "success"; message: string }[] = [];
        if (varDespesa !== null && varDespesa > 15) alerts.push({ type: "warning", message: `Despesas aumentaram ${varDespesa.toFixed(1)}% em relação ao período anterior.` });
        if (varReceita !== null && varReceita < -10) alerts.push({ type: "destructive", message: `Receita caiu ${Math.abs(varReceita).toFixed(1)}% em relação ao período anterior.` });
        if (varReceita !== null && varReceita > 10) alerts.push({ type: "success", message: `Receita cresceu ${varReceita.toFixed(1)}% — bom desempenho.` });
        if (margem < 10 && receita > 0) alerts.push({ type: "warning", message: `Margem de lucro baixa (${margem.toFixed(1)}%). Avalie custos.` });
        if (lucro < 0) alerts.push({ type: "destructive", message: `Resultado negativo no período: prejuízo de ${formatCurrencyBR(Math.abs(lucro))}.` });
        if (categorias[0] && categorias[0].percent >= 40) alerts.push({ type: "warning", message: `${categorias[0].name} concentra ${categorias[0].percent}% das despesas.` });
        if (alerts.length === 0 && receita > 0) alerts.push({ type: "success", message: "Indicadores dentro de parâmetros saudáveis." });

        setPreviewData({
          title: "Relatório Financeiro",
          subtitle: `Período: ${periodLabel}`,
          summary: [
            { label: "Receita Total", value: formatCurrencyBR(receita), tone: "success" },
            { label: "Despesa Total", value: formatCurrencyBR(despesa), tone: "destructive" },
            { label: "Lucro Líquido", value: formatCurrencyBR(lucro), tone: lucro >= 0 ? "success" : "destructive" },
            { label: "Margem de Lucro", value: `${margem.toFixed(1)}%`, tone: margem >= 20 ? "success" : margem >= 10 ? "warning" : "destructive" },
          ],
          headers: ["Data", "Descrição", "Tipo", "Valor"],
          rows: txs.slice(0, 50).map((t: any) => [
            formatDateBR(t.transaction_date),
            t.description,
            t.type === "entrada" ? "Entrada" : "Saída",
            formatCurrencyBR(t.amount),
          ]),
          financial: {
            receita, despesa, lucro, margem,
            receitaPrev, despesaPrev, lucroPrev,
            varReceita, varDespesa, varLucro,
            ticketMedio, totalConsultas,
            consultasConfirmadas, consultasPagas, consultasGratuitas,
            clientesAReceber, profissionaisAPagar,
            receberProfissionaisValor, receberProfissionaisCount,
            receitaPorConsulta: ticketMedio,
            categorias,
            trend,
            alerts,
          },
        });
      } else if (reportId === "appointments") {
        const { data } = await supabase
          .from("appointments")
          .select("*, patients(name), professionals(name)")
          .gte("appointment_date", startStr).lte("appointment_date", endStr)
          .order("appointment_date", { ascending: false });
        const list = data || [];
        const confirmed = countRealized(list);
        const pending = list.filter((a: any) => (a.status || "").toLowerCase() === "agendado").length;
        const cancelled = list.filter((a: any) => ["cancelado", "cliente_faltou", "profissional_faltou"].includes((a.status || "").toLowerCase())).length;

        setPreviewData({
          title: "Relatório de Agenda",
          subtitle: `Período: ${periodLabel}`,
          summary: [
            { label: "Total", value: String(list.length), tone: "primary" },
            { label: "Confirmadas", value: String(confirmed), tone: "success" },
            { label: "Pendentes", value: String(pending), tone: "warning" },
            { label: "Canceladas", value: String(cancelled), tone: "destructive" },
          ],
          headers: ["Data", "Hora", "Paciente", "Profissional", "Status"],
          rows: list.slice(0, 50).map((a: any) => [
            formatDateBR(a.appointment_date),
            a.appointment_time,
            a.patients?.name || "-",
            a.professionals?.name || "-",
            a.status,
          ]),
        });
      } else if (reportId === "patients") {
        const { data } = await supabase.from("patients").select("*").order("name");
        const list = data || [];
        const ativos = list.filter((p: any) => p.is_active).length;
        const inativos = list.length - ativos;
        setPreviewData({
          title: "Relatório de Pacientes",
          subtitle: `Total cadastrado até ${periodLabel}`,
          summary: [
            { label: "Total", value: String(list.length), tone: "primary" },
            { label: "Ativos", value: String(ativos), tone: "success" },
            { label: "Inativos", value: String(inativos), tone: "destructive" },
          ],
          headers: ["Nome", "CPF", "Telefone", "Status"],
          rows: list.slice(0, 50).map((p: any) => [
            p.name,
            p.cpf,
            p.phone,
            p.is_active ? "Ativo" : "Inativo",
          ]),
        });
      } else if (reportId === "professionals") {
        const [profsRes, apptsRes, paymentsRes] = await Promise.all([
          supabase.from("professionals").select("id, name, specialty").eq("is_active", true).order("name"),
          supabase.from("appointments").select("id, professional_id, status").gte("appointment_date", startStr).lte("appointment_date", endStr),
          supabase.from("professional_payments").select("professional_id, clinic_amount, professional_amount, total_value, appointments(appointment_date, status)"),
        ]);
        const profs = profsRes.data || [];
        const appts = apptsRes.data || [];
        const allPayments = (paymentsRes.data || []).filter((p: any) => p.appointments?.status !== "cancelado");
        const periodPayments = allPayments.filter((p: any) => {
          const d = p.appointments?.appointment_date;
          return d && d >= startStr && d <= endStr;
        });
        const rows = profs.map((p: any) => {
          const profAppts = appts.filter((a: any) => a.professional_id === p.id);
          const pays = periodPayments.filter((pp: any) => pp.professional_id === p.id);
          const clinicTotal = pays.reduce((s: number, x: any) => s + (x.clinic_amount || 0), 0);
          const profTotal = pays.reduce((s: number, x: any) => s + (x.professional_amount || 0), 0);
          return [
            p.name,
            p.specialty || "-",
            String(profAppts.length),
            formatCurrencyBR(clinicTotal),
            formatCurrencyBR(profTotal),
          ] as (string | number)[];
        }).filter((r) => Number(r[2]) > 0);

        const totalConsultas = rows.reduce((s, r) => s + Number(r[2]), 0);
        const totalClinic = periodPayments.reduce((s: number, x: any) => s + (x.clinic_amount || 0), 0);
        const totalProf = periodPayments.reduce((s: number, x: any) => s + (x.professional_amount || 0), 0);

        setPreviewData({
          title: "Relatório por Profissional",
          subtitle: `Período: ${periodLabel}`,
          summary: [
            { label: "Profissionais ativos", value: String(rows.length), tone: "primary" },
            { label: "Consultas", value: String(totalConsultas), tone: "primary" },
            { label: "Receita Clínica", value: formatCurrencyBR(totalClinic), tone: "success" },
            { label: "Repasse Profissionais", value: formatCurrencyBR(totalProf), tone: "warning" },
          ],
          headers: ["Profissional", "Especialidade", "Consultas", "Receita Clínica", "Repasse"],
          rows,
        });
      }
    } catch (err: any) {
      toast({ title: "Erro ao carregar prévia", description: err.message, variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExport = async (reportId: string) => {
    let data: any = { title: "", headers: [], rows: [] };
    
    if (reportId === "financial") {
      const { start, end } = getDateRange();
      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const [txRes, billsInPeriodRes, billsOverdueRes] = await Promise.all([
        supabase.from("transactions").select("*").gte("transaction_date", startStr).lte("transaction_date", endStr).order("transaction_date", { ascending: true }),
        supabase.from("bills_to_pay").select("*").gte("due_date", startStr).lte("due_date", endStr).order("due_date", { ascending: true }),
        supabase.from("bills_to_pay").select("*").eq("status", "pendente").lt("due_date", startStr).lt("due_date", todayStr).order("due_date", { ascending: true }),
      ]);

      const periodBillIds = new Set((billsInPeriodRes.data || []).map((b) => b.id));
      const allBills = [
        ...(billsInPeriodRes.data || []),
        ...(billsOverdueRes.data || []).filter((b) => !periodBillIds.has(b.id)),
      ];

      const financialData = {
        periodLabel: getPeriodLabel(),
        transactions: txRes.data || [],
        bills: allBills,
      };
      exportFinancialPDF(financialData, `relatorio-financeiro`);
      toast({ title: "PDF gerencial exportado com sucesso!" });
      return;
    } else if (reportId === "appointments") {
      const { data: appointments } = await supabase.from("appointments").select("*, patients(name), professionals(name)").order("appointment_date", { ascending: false }).limit(100);
      data = { title: "Relatório de Agenda", headers: ["Data", "Hora", "Paciente", "Profissional", "Status"], rows: (appointments || []).map((a) => [formatDateBR(a.appointment_date), a.appointment_time, a.patients?.name || "-", a.professionals?.name || "-", a.status]) };
    } else if (reportId === "patients") {
      const { data: patients } = await supabase.from("patients").select("*").order("name").limit(100);
      data = { title: "Relatório de Pacientes", headers: ["Nome", "CPF", "Telefone", "E-mail", "Status"], rows: (patients || []).map((p) => [p.name, p.cpf, p.phone, p.email || "-", p.is_active ? "Ativo" : "Inativo"]) };
    } else if (reportId === "professionals") {
      const { start, end } = getDateRange();
      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];

      const [profsRes, apptsRes, paymentsRes, txEntradaRes, txSaidaRes, shiftsRes, settingsRes] = await Promise.all([
        supabase.from("professionals").select("id, name, specialty").eq("is_active", true).order("name"),
        supabase
          .from("appointments")
          .select("id, appointment_date, professional_id, patient_id, consultation_value, clinic_percentage, payment_method, payment_status, status, patients(name)")
          .gte("appointment_date", startStr).lte("appointment_date", endStr).neq("status", "cancelado"),
        supabase
          .from("professional_payments")
          .select("id, appointment_id, professional_id, total_value, clinic_amount, professional_amount, is_paid, payment_destination, payment_method, appointments(appointment_date, status)"),
        supabase.from("transactions").select("id, appointment_id, professional_id, amount, type")
          .eq("type", "entrada").gte("transaction_date", startStr).lte("transaction_date", endStr),
        supabase.from("transactions").select("id, appointment_id, professional_id, amount, type")
          .eq("type", "saida").gte("transaction_date", startStr).lte("transaction_date", endStr),
        supabase.from("professional_shifts").select("professional_id"),
        supabase.from("clinic_settings").select("value").eq("key", "floor_value_per_shift").maybeSingle(),
      ]);

      const profs = profsRes.data || [];
      const appts = apptsRes.data || [];
      const allPayments = (paymentsRes.data || []).filter((p: any) => p.appointments?.status !== "cancelado");
      const periodPayments = allPayments.filter((p: any) => {
        const d = p.appointments?.appointment_date;
        return d && d >= startStr && d <= endStr;
      });
      const txEntrada = txEntradaRes.data || [];
      const txSaida = txSaidaRes.data || [];
      const shifts = shiftsRes.data || [];
      const floorPerShift = parseFloat(settingsRes.data?.value || "0");

      // Index
      const shiftCounts: Record<string, number> = {};
      shifts.forEach((s: any) => { shiftCounts[s.professional_id] = (shiftCounts[s.professional_id] || 0) + 1; });

      const paymentsByAppointment: Record<string, any> = {};
      periodPayments.forEach((p: any) => { paymentsByAppointment[p.appointment_id] = p; });

      // Confirmed sets — entradas/saídas vinculadas a appointment_id
      const confirmedEntradaApptIds = new Set(txEntrada.filter((t: any) => t.appointment_id).map((t: any) => t.appointment_id));
      const confirmedSaidaApptIds = new Set(txSaida.filter((t: any) => t.appointment_id).map((t: any) => t.appointment_id));

      const profReports: ProfessionalReportData[] = profs.map((prof: any) => {
        const profAppts = appts.filter((a: any) => a.professional_id === prof.id);
        const profPayments = periodPayments.filter((p: any) => p.professional_id === prof.id);

        const appointmentRows: ProfessionalAppointmentRow[] = profAppts.map((a: any) => {
          const pay = paymentsByAppointment[a.id];
          const consultationValue = a.consultation_value || 0;
          const clinicPct = a.clinic_percentage ?? 25;
          const clinicAmount = pay?.clinic_amount ?? (consultationValue * clinicPct / 100);
          const professionalAmount = pay?.professional_amount ?? (consultationValue - clinicAmount);
          const destination = pay?.payment_destination || null;
          // Confirmed: clinic recebeu => entrada; professional recebeu => saída (repasse confirmado)
          const confirmed = destination === "professional"
            ? confirmedSaidaApptIds.has(a.id)
            : confirmedEntradaApptIds.has(a.id);
          return {
            appointment_id: a.id,
            appointment_date: a.appointment_date,
            patient_name: a.patients?.name || "-",
            consultation_value: consultationValue,
            clinic_percentage: clinicPct,
            clinic_amount: clinicAmount,
            professional_amount: professionalAmount,
            payment_method: pay?.payment_method || a.payment_method || null,
            payment_destination: destination,
            payment_status: a.payment_status,
            is_paid_to_professional: !!pay?.is_paid,
            confirmed_in_finance: confirmed,
          };
        });

        const totalProduced = profPayments.reduce((s: number, p: any) => s + (p.total_value || 0), 0);
        const clinicTotal = profPayments.reduce((s: number, p: any) => s + (p.clinic_amount || 0), 0);
        const professionalTotal = profPayments.reduce((s: number, p: any) => s + (p.professional_amount || 0), 0);

        // Confirmed totals — somente o que efetivamente virou transaction no período
        const confirmedClinic = txEntrada
          .filter((t: any) => t.appointment_id && profAppts.some((a: any) => a.id === t.appointment_id))
          .reduce((s: number, t: any) => s + (t.amount || 0), 0);
        const confirmedProfessional = txSaida
          .filter((t: any) => t.appointment_id && profAppts.some((a: any) => a.id === t.appointment_id))
          .reduce((s: number, t: any) => s + (t.amount || 0), 0);

        // Manuais p/ piso = entradas com professional_id mas SEM appointment_id
        const manualFloorEntries = txEntrada
          .filter((t: any) => t.professional_id === prof.id && !t.appointment_id)
          .reduce((s: number, t: any) => s + (t.amount || 0), 0);

        const pendingClinic = Math.max(0, clinicTotal - confirmedClinic);
        const pendingProfessional = profPayments
          .filter((p: any) => !p.is_paid)
          .reduce((s: number, p: any) => s + (p.professional_amount || 0), 0);

        const shiftsCount = shiftCounts[prof.id] || 0;
        const floorTotal = floorPerShift * shiftsCount;
        const gapToFloor = Math.max(0, floorTotal - confirmedClinic - manualFloorEntries);

        return {
          id: prof.id,
          name: prof.name,
          specialty: prof.specialty,
          shifts: shiftsCount,
          floorPerShift,
          floorTotal,
          manualFloorEntries,
          appointments: appointmentRows,
          appointmentsCount: profAppts.length,
          totalProduced,
          clinicTotal,
          professionalTotal,
          confirmedClinic,
          confirmedProfessional,
          pendingClinic,
          pendingProfessional,
          gapToFloor,
        };
      }).filter((p) => p.appointmentsCount > 0 || p.shifts > 0);

      exportProfessionalPDF(
        { periodLabel: getPeriodLabel(), professionals: profReports },
        `relatorio-profissionais`,
      );
      toast({ title: "PDF gerencial exportado com sucesso!" });
      return;
    }

    exportToPDF(data, `relatorio-${reportId}`);
    toast({ title: "PDF exportado com sucesso!" });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h1 className="page-header">Relatórios</h1><p className="page-subtitle">Análises e exportações de dados</p></div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[150px]"><Calendar className="w-4 h-4 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Este Mês</SelectItem>
                <SelectItem value="year">Este Ano</SelectItem>
                <SelectItem value="custom">Mês Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {period === "custom" && (
              <Select value={customMonth} onValueChange={setCustomMonth}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Export cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {reportTypes.map((report) => (
            <div key={report.id} className="bg-card rounded-xl border border-border/30 shadow-card p-5 hover:shadow-lg transition-all">
              <div className={`w-12 h-12 rounded-xl ${report.color} flex items-center justify-center mb-4`}><report.icon className="w-6 h-6 text-primary-foreground" /></div>
              <h3 className="font-semibold text-foreground">{report.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{report.description}</p>
              <div className="flex items-center gap-2 mt-4">
                <Button variant="default" size="sm" className="text-xs h-8" onClick={() => handlePreview(report.id)}>
                  <Eye className="w-3 h-3 mr-1" />Visualizar
                </Button>
                <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => handleExport(report.id)}>
                  <FileText className="w-3 h-3 mr-1" />PDF
                </Button>
              </div>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* ===== SEÇÃO FINANCEIRA ===== */}
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Resumo Financeiro — {getPeriodLabel()}
              </h2>
              <p className="text-sm text-muted-foreground">Visão rápida das finanças do período selecionado</p>
            </div>

            {/* Financial summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <ArrowUpCircle className="w-4 h-4 text-success" />
                  <span className="text-xs">Total de Entradas</span>
                </div>
                <p className="text-xl font-bold text-success">{formatCurrencyBR(financialSummary.totalEntradas)}</p>
              </div>
              <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <ArrowDownCircle className="w-4 h-4 text-destructive" />
                  <span className="text-xs">Total de Saídas</span>
                </div>
                <p className="text-xl font-bold text-destructive">{formatCurrencyBR(financialSummary.totalSaidas)}</p>
              </div>
              <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  <span className="text-xs">Saldo do Período</span>
                </div>
                <p className={cn("text-xl font-bold", financialSummary.saldo >= 0 ? "text-success" : "text-destructive")}>
                  {formatCurrencyBR(financialSummary.saldo)}
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Clock className="w-4 h-4 text-warning" />
                  <span className="text-xs">Contas Pendentes</span>
                </div>
                <p className="text-xl font-bold text-warning">{formatCurrencyBR(financialSummary.contasPendentes)}</p>
              </div>
              <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="text-xs">Contas Vencidas</span>
                </div>
                <p className="text-xl font-bold text-destructive">{formatCurrencyBR(financialSummary.contasVencidas)}</p>
              </div>
            </div>

            {/* Category breakdown + Upcoming bills */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Despesas por Categoria */}
              <div className="bg-card rounded-xl border border-border/30 shadow-card p-5">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Despesas por Categoria
                </h3>
                {categoryData.length > 0 ? (
                  <div className="space-y-3">
                    {categoryData.map((cat) => (
                      <div key={cat.name} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{cat.name}</span>
                            <span className="text-sm text-muted-foreground ml-2">{cat.percent}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div className="h-2 rounded-full transition-all" style={{ width: `${cat.percent}%`, backgroundColor: cat.color }} />
                          </div>
                        </div>
                        <span className="text-sm font-semibold w-24 text-right">{formatCurrencyBR(cat.value)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Sem despesas pagas no período</p>
                )}
              </div>

              {/* Próximos Vencimentos */}
              <div className="bg-card rounded-xl border border-border/30 shadow-card p-5">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-warning" />
                  Próximos Vencimentos
                </h3>
                {upcomingBills.length > 0 ? (
                  <ScrollArea className="h-[280px]">
                    <div className="space-y-3">
                      {upcomingBills.map((bill) => (
                        <div key={bill.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{bill.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {CATEGORY_LABELS[bill.category] || bill.category || "Outros"}
                              </span>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs text-muted-foreground">{formatDateBR(bill.due_date)}</span>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-warning ml-3">{formatCurrencyBR(bill.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Nenhuma conta a vencer</p>
                )}
              </div>
            </div>

            {/* ===== SEÇÃO OPERACIONAL ===== */}
            <div className="space-y-1 pt-2">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Performance Operacional
              </h2>
              <p className="text-sm text-muted-foreground">Indicadores de atendimento e profissionais</p>
            </div>

            {/* Existing metric cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2"><Building2 className="w-4 h-4" /><span className="text-xs">Receita da Clínica</span></div>
                <p className="text-xl font-bold text-primary">{formatCurrencyBR(metrics.totalClinicRevenue)}</p>
              </div>
              <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2"><Calendar className="w-4 h-4" /><span className="text-xs">Consultas Realizadas</span></div>
                <p className="text-xl font-bold">{metrics.completedAppointments}</p>
              </div>
              <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2"><Users className="w-4 h-4" /><span className="text-xs">Pacientes Ativos</span></div>
                <p className="text-xl font-bold">{metrics.activePatients}</p>
              </div>
              <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2"><DollarSign className="w-4 h-4" /><span className="text-xs">Pagamentos Pendentes</span></div>
                <p className="text-xl font-bold text-warning">{formatCurrencyBR(metrics.pendingPayments)}</p>
              </div>
            </div>

            {/* Rendimento por Profissional para a Clínica */}
            <div className="bg-card rounded-xl border border-border/30 shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Rendimento por Profissional (Clínica)</h3>
              </div>
              <ScrollArea className="h-[300px]">
                {clinicRevenueByProfessional.length > 0 ? (
                  <table className="w-full">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border/30">
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Profissional</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Pisos Optantes</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Consultas</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Valor p/ atingir piso</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Receita Clínica</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Receita Profissional</th>
                      </tr>
                    </thead>
                    <tbody>
                    {clinicRevenueByProfessional.map((prof, i) => (
                      <tr key={i} className="border-b border-border/20">
                        <td className="p-3 font-medium">{prof.name}</td>
                        <td className="p-3 text-right">{prof.shifts}</td>
                        <td className="p-3 text-right">{prof.consultas}</td>
                        <td className="p-3 text-right">
                          {prof.gapToFloor > 0 ? (
                            <span className="text-destructive font-medium">{formatCurrencyBR(prof.gapToFloor)}</span>
                          ) : (
                            <span className="text-success">✓ Atingido</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-semibold text-primary">{formatCurrencyBR(prof.valor)}</td>
                        <td className="p-3 text-right font-semibold text-success">{formatCurrencyBR(prof.professionalReceived || 0)}</td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Sem dados de rendimento</p>
                )}
              </ScrollArea>
            </div>

            {/* Receita Mensal da Clínica */}
            <div className="bg-card rounded-xl border border-border/30 shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Receita Mensal da Clínica ({new Date().getFullYear()})</h3>
              </div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyRevenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [formatCurrencyBR(v), "Clínica"]} />
                    <Line type="monotone" dataKey="clinica" stroke="hsl(175, 60%, 40%)" strokeWidth={2} dot={{ fill: "hsl(175, 60%, 40%)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-xl border border-border/30 shadow-card p-5">
                <h3 className="text-lg font-semibold text-foreground mb-4">Consultas por Profissional</h3>
                <div className="h-[280px]">{appointmentsByProfessional.length > 0 ? <ResponsiveContainer width="100%" height="100%"><BarChart data={appointmentsByProfessional} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={100} /><Tooltip /><Bar dataKey="consultas" fill="hsl(175, 60%, 40%)" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : <p className="text-center text-muted-foreground py-12">Sem dados</p>}</div>
              </div>
              <div className="bg-card rounded-xl border border-border/30 shadow-card p-5">
                <h3 className="text-lg font-semibold text-foreground mb-4">Formas de Pagamento</h3>
                <div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={paymentMethodData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value">{paymentMethodData.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie><Tooltip formatter={(v: number) => [`${v}%`, "Porcentagem"]} /></PieChart></ResponsiveContainer></div>
                <div className="flex flex-wrap justify-center gap-4 mt-4">{paymentMethodData.map((item) => <div key={item.name} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-sm text-muted-foreground">{item.name} ({item.value}%)</span></div>)}</div>
              </div>
            </div>

            {/* Performance Detalhada por Profissional */}
            {professionalPerformance.length > 0 && (
              <div className="bg-card rounded-xl border border-border/30 shadow-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <UserCog className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Performance Detalhada por Profissional</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Profissional</th>
                        <th className="text-center p-3 text-sm font-medium text-muted-foreground">Total</th>
                        <th className="text-center p-3 text-sm font-medium text-muted-foreground">Realizadas</th>
                        <th className="text-center p-3 text-sm font-medium text-muted-foreground">Canceladas</th>
                        <th className="text-center p-3 text-sm font-medium text-muted-foreground">% Cancel.</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Valor p/ piso</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Receita Clínica</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Pendente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {professionalPerformance.map((prof, i) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-muted/30">
                          <td className="p-3 font-medium">{prof.name}</td>
                          <td className="p-3 text-center">{prof.total}</td>
                          <td className="p-3 text-center text-success">{prof.completed}</td>
                          <td className="p-3 text-center text-destructive">{prof.canceled}</td>
                          <td className="p-3 text-center">{prof.cancelRate}%</td>
                          <td className="p-3 text-right">
                            {prof.gapToFloor > 0 ? (
                              <span className="text-destructive font-medium">{formatCurrencyBR(prof.gapToFloor)}</span>
                            ) : (
                              <span className="text-success text-sm">✓ OK</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-semibold text-primary">{formatCurrencyBR(prof.clinicRevenue)}</td>
                          <td className="p-3 text-right text-warning">{formatCurrencyBR(prof.pendingPayments)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-card rounded-xl border border-border/30 shadow-card p-5">
              <div className="flex items-center gap-2 mb-6"><TrendingUp className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold">Indicadores Gerais</h3></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div><p className="text-sm text-muted-foreground">Total Consultas</p><p className="text-2xl font-bold mt-1">{metrics.totalAppointments}</p></div>
                <div><p className="text-sm text-muted-foreground">Faturamento Total</p><p className="text-2xl font-bold mt-1">{formatCurrencyBR(metrics.totalRevenue)}</p></div>
                <div><p className="text-sm text-muted-foreground">Ticket Médio</p><p className="text-2xl font-bold mt-1">{formatCurrencyBR(metrics.avgTicket)}</p></div>
                <div><p className="text-sm text-muted-foreground">Taxa de Cancelamento</p><p className="text-2xl font-bold mt-1">{metrics.cancelRate.toFixed(1)}%</p></div>
              </div>
            </div>

            {/* ===== AUDITORIA — ORIGEM DOS VALORES ===== */}
            <ReportAuditPanel
              period={period}
              customMonth={customMonth}
              floorPerShift={floorPerShiftState}
            />
          </>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl h-[90vh] sm:h-[85vh] flex flex-col p-4 sm:p-6 gap-3">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              {previewData?.title || "Visualizar Relatório"}
            </DialogTitle>
            {previewData?.subtitle && (
              <p className="text-sm text-muted-foreground">{previewData.subtitle}</p>
            )}
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
            {previewLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : previewData ? (
              <div className="h-full">
                <div className="space-y-4">
                  {/* KPIs estratégicos (destaque) — apenas para relatório financeiro */}
                  {previewData.financial ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                        <div className="flex items-center gap-2 text-success"><ArrowUpCircle className="w-4 h-4" /><p className="text-xs font-medium uppercase tracking-wide">Receita Total</p></div>
                        <p className="text-2xl font-bold text-success mt-2">{formatCurrencyBR(previewData.financial.receita)}</p>
                      </div>
                      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                        <div className="flex items-center gap-2 text-destructive"><ArrowDownCircle className="w-4 h-4" /><p className="text-xs font-medium uppercase tracking-wide">Despesa Total</p></div>
                        <p className="text-2xl font-bold text-destructive mt-2">{formatCurrencyBR(previewData.financial.despesa)}</p>
                      </div>
                      <div className={cn("rounded-xl border p-4", previewData.financial.lucro >= 0 ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5")}>
                        <div className={cn("flex items-center gap-2", previewData.financial.lucro >= 0 ? "text-success" : "text-destructive")}><Wallet className="w-4 h-4" /><p className="text-xs font-medium uppercase tracking-wide">Lucro Líquido</p></div>
                        <p className={cn("text-2xl font-bold mt-2", previewData.financial.lucro >= 0 ? "text-success" : "text-destructive")}>{formatCurrencyBR(previewData.financial.lucro)}</p>
                      </div>
                      <div className={cn("rounded-xl border p-4",
                        previewData.financial.margem >= 20 ? "border-success/30 bg-success/5" :
                        previewData.financial.margem >= 10 ? "border-warning/30 bg-warning/5" : "border-destructive/30 bg-destructive/5"
                      )}>
                        <div className={cn("flex items-center gap-2",
                          previewData.financial.margem >= 20 ? "text-success" :
                          previewData.financial.margem >= 10 ? "text-warning" : "text-destructive"
                        )}><TrendingUp className="w-4 h-4" /><p className="text-xs font-medium uppercase tracking-wide">Margem</p></div>
                        <p className={cn("text-2xl font-bold mt-2",
                          previewData.financial.margem >= 20 ? "text-success" :
                          previewData.financial.margem >= 10 ? "text-warning" : "text-destructive"
                        )}>{previewData.financial.margem.toFixed(1)}%</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {previewData.summary.map((s) => (
                        <div key={s.label} className="bg-muted/30 rounded-lg border border-border/30 p-3">
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                          <p className={cn(
                            "text-lg font-bold mt-1",
                            s.tone === "success" && "text-success",
                            s.tone === "destructive" && "text-destructive",
                            s.tone === "warning" && "text-warning",
                            s.tone === "primary" && "text-primary",
                          )}>
                            {s.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* === SEÇÃO ANALÍTICA FINANCEIRA === */}
                  {previewData.financial && (() => {
                    const f = previewData.financial;
                    const VarBadge = ({ v, invert = false }: { v: number | null; invert?: boolean }) => {
                      if (v === null) return <span className="text-xs text-muted-foreground">— sem comparativo</span>;
                      const positive = invert ? v < 0 : v > 0;
                      const neutral = v === 0;
                      const cls = neutral ? "text-muted-foreground" : positive ? "text-success" : "text-destructive";
                      const arrow = neutral ? "→" : v > 0 ? "▲" : "▼";
                      return <span className={cn("text-xs font-medium", cls)}>{arrow} {Math.abs(v).toFixed(1)}% vs período anterior</span>;
                    };
                    return (
                      <div className="space-y-4">
                        {/* Alertas inteligentes */}
                        {f.alerts.length > 0 && (
                          <div className="space-y-2">
                            {f.alerts.map((a, i) => (
                              <div key={i} className={cn(
                                "flex items-start gap-2 rounded-lg border p-3 text-sm",
                                a.type === "destructive" && "border-destructive/30 bg-destructive/5 text-destructive",
                                a.type === "warning" && "border-warning/30 bg-warning/5 text-warning",
                                a.type === "success" && "border-success/30 bg-success/5 text-success",
                              )}>
                                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{a.message}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Comparação com período anterior */}
                        <div className="bg-card border border-border/30 rounded-lg p-4">
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Comparação com período anterior</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-md border border-border/30 p-3">
                              <p className="text-xs text-muted-foreground">Receita</p>
                              <p className="text-base font-bold">{formatCurrencyBR(f.receita)}</p>
                              <p className="text-xs text-muted-foreground">Anterior: {formatCurrencyBR(f.receitaPrev)}</p>
                              <VarBadge v={f.varReceita} />
                            </div>
                            <div className="rounded-md border border-border/30 p-3">
                              <p className="text-xs text-muted-foreground">Despesa</p>
                              <p className="text-base font-bold">{formatCurrencyBR(f.despesa)}</p>
                              <p className="text-xs text-muted-foreground">Anterior: {formatCurrencyBR(f.despesaPrev)}</p>
                              <VarBadge v={f.varDespesa} invert />
                            </div>
                            <div className="rounded-md border border-border/30 p-3">
                              <p className="text-xs text-muted-foreground">Lucro</p>
                              <p className={cn("text-base font-bold", f.lucro >= 0 ? "text-success" : "text-destructive")}>{formatCurrencyBR(f.lucro)}</p>
                              <p className="text-xs text-muted-foreground">Anterior: {formatCurrencyBR(f.lucroPrev)}</p>
                              <VarBadge v={f.varLucro} />
                            </div>
                          </div>
                        </div>

                        {/* Indicadores de operação */}
                        <div className="bg-card border border-border/30 rounded-lg p-4">
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Indicadores operacionais</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Total de consultas</p>
                              <p className="text-lg font-bold">{f.totalConsultas}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">no período</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Confirmadas</p>
                              <p className="text-lg font-bold text-success">{f.consultasConfirmadas}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">atendidas/concluídas</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Pagas</p>
                              <p className="text-lg font-bold text-primary">{f.consultasPagas}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">com receita registrada</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Clientes a receber</p>
                              <p className="text-lg font-bold text-warning">{f.clientesAReceber}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">total pendente</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Profissionais a pagar</p>
                              <p className="text-lg font-bold text-warning">{f.profissionaisAPagar}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">profissionais pendentes</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Receber de profissionais</p>
                              <p className="text-lg font-bold text-warning">{formatCurrencyBR(f.receberProfissionaisValor ?? 0)}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{(f.receberProfissionaisCount ?? 0)} {(f.receberProfissionaisCount ?? 0) === 1 ? "profissional pendente" : "profissionais pendentes"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Ticket médio</p>
                              <p className="text-lg font-bold">{formatCurrencyBR(f.ticketMedio)}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">receita ÷ pagas</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">% Conversão p/ pagamento</p>
                              <p className="text-lg font-bold">{f.totalConsultas > 0 ? ((f.consultasPagas / f.totalConsultas) * 100).toFixed(1) : "0"}%</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">pagas ÷ total</p>
                            </div>
                          </div>
                        </div>

                        {/* Tendência */}
                        {f.trend.length > 0 && (
                          <div className="bg-card border border-border/30 rounded-lg p-4">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Tendência no período</h4>
                            <ResponsiveContainer width="100%" height={220}>
                              <LineChart data={f.trend}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
                                <Tooltip formatter={(v: any) => formatCurrencyBR(Number(v))} />
                                <Line type="monotone" dataKey="receita" stroke="hsl(152, 60%, 42%)" strokeWidth={2} dot={false} name="Receita" />
                                <Line type="monotone" dataKey="despesa" stroke="hsl(12, 80%, 60%)" strokeWidth={2} dot={false} name="Despesa" />
                                <Line type="monotone" dataKey="lucro" stroke="hsl(175, 60%, 40%)" strokeWidth={2} dot={false} name="Lucro" />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        {/* Despesas por categoria */}
                        {f.categorias.length > 0 && (
                          <div className="bg-card border border-border/30 rounded-lg p-4">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" /> Despesas por categoria</h4>
                            <div className="space-y-2">
                              {f.categorias.map((c, i) => (
                                <div key={c.name} className="space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium flex items-center gap-2">
                                      {i === 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">Maior</span>}
                                      {c.name}
                                    </span>
                                    <span className="text-muted-foreground">{formatCurrencyBR(c.value)} • {c.percent}%</span>
                                  </div>
                                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${c.percent}%`, backgroundColor: c.color }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* === SEÇÕES ESPECÍFICAS DO RELATÓRIO POR PROFISSIONAL === */}
                  {previewReportId === "professionals" && (
                    <div className="space-y-4">
                      {/* Rendimento por Profissional (Clínica) */}
                      <div className="border border-border/30 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                          <Building2 className="w-4 h-4" /> Rendimento por Profissional (Clínica)
                        </div>
                        <div className="overflow-x-auto">
                          {clinicRevenueByProfessional.length > 0 ? (
                            <table className="w-full text-sm">
                              <thead className="bg-muted/30">
                                <tr>
                                  <th className="text-left p-3 font-semibold">Profissional</th>
                                  <th className="text-right p-3 font-semibold">Pisos Optantes</th>
                                  <th className="text-right p-3 font-semibold">Consultas</th>
                                  <th className="text-right p-3 font-semibold">Valor p/ atingir piso</th>
                                  <th className="text-right p-3 font-semibold">Receita Clínica</th>
                                </tr>
                              </thead>
                              <tbody>
                                {clinicRevenueByProfessional.map((prof, i) => (
                                  <tr key={i} className="border-t border-border/20">
                                    <td className="p-3 font-medium">{prof.name}</td>
                                    <td className="p-3 text-right">{prof.shifts}</td>
                                    <td className="p-3 text-right">{prof.consultas}</td>
                                    <td className="p-3 text-right">
                                      {prof.gapToFloor > 0 ? (
                                        <span className="text-destructive font-medium">{formatCurrencyBR(prof.gapToFloor)}</span>
                                      ) : (
                                        <span className="text-success">✓ Atingido</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-right font-semibold text-primary">{formatCurrencyBR(prof.valor)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-center text-muted-foreground py-8 text-sm">Sem dados de rendimento</p>
                          )}
                        </div>
                      </div>

                      {/* Performance Detalhada por Profissional */}
                      <div className="border border-border/30 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                          <UserCog className="w-4 h-4" /> Performance Detalhada por Profissional
                        </div>
                        <div className="overflow-x-auto">
                          {professionalPerformance.length > 0 ? (
                            <table className="w-full text-sm">
                              <thead className="bg-muted/30">
                                <tr>
                                  <th className="text-left p-3 font-semibold">Profissional</th>
                                  <th className="text-center p-3 font-semibold">Total</th>
                                  <th className="text-center p-3 font-semibold">Realizadas</th>
                                  <th className="text-center p-3 font-semibold">Canceladas</th>
                                  <th className="text-center p-3 font-semibold">% Cancel.</th>
                                  <th className="text-right p-3 font-semibold">Valor p/ piso</th>
                                  <th className="text-right p-3 font-semibold">Receita Clínica</th>
                                  <th className="text-right p-3 font-semibold">Pendente</th>
                                </tr>
                              </thead>
                              <tbody>
                                {professionalPerformance.map((prof, i) => (
                                  <tr key={i} className="border-t border-border/20 hover:bg-muted/20">
                                    <td className="p-3 font-medium">{prof.name}</td>
                                    <td className="p-3 text-center">{prof.total}</td>
                                    <td className="p-3 text-center text-success">{prof.completed}</td>
                                    <td className="p-3 text-center text-destructive">{prof.canceled}</td>
                                    <td className="p-3 text-center">{prof.cancelRate}%</td>
                                    <td className="p-3 text-right">
                                      {prof.gapToFloor > 0 ? (
                                        <span className="text-destructive font-medium">{formatCurrencyBR(prof.gapToFloor)}</span>
                                      ) : (
                                        <span className="text-success text-sm">✓ OK</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-right font-semibold text-primary">{formatCurrencyBR(prof.clinicRevenue)}</td>
                                    <td className="p-3 text-right text-warning">{formatCurrencyBR(prof.pendingPayments)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-center text-muted-foreground py-8 text-sm">Sem dados de performance</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Detalhamento de transações (secundário) */}
                  <div className="border border-border/30 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Detalhamento de transações
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr>
                          {previewData.headers.map((h) => (
                            <th key={h} className="text-left p-3 font-semibold text-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.rows.length === 0 ? (
                          <tr>
                            <td colSpan={previewData.headers.length} className="text-center p-8 text-muted-foreground">
                              Nenhum dado encontrado para o período.
                            </td>
                          </tr>
                        ) : (
                          previewData.rows.map((row, i) => (
                            <tr key={i} className="border-t border-border/20 hover:bg-muted/20">
                              {row.map((cell, j) => (
                                <td key={j} className="p-3 text-foreground/90">{cell}</td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {previewData.rows.length >= 50 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Mostrando os primeiros 50 registros. Baixe o PDF para ver todos.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>


          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            <Button
              onClick={() => previewReportId && handleExport(previewReportId)}
              disabled={previewLoading || !previewReportId}
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
