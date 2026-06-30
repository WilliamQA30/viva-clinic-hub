import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF, formatPhone, formatDate } from "@/lib/validations";
import {
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  FileText,
  Clock,
  Stethoscope,
  Loader2,
  AlertTriangle,
  MessageSquare,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AttachmentsTab } from "@/components/shared/AttachmentsTab";
import { getReferralSourceLabel } from "@/lib/crm";

interface Patient {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string | null;
  birth_date: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  referral_source?: string | null;
  referral_detail?: string | null;
  emergency_contact?: string | null;
  guardian_name?: string | null;
  guardian_cpf?: string | null;
  guardian_phone?: string | null;
  guardian_relationship?: string | null;
}

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  type: string;
  status: string;
  notes: string | null;
  professionals: { name: string; specialty: string } | null;
}

interface PatientViewDialogProps {
  patient: Patient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PatientViewDialog({ patient, open, onOpenChange }: PatientViewDialogProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && patient) {
      fetchAppointments();
    }
  }, [open, patient]);

  const fetchAppointments = async () => {
    if (!patient) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        appointment_time,
        type,
        status,
        notes,
        professionals (name, specialty)
      `)
      .eq("patient_id", patient.id)
      .order("appointment_date", { ascending: false });

    if (!error && data) {
      setAppointments(data as Appointment[]);
    }
    setIsLoading(false);
  };

  if (!patient) return null;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      agendado: "bg-primary/10 text-primary",
      confirmado: "bg-success/10 text-success",
      atendido: "bg-muted text-muted-foreground",
      cancelado: "bg-destructive/10 text-destructive",
    };
    const labels: Record<string, string> = {
      agendado: "Agendado",
      confirmado: "Confirmado",
      atendido: "Atendido",
      cancelado: "Cancelado",
    };
    return (
      <span className={cn("badge-status", styles[status] || styles.agendado)}>
        {labels[status] || status}
      </span>
    );
  };

  const totalAppointments = appointments.length;
  const completedAppointments = appointments.filter(a => a.status === "atendido").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center">
              <span className="text-lg font-semibold text-primary-foreground">
                {patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{patient.name}</h2>
              <p className="text-sm text-muted-foreground font-normal">
                Paciente desde {formatDate(patient.created_at)}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="history">Histórico ({totalAppointments})</TabsTrigger>
            <TabsTrigger value="anexos">Anexos</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">CPF</p>
                  <p className="font-medium">{formatCPF(patient.cpf)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <Phone className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Telefone</p>
                  <p className="font-medium">{formatPhone(patient.phone)}</p>
                </div>
              </div>
              {patient.email && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">E-mail</p>
                    <p className="font-medium">{patient.email}</p>
                  </div>
                </div>
              )}
              {patient.birth_date && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Data de Nascimento</p>
                    <p className="font-medium">{formatDate(patient.birth_date)}</p>
                  </div>
                </div>
              )}
              {patient.referral_source && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <MessageSquare className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Origem de Aquisição</p>
                    <p className="font-medium">{getReferralSourceLabel(patient.referral_source)}</p>
                    {patient.referral_detail && (
                      <p className="text-xs text-muted-foreground mt-0.5">{patient.referral_detail}</p>
                    )}
                  </div>
                </div>
              )}
              {patient.emergency_contact && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <AlertTriangle className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Contato de Emergência</p>
                    <p className="font-medium">{patient.emergency_contact}</p>
                  </div>
                </div>
              )}
            </div>

            {patient.guardian_name && (
              <div className="space-y-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Users className="w-4 h-4" />
                  Responsável
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Nome</p>
                      <p className="font-medium">{patient.guardian_name}</p>
                    </div>
                  </div>
                  {patient.guardian_relationship && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-background">
                      <Users className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Parentesco</p>
                        <p className="font-medium">{patient.guardian_relationship}</p>
                      </div>
                    </div>
                  )}
                  {patient.guardian_cpf && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-background">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">CPF</p>
                        <p className="font-medium">{formatCPF(patient.guardian_cpf)}</p>
                      </div>
                    </div>
                  )}
                  {patient.guardian_phone && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-background">
                      <Phone className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Telefone</p>
                        <p className="font-medium">{formatPhone(patient.guardian_phone)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {patient.address && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Endereço</p>
                  <p className="font-medium">{patient.address}</p>
                </div>
              </div>
            )}

            {patient.notes && (
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Observações</p>
                <p className="text-sm">{patient.notes}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center p-4 rounded-lg bg-primary/5">
                <p className="text-2xl font-bold text-primary">{totalAppointments}</p>
                <p className="text-sm text-muted-foreground">Total de Consultas</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-success/5">
                <p className="text-2xl font-bold text-success">{completedAppointments}</p>
                <p className="text-sm text-muted-foreground">Consultas Realizadas</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : appointments.length === 0 ? (
              <div className="text-center py-8">
                <Stethoscope className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground">Nenhuma consulta registrada</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-4 rounded-lg border border-border/30 hover:border-primary/20 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Stethoscope className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{apt.type}</p>
                          <p className="text-sm text-muted-foreground">
                            {apt.professionals?.name} • {apt.professionals?.specialty}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(apt.status)}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(apt.appointment_date)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {apt.appointment_time.slice(0, 5)}
                      </div>
                    </div>
                    {apt.notes && (
                      <p className="text-sm text-muted-foreground mt-2 pl-13">
                        {apt.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="anexos" className="mt-4">
            <AttachmentsTab entityType="patient" entityId={patient.id} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
