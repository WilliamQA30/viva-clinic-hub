import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { AppointmentsList } from "@/components/dashboard/AppointmentsList";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { BirthdayWidget } from "@/components/dashboard/BirthdayWidget";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { countRealized, countCanceled, sumReceivedRevenue, isRealized } from "@/lib/business-rules";
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  CalendarIcon,
} from "lucide-react";

interface DashboardStats {
  monthlyRevenue: number;
  monthlyRevenueChange: number;
  todayAppointments: number;
  confirmedToday: number;
  pendingToday: number;
  cancelledToday: number;
  conversionRate: number;
  activePatients: number;
  newPatientsThisMonth: number;
  occupancyRate: number;
  occupancyChange: number;
}

const Index = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<string>("month");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(undefined);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(undefined);

  useEffect(() => {
    fetchDashboardStats();
  }, [filterPeriod, customDateFrom, customDateTo]);

  const getDateRange = () => {
    const today = new Date();
    
    if (filterPeriod === "custom" && customDateFrom && customDateTo) {
      return {
        start: format(customDateFrom, "yyyy-MM-dd"),
        end: format(customDateTo, "yyyy-MM-dd"),
        prevStart: format(customDateFrom, "yyyy-MM-dd"),
        prevEnd: format(customDateTo, "yyyy-MM-dd"),
      };
    }
    
    switch (filterPeriod) {
      case "today":
        const todayStr = format(today, "yyyy-MM-dd");
        return { start: todayStr, end: todayStr, prevStart: todayStr, prevEnd: todayStr };
      case "week":
        return {
          start: format(startOfWeek(today, { locale: ptBR }), "yyyy-MM-dd"),
          end: format(endOfWeek(today, { locale: ptBR }), "yyyy-MM-dd"),
          prevStart: format(startOfWeek(subMonths(today, 1), { locale: ptBR }), "yyyy-MM-dd"),
          prevEnd: format(endOfWeek(subMonths(today, 1), { locale: ptBR }), "yyyy-MM-dd"),
        };
      case "year":
        return {
          start: format(startOfYear(today), "yyyy-MM-dd"),
          end: format(endOfYear(today), "yyyy-MM-dd"),
          prevStart: format(startOfYear(subMonths(today, 12)), "yyyy-MM-dd"),
          prevEnd: format(endOfYear(subMonths(today, 12)), "yyyy-MM-dd"),
        };
      default: // month
        return {
          start: format(startOfMonth(today), "yyyy-MM-dd"),
          end: format(endOfMonth(today), "yyyy-MM-dd"),
          prevStart: format(startOfMonth(subMonths(today, 1)), "yyyy-MM-dd"),
          prevEnd: format(endOfMonth(subMonths(today, 1)), "yyyy-MM-dd"),
        };
    }
  };

  const fetchDashboardStats = async () => {
    setIsLoading(true);
    try {
      const { start, end, prevStart, prevEnd } = getDateRange();

      // Fetch appointments for the selected period (not just today)
      const { data: periodAppts } = await supabase
        .from("appointments")
        .select("status")
        .gte("appointment_date", start)
        .lte("appointment_date", end);

      // Regras unificadas via motor (src/lib/business-rules.ts):
      //  - "confirmedPeriod" agora significa consultas REALIZADAS (atendido/concluido).
      //  - Confirmado puro deixou de inflar o número.
      const periodAppointments = periodAppts?.length || 0;
      const confirmedPeriod = countRealized(periodAppts);
      const pendingPeriod = periodAppts?.filter(a => a.status === "agendado" || a.status === "confirmado").length || 0;
      const cancelledPeriod = countCanceled(periodAppts);
      const conversionBase = confirmedPeriod + pendingPeriod + cancelledPeriod;
      const conversionRate = conversionBase > 0 ? Math.round((confirmedPeriod / conversionBase) * 100) : 0;

      // Fetch active patients
      const { count: activePatients } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // New patients in selected period
      const { count: newPatientsThisMonth } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true })
        .gte("created_at", start)
        .lte("created_at", end);

      // This period's revenue
      const { data: thisMonthTransactions } = await supabase
        .from("transactions")
        .select("amount, type")
        .gte("transaction_date", start)
        .lte("transaction_date", end);

      // Faturamento RECEBIDO (caixa) — motor único.
      const monthlyRevenue = sumReceivedRevenue(thisMonthTransactions || []);

      // Previous period's revenue for comparison
      const { data: lastMonthTransactions } = await supabase
        .from("transactions")
        .select("amount, type")
        .gte("transaction_date", prevStart)
        .lte("transaction_date", prevEnd);

      const lastMonthRevenue = sumReceivedRevenue(lastMonthTransactions || []);

      const monthlyRevenueChange = lastMonthRevenue > 0
        ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
        : 0;

      // Calculate occupancy rate (appointments vs available slots)
      const { data: thisMonthAppts } = await supabase
        .from("appointments")
        .select("id")
        .gte("appointment_date", start)
        .lte("appointment_date", end)
        .neq("status", "cancelado");

      const { data: lastMonthAppts } = await supabase
        .from("appointments")
        .select("id")
        .gte("appointment_date", prevStart)
        .lte("appointment_date", prevEnd)
        .neq("status", "cancelado");

      // Assuming ~20 working days * ~16 slots = 320 possible slots per month
      const maxSlots = 320;
      const occupancyRate = Math.min(Math.round(((thisMonthAppts?.length || 0) / maxSlots) * 100), 100);
      const lastOccupancy = Math.min(Math.round(((lastMonthAppts?.length || 0) / maxSlots) * 100), 100);
      const occupancyChange = occupancyRate - lastOccupancy;

      setStats({
        monthlyRevenue,
        monthlyRevenueChange,
        todayAppointments: periodAppointments,
        confirmedToday: confirmedPeriod,
        pendingToday: pendingPeriod,
        cancelledToday: cancelledPeriod,
        conversionRate,
        activePatients: activePatients || 0,
        newPatientsThisMonth: newPatientsThisMonth || 0,
        occupancyRate,
        occupancyChange,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPeriodLabel = () => {
    switch (filterPeriod) {
      case "today": return "hoje";
      case "week": return "esta semana";
      case "year": return "este ano";
      case "custom": return "no período";
      default: return "este mês";
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="animate-fade-in flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-header">Dashboard</h1>
            <p className="page-subtitle">Bem-vindo de volta! Aqui está o resumo da sua clínica.</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={filterPeriod} onValueChange={(v) => {
              setFilterPeriod(v);
              if (v !== "custom") {
                setCustomDateFrom(undefined);
                setCustomDateTo(undefined);
              }
            }}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Esta Semana</SelectItem>
                <SelectItem value="month">Este Mês</SelectItem>
                <SelectItem value="year">Este Ano</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {filterPeriod === "custom" && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[120px] justify-start text-left font-normal",
                        !customDateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDateFrom ? format(customDateFrom, "dd/MM/yy") : "Início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customDateFrom}
                      onSelect={setCustomDateFrom}
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
                        "w-[120px] justify-start text-left font-normal",
                        !customDateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDateTo ? format(customDateTo, "dd/MM/yy") : "Fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customDateTo}
                      onSelect={setCustomDateTo}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={`Faturamento ${getPeriodLabel()}`}
            value={stats ? formatCurrency(stats.monthlyRevenue) : "R$ 0"}
            change={stats ? `${stats.monthlyRevenueChange >= 0 ? "+" : ""}${stats.monthlyRevenueChange}% em relação ao período anterior` : "Carregando..."}
            changeType={stats && stats.monthlyRevenueChange >= 0 ? "positive" : "negative"}
            icon={DollarSign}
            iconColor="success"
            isLoading={isLoading}
          />
          <StatCard
            title="Consultas Confirmadas"
            value={stats?.confirmedToday.toString() || "0"}
            change={stats ? `${stats.conversionRate}% confirmadas do total` : "Carregando..."}
            changeType="neutral"
            icon={Calendar}
            iconColor="primary"
            isLoading={isLoading}
            breakdown={stats ? [
              { label: "Confirmadas", value: stats.confirmedToday, tone: "success" },
              { label: "Pendentes", value: stats.pendingToday, tone: "warning" },
              { label: "Canceladas", value: stats.cancelledToday, tone: "destructive" },
            ] : undefined}
          />
          <StatCard
            title="Pacientes Ativos"
            value={stats?.activePatients.toString() || "0"}
            change={stats ? `+${stats.newPatientsThisMonth} novos ${getPeriodLabel()}` : "Carregando..."}
            changeType="positive"
            icon={Users}
            iconColor="accent"
            isLoading={isLoading}
          />
          <StatCard
            title="Taxa de Ocupação"
            value={stats ? `${stats.occupancyRate}%` : "0%"}
            change={stats ? `${stats.occupancyChange >= 0 ? "+" : ""}${stats.occupancyChange}% em relação ao período anterior` : "Carregando..."}
            changeType={stats && stats.occupancyChange >= 0 ? "positive" : "negative"}
            icon={TrendingUp}
            iconColor="warning"
            isLoading={isLoading}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Chart - Takes 2 columns */}
          <div className="xl:col-span-2">
            <RevenueChart filterPeriod={filterPeriod} dateFrom={customDateFrom} dateTo={customDateTo} />
          </div>
          
          {/* Quick Actions & Birthdays */}
          <div className="space-y-6">
            <QuickActions />
            <BirthdayWidget />
          </div>
        </div>

        {/* Appointments List */}
        <AppointmentsList />
      </div>
    </MainLayout>
  );
};

export default Index;
