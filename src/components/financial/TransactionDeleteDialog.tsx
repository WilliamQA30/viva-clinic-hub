import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createLog } from "@/lib/log-service";
import { formatDateBR } from "@/lib/export-utils";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar as CalendarIcon,
  Loader2,
  Trash2,
  Link2,
} from "lucide-react";

export interface DeletableTransaction {
  id: string;
  description: string;
  type: string;
  amount: number;
  transaction_date: string;
  transaction_time: string;
  payment_method: string | null;
  professional_id: string | null;
  appointment_id?: string | null;
  professionals?: { name: string } | null;
}

type Origin =
  | "manual"
  | "consulta"
  | "repasse_profissional"
  | "comissao_clinica"
  | "conta_paga";

const REPASSE_PREFIX = "repasse profissional";

interface OriginInfo {
  origin: Origin;
  label: string;
  description: string;
  warning?: string;
}

function detectOrigin(t: DeletableTransaction): OriginInfo {
  const desc = (t.description || "").toLowerCase();

  // Conta paga (saída)
  if (t.type === "saida" && desc.startsWith("conta paga:")) {
    return {
      origin: "conta_paga",
      label: "Pagamento de conta",
      description: "Vinculada a uma conta a pagar.",
      warning:
        "Ao excluir, a conta correspondente será revertida para o status 'Pendente'.",
    };
  }

  // Recebimento de consulta (entrada com appointment_id e descrição "Consulta - ")
  if (t.type === "entrada" && t.appointment_id && desc.startsWith("consulta -")) {
    return {
      origin: "consulta",
      label: "Recebimento de consulta",
      description: "Entrada gerada pelo recebimento de uma consulta.",
      warning:
        "Ao excluir, a consulta voltará para 'Pagamento Pendente' e o repasse vinculado ao profissional será removido.",
    };
  }

  // Comissão clínica (entrada vinculada a repasse de profissional)
  if (
    t.type === "entrada" &&
    t.appointment_id &&
    (desc.startsWith("comissão clínica") ||
      desc.startsWith("comissao clinica") ||
      desc.startsWith("recebimento comissão") ||
      desc.startsWith("recebimento comissao"))
  ) {
    return {
      origin: "comissao_clinica",
      label: "Repasse / Comissão de profissional",
      description:
        "Entrada gerada pela confirmação de pagamento na aba 'Pagamentos a Profissionais'.",
      warning:
        "Ao excluir, o repasse correspondente voltará para o status 'Pendente'.",
    };
  }

  // Saída de repasse a profissional (Cenário A confirmado)
  if (t.type === "saida" && desc.startsWith(REPASSE_PREFIX)) {
    return {
      origin: "repasse_profissional",
      label: "Repasse a profissional",
      description:
        "Saída gerada pela confirmação de pagamento na aba 'Pagar Profissionais'.",
      warning:
        "Ao excluir, o repasse correspondente voltará para o status 'Pendente'.",
    };
  }

  return {
    origin: "manual",
    label: "Movimentação manual",
    description: "Lançamento manual feito diretamente no caixa.",
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: DeletableTransaction | null;
  onSuccess?: () => void;
}

export function TransactionDeleteDialog({
  open,
  onOpenChange,
  transaction,
  onSuccess,
}: Props) {
  const [reason, setReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!transaction) return null;

  const info = detectOrigin(transaction);
  const isEntrada = transaction.type === "entrada";

  const revertLinkedRecords = async () => {
    if (info.origin === "consulta" && transaction.appointment_id) {
      // Reverter consulta para pendente, remover repasse vinculado
      // e excluir eventual saída de repasse já registrada (mantém coerência do caixa)
      await supabase
        .from("appointments")
        .update({ payment_status: "pendente", payment_method: null })
        .eq("id", transaction.appointment_id);

      await supabase
        .from("professional_payments")
        .delete()
        .eq("appointment_id", transaction.appointment_id);

      // Remove saída de repasse vinculada ao mesmo agendamento, se existir
      await supabase
        .from("transactions")
        .delete()
        .eq("appointment_id", transaction.appointment_id)
        .eq("type", "saida")
        .ilike("description", "Repasse profissional%");
      return;
    }

    if (info.origin === "comissao_clinica" && transaction.appointment_id) {
      // Voltar repasse vinculado para pendente
      await supabase
        .from("professional_payments")
        .update({ is_paid: false, paid_at: null, payment_method: null })
        .eq("appointment_id", transaction.appointment_id);
      return;
    }

    if (info.origin === "repasse_profissional" && transaction.appointment_id) {
      // Saída de repasse excluída -> voltar professional_payments para pendente
      await supabase
        .from("professional_payments")
        .update({ is_paid: false, paid_at: null, payment_method: null })
        .eq("appointment_id", transaction.appointment_id)
        .eq("payment_destination", "clinic");
      return;
    }

    if (info.origin === "conta_paga") {
      // Tenta encontrar a conta correspondente: descrição = "Conta paga: X" -> X
      const billDescription = transaction.description.replace(/^Conta paga:\s*/i, "").trim();
      if (!billDescription) return;

      // Buscar conta paga com descrição e valor compatíveis (mais recente, status pago)
      const { data: bills } = await supabase
        .from("bills_to_pay")
        .select("id, paid_at")
        .eq("description", billDescription)
        .eq("amount", transaction.amount)
        .eq("status", "pago")
        .order("paid_at", { ascending: false })
        .limit(1);

      if (bills && bills.length > 0) {
        await supabase
          .from("bills_to_pay")
          .update({ status: "pendente", paid_at: null })
          .eq("id", bills[0].id);
      }
    }
  };

  const handleDelete = async () => {
    if (!reason.trim() || reason.trim().length < 3) {
      toast({
        title: "Motivo obrigatório",
        description: "Informe um motivo (mínimo 3 caracteres) para excluir esta movimentação.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      // 1. Reverter vínculos
      await revertLinkedRecords();

      // 2. Excluir a movimentação
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transaction.id);

      if (error) throw error;

      // 3. Log de auditoria
      await createLog({
        action: "transaction_deleted",
        entityType: "transaction",
        entityId: transaction.id,
        description: `Movimentação excluída: ${transaction.description} (R$ ${transaction.amount.toFixed(2)})`,
        metadata: {
          reason: reason.trim(),
          origin: info.origin,
          origin_label: info.label,
          type: transaction.type,
          amount: transaction.amount,
          transaction_date: transaction.transaction_date,
          transaction_time: transaction.transaction_time,
          payment_method: transaction.payment_method,
          professional_id: transaction.professional_id,
          appointment_id: transaction.appointment_id ?? null,
          description_original: transaction.description,
        },
      });

      toast({
        title: "Movimentação excluída",
        description:
          info.origin === "manual"
            ? "O caixa foi atualizado."
            : "Os registros vinculados foram revertidos e o caixa atualizado.",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir movimentação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !isDeleting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-destructive" />
            </div>
            Excluir movimentação
          </DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir esta movimentação? Essa ação irá alterar o
            saldo financeiro, o dashboard e os relatórios do período.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo da movimentação */}
          <div className="rounded-lg border border-border/40 bg-muted/30 p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isEntrada ? "bg-success/10" : "bg-destructive/10"
                  }`}
                >
                  {isEntrada ? (
                    <ArrowUpRight className="w-4 h-4 text-success" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-destructive" />
                  )}
                </div>
                <p className="font-medium text-foreground truncate">
                  {transaction.description}
                </p>
              </div>
              <span
                className={`font-semibold whitespace-nowrap ${
                  isEntrada ? "text-success" : "text-destructive"
                }`}
              >
                {isEntrada ? "+" : "-"}R${" "}
                {transaction.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" />
                {formatDateBR(transaction.transaction_date)} • {transaction.transaction_time}
              </span>
              <Badge variant="secondary" className="text-xs">
                {isEntrada ? "Entrada" : "Saída"}
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                <Link2 className="w-3 h-3" />
                {info.label}
              </Badge>
            </div>
          </div>

          {/* Aviso baseado na origem */}
          {info.warning && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <span className="font-medium block mb-1">{info.description}</span>
                {info.warning}
              </AlertDescription>
            </Alert>
          )}

          {info.origin === "manual" && (
            <Alert className="border-border/40">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {info.description} A exclusão afetará o saldo, o dashboard e os
                relatórios do período.
              </AlertDescription>
            </Alert>
          )}

          {/* Motivo da exclusão */}
          <div className="space-y-2">
            <Label htmlFor="delete-reason">
              Motivo da exclusão <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="delete-reason"
              placeholder="Ex: Lançamento duplicado, valor incorreto, conta paga por engano..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={isDeleting}
            />
            <p className="text-xs text-muted-foreground">
              Este motivo será registrado no log de auditoria do sistema.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || reason.trim().length < 3}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir movimentação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
