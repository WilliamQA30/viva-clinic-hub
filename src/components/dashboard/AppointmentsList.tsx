import { useState, useEffect } from "react";
import { Clock, User, MoreVertical, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { notifyProfessionalAgendaChange } from "@/lib/professional-agenda-notification";

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  professional_id: string;
  type: string;
  status: "agendado" | "confirmado" | "atendido" | "cancelado";
  patients: { name: string } | null;
  professionals: { name: string } | null;
}

const statusStyles = {
  agendado: "bg-info/10 text-info",
  confirmado: "bg-success/10 text-success",
  atendido: "bg-muted text-muted-foreground",
  cancelado: "bg-destructive/10 text-destructive",
};

const statusLabels = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  atendido: "Atendido",
  cancelado: "Cancelado",
};

export function AppointmentsList() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setIsLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");
    
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        appointment_time,
        professional_id,
        type,
        status,
        patients (name),
        professionals (name)
      `)
      .eq("appointment_date", today)
      .order("appointment_time")
      .limit(10);

    if (!error && data) {
      setAppointments(data as Appointment[]);
    }
    setIsLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      if (status === "confirmado") {
        const appointment = appointments.find((a) => a.id === id);

        if (appointment?.professional_id) {
          const notifyResult = await notifyProfessionalAgendaChange({
            professionalId: appointment.professional_id,
            professionalName: appointment.professionals?.name || "Profissional",
            date: appointment.appointment_date,
            changeType: "edited",
            changeDescription: `✅ ${appointment.patients?.name || "Paciente"} às ${appointment.appointment_time.slice(0, 5)} foi confirmado(a)`,
          });

          if (!notifyResult.success) {
            console.error("Falha ao enviar notificação de confirmação para profissional:", notifyResult.error);
          }
        }
      }

      toast({ title: `Status alterado para ${statusLabels[status as keyof typeof statusLabels]}` });
      fetchAppointments();
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border/30 shadow-card overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="divide-y divide-border/30">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border/30 shadow-card overflow-hidden">
      <div className="p-5 border-b border-border/30 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Consultas de Hoje</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {appointments.length} consulta{appointments.length !== 1 ? "s" : ""} agendada{appointments.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchAppointments}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
      
      {appointments.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Nenhuma consulta agendada para hoje</p>
          <Link to="/agenda" className="text-primary text-sm mt-2 inline-block hover:underline">
            Agendar consulta →
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {appointments.map((appointment) => (
            <div
              key={appointment.id}
              className="p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {appointment.patients?.name || "Paciente"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {appointment.professionals?.name || "Profissional"}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">{appointment.appointment_time.slice(0, 5)}</span>
                  </div>
                  
                  <span className="hidden md:inline text-sm text-muted-foreground">
                    {appointment.type}
                  </span>
                  
                  <span
                    className={cn(
                      "badge-status",
                      statusStyles[appointment.status]
                    )}
                  >
                    {statusLabels[appointment.status]}
                  </span>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      {appointment.status === "agendado" && (
                        <DropdownMenuItem onClick={() => updateStatus(appointment.id, "confirmado")}>
                          Confirmar
                        </DropdownMenuItem>
                      )}
                      {appointment.status === "confirmado" && (
                        <DropdownMenuItem onClick={() => updateStatus(appointment.id, "atendido")}>
                          Marcar como Atendido
                        </DropdownMenuItem>
                      )}
                      {appointment.status !== "cancelado" && appointment.status !== "atendido" && (
                        <DropdownMenuItem 
                          onClick={() => updateStatus(appointment.id, "cancelado")}
                          className="text-destructive"
                        >
                          Cancelar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="p-4 border-t border-border/30 bg-muted/20">
        <Link to="/agenda" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
          Ver todas as consultas →
        </Link>
      </div>
    </div>
  );
}
