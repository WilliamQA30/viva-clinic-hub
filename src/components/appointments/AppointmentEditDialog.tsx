import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, Loader2, Edit2, MapPin, DollarSign, AlertTriangle } from "lucide-react";
import { createLog } from "@/lib/log-service";
import { sendAppointmentWhatsApp } from "@/lib/whatsapp-service";
import { fetchAppointmentPatients } from "@/lib/appointment-patients";
import { notifyProfessionalAgendaChange } from "@/lib/professional-agenda-notification";
import { formatDateBR } from "@/lib/export-utils";
import { checkRoomConflict } from "@/lib/room-conflict";
import { ROOM_OPTIONS } from "./AppointmentFormDialog";

interface EditAppointmentInput {
  id: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  modality: string | null;
  consultation_value?: number | null;
  clinic_percentage?: number | null;
  payment_status?: string | null;
  payment_method?: string | null;
  is_package?: boolean | null;
  package_session_number?: number | null;
  package_total_sessions?: number | null;
  patient_id?: string;
  professional_id?: string;
  patients: { name: string; phone?: string } | null;
  professionals: { name: string } | null;
}

/**
 * Recalculates and updates all financial records linked to an appointment
 * after editing. Updates rows in-place (atomic per-row) and logs changes.
 *
 * Preserves payment_destination and is_paid (repasse) status, but updates:
 * - professional_payments: total_value, clinic_amount, professional_amount
 * - transactions (entrada, if clinic received): amount + description
 * - transactions (saida, if repasse already paid): amount + description
 */
async function recalculateAppointmentFinancials(params: {
  appointmentId: string;
  newValue: number;
  newClinicPct: number;
  patientName: string;
  professionalName: string;
  appointmentDate: string;
  oldValue: number;
  oldClinicPct: number;
}): Promise<{ updated: boolean; details: Record<string, unknown> }> {
  const { appointmentId, newValue, newClinicPct, patientName, professionalName, appointmentDate, oldValue, oldClinicPct } = params;

  // Find existing financial record for this appointment
  const { data: payment } = await supabase
    .from("professional_payments")
    .select("id, payment_destination, is_paid, professional_id, payment_method")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (!payment) {
    return { updated: false, details: { reason: "no_financial_record" } };
  }

  const newClinicAmount = (newValue * newClinicPct) / 100;
  const newProfessionalAmount = newValue - newClinicAmount;
  const dateLabel = formatDateBR(appointmentDate);

  // payment_destination semantics in this project:
  // - "clinic"       → clinic received the payment from the patient (Cenário A)
  // - "professional" → professional received from the patient (Cenário B)
  const destination = (payment as any).payment_destination as string;
  const clinicReceived = destination === "clinic";

  // 1. Update professional_payments (preserves payment_destination, is_paid)
  //    total_value = total da consulta (usado em produção do profissional)
  //    clinic_amount / professional_amount = derivados pelo %
  const { error: ppErr } = await supabase
    .from("professional_payments")
    .update({
      total_value: newValue,
      clinic_amount: newClinicAmount,
      professional_amount: newProfessionalAmount,
    })
    .eq("id", payment.id);
  if (ppErr) throw ppErr;

  // 2. Update entrada transaction (caixa da clínica)
  //    Cenário A (clínica recebeu): entrada = valor TOTAL da consulta
  //    Cenário B (profissional recebeu): entrada = somente a COMISSÃO da clínica
  const { data: entradaTxs } = await supabase
    .from("transactions")
    .select("id")
    .eq("appointment_id", appointmentId)
    .eq("type", "entrada");

  if (entradaTxs && entradaTxs.length > 0) {
    const entradaAmount = clinicReceived ? newValue : newClinicAmount;
    const entradaDescription = clinicReceived
      ? `Consulta - ${patientName} - ${professionalName} - ${dateLabel}`
      : `Recebimento comissão - ${patientName} - ${professionalName} - ${dateLabel}`;
    const { error: txErr } = await supabase
      .from("transactions")
      .update({ amount: entradaAmount, description: entradaDescription })
      .eq("id", entradaTxs[0].id);
    if (txErr) throw txErr;
  }

  // 3. Update saida transaction (somente Cenário A com repasse já pago)
  //    saida = valor do profissional (repasse)
  const { data: saidaTxs } = await supabase
    .from("transactions")
    .select("id")
    .eq("appointment_id", appointmentId)
    .eq("type", "saida");

  if (saidaTxs && saidaTxs.length > 0 && payment.is_paid && clinicReceived) {
    const { error: txErr } = await supabase
      .from("transactions")
      .update({
        amount: newProfessionalAmount,
        description: `Repasse profissional - ${patientName} - ${professionalName} - ${dateLabel}`,
      })
      .eq("id", saidaTxs[0].id);
    if (txErr) throw txErr;
  }

  return {
    updated: true,
    details: {
      payment_id: payment.id,
      payment_destination: destination,
      clinic_received: clinicReceived,
      repasse_paid: payment.is_paid,
      old_value: oldValue,
      new_value: newValue,
      old_clinic_pct: oldClinicPct,
      new_clinic_pct: newClinicPct,
      new_clinic_amount: newClinicAmount,
      new_professional_amount: newProfessionalAmount,
      entrada_recalc: clinicReceived ? "valor_total" : "somente_comissao",
    },
  };
}

const editSchema = z.object({
  appointment_date: z.string().min(1, "Selecione uma data"),
  appointment_time: z.string().min(1, "Selecione um horário"),
  duration_minutes: z.number().min(15).max(180),
  room: z.enum(["harmonia", "serenidade", "florescer", "online"]),
  consultation_value: z.number().min(0, "Informe o valor").optional(),
  clinic_percentage: z.number().min(0).max(100).optional(),
  is_package: z.boolean().optional(),
  package_session_number: z.number().optional(),
  package_total_sessions: z.number().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

interface AppointmentEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: EditAppointmentInput | null;
  onSuccess?: () => void;
}


export function AppointmentEditDialog({
  open,
  onOpenChange,
  appointment,
  onSuccess,
}: AppointmentEditDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      appointment_date: "",
      appointment_time: "",
      duration_minutes: 50,
      room: "harmonia",
      consultation_value: 0,
      clinic_percentage: 25,
      is_package: false,
      package_session_number: undefined,
      package_total_sessions: undefined,
    },
  });

  useEffect(() => {
    if (appointment && open) {
      form.reset({
        appointment_date: appointment.appointment_date,
        appointment_time: appointment.appointment_time.slice(0, 5),
        duration_minutes: appointment.duration_minutes || 50,
        room: (appointment.modality as "harmonia" | "serenidade" | "florescer" | "online") || "harmonia",
        consultation_value: appointment.consultation_value ?? 0,
        clinic_percentage: appointment.clinic_percentage ?? 25,
        is_package: appointment.is_package ?? false,
        package_session_number: appointment.package_session_number ?? undefined,
        package_total_sessions: appointment.package_total_sessions ?? undefined,
      });
    }
  }, [appointment, open, form]);

  const onSubmit = async (data: EditFormData) => {
    if (!appointment) return;

    setIsLoading(true);
    try {
      // Check if date/time/room changed
      const dateChanged = data.appointment_date !== appointment.appointment_date;
      const timeChanged = data.appointment_time !== appointment.appointment_time.slice(0, 5);
      const roomChanged = data.room !== appointment.modality;

      // Check for room conflicts
      const conflict = await checkRoomConflict({
        room: data.room,
        date: data.appointment_date,
        startTime: data.appointment_time,
        durationMinutes: data.duration_minutes,
        excludeAppointmentId: appointment.id,
      });

      if (conflict.hasConflict) {
        toast({
          title: "Conflito de horário!",
          description: `Já existe uma consulta agendada nesta sala às ${conflict.conflictingTime}. Escolha outro horário ou sala.`,
          variant: "destructive",
        });
        return;
      }

      // Snapshot old financial values for rollback + log
      const oldValue = appointment.consultation_value ?? 0;
      const oldClinicPct = appointment.clinic_percentage ?? 25;
      const newValue = data.consultation_value ?? 0;
      const newClinicPct = data.clinic_percentage ?? 25;
      const isPaid = appointment.payment_status === "pago";
      const financialChanged = isPaid && (oldValue !== newValue || oldClinicPct !== newClinicPct);

      // Update appointment
      const { error } = await supabase
        .from("appointments")
        .update({
          appointment_date: data.appointment_date,
          appointment_time: data.appointment_time,
          duration_minutes: data.duration_minutes,
          modality: data.room,
          consultation_value: data.consultation_value ?? null,
          clinic_percentage: data.clinic_percentage ?? null,
          is_package: data.is_package ?? false,
          package_session_number: data.is_package ? (data.package_session_number ?? null) : null,
          package_total_sessions: data.is_package ? (data.package_total_sessions ?? null) : null,
        })
        .eq("id", appointment.id);

      if (error) throw error;

      // Recalculate financials if appointment is paid and value/% changed
      let recalcResult: { updated: boolean; details: Record<string, unknown> } = { updated: false, details: {} };
      if (financialChanged) {
        try {
          recalcResult = await recalculateAppointmentFinancials({
            appointmentId: appointment.id,
            newValue,
            newClinicPct,
            patientName: appointment.patients?.name || "Paciente",
            professionalName: appointment.professionals?.name || "Profissional",
            appointmentDate: data.appointment_date,
            oldValue,
            oldClinicPct,
          });
        } catch (recalcErr: any) {
          // Rollback appointment to keep system consistent
          await supabase
            .from("appointments")
            .update({
              consultation_value: oldValue,
              clinic_percentage: oldClinicPct,
            })
            .eq("id", appointment.id);
          throw new Error(`Falha ao recalcular financeiro: ${recalcErr.message}. Alterações financeiras revertidas.`);
        }
      }

      // Log the change
      await createLog({
        action: "appointment_rescheduled",
        entityType: "appointment",
        entityId: appointment.id,
        description: `Consulta de ${appointment.patients?.name} editada${recalcResult.updated ? " (financeiro recalculado)" : ""}`,
        metadata: {
          old_date: appointment.appointment_date,
          old_time: appointment.appointment_time,
          new_date: data.appointment_date,
          new_time: data.appointment_time,
          old_value: oldValue,
          new_value: newValue,
          old_clinic_pct: oldClinicPct,
          new_clinic_pct: newClinicPct,
          financial_recalc: recalcResult,
        },
      });

      // Send WhatsApp notification if date or time changed - to ALL linked patients
      if ((dateChanged || timeChanged) && appointment.id) {
        const allPatients = await fetchAppointmentPatients(appointment.id, appointment.patient_id);
        const recipients = allPatients
          .filter((p) => p.phone)
          .map((p) => ({ phone: p.phone!, name: p.name }));

        if (recipients.length > 0) {
          sendAppointmentWhatsApp({
            patientNames: allPatients.map((p) => p.name),
            recipients,
            professionalName: appointment.professionals?.name || "Profissional",
            appointmentDate: data.appointment_date,
            appointmentTime: data.appointment_time,
            appointmentId: appointment.id,
            type: "rescheduled",
          });
        }

        if (appointment.professional_id) {
          const namesLabel = allPatients.map((p) => p.name).join(" e ") || appointment.patients?.name || "Paciente";
          notifyProfessionalAgendaChange({
            professionalId: appointment.professional_id,
            professionalName: appointment.professionals?.name || "Profissional",
            date: data.appointment_date,
            changeType: "edited",
            changeDescription: `✏️ ${namesLabel} - horário alterado para ${data.appointment_time.slice(0, 5)}`,
          });
        }
      } else if (appointment.professional_id) {
        notifyProfessionalAgendaChange({
          professionalId: appointment.professional_id,
          professionalName: appointment.professionals?.name || "Profissional",
          date: data.appointment_date,
          changeType: "edited",
          changeDescription: `✏️ ${appointment.patients?.name || "Paciente"} - consulta atualizada`,
        });
      }

      toast({
        title: "Consulta atualizada!",
        description: recalcResult.updated
          ? "Financeiro recalculado automaticamente (caixa, repasse e relatórios sincronizados)."
          : (dateChanged || timeChanged)
            ? "O paciente será notificado sobre a mudança de horário."
            : "Alterações salvas com sucesso.",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar consulta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Edit2 className="w-4 h-4 text-primary" />
            </div>
            Editar Consulta
          </DialogTitle>
        </DialogHeader>

        <div className="p-3 rounded-lg bg-muted/30 border mb-4">
          <p className="text-sm font-medium">{appointment.patients?.name}</p>
          <p className="text-xs text-muted-foreground">
            com {appointment.professionals?.name}
          </p>
        </div>

        {appointment.payment_status === "pago" && (
          <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 mb-4 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 dark:text-amber-300">
              <p className="font-semibold">Consulta já paga</p>
              <p>Alterar <strong>valor</strong> ou <strong>% clínica</strong> recalculará automaticamente o caixa, repasse e relatórios vinculados.</p>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="appointment_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="date" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="appointment_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2 border border-input rounded-md px-3 h-10">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <input
                          type="time"
                          className="flex-1 bg-transparent outline-none text-sm"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          min="08:00"
                          max="23:00"
                          step="60"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="room"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sala</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROOM_OPTIONS.map((room) => (
                        <SelectItem key={room.value} value={room.value}>
                          {room.icon} {room.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="duration_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duração</FormLabel>
                  <Select
                    onValueChange={(val) => field.onChange(parseInt(val))}
                    value={field.value.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                      <SelectItem value="50">50 min</SelectItem>
                      <SelectItem value="60">1 hora</SelectItem>
                      <SelectItem value="90">1h30</SelectItem>
                      <SelectItem value="120">2 horas</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Valor e Porcentagem */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="consultation_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          className="pl-10"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clinic_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>% Clínica</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          className="pr-8"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Package Info */}
            <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="edit_is_package"
                  checked={form.watch("is_package") || false}
                  onChange={(e) => form.setValue("is_package", e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="edit_is_package" className="text-sm font-medium">
                  Pacote?
                </label>
              </div>

              {form.watch("is_package") && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Sessão nº</label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="1"
                      value={form.watch("package_session_number") || ""}
                      onChange={(e) => form.setValue("package_session_number", parseInt(e.target.value) || undefined)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Total de sessões</label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="4"
                      value={form.watch("package_total_sessions") || ""}
                      onChange={(e) => form.setValue("package_total_sessions", parseInt(e.target.value) || undefined)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 gradient-primary border-0"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
