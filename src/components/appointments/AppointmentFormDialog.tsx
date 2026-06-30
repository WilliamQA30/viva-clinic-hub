import { useState, useEffect, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, Stethoscope, Loader2, FileText, DollarSign, Home } from "lucide-react";
import { createLog } from "@/lib/log-service";
import { sendAppointmentWhatsApp } from "@/lib/whatsapp-service";
import { notifyProfessionalAgendaChange } from "@/lib/professional-agenda-notification";
import { checkRoomConflict } from "@/lib/room-conflict";
import { formatCurrencyBR, formatDateBR } from "@/lib/export-utils";
import { SearchableCombobox } from "@/components/shared/SearchableCombobox";

export const ROOM_OPTIONS = [
  { value: "harmonia", label: "Harmonia", icon: "🌿" },
  { value: "serenidade", label: "Serenidade", icon: "💜" },
  { value: "florescer", label: "Florescer", icon: "🌸" },
  { value: "online", label: "Online", icon: "💻" },
] as const;

export type RoomType = typeof ROOM_OPTIONS[number]["value"];

const appointmentSchema = z.object({
  patient_id: z.string().min(1, "Selecione um paciente"),
  professional_id: z.string().min(1, "Selecione um profissional"),
  appointment_date: z.string().min(1, "Selecione uma data"),
  appointment_time: z.string().min(1, "Selecione um horário"),
  type: z.string().min(1, "Selecione o tipo de atendimento"),
  duration_minutes: z.number().min(15).max(180),
  room: z.enum(["harmonia", "serenidade", "florescer", "online"]),
  consultation_value: z.number().min(0, "Informe o valor da consulta"),
  clinic_percentage: z.number().min(0).max(100),
  payment_destination: z.enum(["clinic", "professional"]),
  notes: z.string().optional(),
  is_package: z.boolean().optional(),
  package_session_number: z.number().optional(),
  package_total_sessions: z.number().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface Patient {
  id: string;
  name: string;
  cpf: string;
  phone?: string;
}

interface Professional {
  id: string;
  name: string;
  specialty: string;
  consultation_value?: number;
}

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultDate?: string;
}

const appointmentTypes = [
  "Psicoterapia",
  "Terapia de Casal",
  "Avaliação Psicológica",
  "Primeira Consulta",
  "Retorno",
  "Acompanhamento",
  "Plantão Psicológico",
  "Orientação Parental",
];


export function AppointmentFormDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultDate,
}: AppointmentFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isCoupleTherapy, setIsCoupleTherapy] = useState(false);
  const [additionalPatientIds, setAdditionalPatientIds] = useState<string[]>([]);
  const { toast } = useToast();

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patient_id: "",
      professional_id: "",
      appointment_date: defaultDate || new Date().toISOString().split("T")[0],
      appointment_time: "",
      type: "Psicoterapia",
      duration_minutes: 50,
      room: "harmonia",
      consultation_value: 0,
      clinic_percentage: 25,
      payment_destination: "professional",
      notes: "",
      is_package: false,
      package_session_number: undefined,
      package_total_sessions: undefined,
    },
  });

  const selectedType = form.watch("type");
  const primaryPatientId = form.watch("patient_id");

  useEffect(() => {
    if (open) {
      fetchPatients();
      fetchProfessionals();
      setIsCoupleTherapy(false);
      setAdditionalPatientIds([]);
    }
  }, [open]);

  useEffect(() => {
    if (defaultDate) {
      form.setValue("appointment_date", defaultDate);
    }
  }, [defaultDate, form]);

  useEffect(() => {
    if (selectedType === "Terapia de Casal") {
      setIsCoupleTherapy(true);
      return;
    }

    setIsCoupleTherapy(false);
    setAdditionalPatientIds([]);
  }, [selectedType]);

  const fetchPatients = async () => {
    const { data, error } = await supabase
      .from("patients")
      .select("id, name, cpf, phone")
      .neq("is_active", false)
      .order("name", { ascending: true });

    if (!error && data) {
      setPatients(data);
    }
  };

  const fetchProfessionals = async () => {
    const { data, error } = await supabase
      .from("professionals")
      .select("id, name, specialty, consultation_value")
      .neq("is_active", false)
      .order("name", { ascending: true });

    if (!error && data) {
      setProfessionals(data);
    }
  };

  // Auto-fill consultation value when professional is selected
  const handleProfessionalChange = (professionalId: string) => {
    form.setValue("professional_id", professionalId);
    const professional = professionals.find((p) => p.id === professionalId);
    if (professional?.consultation_value) {
      form.setValue("consultation_value", professional.consultation_value);
    }
  };

  const handleCoupleTherapyToggle = (checked: boolean) => {
    setIsCoupleTherapy(checked);

    if (checked) {
      form.setValue("type", "Terapia de Casal");
      return;
    }

    if (form.getValues("type") === "Terapia de Casal") {
      form.setValue("type", "Psicoterapia");
    }
    setAdditionalPatientIds([]);
  };

  const onSubmit = async (data: AppointmentFormData) => {
    setIsLoading(true);
    try {
      // Check for room conflicts (same room, overlapping times)
      const roomConflict = await checkRoomConflict({
        room: data.room,
        date: data.appointment_date,
        startTime: data.appointment_time,
        durationMinutes: data.duration_minutes,
      });

      if (roomConflict.hasConflict) {
        toast({
          title: "Conflito de horário na sala!",
          description: `Já existe uma consulta agendada na sala ${data.room} às ${roomConflict.conflictingTime}. Salas diferentes podem ter consultas simultâneas.`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Check for professional conflicts (same professional, same time)
      const { data: existingAppointments, error: checkError } = await supabase
        .from("appointments")
        .select("id")
        .eq("professional_id", data.professional_id)
        .eq("appointment_date", data.appointment_date)
        .eq("appointment_time", data.appointment_time)
        .neq("status", "cancelado");

      if (checkError) throw checkError;

      if (existingAppointments && existingAppointments.length > 0) {
        toast({
          title: "Horário indisponível",
          description: "Já existe uma consulta agendada para este profissional neste horário.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const selectedPatientIds = Array.from(
        new Set([data.patient_id, ...additionalPatientIds].filter(Boolean))
      );

      if (isCoupleTherapy && selectedPatientIds.length < 2) {
        toast({
          title: "Terapia de casal incompleta",
          description: "Selecione pelo menos 2 pacientes para continuar.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { data: insertedAppointment, error } = await supabase
        .from("appointments")
        .insert({
          patient_id: data.patient_id,
          professional_id: data.professional_id,
          appointment_date: data.appointment_date,
          appointment_time: data.appointment_time,
          type: data.type,
          duration_minutes: data.duration_minutes,
          modality: data.room,
          consultation_value: data.consultation_value,
          clinic_percentage: data.clinic_percentage,
          payment_method: null,
          payment_status: "pendente",
          notes: data.notes || null,
          status: "agendado",
          is_package: data.is_package || false,
          package_session_number: data.is_package ? data.package_session_number : null,
          package_total_sessions: data.is_package ? data.package_total_sessions : null,
        })
        .select()
        .single();

      if (error) throw error;

      const { error: relationshipError } = await supabase.from("appointment_patients" as any).upsert(
        selectedPatientIds.map((patientId) => ({
          appointment_id: insertedAppointment.id,
          patient_id: patientId,
        })),
        { onConflict: "appointment_id,patient_id" }
      );

      if (relationshipError) throw relationshipError;

      const selectedPatients = patients.filter((p) => selectedPatientIds.includes(p.id));
      const patientNames = selectedPatients.map((p) => p.name).join(" e ") || "Paciente";
      const professional = professionals.find((p) => p.id === data.professional_id);

      // Log the action
      await createLog({
        action: "appointment_created",
        entityType: "appointment",
        entityId: insertedAppointment.id,
        description: `Consulta agendada para ${patientNames} com ${professional?.name} em ${formatDateBR(data.appointment_date)} às ${data.appointment_time}`,
        metadata: {
          consultation_value: data.consultation_value,
          patient_ids: selectedPatientIds,
          is_couple_therapy: isCoupleTherapy,
        },
      });

      // Send WhatsApp notification on scheduling - to all patients with all names
      const recipients = selectedPatients
        .filter((p) => p.phone)
        .map((p) => ({ phone: p.phone!, name: p.name }));

      if (recipients.length > 0) {
        sendAppointmentWhatsApp({
          patientNames: selectedPatients.map((p) => p.name),
          recipients,
          professionalName: professional?.name || "Profissional",
          appointmentDate: data.appointment_date,
          appointmentTime: data.appointment_time,
          appointmentId: insertedAppointment.id,
          type: "scheduled",
          appointmentType: data.type,
        });
      }

      // Professional is NOT notified on creation - only on confirm/cancel

      toast({
        title: "Consulta agendada!",
        description: `${patientNames} agendado(s) para ${formatDateBR(data.appointment_date)} às ${data.appointment_time}.`,
      });

      form.reset();
      setAdditionalPatientIds([]);
      setIsCoupleTherapy(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erro ao agendar consulta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const patientOptions = useMemo(
    () =>
      patients.map((patient) => ({
        value: patient.id,
        label: patient.name,
        searchText: `${patient.name} ${patient.cpf}`,
      })),
    [patients]
  );

  const professionalOptions = useMemo(
    () =>
      professionals.map((professional) => ({
        value: professional.id,
        label: `${professional.name} — ${professional.specialty} (${formatCurrencyBR(professional.consultation_value || 0)})`,
        searchText: `${professional.name} ${professional.specialty}`,
      })),
    [professionals]
  );

  const additionalPatientOptions = patients.filter((patient) => patient.id !== primaryPatientId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary-foreground" />
            </div>
            Nova Consulta
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="patient_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paciente principal *</FormLabel>
                  <FormControl>
                    <SearchableCombobox
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setAdditionalPatientIds((current) => current.filter((id) => id !== value));
                      }}
                      options={patientOptions}
                      placeholder="Selecione um paciente"
                      searchPlaceholder="Buscar paciente por nome ou CPF..."
                      emptyText="Nenhum paciente encontrado"
                      ariaLabel="Selecionar paciente principal"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="professional_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profissional *</FormLabel>
                  <FormControl>
                    <SearchableCombobox
                      value={field.value}
                      onValueChange={(value) => {
                        handleProfessionalChange(value);
                      }}
                      options={professionalOptions}
                      placeholder="Selecione um profissional"
                      searchPlaceholder="Buscar por nome ou especialidade..."
                      emptyText="Nenhum profissional encontrado"
                      ariaLabel="Selecionar profissional"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="is_couple_therapy"
                  checked={isCoupleTherapy}
                  onCheckedChange={(checked) => handleCoupleTherapyToggle(checked === true)}
                  aria-describedby="couple-therapy-description"
                />
                <div className="space-y-1">
                  <Label htmlFor="is_couple_therapy" className="text-sm font-medium">
                    Terapia de casal (permitir mais de 1 paciente)
                  </Label>
                  <p id="couple-therapy-description" className="text-xs text-muted-foreground">
                    Ative para vincular mais de um paciente na mesma consulta.
                  </p>
                </div>
              </div>

              {isCoupleTherapy && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Selecione o paciente principal acima e adicione pacientes abaixo.
                  </p>

                  {!primaryPatientId && (
                    <p className="text-xs text-destructive">Selecione primeiro o paciente principal.</p>
                  )}

                  {primaryPatientId && (
                    <div className="space-y-2" aria-live="polite">
                      {additionalPatientIds.map((patientId) => {
                        const patient = patients.find((p) => p.id === patientId);
                        if (!patient) return null;
                        return (
                          <div
                            key={patientId}
                            className="flex items-center justify-between rounded-md border border-border/50 bg-background px-3 py-1.5"
                          >
                            <span className="text-sm">{patient.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                              onClick={() =>
                                setAdditionalPatientIds((current) =>
                                  current.filter((id) => id !== patientId)
                                )
                              }
                            >
                              Remover
                            </Button>
                          </div>
                        );
                      })}

                      <SearchableCombobox
                        value=""
                        onValueChange={(value) => {
                          if (value && !additionalPatientIds.includes(value)) {
                            setAdditionalPatientIds((current) => [...current, value]);
                          }
                        }}
                        options={patientOptions.filter(
                          (opt) =>
                            opt.value !== primaryPatientId &&
                            !additionalPatientIds.includes(opt.value)
                        )}
                        placeholder="Adicionar paciente..."
                        searchPlaceholder="Buscar paciente por nome ou CPF..."
                        emptyText="Nenhum paciente disponível"
                        ariaLabel="Adicionar paciente à terapia de casal"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="appointment_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data *</FormLabel>
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
                    <FormLabel>Horário *</FormLabel>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Atendimento *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <div className="flex items-center gap-2">
                            <Stethoscope className="w-4 h-4 text-muted-foreground" />
                            <SelectValue placeholder="Selecione" />
                          </div>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {appointmentTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
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
                    <FormLabel>Duração (min)</FormLabel>
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
            </div>

            {/* Valor e Porcentagem */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="consultation_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Consulta (R$) *</FormLabel>
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
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                    {form.watch("consultation_value") > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Clínica: R$ {((form.watch("consultation_value") * field.value) / 100).toFixed(2)} | 
                        Profissional: R$ {(form.watch("consultation_value") - (form.watch("consultation_value") * field.value) / 100).toFixed(2)}
                      </p>
                    )}
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="room"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Espaço *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <div className="flex items-center gap-2">
                            <Home className="w-4 h-4 text-muted-foreground" />
                            <SelectValue placeholder="Selecione o espaço" />
                          </div>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ROOM_OPTIONS.map((room) => (
                          <SelectItem key={room.value} value={room.value}>
                            <span className="flex items-center gap-2">
                              <span>{room.icon}</span>
                              <span>{room.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  id="is_package"
                  checked={form.watch("is_package") || false}
                  onChange={(e) => form.setValue("is_package", e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="is_package" className="text-sm font-medium">
                  Faz parte de um pacote?
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

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Textarea
                        placeholder="Observações sobre a sessão..."
                        className="pl-10 min-h-[80px]"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="gradient-primary border-0" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Agendando...
                  </>
                ) : (
                  "Agendar Consulta"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
