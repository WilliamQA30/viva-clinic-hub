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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  Loader2,
  DollarSign,
  CheckCircle,
  Clock,
  CreditCard,
  Users,
  AlertCircle,
  CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateBR, formatCurrencyBR } from "@/lib/export-utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingAppointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  consultation_value: number | null;
  payment_status: string | null;
  payment_method: string | null;
  status: string;
  type: string;
  patients: { name: string } | null;
  professionals: { name: string } | null;
  professional_id: string;
  patient_id: string;
  clinic_percentage: number | null;
  is_package: boolean | null;
  package_session_number: number | null;
  package_total_sessions: number | null;
  no_show_charged: boolean | null;
}

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  boleto: "Boleto",
  transferencia: "Transferência",
};

export function ClientReceivablesTab() {
  const [appointments, setAppointments] = useState<PendingAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"pending" | "all">("pending");
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<PendingAppointment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReceiver, setPaymentReceiver] = useState<"clinic" | "professional">("professional");
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(undefined);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingAppointments();
  }, []);

  const fetchPendingAppointments = async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        appointment_time,
        consultation_value,
        payment_status,
        payment_method,
        status,
        type,
        professional_id,
        patient_id,
        clinic_percentage,
        is_package,
        package_session_number,
        package_total_sessions,
        no_show_charged,
        patients (name),
        professionals (name)
      `)
      .in("status", ["confirmado", "concluido", "atendido", "cliente_faltou"])
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: false });

    if (error) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Keep only paid appointments OR active ones that have financial impact:
      //  - status confirmado/atendido/concluido com valor > 0
      //  - status cliente_faltou APENAS se profissional cobrou
      const allAppts = ((data || []) as PendingAppointment[]).filter((a) => {
        if ((a.consultation_value ?? 0) <= 0) return false;
        if (a.status === "cliente_faltou") return a.no_show_charged === true;
        return true;
      });
      setAppointments(allAppts);
    }
    setIsLoading(false);
  };

  const filteredAppointments = appointments.filter((a) => {
    const matchesSearch =
      a.patients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.professionals?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const isPending = !a.payment_status || a.payment_status === "pendente";
    const matchesStatus = filterStatus === "all" || (filterStatus === "pending" && isPending);

    return matchesSearch && matchesStatus;
  });

  const totalPending = filteredAppointments
    .filter((a) => !a.payment_status || a.payment_status === "pendente")
    .reduce((sum, a) => sum + (a.consultation_value || 0), 0);

  const totalPendingCount = filteredAppointments.filter(
    (a) => !a.payment_status || a.payment_status === "pendente"
  ).length;

  const handleMarkAsPaid = (appointment: PendingAppointment) => {
    setSelectedAppointment(appointment);
    setPaymentMethod("");
    setPaymentReceiver("professional");
    setPaymentDate(undefined);
    setShowPayDialog(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedAppointment || !paymentMethod) {
      toast({ title: "Selecione a forma de pagamento", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      // Update appointment payment status
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          payment_status: "pago",
          payment_method: paymentMethod,
        })
        .eq("id", selectedAppointment.id);

      if (updateError) throw updateError;

      const value = selectedAppointment.consultation_value || 0;

      if (value > 0) {
        const clinicPercentage = selectedAppointment.clinic_percentage ?? 25;
        const clinicAmount = value * (clinicPercentage / 100);
        const professionalAmount = value - clinicAmount;

        // Only create cash inflow when the CLINIC actually received the money
        if (paymentReceiver === "clinic") {
          const { data: existingTransactions, error: transactionLookupError } = await supabase
            .from("transactions")
            .select("id")
            .eq("appointment_id", selectedAppointment.id)
            .eq("type", "entrada")
            .eq("amount", value)
            .limit(1);

          if (transactionLookupError) throw transactionLookupError;

          if ((existingTransactions || []).length === 0) {
            const txDate = paymentDate
              ? format(paymentDate, "yyyy-MM-dd")
              : new Date().toISOString().split("T")[0];
            const { error: transactionInsertError } = await supabase.from("transactions").insert({
              description: `Consulta - ${selectedAppointment.patients?.name || "Paciente"} - ${selectedAppointment.professionals?.name || "Profissional"} - ${formatDateBR(selectedAppointment.appointment_date)}`,
              type: "entrada",
              amount: value,
              payment_method: paymentMethod,
              transaction_date: txDate,
              transaction_time: new Date().toTimeString().slice(0, 5),
              professional_id: selectedAppointment.professional_id,
              appointment_id: selectedAppointment.id,
            });

            if (transactionInsertError) throw transactionInsertError;
          }
        }

        // Always register the commission split, with proper destination
        const { data: existingProfessionalPayments, error: paymentLookupError } = await supabase
          .from("professional_payments")
          .select("id")
          .eq("appointment_id", selectedAppointment.id)
          .limit(1);

        if (paymentLookupError) throw paymentLookupError;

        if ((existingProfessionalPayments || []).length === 0) {
          const { error: professionalPaymentInsertError } = await supabase.from("professional_payments").insert({
            professional_id: selectedAppointment.professional_id,
            appointment_id: selectedAppointment.id,
            total_value: value,
            clinic_amount: clinicAmount,
            professional_amount: professionalAmount,
            payment_destination: paymentReceiver,
            payment_method: paymentMethod,
          });

          if (professionalPaymentInsertError) throw professionalPaymentInsertError;
        } else {
          // Update destination/method if record already exists (keeps consistency)
          const { error: updatePaymentError } = await supabase
            .from("professional_payments")
            .update({
              payment_destination: paymentReceiver,
              payment_method: paymentMethod,
            })
            .eq("appointment_id", selectedAppointment.id)
            .eq("is_paid", false);

          if (updatePaymentError) throw updatePaymentError;
        }
      }

      toast({
        title: "Pagamento registrado!",
        description: `Pagamento de ${selectedAppointment.patients?.name} registrado com sucesso.`,
      });

      setShowPayDialog(false);
      setSelectedAppointment(null);
      fetchPendingAppointments();
    } catch (error: any) {
      toast({
        title: "Erro ao registrar pagamento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-warning/10 border border-warning/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendente</p>
              <p className="text-xl font-bold text-warning">
                {formatCurrencyBR(totalPending)}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Consultas Pendentes</p>
              <p className="text-xl font-bold text-destructive">{totalPendingCount}</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-success/10 border border-success/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Consultas</p>
              <p className="text-xl font-bold text-success">{appointments.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por paciente ou profissional..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/30 shadow-card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border/30">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Pagamentos de Clientes</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredAppointments.length} registro(s) encontrado(s)
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Nenhum pagamento pendente</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Todos os clientes estão em dia!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left p-4 table-header">Paciente</th>
                  <th className="text-left p-4 table-header hidden md:table-cell">Profissional</th>
                  <th className="text-left p-4 table-header">Data</th>
                  <th className="text-left p-4 table-header hidden sm:table-cell">Tipo</th>
                  <th className="text-right p-4 table-header">Valor</th>
                  <th className="text-center p-4 table-header">Status</th>
                  <th className="text-center p-4 table-header">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredAppointments.map((appt) => {
                  const isPending = !appt.payment_status || appt.payment_status === "pendente";
                  const packageLabel = appt.is_package && appt.package_session_number && appt.package_total_sessions
                    ? ` - Sessão ${appt.package_session_number}/${appt.package_total_sessions}`
                    : "";

                  return (
                    <tr key={appt.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            isPending ? "bg-warning/10" : "bg-success/10"
                          )}>
                            {isPending ? (
                              <AlertCircle className="w-5 h-5 text-warning" />
                            ) : (
                              <CheckCircle className="w-5 h-5 text-success" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground flex items-center gap-2">
                              {appt.patients?.name || "-"}{packageLabel}
                              {appt.status === "cliente_faltou" && (
                                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px] py-0">
                                  Faltou (cobrada)
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground md:hidden">
                              {appt.professionals?.name || "-"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {appt.professionals?.name || "-"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-muted-foreground">
                          <p>{formatDateBR(appt.appointment_date)}</p>
                          <p className="text-xs">{appt.appointment_time}</p>
                        </div>
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground">{appt.type}</span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-semibold">
                          {formatCurrencyBR(appt.consultation_value || 0)}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "border",
                            isPending
                              ? "bg-warning/10 text-warning border-warning/30"
                              : "bg-success/10 text-success border-success/30"
                          )}
                        >
                          {isPending ? "Pendente" : "Pago"}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        {isPending && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-success border-success/30 hover:bg-success/10"
                            onClick={() => handleMarkAsPaid(appt)}
                          >
                            <DollarSign className="w-3 h-3 mr-1" />
                            Receber
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-primary-foreground" />
              </div>
              Registrar Pagamento
            </DialogTitle>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Paciente</span>
                  <span className="text-sm font-medium">{selectedAppointment.patients?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Profissional</span>
                  <span className="text-sm font-medium">{selectedAppointment.professionals?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Data</span>
                  <span className="text-sm font-medium">{formatDateBR(selectedAppointment.appointment_date)}</span>
                </div>
                <div className="flex justify-between border-t border-border/30 pt-2">
                  <span className="text-sm text-muted-foreground">Valor</span>
                  <span className="text-lg font-bold text-primary">
                    {formatCurrencyBR(selectedAppointment.consultation_value || 0)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Quem recebeu? *</Label>
                <RadioGroup
                  value={paymentReceiver}
                  onValueChange={(v) => setPaymentReceiver(v as "clinic" | "professional")}
                  className="grid grid-cols-2 gap-2"
                >
                  <label
                    htmlFor="receiver-professional"
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                      paymentReceiver === "professional"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/30"
                    )}
                  >
                    <RadioGroupItem value="professional" id="receiver-professional" />
                    <span className="text-sm font-medium">Profissional</span>
                  </label>
                  <label
                    htmlFor="receiver-clinic"
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                      paymentReceiver === "clinic"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/30"
                    )}
                  >
                    <RadioGroupItem value="clinic" id="receiver-clinic" />
                    <span className="text-sm font-medium">Clínica</span>
                  </label>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  {paymentReceiver === "clinic"
                    ? "Entrada no caixa da clínica. A clínica deverá repassar a parte do profissional."
                    : "Sem entrada no caixa. O profissional deverá repassar a parte da clínica (ver Receber de Profissionais)."}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Forma de Pagamento *</label>
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

              <div className="space-y-2">
                <Label className="text-sm font-medium">Data do Recebimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !paymentDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {paymentDate ? format(paymentDate, "dd/MM/yyyy", { locale: ptBR }) : "Hoje (padrão)"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={paymentDate}
                      onSelect={setPaymentDate}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Deixe vazio para usar a data de hoje. Use uma data passada para registrar pagamentos retroativos.
                </p>
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
                  onClick={handleConfirmPayment}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Confirmar Recebimento"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
