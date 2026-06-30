import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

interface CancelConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading: boolean;
  patientName?: string;
}

export function CancelConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  patientName,
}: CancelConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar Consulta</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja cancelar a consulta de{" "}
            <strong>{patientName || "este paciente"}</strong>?
            <br /><br />
            Esta ação irá:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Marcar a consulta como cancelada</li>
              <li>Excluir todos os registros financeiros associados</li>
              <li>Remover débitos pendentes do profissional</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelando...
              </>
            ) : (
              "Sim, cancelar consulta"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
