import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, parseISO, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

interface ChartData {
  name: string;
  fullName: string;
  receita: number;
  despesa: number;
  lucro: number;
}

interface RevenueChartProps {
  filterPeriod?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export function RevenueChart({ filterPeriod = "month", dateFrom, dateTo }: RevenueChartProps) {
  const [data, setData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chartType, setChartType] = useState<"area" | "bar">("area");

  useEffect(() => {
    fetchChartData();
  }, [filterPeriod, dateFrom, dateTo]);

  const fetchChartData = async () => {
    setIsLoading(true);
    try {
      if (filterPeriod === "today") {
        // Single day - show just today
        const today = format(new Date(), "yyyy-MM-dd");
        const { data: transactions } = await supabase
          .from("transactions")
          .select("amount, type")
          .eq("transaction_date", today);

        const receita = transactions?.filter((t) => t.type === "entrada").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        const despesa = transactions?.filter((t) => t.type === "saida").reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        setData([{
          name: "Hoje",
          fullName: format(new Date(), "dd 'de' MMMM", { locale: ptBR }),
          receita,
          despesa,
          lucro: receita - despesa,
        }]);
      } else if (filterPeriod === "week") {
        // Week - show each day of the week
        const weekStart = startOfWeek(new Date(), { locale: ptBR });
        const weekEnd = endOfWeek(new Date(), { locale: ptBR });
        const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
        
        const chartData: ChartData[] = [];
        for (const day of days) {
          const dayStr = format(day, "yyyy-MM-dd");
          const { data: transactions } = await supabase
            .from("transactions")
            .select("amount, type")
            .eq("transaction_date", dayStr);

          const receita = transactions?.filter((t) => t.type === "entrada").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
          const despesa = transactions?.filter((t) => t.type === "saida").reduce((sum, t) => sum + Number(t.amount), 0) || 0;

          chartData.push({
            name: format(day, "EEE", { locale: ptBR }),
            fullName: format(day, "EEEE, dd 'de' MMMM", { locale: ptBR }),
            receita,
            despesa,
            lucro: receita - despesa,
          });
        }
        setData(chartData);
      } else if (filterPeriod === "custom" && dateFrom && dateTo) {
        // Custom period - decide granularity based on range
        const daysDiff = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 31) {
          // Show daily for up to 31 days
          const days = eachDayOfInterval({ start: dateFrom, end: dateTo });
          const chartData: ChartData[] = [];
          
          for (const day of days) {
            const dayStr = format(day, "yyyy-MM-dd");
            const { data: transactions } = await supabase
              .from("transactions")
              .select("amount, type")
              .eq("transaction_date", dayStr);

            const receita = transactions?.filter((t) => t.type === "entrada").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
            const despesa = transactions?.filter((t) => t.type === "saida").reduce((sum, t) => sum + Number(t.amount), 0) || 0;

            chartData.push({
              name: format(day, "dd/MM"),
              fullName: format(day, "dd 'de' MMMM", { locale: ptBR }),
              receita,
              despesa,
              lucro: receita - despesa,
            });
          }
          setData(chartData);
        } else {
          // Show monthly for longer periods
          const months = eachMonthOfInterval({ start: dateFrom, end: dateTo });
          const chartData: ChartData[] = [];
          
          for (const month of months) {
            const start = format(startOfMonth(month), "yyyy-MM-dd");
            const end = format(endOfMonth(month), "yyyy-MM-dd");
            const { data: transactions } = await supabase
              .from("transactions")
              .select("amount, type")
              .gte("transaction_date", start)
              .lte("transaction_date", end);

            const receita = transactions?.filter((t) => t.type === "entrada").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
            const despesa = transactions?.filter((t) => t.type === "saida").reduce((sum, t) => sum + Number(t.amount), 0) || 0;

            chartData.push({
              name: format(month, "MMM", { locale: ptBR }),
              fullName: format(month, "MMMM 'de' yyyy", { locale: ptBR }),
              receita,
              despesa,
              lucro: receita - despesa,
            });
          }
          setData(chartData);
        }
      } else if (filterPeriod === "year") {
        // Year - show 12 months of the current year
        const today = new Date();
        const months: ChartData[] = [];

        for (let i = 11; i >= 0; i--) {
          const date = subMonths(today, i);
          const start = format(startOfMonth(date), "yyyy-MM-dd");
          const end = format(endOfMonth(date), "yyyy-MM-dd");
          const monthName = format(date, "MMM", { locale: ptBR });
          const monthFull = format(date, "MMMM yyyy", { locale: ptBR });

          const { data: transactions } = await supabase
            .from("transactions")
            .select("amount, type")
            .gte("transaction_date", start)
            .lte("transaction_date", end);

          const receita = transactions?.filter((t) => t.type === "entrada").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
          const despesa = transactions?.filter((t) => t.type === "saida").reduce((sum, t) => sum + Number(t.amount), 0) || 0;

          months.push({
            name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
            fullName: monthFull.charAt(0).toUpperCase() + monthFull.slice(1),
            receita,
            despesa,
            lucro: receita - despesa,
          });
        }
        setData(months);
      } else {
        // Default "month": show each day of the current month
        const today = new Date();
        const monthStart = startOfMonth(today);
        const monthEnd = endOfMonth(today);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

        const startStr = format(monthStart, "yyyy-MM-dd");
        const endStr = format(monthEnd, "yyyy-MM-dd");

        const { data: transactions } = await supabase
          .from("transactions")
          .select("amount, type, transaction_date")
          .gte("transaction_date", startStr)
          .lte("transaction_date", endStr);

        const chartData: ChartData[] = days.map((day) => {
          const dayStr = format(day, "yyyy-MM-dd");
          const dayTx = transactions?.filter((t) => t.transaction_date === dayStr) || [];
          const receita = dayTx.filter((t) => t.type === "entrada").reduce((sum, t) => sum + Number(t.amount), 0);
          const despesa = dayTx.filter((t) => t.type === "saida").reduce((sum, t) => sum + Number(t.amount), 0);

          return {
            name: format(day, "dd/MM"),
            fullName: format(day, "dd 'de' MMMM", { locale: ptBR }),
            receita,
            despesa,
            lucro: receita - despesa,
          };
        });

        setData(chartData);
      }
    } catch (error) {
      console.error("Error fetching chart data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalReceita = data.reduce((sum, d) => sum + d.receita, 0);
  const totalDespesa = data.reduce((sum, d) => sum + d.despesa, 0);
  const totalLucro = totalReceita - totalDespesa;

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border/30 shadow-card p-5">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-[280px] w-full" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border/30 shadow-card p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Faturamento</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Receitas vs Despesas no período selecionado</p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setChartType("area")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              chartType === "area"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Área
          </button>
          <button
            onClick={() => setChartType("bar")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              chartType === "bar"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Barras
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-3 rounded-lg bg-success/10 border border-success/20">
          <p className="text-xs text-muted-foreground">Total Receitas</p>
          <p className="text-lg font-bold text-success">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalReceita)}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-muted-foreground">Total Despesas</p>
          <p className="text-lg font-bold text-destructive">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalDespesa)}
          </p>
        </div>
        <div className={`p-3 rounded-lg ${totalLucro >= 0 ? "bg-primary/10 border-primary/20" : "bg-destructive/10 border-destructive/20"} border`}>
          <p className="text-xs text-muted-foreground">Lucro Líquido</p>
          <p className={`text-lg font-bold ${totalLucro >= 0 ? "text-primary" : "text-destructive"}`}>
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalLucro)}
          </p>
        </div>
      </div>
      
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "area" ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(175, 60%, 40%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(175, 60%, 40%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(12, 80%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(12, 80%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 12 }}
                tickFormatter={(value) => value > 0 ? `R$${(value / 1000).toFixed(0)}k` : "R$0"}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(210, 20%, 90%)",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
                formatter={(value: number) =>
                  new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(value)
                }
              />
              <Area
                type="monotone"
                dataKey="receita"
                stroke="hsl(175, 60%, 40%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorReceita)"
                name="Receita"
              />
              <Area
                type="monotone"
                dataKey="despesa"
                stroke="hsl(12, 80%, 60%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorDespesa)"
                name="Despesa"
              />
            </AreaChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 12 }}
                tickFormatter={(value) => value > 0 ? `R$${(value / 1000).toFixed(0)}k` : "R$0"}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(210, 20%, 90%)",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
                formatter={(value: number) =>
                  new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(value)
                }
              />
              <Legend />
              <Bar dataKey="receita" fill="hsl(175, 60%, 40%)" name="Receita" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesa" fill="hsl(12, 80%, 60%)" name="Despesa" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      
      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border/30">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-sm text-muted-foreground">Receita</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent" />
          <span className="text-sm text-muted-foreground">Despesa</span>
        </div>
      </div>
    </div>
  );
}
