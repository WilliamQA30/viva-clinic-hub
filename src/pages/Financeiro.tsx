import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Search,
  Loader2,
  Calendar,
  FileText,
  FileSpreadsheet,
  UserCog,
  CalendarIcon,
  Trash2,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TransactionFormDialog } from "@/components/financial/TransactionFormDialog";
import { TransactionDeleteDialog, DeletableTransaction } from "@/components/financial/TransactionDeleteDialog";
import { ProfessionalPaymentsTab } from "@/components/financial/ProfessionalPaymentsTab";
import { ClientReceivablesTab } from "@/components/financial/ClientReceivablesTab";
import { exportToPDF, exportToExcel, formatDateBR, formatCurrencyBR } from "@/lib/export-utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Transaction {
  id: string;
  description: string;
  type: string;
  amount: number;
  payment_method: string | null;
  transaction_date: string;
  transaction_time: string;
  professional_id: string | null;
  appointment_id: string | null;
  professionals?: { name: string } | null;
  appointments?: {
    appointment_date: string;
    appointment_time: string;
    patients: { name: string } | null;
  } | null;
}

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  boleto: "Boleto",
  transferencia: "Transferência",
};

const paymentMethodIcons: Record<string, typeof CreditCard> = {
  pix: Wallet,
  dinheiro: DollarSign,
  cartao_credito: CreditCard,
  cartao_debito: CreditCard,
  boleto: FileText,
  transferencia: Wallet,
};

export default function Financeiro() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [appointmentStats, setAppointmentStats] = useState({
    confirmed: 0,
    paid: 0,
    free: 0,
    clientReceivable: 0,
    professionalReceivable: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [transactionType, setTransactionType] = useState<"entrada" | "saida">("entrada");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "entrada" | "saida">("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [filterPeriod, setFilterPeriod] = useState<string>("month");
  const [activeTab, setActiveTab] = useState("transactions");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(undefined);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<DeletableTransaction | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTransactions();
    fetchAppointmentStats();
  }, [filterPeriod, customDateFrom, customDateTo]);

  const getDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (filterPeriod === "custom" && customDateFrom && customDateTo) {
      return { 
        start: format(customDateFrom, "yyyy-MM-dd"), 
        end: format(customDateTo, "yyyy-MM-dd") 
      };
    }
    
    switch (filterPeriod) {
      case "today":
        return { start: today.toISOString().split("T")[0], end: today.toISOString().split("T")[0] };
      case "week":
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6);
        return { start: weekStart.toISOString().split("T")[0], end: today.toISOString().split("T")[0] };
      case "month":
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month
        return { start: monthStart.toISOString().split("T")[0], end: monthEnd.toISOString().split("T")[0] };
      case "year":
        const yearStart = new Date(today.getFullYear(), 0, 1);
        const yearEnd = new Date(today.getFullYear(), 11, 31); // Last day of current year
        return { start: yearStart.toISOString().split("T")[0], end: yearEnd.toISOString().split("T")[0] };
      default:
        return { start: today.toISOString().split("T")[0], end: today.toISOString().split("T")[0] };
    }
  };

  const fetchTransactions = async () => {
    setIsLoading(true);
    const { start, end } = getDateRange();
    
    const { data, error } = await supabase
      .from("transactions")
      .select(`
        *,
        professionals (name),
        appointments (
          appointment_date,
          appointment_time,
          patients (name)
        )
      `)
      .gte("transaction_date", start)
      .lte("transaction_date", end)
      .order("transaction_date", { ascending: false })
      .order("transaction_time", { ascending: false });

    if (error) {
      toast({
        title: "Erro ao carregar transações",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setTransactions(data || []);
    }
    setIsLoading(false);
  };

  const fetchAppointmentStats = async () => {
    const { start, end } = getDateRange();

    // Confirmed appointments (excluding cancellations/non-charged absences) within the period
    const { data: apptsRaw, error } = await supabase
      .from("appointments")
      .select("id, status, consultation_value, payment_status, no_show_charged")
      .gte("appointment_date", start)
      .lte("appointment_date", end)
      .in("status", ["confirmado", "concluido", "atendido", "cliente_faltou"]);

    if (error || !apptsRaw) {
      setAppointmentStats({ confirmed: 0, paid: 0, free: 0, clientReceivable: 0, professionalReceivable: 0 });
      return;
    }

    // Excluir faltas não cobradas — não impactam financeiro
    const appts = apptsRaw.filter(
      (a: any) => a.status !== "cliente_faltou" || a.no_show_charged === true
    );

    const confirmed = appts.length;
    const free = appts.filter((a) => !a.consultation_value || Number(a.consultation_value) === 0).length;
    const paidAppts = appts.filter(
      (a) => a.payment_status === "pago" && Number(a.consultation_value || 0) > 0
    );
    const paid = paidAppts.length;
    const clientReceivable = appts.filter(
      (a) =>
        Number(a.consultation_value || 0) > 0 &&
        (!a.payment_status || a.payment_status === "pendente")
    ).length;

    // Professional receivables: appointments where professional received from client
    // and clinic still has commission to receive (payment_destination = 'professional', is_paid = false)
    const apptIds = appts.map((a) => a.id);
    let professionalReceivable = 0;
    if (apptIds.length > 0) {
      const { data: profPayments } = await supabase
        .from("professional_payments")
        .select("appointment_id, payment_destination, is_paid")
        .in("appointment_id", apptIds)
        .eq("payment_destination", "professional")
        .eq("is_paid", false);
      professionalReceivable = profPayments?.length || 0;
    }

    setAppointmentStats({ confirmed, paid, free, clientReceivable, professionalReceivable });
  };

  const filteredTransactions = transactions.filter((t) => {
    const normalizedSearch = searchTerm.toLowerCase();
    const matchesSearch =
      t.description.toLowerCase().includes(normalizedSearch) ||
      (t.professionals?.name || "").toLowerCase().includes(normalizedSearch) ||
      (t.appointments?.patients?.name || "").toLowerCase().includes(normalizedSearch);
    const matchesType = filterType === "all" || t.type === filterType;
    const matchesPayment = filterPayment === "all" || t.payment_method === filterPayment;
    return matchesSearch && matchesType && matchesPayment;
  });

  const totalEntrada = filteredTransactions
    .filter((t) => t.type === "entrada")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSaida = filteredTransactions
    .filter((t) => t.type === "saida")
    .reduce((sum, t) => sum + t.amount, 0);

  const saldo = totalEntrada - totalSaida;

  const getPeriodLabel = () => {
    if (filterPeriod === "custom" && customDateFrom && customDateTo) {
      return `${format(customDateFrom, "dd/MM/yyyy")} a ${format(customDateTo, "dd/MM/yyyy")}`;
    }
    return filterPeriod === "today" ? "Hoje" : filterPeriod === "week" ? "Última Semana" : filterPeriod === "month" ? "Este Mês" : "Este Ano";
  };

  const handleExportPDF = () => {
    const data = {
      title: "Relatório Financeiro",
      subtitle: `Período: ${getPeriodLabel()}`,
      headers: ["Data", "Descrição", "Tipo", "Pagamento", "Valor"],
      rows: filteredTransactions.map((t) => [
        formatDateBR(t.transaction_date),
        t.description,
        t.type === "entrada" ? "Entrada" : "Saída",
        paymentMethodLabels[t.payment_method || ""] || t.payment_method || "-",
        formatCurrencyBR(t.amount),
      ]),
    };
    exportToPDF(data, "relatorio-financeiro");
    toast({ title: "PDF exportado com sucesso!" });
  };

  const handleExportExcel = () => {
    const data = {
      title: "Relatório Financeiro",
      subtitle: `Período: ${getPeriodLabel()}`,
      headers: ["Data", "Hora", "Descrição", "Tipo", "Pagamento", "Profissional", "Valor"],
      rows: filteredTransactions.map((t) => [
        formatDateBR(t.transaction_date),
        t.transaction_time,
        t.description,
        t.type === "entrada" ? "Entrada" : "Saída",
        paymentMethodLabels[t.payment_method || ""] || t.payment_method || "-",
        t.professionals?.name || "-",
        t.amount,
      ]),
    };
    exportToExcel(data, "relatorio-financeiro");
    toast({ title: "Excel exportado com sucesso!" });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-header">Financeiro</h1>
            <p className="page-subtitle">Controle de caixa e movimentações</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="text-success border-success/30 hover:bg-success/10"
              onClick={() => {
                setTransactionType("entrada");
                setShowTransactionDialog(true);
              }}
            >
              <ArrowUpRight className="w-4 h-4 mr-2" />
              Entrada
            </Button>
            <Button
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => {
                setTransactionType("saida");
                setShowTransactionDialog(true);
              }}
            >
              <ArrowDownRight className="w-4 h-4 mr-2" />
              Saída
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Caixa
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Receber de Clientes
            </TabsTrigger>
            <TabsTrigger value="professionals" className="flex items-center gap-2">
              <UserCog className="w-4 h-4" />
              Profissionais
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Saldo do Período"
                value={`R$ ${saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                change={saldo >= 0 ? "Positivo" : "Negativo"}
                changeType={saldo >= 0 ? "positive" : "negative"}
                icon={DollarSign}
                iconColor="primary"
              />
              <StatCard
                title="Total Entradas"
                value={`R$ ${totalEntrada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                change={`${filteredTransactions.filter((t) => t.type === "entrada").length} transações`}
                changeType="positive"
                icon={TrendingUp}
                iconColor="success"
              />
              <StatCard
                title="Total Saídas"
                value={`R$ ${totalSaida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                change={`${filteredTransactions.filter((t) => t.type === "saida").length} transações`}
                changeType="negative"
                icon={TrendingDown}
                iconColor="accent"
              />
              <div className="bg-card rounded-xl border border-border/30 shadow-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Consultas Confirmadas
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {appointmentStats.confirmed}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <CalendarCheck className="w-5 h-5 text-warning" />
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Pagas</span>
                    <span className="font-medium text-success">{appointmentStats.paid}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Gratuitas</span>
                    <span className="font-medium text-muted-foreground">{appointmentStats.free}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Clientes a receber</span>
                    <span className="font-medium text-warning">{appointmentStats.clientReceivable}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Receber de profissionais</span>
                    <span className="font-medium text-destructive">{appointmentStats.professionalReceivable}</span>
                  </div>
                </div>
              </div>
            </div>

        {/* Filters */}
        <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar transações..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Select value={filterPeriod} onValueChange={(v) => {
                setFilterPeriod(v);
                if (v !== "custom") {
                  setCustomDateFrom(undefined);
                  setCustomDateTo(undefined);
                }
              }}>
                <SelectTrigger className="w-[140px]">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Última Semana</SelectItem>
                  <SelectItem value="month">Este Mês</SelectItem>
                  <SelectItem value="year">Este Ano</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>

              {filterPeriod === "custom" && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[130px] justify-start text-left font-normal",
                          !customDateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateFrom ? format(customDateFrom, "dd/MM/yy") : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={customDateFrom}
                        onSelect={setCustomDateFrom}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[130px] justify-start text-left font-normal",
                          !customDateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateTo ? format(customDateTo, "dd/MM/yy") : "Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={customDateTo}
                        onSelect={setCustomDateTo}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </>
              )}

              <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                <SelectTrigger className="w-[130px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterPayment} onValueChange={setFilterPayment}>
                <SelectTrigger className="w-[150px]">
                  <CreditCard className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(paymentMethodLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-card rounded-xl border border-border/30 shadow-card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border/30">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Movimentações</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {filteredTransactions.length} transações encontradas
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <DollarSign className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground">Nenhuma transação encontrada</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Registre entradas e saídas para visualizar o histórico
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left p-4 table-header">Descrição</th>
                    <th className="text-left p-4 table-header hidden md:table-cell">Profissional</th>
                    <th className="text-left p-4 table-header hidden sm:table-cell">Pagamento</th>
                    <th className="text-left p-4 table-header hidden lg:table-cell">Data</th>
                    <th className="text-right p-4 table-header">Valor</th>
                    <th className="text-right p-4 table-header w-16">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredTransactions.map((transaction) => {
                    const PaymentIcon = paymentMethodIcons[transaction.payment_method || ""] || CreditCard;

                    return (
                      <tr key={transaction.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                transaction.type === "entrada"
                                  ? "bg-success/10"
                                  : "bg-destructive/10"
                              )}
                            >
                              {transaction.type === "entrada" ? (
                                <ArrowUpRight className="w-5 h-5 text-success" />
                              ) : (
                                <ArrowDownRight className="w-5 h-5 text-destructive" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground break-words">{transaction.description}</p>
                              {transaction.appointments?.patients?.name && (
                                <p className="text-sm text-muted-foreground break-words">
                                  Paciente: {transaction.appointments.patients.name}
                                  {transaction.appointments.appointment_date && (
                                    <>
                                      {" · Consulta: "}
                                      {formatDateBR(transaction.appointments.appointment_date)}
                                      {transaction.appointments.appointment_time ? ` às ${transaction.appointments.appointment_time.slice(0, 5)}` : ""}
                                    </>
                                  )}
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground sm:hidden">
                                {formatDateBR(transaction.transaction_date)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 hidden md:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {transaction.professionals?.name || "-"}
                          </span>
                        </td>
                        <td className="p-4 hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <PaymentIcon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {paymentMethodLabels[transaction.payment_method || ""] || transaction.payment_method || "-"}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 hidden lg:table-cell">
                          <div className="text-sm text-muted-foreground">
                            <p>{formatDateBR(transaction.transaction_date)}</p>
                            <p className="text-xs">{transaction.transaction_time}</p>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <span
                            className={cn(
                              "font-semibold",
                              transaction.type === "entrada"
                                ? "text-success"
                                : "text-destructive"
                            )}
                          >
                            {transaction.type === "entrada" ? "+" : "-"}R${" "}
                            {transaction.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setDeleteTarget(transaction);
                              setShowDeleteDialog(true);
                            }}
                            title="Excluir movimentação"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </TabsContent>

          <TabsContent value="clients">
            <ClientReceivablesTab />
          </TabsContent>

          <TabsContent value="professionals">
            <ProfessionalPaymentsTab />
          </TabsContent>
        </Tabs>
      </div>

      <TransactionFormDialog
        open={showTransactionDialog}
        onOpenChange={setShowTransactionDialog}
        onSuccess={fetchTransactions}
        defaultType={transactionType}
      />

      <TransactionDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        transaction={deleteTarget}
        onSuccess={() => {
          setDeleteTarget(null);
          fetchTransactions();
        }}
      />
    </MainLayout>
  );
}
