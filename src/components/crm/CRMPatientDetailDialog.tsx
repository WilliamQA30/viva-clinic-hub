import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CRM_STATUSES, INACTIVATION_REASONS, SUGGESTED_TAGS, isAutoTag, tagDisplay, getReasonLabel } from "@/lib/crm";
import { CRMStatusBadge } from "./CRMStatusBadge";
import { X, Plus, Loader2 } from "lucide-react";

export interface CRMPatientRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  is_active: boolean;
  crm_status: string | null;
  crm_status_locked: boolean;
  crm_tags: string[];
  crm_notes: string | null;
  inactivation_reason: string | null;
  inactivation_reason_other: string | null;
  last_appointment_date?: string | null;
  last_professional_name?: string | null;
  total_attended?: number;
}

interface Props {
  patient: CRMPatientRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

export function CRMPatientDetailDialog({ patient, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [locked, setLocked] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [reason, setReason] = useState<string>("");
  const [reasonOther, setReasonOther] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (patient && open) {
      setStatus(patient.crm_status ?? "lead_novo");
      setLocked(patient.crm_status_locked);
      setTags(patient.crm_tags ?? []);
      setReason(patient.inactivation_reason ?? "");
      setReasonOther(patient.inactivation_reason_other ?? "");
      setNotes(patient.crm_notes ?? "");
      setNewTag("");
    }
  }, [patient, open]);

  if (!patient) return null;

  const addTag = (t: string) => {
    const trimmed = t.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) return;
    setTags([...tags, trimmed]);
    setNewTag("");
  };

  const removeTag = (t: string) => {
    if (isAutoTag(t)) return;
    setTags(tags.filter((x) => x !== t));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        crm_status: status,
        crm_status_locked: locked,
        crm_status_updated_at: new Date().toISOString(),
        crm_tags: tags,
        crm_notes: notes || null,
        inactivation_reason: patient.is_active ? null : (reason || null),
        inactivation_reason_other: patient.is_active ? null : (reason === "outros" ? (reasonOther || null) : null),
      };
      const { error } = await supabase.from("patients").update(payload).eq("id", patient.id);
      if (error) throw error;
      toast({ title: "CRM atualizado", description: `${patient.name} salvo com sucesso.` });
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {patient.name}
            <CRMStatusBadge status={status} />
            {!patient.is_active && <Badge variant="outline" className="border-rose-200 text-rose-700">Inativo</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3 text-sm bg-muted/40 p-3 rounded-lg">
            <div><span className="text-muted-foreground">Telefone:</span> {patient.phone || "—"}</div>
            <div><span className="text-muted-foreground">E-mail:</span> {patient.email || "—"}</div>
            <div><span className="text-muted-foreground">Última consulta:</span> {patient.last_appointment_date ? new Date(patient.last_appointment_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</div>
            <div><span className="text-muted-foreground">Profissional recente:</span> {patient.last_professional_name || "—"}</div>
            <div><span className="text-muted-foreground">Consultas atendidas:</span> {patient.total_attended ?? 0}</div>
          </div>

          {/* Status CRM */}
          <div className="space-y-2">
            <Label>Status CRM</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CRM_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Fixar status manualmente</p>
                <p className="text-xs text-muted-foreground">O sistema não vai sobrescrever automaticamente</p>
              </div>
              <Switch checked={locked} onCheckedChange={setLocked} />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <Badge key={t} variant={isAutoTag(t) ? "secondary" : "outline"} className="gap-1">
                  {tagDisplay(t)}
                  {!isAutoTag(t) && (
                    <button onClick={() => removeTag(t)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                  )}
                </Badge>
              ))}
              {tags.length === 0 && <span className="text-sm text-muted-foreground">Sem tags</span>}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Nova tag..." value={newTag} onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(newTag); } }} />
              <Button type="button" variant="outline" size="icon" onClick={() => addTag(newTag)}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {SUGGESTED_TAGS.filter((s) => !tags.includes(s)).map((s) => (
                <button key={s} type="button" onClick={() => addTag(s)} className="text-xs px-2 py-0.5 rounded-md border border-dashed hover:bg-muted">
                  + {s}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo de inativação */}
          {!patient.is_active && (
            <div className="space-y-2">
              <Label>Motivo da inativação</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {INACTIVATION_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {reason === "outros" && (
                <Textarea value={reasonOther} onChange={(e) => setReasonOther(e.target.value)} placeholder="Descreva..." />
              )}
              {reason && reason !== "outros" && (
                <p className="text-xs text-muted-foreground">{getReasonLabel(reason)}</p>
              )}
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações de relacionamento</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Cliente pediu para chamar em junho..."
              className="min-h-[90px]"
            />
            <p className="text-xs text-muted-foreground">Uso operacional do CRM. Não substitui anotações clínicas.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
