import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Plus, MoreVertical, Clock, DollarSign, Calendar, Star, Search, Loader2, Pencil, Trash2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProfessionalFormDialog } from "@/components/professionals/ProfessionalFormDialog";
import { ProfessionalViewDialog } from "@/components/professionals/ProfessionalViewDialog";

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
}

const dayLabels: Record<string, string> = {
  seg: "Seg",
  ter: "Ter",
  qua: "Qua",
  qui: "Qui",
  sex: "Sex",
  sab: "Sáb",
  dom: "Dom",
};

export default function Profissionais() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [shiftCounts, setShiftCounts] = useState<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchProfessionals();
    fetchShiftCounts();
  }, []);

  const fetchProfessionals = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("professionals")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Erro ao carregar profissionais",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setProfessionals(data || []);
    }
    setIsLoading(false);
  };

  const fetchShiftCounts = async () => {
    const { data } = await supabase
      .from("professional_shifts")
      .select("professional_id");
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((s) => {
        counts[s.professional_id] = (counts[s.professional_id] || 0) + 1;
      });
      setShiftCounts(counts);
    }
  };

  const handleDelete = async () => {
    if (!selectedProfessional) return;

    const { error } = await supabase
      .from("professionals")
      .delete()
      .eq("id", selectedProfessional.id);

    if (error) {
      toast({
        title: "Erro ao excluir profissional",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profissional excluído",
        description: `${selectedProfessional.name} foi removido com sucesso.`,
      });
      fetchProfessionals();
    }
    setShowDeleteDialog(false);
    setSelectedProfessional(null);
  };

  const filteredProfessionals = professionals.filter((prof) =>
    prof.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prof.specialty.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeProfessionals = professionals.filter((p) => p.is_active);
  const totalConsultationValue = professionals.reduce((sum, p) => sum + p.consultation_value, 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-header">Profissionais</h1>
            <p className="page-subtitle">Gerencie os profissionais da clínica</p>
          </div>
          <Button
            className="gradient-primary border-0 text-primary-foreground"
            onClick={() => {
              setSelectedProfessional(null);
              setShowFormDialog(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Profissional
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou especialidade..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
            <p className="text-sm text-muted-foreground">Total de Profissionais</p>
            <p className="text-2xl font-bold text-foreground mt-1">{professionals.length}</p>
          </div>
          <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
            <p className="text-sm text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold text-foreground mt-1">{activeProfessionals.length}</p>
          </div>
          <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
            <p className="text-sm text-muted-foreground">Valor Médio Consulta</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              R$ {professionals.length > 0 ? (totalConsultationValue / professionals.length).toFixed(0) : 0}
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
            <p className="text-sm text-muted-foreground">Especialidades</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {new Set(professionals.map((p) => p.specialty)).size}
            </p>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && professionals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Nenhum profissional cadastrado</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Comece cadastrando seu primeiro profissional
            </p>
            <Button onClick={() => setShowFormDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Profissional
            </Button>
          </div>
        )}

        {/* Professionals List */}
        {!isLoading && filteredProfessionals.length > 0 && (
          <div className="bg-card rounded-xl border border-border/30 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left p-4 table-header">Profissional</th>
                    <th className="text-left p-4 table-header hidden sm:table-cell">Especialidade</th>
                    <th className="text-left p-4 table-header hidden md:table-cell">Turnos</th>
                    <th className="text-left p-4 table-header hidden lg:table-cell">Valor Consulta</th>
                    <th className="text-left p-4 table-header">Status</th>
                    <th className="text-left p-4 table-header"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredProfessionals.map((professional) => (
                    <tr key={professional.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary-foreground">
                              {professional.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{professional.name}</p>
                            <p className="text-sm text-muted-foreground sm:hidden">{professional.specialty}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <span className="text-sm text-foreground">{professional.specialty}</span>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{shiftCounts[professional.id] || 0} turno(s)</span>
                        </div>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <DollarSign className="w-4 h-4 text-success" />
                          <span>R$ {professional.consultation_value.toLocaleString("pt-BR")}</span>
                        </div>
                      </td>
                      <td className="p-4">
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
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                              <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedProfessional(professional);
                                setShowViewDialog(true);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedProfessional(professional);
                                setShowFormDialog(true);
                              }}
                            >
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                setSelectedProfessional(professional);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No results */}
        {!isLoading && professionals.length > 0 && filteredProfessionals.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum profissional encontrado</p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ProfessionalFormDialog
        professional={selectedProfessional}
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        onSuccess={fetchProfessionals}
      />

      <ProfessionalViewDialog
        professional={selectedProfessional}
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o profissional <strong>{selectedProfessional?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
