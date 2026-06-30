import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";

const ROOMS = [
  { value: "harmonia", label: "Harmonia 🌿" },
  { value: "serenidade", label: "Serenidade 💜" },
  { value: "florescer", label: "Florescer 🌸" },
  { value: "online", label: "Online 💻" },
];

const DAYS = [
  { value: "seg", label: "Segunda" },
  { value: "ter", label: "Terça" },
  { value: "qua", label: "Quarta" },
  { value: "qui", label: "Quinta" },
  { value: "sex", label: "Sexta" },
  { value: "sab", label: "Sábado" },
  { value: "dom", label: "Domingo" },
];

const SHIFTS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
];

interface Shift {
  id: string;
  room: string;
  day_of_week: string;
  shift_period: string;
  professional_id: string;
}

interface ProfessionalShiftsTabProps {
  professionalId: string;
}

export function ProfessionalShiftsTab({ professionalId }: ProfessionalShiftsTabProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newRoom, setNewRoom] = useState("");
  const [newDay, setNewDay] = useState("");
  const [newShift, setNewShift] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchShifts();
  }, [professionalId]);

  const fetchShifts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("professional_shifts")
      .select("*")
      .eq("professional_id", professionalId)
      .order("day_of_week");

    if (!error && data) setShifts(data);
    setIsLoading(false);
  };

  const addShift = async () => {
    if (!newRoom || !newDay || !newShift) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    // Check for conflict
    const { data: existing } = await supabase
      .from("professional_shifts")
      .select("*, professionals:professional_id(name)")
      .eq("room", newRoom)
      .eq("day_of_week", newDay)
      .eq("shift_period", newShift)
      .maybeSingle();

    if (existing) {
      toast({
        title: "Conflito de turno",
        description: `Esta sala já está ocupada neste dia e turno por ${(existing as any).professionals?.name || 'outro profissional'}.`,
        variant: "destructive",
      });
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.from("professional_shifts").insert({
      professional_id: professionalId,
      room: newRoom,
      day_of_week: newDay,
      shift_period: newShift,
    });

    if (error) {
      toast({ title: "Erro ao adicionar turno", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Turno adicionado!" });
      setNewRoom("");
      setNewDay("");
      setNewShift("");
      fetchShifts();
    }
    setIsSaving(false);
  };

  const removeShift = async (id: string) => {
    const { error } = await supabase.from("professional_shifts").delete().eq("id", id);
    if (!error) {
      toast({ title: "Turno removido!" });
      fetchShifts();
    }
  };

  const getRoomLabel = (v: string) => ROOMS.find(r => r.value === v)?.label || v;
  const getDayLabel = (v: string) => DAYS.find(d => d.value === v)?.label || v;
  const getShiftLabel = (v: string) => SHIFTS.find(s => s.value === v)?.label || v;

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cada turno adicionado representa um padrão fixo semanal e 1 unidade de piso a ser atingida.
      </p>

      {/* Add new shift */}
      <div className="flex flex-wrap gap-2 items-end p-4 rounded-lg border border-border/30 bg-muted/20">
        <div className="space-y-1 flex-1 min-w-[120px]">
          <label className="text-xs font-medium">Sala</label>
          <Select value={newRoom} onValueChange={setNewRoom}>
            <SelectTrigger><SelectValue placeholder="Sala" /></SelectTrigger>
            <SelectContent>{ROOMS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[120px]">
          <label className="text-xs font-medium">Dia da Semana</label>
          <Select value={newDay} onValueChange={setNewDay}>
            <SelectTrigger><SelectValue placeholder="Dia" /></SelectTrigger>
            <SelectContent>{DAYS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[120px]">
          <label className="text-xs font-medium">Turno</label>
          <Select value={newShift} onValueChange={setNewShift}>
            <SelectTrigger><SelectValue placeholder="Turno" /></SelectTrigger>
            <SelectContent>{SHIFTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={addShift} disabled={isSaving} size="sm">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
          Adicionar
        </Button>
      </div>

      {/* List shifts */}
      {shifts.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">Nenhum turno cadastrado</p>
      ) : (
        <div className="space-y-2">
          {shifts.map((shift) => (
            <div key={shift.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-card">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{getRoomLabel(shift.room)}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm">{getDayLabel(shift.day_of_week)}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm">{getShiftLabel(shift.shift_period)}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeShift(shift.id)} className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Total de turnos: <strong>{shifts.length}</strong> (= {shifts.length} unidade(s) de piso)
      </p>
    </div>
  );
}
