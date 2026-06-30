import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Calendar, 
  Clock, 
  User, 
  UserCog, 
  Stethoscope, 
  Loader2, 
  MapPin, 
  Video, 
  CreditCard,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CancelConfirmDialog } from "./CancelConfirmDialog";
import { AppointmentEditDialog } from "./AppointmentEditDialog";
import { createLog } from "@/lib/log-service";
import { sendAppointmentWhatsApp } from "@/lib/whatsapp-service";
import { formatDateBR } from "@/lib/export-utils";
import { fetchAppointmentPatients } from "@/lib/appointment-patients";
import { notifyProfessionalAgendaChange } from "@/lib/professional-agenda-notification";

interface AppointmentDetails {
  id: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  type: string;
  status: string;
  modality: string | null;
  payment_method: string | null;
  payment_status: string | null;
  consultation_value?: number | null;
  clinic_percentage?: number | null;
  no_show_charged?: boolean | null;
  notes: string | null;
  patient_id?: string;
  professional_id?: string;
  patients: { name: string; phone?: string } | null;
  professionals: { name: string; specialty?: string } | null;
}

interface AppointmentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentDetails | null;
  onSuccess?: () => void;
}

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
};

const roomLabels: Record<string, { label: string; icon: string }> = {
  harmonia: { label: "Harmonia", icon: "🌿" },
  serenidade: { label: "Serenidade", icon: "💜" },
  florescer: { label: "Florescer", icon: "🌸" },
  online: { label: "Online", icon: "💻" },
  presencial: { label: "Presencial", icon: "📍" }, // Legacy support
};

const statusLabels: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  atendido: "Atendido",
  cancelado: "Cancelado",
  cliente_faltou: "Cliente Faltou",
  profissional_faltou: "Profissional Faltou",
};

const statusStyles: Record<string, string> = {
  agendado: "bg-primary/10 text-primary border-primary/30",
  confirmado: "bg-success/10 text-success border-success/30",
  atendido: "bg-muted text-muted-foreground border-border",
  cancelado: "bg-destructive/10 text-destructive border-destructive/30",
  cliente_faltou: "bg-warning/10 text-warning border-warning/30",
  profissional_faltou: "bg-info/10 text-info border-info/30",
};

export function AppointmentDetailsDialog({
  open,
  onOpenChange,
  appointment,
  onSuccess,
}: AppointmentDetailsDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showNoShowDialog, setShowNoShowDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentDestination, setPaymentDestination] = useState<string>("clinic");
  const [registeredReceiver, setRegisteredReceiver] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!appointment || !open || appointment.payment_status !== "pago") {
      setRegisteredReceiver(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("professional_payments")
        .select("payment_destination")
        .eq("appointment_id", appointment.id)
        .limit(1)
        .maybeSingle();
      if (!cancelled) setRegisteredReceiver((data as any)?.payment_destination ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [appointment, open]);

  if (!appointment) return null;

  const consultationValue = appointment.consultation_value ?? 0;
  const isFree = consultationValue <= 0;
  const isPaid = appointment.payment_status === "pago";
  const isPending = appointment.payment_status === "pendente" && !isFree;

  const handlePayment = async () => {
    if (isFree) {
      toast({
        title: "Consulta gratuita",
        description: "Esta consulta não possui valor a receber.",
      });
      return;
    }

    if (!paymentMethod) {
      toast({
        title: "Selecione a forma de pagamento",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Update appointment payment status
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ 
          payment_status: "pago",
          payment_method: paymentMethod 
        })
        .eq("id", appointment.id);

      if (updateError) throw updateError;

      // Create professional payment record
      const payValue = consultationValue;
      const clinicPercentage = appointment.clinic_percentage || 30;
      const clinicAmount = (payValue * clinicPercentage) / 100;
      const professionalAmount = payValue - clinicAmount;

      // Create professional payment record (to be confirmed later in Financeiro)
      if (appointment.professional_id) {
        await supabase.from("professional_payments").insert({
          professional_id: appointment.professional_id,
          appointment_id: appointment.id,
          total_value: payValue,
          professional_amount: professionalAmount,
          clinic_amount: clinicAmount,
          is_paid: false,
          payment_destination: paymentDestination,
          payment_method: paymentMethod,
        });
      }

      // When the CLINIC received the payment, create the cash inflow immediately
      if (paymentDestination === "clinic") {
        const { data: existingTx } = await supabase
          .from("transactions")
          .select("id")
          .eq("appointment_id", appointment.id)
          .eq("type", "entrada")
          .limit(1);

        if (!existingTx || existingTx.length === 0) {
          await supabase.from("transactions").insert({
            description: `Consulta - ${appointment.patients?.name || "Paciente"} - ${appointment.professionals?.name || "Profissional"} - ${formatDateBR(appointment.appointment_date)}`,
            type: "entrada",
            amount: payValue,
            payment_method: paymentMethod,
            transaction_date: new Date().toISOString().split("T")[0],
            transaction_time: new Date().toTimeString().slice(0, 5),
            professional_id: appointment.professional_id,
            appointment_id: appointment.id,
          });
        }
      }

      toast({
        title: "Pagamento registrado!",
        description: `Clínica: R$ ${clinicAmount.toFixed(2)} | Profissional: R$ ${professionalAmount.toFixed(2)}`,
      });

      // Log the payment
      await createLog({
        action: "payment_registered",
        entityType: "appointment",
        entityId: appointment.id,
        description: `Pagamento registrado para consulta de ${appointment.patients?.name} - R$ ${consultationValue.toFixed(2)}`,
        metadata: { clinicAmount, professionalAmount, paymentMethod },
      });

      setShowPaymentForm(false);
      setPaymentMethod("");
      setPaymentDestination("clinic");
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao registrar pagamento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAppointment = async () => {
    setIsLoading(true);
    try {
      // Delete associated financial records first
      const { error: txError } = await supabase
        .from("transactions")
        .delete()
        .eq("appointment_id", appointment.id);

      if (txError) {
        console.error("Error deleting transactions:", txError);
      }

      const { error: ppError } = await supabase
        .from("professional_payments")
        .delete()
        .eq("appointment_id", appointment.id);

      if (ppError) {
        console.error("Error deleting professional payments:", ppError);
      }

      // Update appointment status
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelado" })
        .eq("id", appointment.id);

      if (error) throw error;

      // Log the cancellation
      await createLog({
        action: "appointment_cancelled",
        entityType: "appointment",
        entityId: appointment.id,
        description: `Consulta de ${appointment.patients?.name} cancelada (${appointment.appointment_date} ${appointment.appointment_time})`,
        metadata: { 
          patient_name: appointment.patients?.name,
          professional_name: appointment.professionals?.name,
        },
      });

      // Send WhatsApp notification about cancellation - to ALL linked patients
      const allPatients = await fetchAppointmentPatients(appointment.id, appointment.patient_id);
      const recipients = allPatients
        .filter((p) => p.phone)
        .map((p) => ({ phone: p.phone!, name: p.name }));

      if (recipients.length > 0) {
        sendAppointmentWhatsApp({
          patientNames: allPatients.map((p) => p.name),
          recipients,
          professionalName: appointment.professionals?.name || "Profissional",
          appointmentDate: appointment.appointment_date,
          appointmentTime: appointment.appointment_time,
          appointmentId: appointment.id,
          type: "cancelled",
        });
      }

      if (appointment.professional_id) {
        const namesLabel = allPatients.map((p) => p.name).join(" e ") || appointment.patients?.name || "Paciente";
        notifyProfessionalAgendaChange({
          professionalId: appointment.professional_id,
          professionalName: appointment.professionals?.name || "Profissional",
          date: appointment.appointment_date,
          changeType: "cancelled",
          changeDescription: `❌ ${namesLabel} às ${appointment.appointment_time.slice(0, 5)} foi cancelada`,
        });
      }

      toast({
        title: "Consulta cancelada!",
        description: "Todos os registros financeiros associados foram removidos.",
      });

      setShowCancelConfirm(false);
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar consulta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAppointment = async () => {
    setIsLoading(true);
    try {
      // Validação baseada no estado financeiro REAL e atual (não em flags antigas).
      // Bloqueia apenas se ainda existir impacto financeiro ativo:
      // - movimentação em transactions, OU
      // - repasse confirmado (is_paid=true) em professional_payments
      // Repasses pendentes (is_paid=false) não bloqueiam: serão limpos junto.
      const [{ data: txs }, { data: pays }] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, type, description")
          .eq("appointment_id", appointment.id),
        supabase
          .from("professional_payments")
          .select("id, is_paid")
          .eq("appointment_id", appointment.id),
      ]);

      const hasTransactions = (txs?.length ?? 0) > 0;
      const hasPaidPayment = (pays ?? []).some((p: any) => p.is_paid);

      if (hasTransactions || hasPaidPayment) {
        let description = "";
        if (hasTransactions && hasPaidPayment) {
          description =
            "Existe pagamento registrado no caixa e repasse ao profissional confirmado. Estorne ambos no Financeiro antes de excluir.";
        } else if (hasTransactions) {
          description =
            "Existe pagamento registrado no caixa vinculado a esta consulta. Exclua a movimentação no Financeiro antes de excluir a consulta.";
        } else {
          description =
            "Existe repasse ao profissional já confirmado. Estorne o repasse na aba 'Pagar Profissionais' antes de excluir.";
        }

        toast({
          title: "Exclusão bloqueada",
          description,
          variant: "destructive",
        });
        setShowDeleteConfirm(false);
        setIsLoading(false);
        return;
      }

      // Sem impacto financeiro ativo → limpar vínculos residuais e excluir
      // (professional_payments pendentes / appointment_patients / etc.)
      await supabase.from("professional_payments").delete().eq("appointment_id", appointment.id);
      await supabase.from("appointment_patients" as any).delete().eq("appointment_id", appointment.id);

      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", appointment.id);

      if (error) throw error;

      await createLog({
        action: "appointment_deleted",
        entityType: "appointment",
        entityId: appointment.id,
        description: `Consulta de ${appointment.patients?.name} excluída (${appointment.appointment_date} ${appointment.appointment_time})`,
        metadata: {
          patient_name: appointment.patients?.name,
          professional_name: appointment.professionals?.name,
        },
      });

      toast({
        title: "Consulta excluída!",
        description: "O registro foi removido permanentemente.",
      });

      setShowDeleteConfirm(false);
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao excluir consulta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle "Cliente Faltou" with charged/not-charged distinction
  const handleClientNoShow = async (charged: boolean) => {
    setIsLoading(true);
    try {
      if (!charged) {
        // Block if there's already a paid impact that would be inconsistent with "não cobrou"
        const [{ data: txs }, { data: pays }] = await Promise.all([
          supabase.from("transactions").select("id").eq("appointment_id", appointment.id),
          supabase
            .from("professional_payments")
            .select("id, is_paid")
            .eq("appointment_id", appointment.id),
        ]);
        const hasPaidImpact =
          (txs?.length ?? 0) > 0 || (pays ?? []).some((p: any) => p.is_paid);
        if (hasPaidImpact) {
          toast({
            title: "Não é possível marcar como 'não cobrou'",
            description:
              "Esta consulta já possui pagamento/repasse registrado. Estorne no Financeiro antes ou marque como 'profissional cobrou'.",
            variant: "destructive",
          });
          setShowNoShowDialog(false);
          setIsLoading(false);
          return;
        }
        // Remove orphan unpaid pendencies
        await supabase
          .from("professional_payments")
          .delete()
          .eq("appointment_id", appointment.id)
          .eq("is_paid", false);
      }

      const { error } = await supabase
        .from("appointments")
        .update({
          status: "cliente_faltou",
          no_show_charged: charged,
          // If not charged → clear receivable so it stops showing as pending
          ...(charged ? {} : { payment_status: null, payment_method: null }),
        } as any)
        .eq("id", appointment.id);

      if (error) throw error;

      await createLog({
        action: "appointment_updated",
        entityType: "appointment",
        entityId: appointment.id,
        description: `Cliente faltou - ${appointment.patients?.name} (${
          charged ? "profissional cobrou" : "profissional não cobrou"
        })`,
        metadata: { new_status: "cliente_faltou", no_show_charged: charged },
      });

      toast({
        title: "Falta registrada",
        description: charged
          ? "Consulta marcada como falta — cobrança mantida."
          : "Consulta marcada como falta — sem impacto financeiro.",
      });

      setShowNoShowDialog(false);
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao registrar falta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset no_show_charged when reverting status away from cliente_faltou
  const revertNoShowFlag = async () => {
    await supabase
      .from("appointments")
      .update({ no_show_charged: false } as any)
      .eq("id", appointment.id);
  };

  const updateStatus = async (newStatus: string) => {
    setIsLoading(true);
    try {
      const updatePayload: any = { status: newStatus };
      // Sair de cliente_faltou → limpar flag para não deixar metadado inconsistente
      if (newStatus !== "cliente_faltou" && appointment.status === "cliente_faltou") {
        updatePayload.no_show_charged = false;
      }
      const { error } = await supabase
        .from("appointments")
        .update(updatePayload)
        .eq("id", appointment.id);

      if (error) throw error;

      // Log the status update
      await createLog({
        action: newStatus === "confirmado" ? "appointment_confirmed" : "appointment_updated",
        entityType: "appointment",
        entityId: appointment.id,
        description: `Status da consulta de ${appointment.patients?.name} alterado para ${statusLabels[newStatus]}`,
        metadata: { new_status: newStatus },
      });

      // Notify professional about confirmation - include all patient names
      if (newStatus === "confirmado" && appointment.professional_id) {
        const allPatients = await fetchAppointmentPatients(appointment.id, appointment.patient_id);
        const namesLabel = allPatients.map((p) => p.name).join(" e ") || appointment.patients?.name || "Paciente";
        notifyProfessionalAgendaChange({
          professionalId: appointment.professional_id,
          professionalName: appointment.professionals?.name || "Profissional",
          date: appointment.appointment_date,
          changeType: "edited",
          changeDescription: `✅ ${namesLabel} às ${appointment.appointment_time.slice(0, 5)} foi confirmado(a)`,
        }).then((result) => {
          if (result.success) {
            console.log("Notificação WhatsApp enviada para profissional");
          } else {
            console.error("Falha ao enviar notificação WhatsApp:", result.error);
          }
        });
      }

      toast({
        title: "Status atualizado!",
        description: `Consulta marcada como ${statusLabels[newStatus]}.`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                isPending ? "bg-destructive/10" : "bg-success/10"
              )}>
                {isPending ? (
                  <AlertCircle className="w-4 h-4 text-destructive" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-success" />
                )}
              </div>
              Detalhes da Consulta
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <Badge className={cn("border", statusStyles[appointment.status])}>
                {statusLabels[appointment.status]}
                {appointment.status === "cliente_faltou" && (
                  <span className="ml-1 opacity-80">
                    {appointment.no_show_charged ? "· cobrada" : "· não cobrada"}
                  </span>
                )}
              </Badge>
              {isFree ? (
                <Badge
                  variant="outline"
                  className="border bg-info/10 text-info border-info/30"
                >
                  Consulta gratuita
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={cn(
                    "border",
                    isPaid
                      ? "bg-success/10 text-success border-success/30"
                      : "bg-destructive/10 text-destructive border-destructive/30"
                  )}
                >
                  {isPaid ? (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Pago
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3 mr-1" />
                      Pendente
                    </>
                  )}
                </Badge>
              )}
            </div>

            {/* Patient Info */}
            <div className="p-4 rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">{appointment.patients?.name || "Paciente"}</p>
                  {appointment.patients?.phone && (
                    <p className="text-sm text-muted-foreground">{appointment.patients.phone}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <UserCog className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">{appointment.professionals?.name || "Profissional"}</p>
                  {appointment.professionals?.specialty && (
                    <p className="text-sm text-muted-foreground">{appointment.professionals.specialty}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Appointment Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs">Data</span>
                </div>
                <p className="text-sm font-medium">{formatDate(appointment.appointment_date)}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs">Horário</span>
                </div>
                <p className="text-sm font-medium">{appointment.appointment_time.slice(0, 5)}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Stethoscope className="w-4 h-4" />
                  <span className="text-xs">Tipo</span>
                </div>
                <p className="text-sm font-medium">{appointment.type}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-xs">Espaço</span>
                </div>
                <p className="text-sm font-medium flex items-center gap-2">
                  <span>{roomLabels[appointment.modality || "presencial"]?.icon || "📍"}</span>
                  <span>{roomLabels[appointment.modality || "presencial"]?.label || appointment.modality || "Presencial"}</span>
                </p>
              </div>
            </div>

            {/* Payment Info */}
            {appointment.payment_method && (
              <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-xs">Forma de Pagamento</span>
                  </div>
                  <p className="text-sm font-medium">
                    {paymentMethodLabels[appointment.payment_method] || appointment.payment_method}
                  </p>
                </div>
                {registeredReceiver && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Quem recebeu</span>
                    <span className="text-sm font-medium">
                      {registeredReceiver === "clinic" ? "Clínica" : "Profissional"}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <span className="text-sm font-medium">
                    {appointment.payment_status === "pago" ? "Pago" : "Pendente"}
                  </span>
                </div>
              </div>
            )}

            {/* Notes */}
            {appointment.notes && (
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Observações</p>
                <p className="text-sm">{appointment.notes}</p>
              </div>
            )}

            {/* Payment Form */}
            {showPaymentForm && isPending && (
              <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                <p className="font-medium text-sm">Registrar Pagamento</p>
                <Select value={paymentDestination} onValueChange={setPaymentDestination}>
                  <SelectTrigger>
                    <SelectValue placeholder="Quem recebeu o pagamento?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clinic">Clínica recebeu</SelectItem>
                    <SelectItem value="professional">Profissional recebeu</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Forma de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPaymentForm(false)}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="gradient-primary border-0"
                    onClick={handlePayment}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <DollarSign className="w-4 h-4 mr-1" />
                        Confirmar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              {/* Edit button - always show unless cancelled */}
              {appointment.status !== "cancelado" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditDialog(true)}
                  disabled={isLoading}
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Editar
                </Button>
              )}

              {isPending && !showPaymentForm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPaymentForm(true)}
                  className="border-success/30 text-success hover:bg-success/10"
                >
                  <DollarSign className="w-4 h-4 mr-1" />
                  Registrar Pagamento
                </Button>
              )}

              {appointment.status === "agendado" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateStatus("confirmado")}
                  disabled={isLoading}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Confirmar
                </Button>
              )}

              {appointment.status === "confirmado" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateStatus("atendido")}
                    disabled={isLoading}
                  >
                    Marcar Atendido
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNoShowDialog(true)}
                    disabled={isLoading}
                    className="border-warning/30 text-warning hover:bg-warning/10"
                  >
                    Cliente Faltou
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateStatus("profissional_faltou")}
                    disabled={isLoading}
                    className="border-info/30 text-info hover:bg-info/10"
                  >
                    Profissional Faltou
                  </Button>
                </>
              )}

              {appointment.status !== "cancelado" && appointment.status !== "atendido" && appointment.status !== "cliente_faltou" && appointment.status !== "profissional_faltou" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={isLoading}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancelar
                </Button>
              )}

              {(appointment.status === "cliente_faltou" ||
                appointment.status === "profissional_faltou" ||
                appointment.status === "atendido") && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateStatus("confirmado")}
                    disabled={isLoading}
                    className="border-success/30 text-success hover:bg-success/10"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Reverter status
                  </Button>
                  {appointment.status === "cliente_faltou" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClientNoShow(!appointment.no_show_charged)}
                      disabled={isLoading}
                      className="border-warning/30 text-warning hover:bg-warning/10"
                    >
                      {appointment.no_show_charged
                        ? "Marcar como não cobrada"
                        : "Marcar como cobrada"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isLoading}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Excluir
                  </Button>
                </>
              )}

              {appointment.status === "cancelado" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isLoading}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Excluir
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CancelConfirmDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        onConfirm={handleCancelAppointment}
        isLoading={isLoading}
        patientName={appointment.patients?.name}
      />

      <AppointmentEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        appointment={appointment}
        onSuccess={() => {
          onSuccess?.();
          onOpenChange(false);
        }}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir consulta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá <strong>permanentemente</strong> o registro da consulta de{" "}
              <strong>{appointment.patients?.name || "este paciente"}</strong> em{" "}
              {appointment.appointment_date.split("-").reverse().join("/")} às{" "}
              {appointment.appointment_time.slice(0, 5)}.
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAppointment();
              }}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Sim, excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* No-show decision dialog */}
      <AlertDialog open={showNoShowDialog} onOpenChange={setShowNoShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Como esta falta foi tratada?</AlertDialogTitle>
            <AlertDialogDescription>
              O profissional cobrou esta consulta mesmo com a ausência de{" "}
              <strong>{appointment.patients?.name || "o paciente"}</strong>?
              <br />
              <br />
              <span className="text-success font-medium">✅ Profissional cobrou</span> — a consulta
              continua válida financeiramente (pendente de recebimento, comissão, repasse).
              <br />
              <span className="text-destructive font-medium">❌ Profissional não cobrou</span> — a
              consulta sai do fluxo financeiro mas permanece registrada como falta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={isLoading}>Voltar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleClientNoShow(false)}
              disabled={isLoading}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              ❌ Profissional não cobrou
            </Button>
            <Button
              onClick={() => handleClientNoShow(true)}
              disabled={isLoading}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              ✅ Profissional cobrou
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}