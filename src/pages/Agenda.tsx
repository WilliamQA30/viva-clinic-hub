import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Calendar, Plus, ChevronLeft, ChevronRight, Filter, Home } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { AppointmentFormDialog, ROOM_OPTIONS, RoomType } from "@/components/appointments/AppointmentFormDialog";
import { AppointmentDetailsDialog } from "@/components/appointments/AppointmentDetailsDialog";
import { supabase } from "@/integrations/supabase/client";
import { notifyProfessionalAgendaChange } from "@/lib/professional-agenda-notification";
import { createLog } from "@/lib/log-service";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, addDays, startOfMonth, endOfMonth, isSameDay, isSameMonth, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";

const DAY_START_MINUTES = 8 * 60;
const DAY_END_MINUTES = 23 * 60;
const SLOT_INTERVAL_MINUTES = 30;

const timeSlots = Array.from(
  { length: (DAY_END_MINUTES - DAY_START_MINUTES) / SLOT_INTERVAL_MINUTES + 1 },
  (_, index) => {
    const totalMinutes = DAY_START_MINUTES + index * SLOT_INTERVAL_MINUTES;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
);

const getAppointmentTopOffset = (time: string, rowHeight: number) => {
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  const totalMinutes = hour * 60 + minute;
  if (totalMinutes < DAY_START_MINUTES || totalMinutes > DAY_END_MINUTES) return null;
  return ((totalMinutes - DAY_START_MINUTES) / SLOT_INTERVAL_MINUTES) * rowHeight;
};

const getRoomIcon = (room: string | null) => {
  const roomIcons: Record<string, string> = {
    harmonia: "🌿",
    serenidade: "💜",
    florescer: "🌸",
    online: "💻",
  };
  return roomIcons[room || ""] || "";
};

const getEndTime = (startTime: string, durationMinutes: number) => {
  const [h, m] = startTime.slice(0, 5).split(":").map(Number);
  const totalMinutes = h * 60 + m + (durationMinutes || 30);
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
};

// Get display name for an appointment (including all patients for couple/family therapy + package info)
const getDisplayName = (apt: Appointment): string => {
  let name = "";
  
  // Check if there are multiple patients (couple/family therapy)
  const allPatients = apt.appointment_patients && apt.appointment_patients.length > 1
    ? apt.appointment_patients.map(ap => ap.patients?.name).filter(Boolean)
    : [apt.patients?.name].filter(Boolean);
  
  name = allPatients.length > 0 ? allPatients.join(" / ") : "Paciente";
  
  // Add package info
  if (apt.is_package && apt.package_session_number && apt.package_total_sessions) {
    name += ` - Sessão ${apt.package_session_number}/${apt.package_total_sessions}`;
  }
  
  return name;
};

// Get short display name (first names only, for compact views)
const getShortDisplayName = (apt: Appointment): string => {
  const allPatients = apt.appointment_patients && apt.appointment_patients.length > 1
    ? apt.appointment_patients.map(ap => ap.patients?.name?.split(" ")[0]).filter(Boolean)
    : [apt.patients?.name?.split(" ")[0]].filter(Boolean);
  
  let name = allPatients.length > 0 ? allPatients.join(" / ") : "";
  
  if (apt.is_package && apt.package_session_number && apt.package_total_sessions) {
    name += ` (${apt.package_session_number}/${apt.package_total_sessions})`;
  }
  
  return name;
};
interface AppointmentPatient {
  patient_id: string;
  patients: { name: string; phone?: string } | null;
}

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  type: string;
  status: string;
  modality: string | null;
  payment_method: string | null;
  payment_status: string | null;
  consultation_value: number | null;
  clinic_percentage: number | null;
  no_show_charged: boolean | null;
  notes: string | null;
  patient_id: string;
  professional_id: string;
  is_package: boolean | null;
  package_session_number: number | null;
  package_total_sessions: number | null;
  patients: { name: string; phone?: string } | null;
  professionals: { name: string; specialty?: string } | null;
  appointment_patients?: AppointmentPatient[];
}

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [selectedRoom, setSelectedRoom] = useState<RoomType | "all">("all");
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatDateForDB = (date: Date) => {
    return format(date, "yyyy-MM-dd");
  };

  useEffect(() => {
    fetchAppointments();
  }, [currentDate, view, selectedRoom]);

  const fetchAppointments = async () => {
    setIsLoading(true);
    let startDate: string, endDate: string;

    if (view === "day") {
      startDate = endDate = formatDateForDB(currentDate);
    } else if (view === "week") {
      startDate = formatDateForDB(startOfWeek(currentDate, { weekStartsOn: 1 }));
      endDate = formatDateForDB(endOfWeek(currentDate, { weekStartsOn: 1 }));
    } else {
      startDate = formatDateForDB(startOfMonth(currentDate));
      endDate = formatDateForDB(endOfMonth(currentDate));
    }

    let query = supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        appointment_time,
        duration_minutes,
        type,
        status,
        modality,
        payment_method,
        payment_status,
        consultation_value,
        clinic_percentage,
        no_show_charged,
        notes,
        patient_id,
        professional_id,
        is_package,
        package_session_number,
        package_total_sessions,
        patients (name, phone),
        professionals (name, specialty),
        appointment_patients (patient_id, patients (name, phone))
      `)
      .gte("appointment_date", startDate)
      .lte("appointment_date", endDate)
      .order("appointment_date")
      .order("appointment_time");

    // Filter by room if not "all"
    if (selectedRoom !== "all") {
      query = query.eq("modality", selectedRoom);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Erro ao carregar consultas",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setAppointments((data as Appointment[]) || []);
    }
    setIsLoading(false);
  };

  const goToToday = () => setCurrentDate(new Date());
  
  const goPrev = () => {
    if (view === "day") {
      setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 1)));
    } else if (view === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };
  
  const goNext = () => {
    if (view === "day") {
      setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)));
    } else if (view === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const updateAppointmentStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", id);

      if (error) {
        toast({
          title: "Erro ao atualizar status",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Find the appointment to get details for notification
        const apt = appointments.find((a: any) => a.id === id);

        // Log the status update
        await createLog({
          action: status === "confirmado" ? "appointment_confirmed" : "appointment_updated",
          entityType: "appointment",
          entityId: id,
          description: `Status da consulta de ${apt ? getDisplayName(apt) : "Paciente"} alterado para ${status}`,
          metadata: { new_status: status },
        });

        // Notify professional immediately when appointment is confirmed
        if (status === "confirmado" && apt?.professional_id) {
          const notifyResult = await notifyProfessionalAgendaChange({
            professionalId: apt.professional_id,
            professionalName: apt.professionals?.name || "Profissional",
            date: apt.appointment_date,
            changeType: "edited",
            changeDescription: `✅ ${getDisplayName(apt)} às ${apt.appointment_time.slice(0, 5)} foi confirmado(a)`,
          });

          if (!notifyResult.success) {
            console.error("Falha ao enviar notificação de confirmação para profissional:", notifyResult.error);
          }
        }

        toast({
          title: "Status atualizado!",
          description: `Consulta marcada como ${status}.`,
        });
        await fetchAppointments();
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const getMonthDays = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days: Date[] = [];
    
    // Add days from previous month to fill the first week
    const startWeek = startOfWeek(start, { weekStartsOn: 1 });
    let current = startWeek;
    
    while (current <= end || days.length % 7 !== 0) {
      days.push(current);
      current = addDays(current, 1);
      if (days.length > 42) break; // Max 6 weeks
    }
    
    return days;
  };

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter(apt => apt.appointment_date === formatDateForDB(date));
  };

  // Calculate position for concurrent appointments (side by side)
  const getAppointmentLayout = (apt: Appointment, allAppointments: Appointment[]) => {
    const timeStr = apt.appointment_time.slice(0, 5);
    const concurrent = allAppointments.filter(a => 
      a.appointment_time.slice(0, 5) === timeStr && 
      a.appointment_date === apt.appointment_date
    );
    const index = concurrent.findIndex(a => a.id === apt.id);
    const total = concurrent.length;
    
    return {
      width: total > 1 ? `calc(${100 / total}% - 8px)` : 'calc(100% - 16px)',
      left: total > 1 ? `calc(${(index * 100) / total}% + 8px)` : '8px',
    };
  };

  const renderDayView = () => (
    <div className="grid grid-cols-[80px_1fr] divide-x divide-border/30">
      <div className="divide-y divide-border/30">
        <div className="h-12 border-b border-border/30" />
        {timeSlots.map((time) => (
          <div key={time} className="h-16 flex items-start justify-end p-2">
            <span className="text-xs text-muted-foreground">{time}</span>
          </div>
        ))}
      </div>

      <div className="relative">
        <div className="h-12 border-b border-border/30 flex items-center px-4">
          <span className="font-medium text-foreground">
            {currentDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric" })}
          </span>
        </div>
        
        <div className="relative">
          {timeSlots.map((time) => (
            <div key={time} className="h-16 border-b border-border/20 hover:bg-muted/20 transition-colors" />
          ))}

          {appointments.map((apt) => {
            const timeStr = apt.appointment_time.slice(0, 5);
            
            const topOffset = getAppointmentTopOffset(timeStr, 64);
            if (topOffset === null) return null;
            const height = ((apt.duration_minutes || 30) / SLOT_INTERVAL_MINUTES) * 64;
            const isFree = (apt.consultation_value ?? 0) <= 0;
            const isPending = apt.payment_status === "pendente" && !isFree;
            const isPaid = apt.payment_status === "pago" && !isFree;
            const layout = getAppointmentLayout(apt, appointments);

            return (
              <div
                key={apt.id}
                onClick={() => {
                  setSelectedAppointment(apt);
                  setShowDetailsDialog(true);
                }}
                className={cn(
                  "absolute rounded-lg p-3 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg group overflow-hidden",
                  apt.status === "cancelado"
                    ? "bg-muted border border-border/30 opacity-60"
                    : apt.status === "cliente_faltou"
                    ? "bg-warning/15 border-2 border-warning/50"
                    : apt.status === "profissional_faltou"
                    ? "bg-purple-500/10 border-2 border-purple-500/50"
                    : apt.status === "atendido"
                    ? "bg-success/10 border-2 border-success/50"
                    : apt.status === "confirmado"
                    ? "bg-blue-500/10 border-2 border-blue-500/50"
                    : isPending
                    ? "bg-destructive/10 border-2 border-destructive/50"
                    : isPaid
                    ? "bg-success/10 border-2 border-success/50"
                    : "bg-primary/10 border border-primary/30"
                )}
                style={{ 
                  top: topOffset, 
                  height: Math.max(height - 4, 56),
                  width: layout.width,
                  left: layout.left,
                }}
                title={`${timeStr} - ${getEndTime(apt.appointment_time, apt.duration_minutes)} • ${getDisplayName(apt)}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm text-foreground truncate flex items-center gap-1">
                    {apt.status === "confirmado" && <span>✅</span>}
                    {apt.status === "cliente_faltou" && <span title="Cliente faltou">⚠️</span>}
                    {apt.status === "profissional_faltou" && <span title="Profissional faltou">🚫</span>}
                    {getDisplayName(apt)}
                  </p>
                  {isFree && apt.status !== "cancelado" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-info/20 text-info" title="Consulta gratuita">Grátis</span>
                  )}
                  {isPending && apt.status !== "cancelado" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">$</span>
                  )}
                  {isPaid && apt.status !== "cancelado" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-success/20 text-success">✓</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {getRoomIcon(apt.modality)} {apt.professionals?.name || "Profissional"} • {apt.type}
                </p>
                
                <div className="hidden group-hover:flex items-center gap-1 mt-1">
                  {apt.status === "agendado" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateAppointmentStatus(apt.id, "confirmado");
                      }}
                      disabled={updatingId === apt.id}
                      className="text-xs px-2 py-0.5 rounded bg-success/20 text-success hover:bg-success/30 disabled:opacity-50"
                    >
                      {updatingId === apt.id ? "⏳ Confirmando..." : "✅ Confirmar"}
                    </button>
                  )}
                  {apt.status === "confirmado" && (
                    <span className="text-xs px-2 py-0.5 rounded bg-success/10 text-success">
                      ✅ Confirmado
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/50">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          )}

          {!isLoading && appointments.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground">Nenhuma consulta agendada</p>
                <Button
                  variant="link"
                  onClick={() => setShowAppointmentDialog(true)}
                  className="text-primary"
                >
                  Agendar consulta
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderWeekView = () => {
    const weekDays = getWeekDays();
    
    return (
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-[80px_repeat(7,1fr)] divide-x divide-border/30">
            <div className="divide-y divide-border/30">
              <div className="h-16 border-b border-border/30" />
              {timeSlots.map((time) => (
                <div key={time} className="h-14 flex items-start justify-end p-2">
                  <span className="text-xs text-muted-foreground">{time}</span>
                </div>
              ))}
            </div>

            {weekDays.map((day) => {
              const dayAppointments = getAppointmentsForDate(day);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div key={day.toISOString()} className="relative">
                  <div className={cn(
                    "h-16 border-b border-border/30 flex flex-col items-center justify-center",
                    isToday && "bg-primary/5"
                  )}>
                    <span className="text-xs text-muted-foreground">
                      {format(day, "EEE", { locale: ptBR })}
                    </span>
                    <span className={cn(
                      "text-lg font-semibold",
                      isToday && "text-primary"
                    )}>
                      {format(day, "d")}
                    </span>
                  </div>
                  
                  <div className="relative">
                    {timeSlots.map((time) => (
                      <div key={time} className="h-14 border-b border-border/20 hover:bg-muted/20 transition-colors" />
                    ))}

                    {dayAppointments.map((apt) => {
                      const timeStr = apt.appointment_time.slice(0, 5);
                      
                      const topOffset = getAppointmentTopOffset(timeStr, 56);
                      if (topOffset === null) return null;
                      const isFree = (apt.consultation_value ?? 0) <= 0;
                      const isPending = apt.payment_status === "pendente" && !isFree;
                      const isPaid = apt.payment_status === "pago" && !isFree;

                      return (
                        <div
                          key={apt.id}
                          onClick={() => {
                            setSelectedAppointment(apt);
                            setShowDetailsDialog(true);
                          }}
                          className={cn(
                            "absolute left-1 right-1 rounded p-1 text-xs cursor-pointer",
                            apt.status === "cancelado"
                              ? "bg-muted border border-border/30 opacity-60"
                              : apt.status === "cliente_faltou"
                              ? "bg-warning/15 border-2 border-warning/40"
                              : apt.status === "profissional_faltou"
                              ? "bg-purple-500/10 border-2 border-purple-500/40"
                              : apt.status === "atendido"
                              ? "bg-success/10 border-2 border-success/40"
                              : apt.status === "confirmado"
                              ? "bg-blue-500/10 border-2 border-blue-500/40"
                              : isPending
                              ? "bg-destructive/10 border-2 border-destructive/40"
                              : isPaid
                              ? "bg-success/10 border-2 border-success/40"
                              : "bg-primary/20 border border-primary/30"
                          )}
                          style={{ top: topOffset, height: 52 }}
                          title={`${timeStr} - ${getEndTime(apt.appointment_time, apt.duration_minutes)} • ${getDisplayName(apt)} • ${apt.type}`}
                        >
                          <p className="font-medium truncate">
                            {apt.status === "confirmado" && "✅ "}
                            {apt.status === "cliente_faltou" && "⚠️ "}
                            {apt.status === "profissional_faltou" && "🚫 "}
                            {getDisplayName(apt)}
                          </p>
                          <p className="text-muted-foreground truncate">{timeStr}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthDays = getMonthDays();
    const weekDayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    
    return (
      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDayNames.map((day) => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((day, index) => {
            const dayAppointments = getAppointmentsForDate(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, currentDate);
            
            return (
              <div
                key={index}
                className={cn(
                  "min-h-[100px] p-2 rounded-lg border transition-colors",
                  isCurrentMonth ? "bg-card border-border/30" : "bg-muted/30 border-transparent",
                  isToday && "ring-2 ring-primary"
                )}
              >
                <span className={cn(
                  "text-sm font-medium",
                  isCurrentMonth ? "text-foreground" : "text-muted-foreground",
                  isToday && "text-primary"
                )}>
                  {format(day, "d")}
                </span>
                
                <div className="mt-1 space-y-1">
                  {dayAppointments.slice(0, 3).map((apt) => {
                    const isFree = (apt.consultation_value ?? 0) <= 0;
                    const isPending = apt.payment_status === "pendente" && !isFree;
                    const isPaid = apt.payment_status === "pago" && !isFree;
                    
                    return (
                      <div
                        key={apt.id}
                        onClick={() => {
                          setSelectedAppointment(apt);
                          setShowDetailsDialog(true);
                        }}
                        className={cn(
                          "text-xs p-1 rounded truncate cursor-pointer",
                          apt.status === "cancelado"
                            ? "bg-muted text-muted-foreground opacity-60"
                            : apt.status === "cliente_faltou"
                            ? "bg-warning/15 text-warning"
                            : apt.status === "profissional_faltou"
                            ? "bg-purple-500/10 text-purple-600"
                            : apt.status === "atendido"
                            ? "bg-success/10 text-success"
                            : apt.status === "confirmado"
                            ? "bg-blue-500/10 text-blue-500"
                            : isPending
                            ? "bg-destructive/10 text-destructive"
                            : isPaid
                            ? "bg-success/10 text-success"
                            : "bg-primary/20 text-primary"
                        )}
                        title={`${apt.appointment_time.slice(0, 5)} - ${getEndTime(apt.appointment_time, apt.duration_minutes)} • ${getDisplayName(apt)}`}
                      >
                        {apt.status === "confirmado" ? "✅ " : ""}{apt.appointment_time.slice(0, 5)} {getShortDisplayName(apt)}
                      </div>
                    );
                  })}
                  {dayAppointments.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{dayAppointments.length - 3} mais
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getHeaderText = () => {
    if (view === "day") {
      return formatDate(currentDate);
    } else if (view === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, "d MMM", { locale: ptBR })} - ${format(end, "d MMM yyyy", { locale: ptBR })}`;
    } else {
      return format(currentDate, "MMMM yyyy", { locale: ptBR });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-header">Agenda</h1>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="page-subtitle capitalize text-left hover:text-foreground transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  {getHeaderText()}
                  <Calendar className="w-4 h-4 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={currentDate}
                  onSelect={(date) => date && setCurrentDate(date)}
                  initialFocus
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="gradient-primary border-0 text-primary-foreground"
              onClick={() => setShowAppointmentDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Consulta
            </Button>
          </div>
        </div>

        {/* Room Tabs */}
        <div className="flex items-center gap-2 p-1 bg-muted rounded-lg overflow-x-auto">
          <button
            onClick={() => setSelectedRoom("all")}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-2",
              selectedRoom === "all"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Home className="w-4 h-4" />
            Todos os Espaços
          </button>
          {ROOM_OPTIONS.map((room) => (
            <button
              key={room.value}
              onClick={() => setSelectedRoom(room.value)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-2",
                selectedRoom === room.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{room.icon}</span>
              {room.label}
            </button>
          ))}
        </div>

        {/* Calendar Controls */}
        <div className="flex items-center justify-between bg-card rounded-xl border border-border/30 shadow-card p-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={goPrev}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={goNext}>
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              <Calendar className="w-4 h-4 mr-2" />
              Hoje
            </Button>
          </div>
          
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setView("day")}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                view === "day"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Dia
            </button>
            <button
              onClick={() => setView("week")}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                view === "week"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Semana
            </button>
            <button
              onClick={() => setView("month")}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                view === "month"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mês
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {appointments.length} consulta{appointments.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-card rounded-xl border border-border/30 shadow-card overflow-hidden">
          {view === "day" && renderDayView()}
          {view === "week" && renderWeekView()}
          {view === "month" && renderMonthView()}
        </div>
      </div>

      <AppointmentFormDialog
        open={showAppointmentDialog}
        onOpenChange={setShowAppointmentDialog}
        onSuccess={fetchAppointments}
        defaultDate={formatDateForDB(currentDate)}
      />

      <AppointmentDetailsDialog
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        appointment={selectedAppointment}
        onSuccess={fetchAppointments}
      />
    </MainLayout>
  );
}
