import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Stethoscope, Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/validations";

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  type: string;
  status: string;
  notes: string | null;
  patients: { name: string } | null;
}

interface ProfessionalHistoryTabProps {
  professionalId: string;
}

export function ProfessionalHistoryTab({ professionalId }: ProfessionalHistoryTabProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [professionalId]);

  const fetchHistory = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("appointments")
      .select("id, appointment_date, appointment_time, type, status, notes, patients(name)")
      .eq("professional_id", professionalId)
      .order("appointment_date", { ascending: false })
      .limit(200);

    if (data) setAppointments(data as Appointment[]);
    setIsLoading(false);
  };

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
      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", styles[status])}>
        {labels[status] || status}
      </span>
    );
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-8">
        <Stethoscope className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-muted-foreground">Nenhuma consulta registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {appointments.map((apt) => (
        <div key={apt.id} className="p-3 rounded-lg border border-border/30 hover:border-primary/20 transition-colors">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Stethoscope className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{apt.patients?.name || "Paciente"}</p>
                <p className="text-xs text-muted-foreground">{apt.type}</p>
              </div>
            </div>
            {getStatusBadge(apt.status)}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(apt.appointment_date)}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {apt.appointment_time.slice(0, 5)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
