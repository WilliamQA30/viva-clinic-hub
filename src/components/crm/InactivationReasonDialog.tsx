import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INACTIVATION_REASONS } from "@/lib/crm";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (reason: string, other: string | null) => void;
  initialReason?: string | null;
  initialOther?: string | null;
  title?: string;
}

export function InactivationReasonDialog({ open, onOpenChange, onConfirm, initialReason, initialOther, title }: Props) {
  const [reason, setReason] = useState<string>(initialReason ?? "");
  const [other, setOther] = useState<string>(initialOther ?? "");

  useEffect(() => {
    if (open) {
      setReason(initialReason ?? "");
      setOther(initialOther ?? "");
    }
  }, [open, initialReason, initialOther]);

  const isOther = reason === "outros";
  const canSave = reason.length > 0 && (!isOther || other.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{title ?? "Motivo da inativação"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Motivo *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Selecione um motivo" /></SelectTrigger>
              <SelectContent>
                {INACTIVATION_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isOther && (
            <div>
              <Label>Descreva *</Label>
              <Textarea value={other} onChange={(e) => setOther(e.target.value)} placeholder="Detalhe o motivo..." />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!canSave} onClick={() => onConfirm(reason, isOther ? other.trim() : null)}>
            Confirmar inativação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
