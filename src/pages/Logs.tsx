import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Search,
  History,
  Calendar,
  User,
  FileText,
  DollarSign,
  Settings,
  Shield,
  MessageSquare,
  RefreshCw,
  CalendarIcon,
} from "lucide-react";

interface SystemLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  user_name: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  appointment_created: "Consulta Criada",
  appointment_updated: "Consulta Atualizada",
  appointment_cancelled: "Consulta Cancelada",
  appointment_confirmed: "Consulta Confirmada",
  payment_registered: "Pagamento Registrado",
  patient_created: "Paciente Criado",
  patient_updated: "Paciente Atualizado",
  professional_created: "Profissional Criado",
  professional_updated: "Profissional Atualizado",
  transaction_created: "Transação Criada",
  transaction_deleted: "Transação Excluída",
  professional_paid: "Profissional Pago",
  whatsapp_sent: "WhatsApp Enviado",
  reminder_sent: "Lembrete Enviado",
  settings_updated: "Configurações Atualizadas",
  login: "Login",
  logout: "Logout",
};

const entityIcons: Record<string, any> = {
  appointment: Calendar,
  patient: User,
  professional: User,
  transaction: DollarSign,
  settings: Settings,
  auth: Shield,
};

const actionStyles: Record<string, string> = {
  appointment_created: "bg-success/10 text-success border-success/30",
  appointment_cancelled: "bg-destructive/10 text-destructive border-destructive/30",
  payment_registered: "bg-primary/10 text-primary border-primary/30",
  whatsapp_sent: "bg-green-500/10 text-green-600 border-green-500/30",
  reminder_sent: "bg-blue-500/10 text-blue-600 border-blue-500/30",
};

export default function Logs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  useEffect(() => {
    fetchLogs();
  }, [entityFilter, dateFrom, dateTo]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }

      if (dateFrom) {
        query = query.gte("created_at", startOfDay(dateFrom).toISOString());
      }

      if (dateTo) {
        query = query.lte("created_at", endOfDay(dateTo).toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs((data as SystemLog[]) || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(
    (log) =>
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="page-header flex items-center gap-2">
              <History className="w-8 h-8" />
              Logs do Sistema
            </h1>
            <p className="page-subtitle">
              Histórico completo de todas as ações realizadas no sistema
            </p>
          </div>
          <Button variant="outline" onClick={fetchLogs} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="appointment">Consultas</SelectItem>
                  <SelectItem value="patient">Pacientes</SelectItem>
                  <SelectItem value="professional">Profissionais</SelectItem>
                  <SelectItem value="transaction">Transações</SelectItem>
                  <SelectItem value="settings">Configurações</SelectItem>
                  <SelectItem value="auth">Autenticação</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full md:w-[150px] justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full md:w-[150px] justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>

              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateFrom(undefined);
                    setDateTo(undefined);
                  }}
                >
                  Limpar datas
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Registros ({filteredLogs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum log encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Data/Hora</TableHead>
                      <TableHead className="w-[150px]">Ação</TableHead>
                      <TableHead className="w-[120px]">Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[150px]">Usuário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const Icon = entityIcons[log.entity_type] || FileText;
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {formatDate(log.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={actionStyles[log.action] || "bg-muted"}
                            >
                              {actionLabels[log.action] || log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                              <span className="capitalize text-sm">
                                {log.entity_type}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {log.description}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.user_name || "Sistema"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}