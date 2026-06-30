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
import { Plus, Search, MoreVertical, Phone, Mail, Calendar, Loader2, Eye, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { PatientFormDialog } from "@/components/patients/PatientFormDialog";
import { PatientViewDialog } from "@/components/patients/PatientViewDialog";
import { PatientEditDialog } from "@/components/patients/PatientEditDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCPF, formatPhone, formatDate } from "@/lib/validations";

interface Patient {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string | null;
  birth_date: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Pacientes() {
  const [showPatientDialog, setShowPatientDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Erro ao carregar pacientes",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setPatients(data || []);
    }
    setIsLoading(false);
  };

  const handleDelete = async () => {
    if (!selectedPatient) return;

    const { error } = await supabase
      .from("patients")
      .delete()
      .eq("id", selectedPatient.id);

    if (error) {
      toast({
        title: "Erro ao excluir paciente",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Paciente excluído",
        description: `${selectedPatient.name} foi removido com sucesso.`,
      });
      fetchPatients();
    }
    setShowDeleteDialog(false);
    setSelectedPatient(null);
  };

  const filteredPatients = patients.filter((patient) => {
    const normalizedSearch = searchTerm
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const numericSearch = searchTerm.replace(/\D/g, "");
    const normalizedPatientName = patient.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const matchesSearch =
      !normalizedSearch ||
      normalizedPatientName.includes(normalizedSearch) ||
      (numericSearch.length > 0 && patient.cpf.includes(numericSearch)) ||
      (numericSearch.length > 0 && patient.phone.includes(numericSearch));

    const isActive = patient.is_active !== false;
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && isActive) ||
      (filter === "inactive" && !isActive);

    return matchesSearch && matchesFilter;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-header">Pacientes</h1>
            <p className="page-subtitle">Gerencie os pacientes da clínica</p>
          </div>
          <Button
            className="gradient-primary border-0 text-primary-foreground"
            onClick={() => setShowPatientDialog(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Paciente
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou telefone..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={filter === "all" ? "outline" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
              className={filter === "all" ? "border-primary text-primary" : ""}
            >
              Todos ({patients.length})
            </Button>
            <Button
              variant={filter === "active" ? "outline" : "ghost"}
              size="sm"
              onClick={() => setFilter("active")}
              className={filter === "active" ? "border-primary text-primary" : ""}
            >
              Ativos ({patients.filter((p) => p.is_active).length})
            </Button>
            <Button
              variant={filter === "inactive" ? "outline" : "ghost"}
              size="sm"
              onClick={() => setFilter("inactive")}
              className={filter === "inactive" ? "border-primary text-primary" : ""}
            >
              Inativos ({patients.filter((p) => !p.is_active).length})
            </Button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && patients.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Nenhum paciente cadastrado</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Comece cadastrando seu primeiro paciente
            </p>
            <Button onClick={() => setShowPatientDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Paciente
            </Button>
          </div>
        )}

        {/* Patients Grid */}
        {!isLoading && filteredPatients.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPatients.map((patient) => (
              <div
                key={patient.id}
                className="bg-card rounded-xl border border-border/30 shadow-card p-5 hover:shadow-lg hover:border-primary/20 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center">
                      <span className="text-lg font-semibold text-primary-foreground">
                        {patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{patient.name}</h3>
                      <p className="text-sm text-muted-foreground">{formatCPF(patient.cpf)}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedPatient(patient);
                          setShowViewDialog(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Visualizar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedPatient(patient);
                          setShowEditDialog(true);
                        }}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setSelectedPatient(patient);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{formatPhone(patient.phone)}</span>
                  </div>
                  {patient.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{patient.email}</span>
                    </div>
                  )}
                  {patient.birth_date && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Nascimento: {formatDate(patient.birth_date)}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border/30">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Cadastrado em: </span>
                    <span className="text-foreground font-medium">
                      {formatDate(patient.created_at)}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "badge-status",
                      patient.is_active
                        ? "bg-success/10 text-success"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {patient.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No results */}
        {!isLoading && patients.length > 0 && filteredPatients.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum paciente encontrado com os filtros aplicados</p>
          </div>
        )}

        {/* Pagination */}
        {filteredPatients.length > 0 && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {filteredPatients.length} de {patients.length} pacientes
            </p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <PatientFormDialog
        open={showPatientDialog}
        onOpenChange={setShowPatientDialog}
        onSuccess={fetchPatients}
      />

      <PatientViewDialog
        patient={selectedPatient}
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
      />

      <PatientEditDialog
        patient={selectedPatient}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={fetchPatients}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o paciente <strong>{selectedPatient?.name}</strong>?
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
