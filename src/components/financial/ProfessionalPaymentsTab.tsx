import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  Loader2, 
  UserCog, 
  DollarSign, 
  CheckCircle, 
  Clock,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Pencil,
  CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateBR, formatCurrencyBR } from "@/lib/export-utils";
import { formatCurrency } from "@/lib/validations";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProfessionalPayment {
  id: string;
  professional_id: string;
  appointment_id: string;
  total_value: number;
  professional_amount: number;
  clinic_amount: number;
  is_paid: boolean;
  paid_at: string | null;
  payment_method: string | null;
  created_at: string;
  professionals: { name: string } | null;
  appointments: { 
    appointment_date: string;
    status: string;
    patients: { name: string } | null;
  } | null;
  payment_destination?: string;
}

interface Professional {
  id: string;
  name: string;
  total_pending: number;
  total_paid: number;
  debt_pending: number;
  debt_paid: number;
}

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  transferencia: "Transferência",
};

export function ProfessionalPaymentsTab() {
  const [payments, setPayments] = useState<ProfessionalPayment[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "paid">("pending");
  const [filterProfessional, setFilterProfessional] = useState<string>("all");
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [receivedDate, setReceivedDate] = useState<Date | undefined>(undefined);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"pay_professionals" | "receive_from_professionals">("receive_from_professionals");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPayment, setEditingPayment] = useState<ProfessionalPayment | null>(null);
  const [editTotalValue, setEditTotalValue] = useState("");
  const [editClinicPercentage, setEditClinicPercentage] = useState("25");
  const { toast } = useToast();

  useEffect(() => {
    fetchPayments();
    fetchProfessionals();
  }, []);

  const fetchPayments = async () => {
    setIsLoading(true);
    
    const { data: paymentsData, error: paymentsError } = await supabase
      .from("professional_payments")
      .select(`
        *,
        professionals (name),
        appointments (
          appointment_date,
          status,
          patients (name)
        )
      `)
      .order("created_at", { ascending: false });

    if (paymentsError) {
      toast({
        title: "Erro ao carregar pagamentos",
        description: paymentsError.message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Filter out cancelled appointments
    const validPayments = (paymentsData || []).filter(
      payment => payment.appointments?.status !== "cancelado"
    ) as ProfessionalPayment[];

    setPayments(validPayments);
    setIsLoading(false);
  };

  const fetchProfessionals = async () => {
    const { data, error } = await supabase
      .from("professionals")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      // Fetch all payments with appointment status and payment_destination
      const { data: paymentsData } = await supabase
        .from("professional_payments")
        .select("professional_id, professional_amount, clinic_amount, is_paid, appointment_id, payment_destination, appointments(status)");

      // Filter out cancelled appointments
      const validPayments = (paymentsData || []).filter(
        p => (p.appointments as any)?.status !== "cancelado"
      );

      const professionalsWithTotals = data.map(prof => {
        const profPayments = validPayments.filter(p => p.professional_id === prof.id);
        
        // Use payment_destination column to determine flow
        const clinicReceivedPayments = profPayments.filter(p => (p as any).payment_destination === "clinic");
        const professionalReceivedPayments = profPayments.filter(p => (p as any).payment_destination === "professional");

        return {
          ...prof,
          total_pending: clinicReceivedPayments.filter(p => !p.is_paid).reduce((sum, p) => sum + p.professional_amount, 0),
          total_paid: clinicReceivedPayments.filter(p => p.is_paid).reduce((sum, p) => sum + p.professional_amount, 0),
          debt_pending: professionalReceivedPayments.filter(p => !p.is_paid).reduce((sum, p) => sum + p.clinic_amount, 0),
          debt_paid: professionalReceivedPayments.filter(p => p.is_paid).reduce((sum, p) => sum + p.clinic_amount, 0),
        };
      });

      setProfessionals(professionalsWithTotals);
    }
  };

  // Filter payments based on sub-tab
  const getFilteredPayments = () => {
    const baseFiltered = payments.filter((p) => {
      const matchesSearch = 
        p.professionals?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.appointments?.patients?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = 
        filterStatus === "all" || 
        (filterStatus === "pending" && !p.is_paid) ||
        (filterStatus === "paid" && p.is_paid);
      const matchesProfessional = 
        filterProfessional === "all" || p.professional_id === filterProfessional;
      
      // Filter by sub-tab using payment_destination
      const matchesSubTab = activeSubTab === "pay_professionals" 
        ? p.payment_destination === "clinic"  // Clinic received, owes professional
        : p.payment_destination === "professional"; // Professional received, owes clinic
      
      return matchesSearch && matchesStatus && matchesProfessional && matchesSubTab;
    });
    return baseFiltered;
  };

  const filteredPayments = getFilteredPayments();

  // Calculate totals based on sub-tab
  const getTotals = () => {
    if (activeSubTab === "pay_professionals") {
      return {
        pending: professionals.reduce((sum, p) => sum + p.total_pending, 0),
        paid: professionals.reduce((sum, p) => sum + p.total_paid, 0),
      };
    } else {
      return {
        pending: professionals.reduce((sum, p) => sum + p.debt_pending, 0),
        paid: professionals.reduce((sum, p) => sum + p.debt_paid, 0),
      };
    }
  };

  const totals = getTotals();

  const handleSelectPayment = (id: string) => {
    setSelectedPayments(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const pendingIds = filteredPayments.filter(p => !p.is_paid).map(p => p.id);
    if (selectedPayments.length === pendingIds.length) {
      setSelectedPayments([]);
    } else {
      setSelectedPayments(pendingIds);
    }
  };

  const handlePaySelected = async () => {
    if (!paymentMethod) {
      toast({
        title: "Selecione a forma de pagamento",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const effectiveDate = receivedDate ?? new Date();
      const effectiveDateStr = format(effectiveDate, "yyyy-MM-dd");

      const { error } = await supabase
        .from("professional_payments")
        .update({ 
          is_paid: true, 
          paid_at: effectiveDate.toISOString(),
          payment_method: paymentMethod 
        })
        .in("id", selectedPayments);

      if (error) throw error;

      const selectedPaymentData = payments.filter(p => selectedPayments.includes(p.id));

      for (const payment of selectedPaymentData) {
        const apptDate = payment.appointments?.appointment_date
          ? formatDateBR(payment.appointments.appointment_date)
          : "";

        const isPayingProfessional = activeSubTab === "pay_professionals";
        const transactionType = isPayingProfessional ? "saida" : "entrada";
        const transactionAmount = isPayingProfessional ? payment.professional_amount : payment.clinic_amount;
        const description = isPayingProfessional
          ? `Repasse profissional - ${payment.appointments?.patients?.name || "Paciente"} - ${payment.professionals?.name || "Profissional"}${apptDate ? ` - ${apptDate}` : ""}`
          : `Recebimento comissão - ${payment.appointments?.patients?.name || "Paciente"} - ${payment.professionals?.name || "Profissional"}${apptDate ? ` - ${apptDate}` : ""}`;

        // Não gera movimentação financeira zerada e evita duplicação por reprocessamento.
        if ((transactionAmount || 0) <= 0) continue;

        const { data: existingTransactions, error: existingError } = await supabase
          .from("transactions")
          .select("id")
          .eq("appointment_id", payment.appointment_id)
          .eq("type", transactionType)
          .eq("amount", transactionAmount)
          .limit(1);

        if (existingError) throw existingError;
        if ((existingTransactions || []).length > 0) continue;

        const { error: insertError } = await supabase.from("transactions").insert({
          description,
          type: transactionType,
          amount: transactionAmount,
          payment_method: paymentMethod,
          transaction_date: effectiveDateStr,
          transaction_time: new Date().toTimeString().slice(0, 5),
          professional_id: payment.professional_id,
          appointment_id: payment.appointment_id,
        });

        if (insertError) throw insertError;
      }

      toast({
        title: activeSubTab === "pay_professionals" ? "Repasses realizados!" : "Débitos quitados!",
        description:
          activeSubTab === "pay_professionals"
            ? `${selectedPayments.length} repasse(s) ao(s) profissional(is) registrado(s) como saída no caixa.`
            : `${selectedPayments.length} débito(s) de profissional(is) marcado(s) como recebido(s).`,
      });

      setSelectedPayments([]);
      setShowPayDialog(false);
      setPaymentMethod("");
      setReceivedDate(undefined);
      fetchPayments();
      fetchProfessionals();
    } catch (error: any) {
      toast({
        title: "Erro ao processar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedTotal = payments
    .filter(p => selectedPayments.includes(p.id))
    .reduce((sum, p) => {
      return sum + (activeSubTab === "pay_professionals" ? p.professional_amount : p.clinic_amount);
    }, 0);

  const handleSubTabChange = (value: string) => {
    setActiveSubTab(value as "pay_professionals" | "receive_from_professionals");
    setSelectedPayments([]);
    setFilterStatus("pending");
  };

  const handleEditPayment = (payment: ProfessionalPayment) => {
    setEditingPayment(payment);
    setEditTotalValue(formatCurrency(payment.total_value));
    const pct = payment.total_value > 0 ? Math.round((payment.clinic_amount / payment.total_value) * 100) : 25;
    setEditClinicPercentage(pct.toString());
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPayment) return;
    setIsProcessing(true);
    try {
      const numValue = parseFloat(editTotalValue.replace(/[^\d,]/g, "").replace(",", ".")) ||
                       parseFloat(editTotalValue.replace(/\D/g, "")) / 100;
      const pct = parseInt(editClinicPercentage) || 25;
      const clinicAmt = numValue * (pct / 100);
      const profAmt = numValue - clinicAmt;

      const { error } = await supabase
        .from("professional_payments")
        .update({
          total_value: numValue,
          clinic_amount: clinicAmt,
          professional_amount: profAmt,
        })
        .eq("id", editingPayment.id);

      if (error) throw error;

      // If payment was already processed, update related transaction
      if (editingPayment.is_paid && editingPayment.appointment_id) {
        const { data: txns } = await supabase
          .from("transactions")
          .select("id")
          .eq("appointment_id", editingPayment.appointment_id)
          .limit(1);

        if (txns && txns.length > 0) {
          await supabase
            .from("transactions")
            .update({ amount: clinicAmt })
            .eq("id", txns[0].id);
        }
      }

      toast({ title: "Valores atualizados com sucesso!" });
      setShowEditDialog(false);
      setEditingPayment(null);
      fetchPayments();
      fetchProfessionals();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    const numValue = parseInt(value) / 100;
    if (!isNaN(numValue) && numValue > 0) {
      setEditTotalValue(formatCurrency(numValue));
    } else {
      setEditTotalValue("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <Tabs value={activeSubTab} onValueChange={handleSubTabChange} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="receive_from_professionals" className="flex items-center gap-2">
            <ArrowDownRight className="w-4 h-4" />
            Receber de Profissionais
          </TabsTrigger>
          <TabsTrigger value="pay_professionals" className="flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4" />
            Pagar Profissionais
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cn(
          "p-4 rounded-xl border",
          activeSubTab === "pay_professionals" 
            ? "bg-destructive/10 border-destructive/30" 
            : "bg-warning/10 border-warning/30"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              activeSubTab === "pay_professionals" ? "bg-destructive/20" : "bg-warning/20"
            )}>
              <Clock className={cn(
                "w-5 h-5",
                activeSubTab === "pay_professionals" ? "text-destructive" : "text-warning"
              )} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {activeSubTab === "pay_professionals" ? "A Pagar" : "A Receber"}
              </p>
              <p className={cn(
                "text-xl font-bold",
                activeSubTab === "pay_professionals" ? "text-destructive" : "text-warning"
              )}>
                {formatCurrencyBR(totals.pending)}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-success/10 border border-success/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {activeSubTab === "pay_professionals" ? "Pago" : "Recebido"}
              </p>
              <p className="text-xl font-bold text-success">
                {formatCurrencyBR(totals.paid)}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <UserCog className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Profissionais</p>
              <p className="text-xl font-bold text-primary">{professionals.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por profissional ou paciente..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="paid">{activeSubTab === "pay_professionals" ? "Pagos" : "Recebidos"}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterProfessional} onValueChange={setFilterProfessional}>
            <SelectTrigger className="w-[180px]">
              <UserCog className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Profissional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {professionals.map((prof) => (
                <SelectItem key={prof.id} value={prof.id}>
                  {prof.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedPayments.length > 0 && (
            <Button
              onClick={() => setShowPayDialog(true)}
              className="gradient-primary border-0"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              {activeSubTab === "pay_professionals" ? "Pagar" : "Receber"} ({selectedPayments.length})
            </Button>
          )}
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-card rounded-xl border border-border/30 shadow-card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border/30">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {activeSubTab === "pay_professionals" 
                ? "Pagamentos aos Profissionais" 
                : "Débitos dos Profissionais"}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredPayments.length} registro(s) encontrado(s)
            </p>
          </div>
          {filteredPayments.filter(p => !p.is_paid).length > 0 && (
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedPayments.length === filteredPayments.filter(p => !p.is_paid).length 
                ? "Desmarcar Todos" 
                : "Selecionar Todos Pendentes"}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              {activeSubTab === "pay_professionals" ? (
                <ArrowUpRight className="w-8 h-8 text-muted-foreground" />
              ) : (
                <ArrowDownRight className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <h3 className="font-semibold text-foreground">
              {activeSubTab === "pay_professionals" 
                ? "Nenhum pagamento encontrado" 
                : "Nenhum débito encontrado"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {activeSubTab === "pay_professionals"
                ? "Pagamentos são gerados quando consultas são pagas à clínica"
                : "Débitos são gerados quando pacientes pagam diretamente ao profissional"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left p-4 table-header w-10"></th>
                  <th className="text-left p-4 table-header">Profissional</th>
                  <th className="text-left p-4 table-header hidden md:table-cell">Paciente</th>
                  <th className="text-left p-4 table-header hidden lg:table-cell">Data Consulta</th>
                  <th className="text-right p-4 table-header">Valor Total</th>
                  <th className="text-right p-4 table-header">
                    {activeSubTab === "pay_professionals" ? "Profissional (75%)" : "Clínica (25%)"}
                  </th>
                  <th className="text-center p-4 table-header">Status</th>
                  <th className="text-center p-4 table-header w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredPayments.map((payment) => (
                  <tr 
                    key={payment.id} 
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      selectedPayments.includes(payment.id) && "bg-primary/5"
                    )}
                  >
                    <td className="p-4">
                      {!payment.is_paid && (
                        <input
                          type="checkbox"
                          checked={selectedPayments.includes(payment.id)}
                          onChange={() => handleSelectPayment(payment.id)}
                          className="w-4 h-4 rounded border-border"
                        />
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <UserCog className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium">{payment.professionals?.name || "-"}</span>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {payment.appointments?.patients?.name || "-"}
                      </span>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {payment.appointments?.appointment_date 
                          ? formatDateBR(payment.appointments.appointment_date)
                          : "-"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-medium">{formatCurrencyBR(payment.total_value)}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className={cn(
                        "font-semibold",
                        activeSubTab === "pay_professionals" ? "text-primary" : "text-warning"
                      )}>
                        {formatCurrencyBR(activeSubTab === "pay_professionals" 
                          ? payment.professional_amount 
                          : payment.clinic_amount)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <Badge 
                        variant="outline"
                        className={cn(
                          "border",
                          payment.is_paid 
                            ? "bg-success/10 text-success border-success/30" 
                            : "bg-destructive/10 text-destructive border-destructive/30"
                        )}
                      >
                        {payment.is_paid 
                          ? (activeSubTab === "pay_professionals" ? "Pago" : "Recebido") 
                          : "Pendente"}
                      </Badge>
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEditPayment(payment)}
                        title="Editar valores"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pay/Receive Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-primary-foreground" />
              </div>
              {activeSubTab === "pay_professionals" 
                ? "Confirmar Pagamento" 
                : "Confirmar Recebimento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground">
                {activeSubTab === "pay_professionals" ? "Total a pagar" : "Total a receber"}
              </p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrencyBR(selectedTotal)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedPayments.length} registro(s) selecionado(s)
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {activeSubTab === "pay_professionals" ? "Data do Pagamento" : "Data do Recebimento"}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !receivedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {receivedDate ? format(receivedDate, "dd/MM/yyyy", { locale: ptBR }) : "Hoje (padrão)"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={receivedDate}
                    onSelect={setReceivedDate}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Deixe vazio para usar a data de hoje. Use uma data passada para registrar movimentações retroativas.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Forma de Pagamento</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <CreditCard className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentMethodLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => setShowPayDialog(false)}
                disabled={isProcessing}
              >
                Cancelar
              </Button>
              <Button 
                className="flex-1 gradient-primary border-0" 
                onClick={handlePaySelected}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  activeSubTab === "pay_professionals" ? "Confirmar Pagamento" : "Confirmar Recebimento"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Pencil className="w-4 h-4 text-primary" />
              </div>
              Editar Valores
            </DialogTitle>
          </DialogHeader>

          {editingPayment && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profissional</span>
                  <span className="font-medium">{editingPayment.professionals?.name}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Paciente</span>
                  <span className="font-medium">{editingPayment.appointments?.patients?.name}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Valor Total da Consulta</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="R$ 0,00"
                    className="pl-10"
                    value={editTotalValue}
                    onChange={handleEditCurrencyChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">% Clínica</label>
                <Select value={editClinicPercentage} onValueChange={setEditClinicPercentage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 15, 20, 25, 30, 35, 40, 50].map(pct => (
                      <SelectItem key={pct} value={pct.toString()}>{pct}%</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editTotalValue && (
                <div className="p-3 rounded-lg border border-border/30 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Clínica ({editClinicPercentage}%)</span>
                    <span className="font-medium">
                      {formatCurrencyBR(
                        (parseFloat(editTotalValue.replace(/[^\d,]/g, "").replace(",", ".")) || parseFloat(editTotalValue.replace(/\D/g, "")) / 100 || 0) * (parseInt(editClinicPercentage) / 100)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profissional ({100 - parseInt(editClinicPercentage)}%)</span>
                    <span className="font-medium">
                      {formatCurrencyBR(
                        (parseFloat(editTotalValue.replace(/[^\d,]/g, "").replace(",", ".")) || parseFloat(editTotalValue.replace(/\D/g, "")) / 100 || 0) * ((100 - parseInt(editClinicPercentage)) / 100)
                      )}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)} disabled={isProcessing}>
                  Cancelar
                </Button>
                <Button className="flex-1 gradient-primary border-0" onClick={handleSaveEdit} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
