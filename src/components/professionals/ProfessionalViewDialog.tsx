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
  DollarSign,
  Briefcase,
  GraduationCap,
  Target,
  Sparkles,
  Loader2,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Professional {
  id: string;
  name: string;
  specialty: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  consultation_value: number;
  work_hours_start: string;
  work_hours_end: string;
  work_days: string[] | null;
  is_active: boolean | null;
  created_at: string;
  birth_date?: string | null;
  crp?: string | null;
  mini_curriculum?: string | null;
  education?: string | null;
  target_audience?: string | null;
  approach?: string | null;
  services?: string[] | null;
  address?: string | null;
}

interface Shift {
  id: string;
  room: string;
  day_of_week: string;
  shift_period: string;
}

interface ProfessionalViewDialogProps {
  professional: Professional | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROOM_LABELS: Record<string, string> = {
  harmonia: "Harmonia 🌿",
  serenidade: "Serenidade 💜",
  florescer: "Florescer 🌸",
  online: "Online 💻",
};

const DAY_LABELS: Record<string, string> = {
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
  sab: "Sábado",
  dom: "Domingo",
};

const SHIFT_LABELS: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

export function ProfessionalViewDialog({ professional, open, onOpenChange }: ProfessionalViewDialogProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && professional) {
      fetchShifts();
    }
  }, [open, professional]);

  const fetchShifts = async () => {
    if (!professional) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("professional_shifts")
      .select("*")
      .eq("professional_id", professional.id)
      .order("day_of_week");

    if (!error && data) {
      setShifts(data as Shift[]);
    }
    setIsLoading(false);
  };

  if (!professional) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center">
              <span className="text-lg font-semibold text-primary-foreground">
                {professional.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{professional.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground font-normal">{professional.specialty}</p>
                <span
                  className={cn(
                    "badge-status",
                    professional.is_active
                      ? "bg-success/10 text-success"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {professional.is_active ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="shifts">Turnos ({shifts.length})</TabsTrigger>
            <TabsTrigger value="professional">Atuação</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {professional.cpf && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">CPF</p>
                    <p className="font-medium">{formatCPF(professional.cpf)}</p>
                  </div>
                </div>
              )}
              {professional.crp && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <Briefcase className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">CRP</p>
                    <p className="font-medium">{professional.crp}</p>
                  </div>
                </div>
              )}
              {professional.phone && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="font-medium">{formatPhone(professional.phone)}</p>
                  </div>
                </div>
              )}
              {professional.email && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">E-mail</p>
                    <p className="font-medium truncate">{professional.email}</p>
                  </div>
                </div>
              )}
              {professional.birth_date && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Data de Nascimento</p>
                    <p className="font-medium">{formatDate(professional.birth_date)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <DollarSign className="w-5 h-5 text-success" />
                <div>
                  <p className="text-xs text-muted-foreground">Valor da Consulta</p>
                  <p className="font-medium">
                    R$ {professional.consultation_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Horário de Trabalho</p>
                  <p className="font-medium">
                    {professional.work_hours_start?.slice(0, 5)} - {professional.work_hours_end?.slice(0, 5)}
                  </p>
                </div>
              </div>
            </div>

            {professional.address && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Endereço</p>
                  <p className="font-medium">{professional.address}</p>
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Cadastrado em {formatDate(professional.created_at)}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="shifts" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground">Nenhum turno cadastrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {shifts.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/30 hover:border-primary/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Home className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{ROOM_LABELS[s.room] || s.room}</p>
                        <p className="text-sm text-muted-foreground">
                          {DAY_LABELS[s.day_of_week] || s.day_of_week} • {SHIFT_LABELS[s.shift_period] || s.shift_period}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="professional" className="space-y-4 mt-4">
            {professional.education && (
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <GraduationCap className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Formação</p>
                </div>
                <p className="text-sm">{professional.education}</p>
              </div>
            )}
            {professional.approach && (
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Abordagem</p>
                </div>
                <p className="text-sm">{professional.approach}</p>
              </div>
            )}
            {professional.target_audience && (
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Público-Alvo</p>
                </div>
                <p className="text-sm">{professional.target_audience}</p>
              </div>
            )}
            {professional.services && professional.services.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Serviços</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {professional.services.map((s, i) => (
                    <span key={i} className="badge-status bg-primary/10 text-primary">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {professional.mini_curriculum && (
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Mini Currículo</p>
                </div>
                <p className="text-sm whitespace-pre-wrap">{professional.mini_curriculum}</p>
              </div>
            )}
            {!professional.education &&
              !professional.approach &&
              !professional.target_audience &&
              !professional.services?.length &&
              !professional.mini_curriculum && (
                <div className="text-center py-8">
                  <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground">Nenhuma informação de atuação cadastrada</p>
                </div>
              )}
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
