import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Plus,
  Search,
  Loader2,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  MoreVertical,
  Pencil,
  Trash2,
  CreditCard,
  Repeat,
  XCircle,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/validations";

interface Bill {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  payment_method: string | null;
  paid_at: string | null;
  category: string | null;
  notes: string | null;
  created_at: string;
  recurring_bill_id: string | null;
}

interface RecurringBill {
  id: string;
  description: string;
  amount: number;
  category: string | null;
  notes: string | null;
  payment_method: string | null;
  frequency: string;
  billing_day: number;
  due_day: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  last_generated_date: string | null;
  created_at: string;
}

const billSchema = z.object({
  description: z.string().min(3, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  due_date: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  payment_method: z.string().optional(),
  is_recurring: z.boolean().default(false),
  billing_day: z.string().optional(),
  due_day: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  continuous: z.boolean().default(true),
}).refine((data) => {
  if (!data.is_recurring) return true;
  const billing = parseInt(data.billing_day || "1");
  const due = parseInt(data.due_day || "10");
  return due >= billing;
}, {
  message: "O dia de vencimento deve ser igual ou posterior ao dia de faturamento",
  path: ["due_day"],
});

type BillFormData = z.infer<typeof billSchema>;

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  boleto: "Boleto",
  transferencia: "Transferência",
};

const categoryLabels: Record<string, string> = {
  aluguel: "Aluguel",
  energia: "Energia",
  agua: "Água",
  internet: "Internet",
  material: "Material",
  manutencao: "Manutenção",
  impostos: "Impostos",
  outros: "Outros",
};

const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

export default function ContasPagar() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPeriod, setFilterPeriod] = useState<string>("mes_atual");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(undefined);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(undefined);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditScopeDialog, setShowEditScopeDialog] = useState(false);
  const [showCancelRecurrenceDialog, setShowCancelRecurrenceDialog] = useState(false);
  const [showEditRecurringDialog, setShowEditRecurringDialog] = useState(false);
  const [showDeleteRecurringDialog, setShowDeleteRecurringDialog] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payDate, setPayDate] = useState<Date>(new Date());
  const [isPaying, setIsPaying] = useState(false);
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringBill | null>(null);
  const [editScope, setEditScope] = useState<"this" | "future" | "all">("this");
  const [activeTab, setActiveTab] = useState("contas");
  const { toast } = useToast();

  const form = useForm<BillFormData>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      description: "",
      amount: "",
      due_date: "",
      category: "",
      notes: "",
      payment_method: "",
      is_recurring: false,
      billing_day: "1",
      due_day: "10",
      start_date: "",
      end_date: "",
      continuous: true,
    },
  });

  const isRecurring = form.watch("is_recurring");
  const isContinuous = form.watch("continuous");

  useEffect(() => {
    fetchBills();
    fetchRecurringBills();
    triggerGeneration();
  }, []);

  useEffect(() => {
    if (selectedBill && showFormDialog) {
      form.reset({
        description: selectedBill.description,
        amount: selectedBill.amount.toString(),
        due_date: selectedBill.due_date,
        category: selectedBill.category || "",
        notes: selectedBill.notes || "",
        payment_method: selectedBill.payment_method || "",
        is_recurring: false,
        billing_day: "1",
        due_day: "10",
        start_date: "",
        end_date: "",
        continuous: true,
      });
    } else if (!selectedBill && !selectedRecurring && showFormDialog) {
      form.reset({
        description: "",
        amount: "",
        due_date: "",
        category: "",
        notes: "",
        payment_method: "",
        is_recurring: false,
        billing_day: "1",
        due_day: "10",
        start_date: "",
        end_date: "",
        continuous: true,
      });
    }
  }, [selectedBill, showFormDialog, form]);

  const triggerGeneration = async () => {
    try {
      await supabase.functions.invoke("generate-recurring-bills");
    } catch (e) {
      console.error("Error triggering generation:", e);
    }
  };

  const fetchBills = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("bills_to_pay")
      .select("*")
      .order("due_date", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar contas", description: error.message, variant: "destructive" });
    } else {
      setBills(data || []);
    }
    setIsLoading(false);
  };

  const fetchRecurringBills = async () => {
    const { data, error } = await supabase
      .from("recurring_bills")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching recurring bills:", error);
    } else {
      setRecurringBills((data as any[]) || []);
    }
  };

  const onSubmit = async (data: BillFormData) => {
    try {
      const amount = parseFloat(data.amount.replace(/\D/g, "")) / 100 || parseFloat(data.amount);

      if (data.is_recurring && !selectedBill) {
        const billingDay = parseInt(data.billing_day || "1");
        const dueDay = parseInt(data.due_day || "10");

        const { error } = await supabase.from("recurring_bills").insert({
          description: data.description,
          amount,
          category: data.category || null,
          notes: data.notes || null,
          payment_method: data.payment_method || null,
          frequency: "mensal",
          billing_day: billingDay,
          due_day: dueDay,
          start_date: data.start_date || new Date().toISOString().split("T")[0],
          end_date: data.continuous ? null : (data.end_date || null),
          is_active: true,
          last_generated_date: null,
        });
        if (error) throw error;

        toast({ title: "Conta recorrente criada!" });

        await triggerGeneration();
        await fetchBills();
        await fetchRecurringBills();
      } else if (selectedBill) {
        const payload = {
          description: data.description,
          amount,
          due_date: data.due_date,
          category: data.category || null,
          notes: data.notes || null,
          payment_method: data.payment_method || null,
        };

        const { error } = await supabase.from("bills_to_pay").update(payload).eq("id", selectedBill.id);
        if (error) throw error;
        toast({ title: "Conta atualizada!" });
        await fetchBills();
      } else {
        if (!data.due_date) {
          toast({ title: "Erro", description: "Data de vencimento é obrigatória", variant: "destructive" });
          return;
        }
        const payload = {
          description: data.description,
          amount,
          due_date: data.due_date,
          category: data.category || null,
          notes: data.notes || null,
          payment_method: data.payment_method || null,
        };

        const { error } = await supabase.from("bills_to_pay").insert(payload);
        if (error) throw error;
        toast({ title: "Conta registrada!" });
        await fetchBills();
      }

      setShowFormDialog(false);
      setSelectedBill(null);
      setSelectedRecurring(null);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleEditRecurringBill = (bill: Bill) => {
    if (bill.recurring_bill_id) {
      setSelectedBill(bill);
      setShowEditScopeDialog(true);
    } else {
      setSelectedBill(bill);
      setShowFormDialog(true);
    }
  };

  const handleEditScopeConfirm = async () => {
    setShowEditScopeDialog(false);

    if (editScope === "this") {
      setShowFormDialog(true);
    } else if (editScope === "future" || editScope === "all") {
      if (!selectedBill?.recurring_bill_id) return;

      const recurring = recurringBills.find(r => r.id === selectedBill.recurring_bill_id);
      if (!recurring) {
        toast({ title: "Erro", description: "Regra de recorrência não encontrada", variant: "destructive" });
        return;
      }

      form.reset({
        description: recurring.description,
        amount: recurring.amount.toString(),
        due_date: selectedBill.due_date,
        category: recurring.category || "",
        notes: recurring.notes || "",
        payment_method: recurring.payment_method || "",
        is_recurring: false,
        billing_day: String(recurring.billing_day),
        due_day: String(recurring.due_day),
        start_date: recurring.start_date,
        end_date: recurring.end_date || "",
        continuous: !recurring.end_date,
      });

      setSelectedRecurring(recurring);
      setShowFormDialog(true);
    }
  };

  const handleEditRecurringRule = (recurring: RecurringBill) => {
    form.reset({
      description: recurring.description,
      amount: recurring.amount.toString(),
      due_date: "",
      category: recurring.category || "",
      notes: recurring.notes || "",
      payment_method: recurring.payment_method || "",
      is_recurring: false,
      billing_day: String(recurring.billing_day),
      due_day: String(recurring.due_day),
      start_date: recurring.start_date,
      end_date: recurring.end_date || "",
      continuous: !recurring.end_date,
    });
    setSelectedRecurring(recurring);
    setShowEditRecurringDialog(true);
  };

  const handleSaveRecurringEdit = async (data: BillFormData) => {
    const recurringToEdit = selectedRecurring;
    if (!recurringToEdit) return;

    try {
      const amount = parseFloat(data.amount.replace(/\D/g, "")) / 100 || parseFloat(data.amount);
      const billingDay = parseInt(data.billing_day || "1");
      const dueDay = parseInt(data.due_day || "10");

      if (dueDay < billingDay) {
        toast({ title: "Erro", description: "O dia de vencimento deve ser igual ou posterior ao dia de faturamento", variant: "destructive" });
        return;
      }

      const payload: any = {
        description: data.description,
        amount,
        category: data.category || null,
        notes: data.notes || null,
        payment_method: data.payment_method || null,
        billing_day: billingDay,
        due_day: dueDay,
        end_date: data.continuous ? null : (data.end_date || null),
      };

      await supabase.from("recurring_bills").update(payload).eq("id", recurringToEdit.id);

      // Helper: clamp a day to the month's last day
      const clampDayToMonth = (year: number, month: number, day: number) => {
        const lastDay = new Date(year, month, 0).getDate();
        const actualDay = Math.min(day, lastDay);
        return `${year}-${String(month).padStart(2, "0")}-${String(actualDay).padStart(2, "0")}`;
      };

      // Realign due_date of all pending bills of this rule to the new due_day
      const { data: pendingBills } = await supabase
        .from("bills_to_pay")
        .select("id, due_date")
        .eq("recurring_bill_id", recurringToEdit.id)
        .eq("status", "pendente");

      // Deduplicate: keep only one bill per month for this rule (oldest first)
      const seenMonths = new Set<string>();
      const sorted = (pendingBills || []).slice().sort((a: any, b: any) => a.due_date.localeCompare(b.due_date));
      for (const b of sorted) {
        const [yStr, mStr] = (b as any).due_date.split("-");
        const monthKey = `${yStr}-${mStr}`;
        if (seenMonths.has(monthKey)) {
          await supabase.from("bills_to_pay").delete().eq("id", (b as any).id);
        } else {
          seenMonths.add(monthKey);
          const newDue = clampDayToMonth(parseInt(yStr), parseInt(mStr), dueDay);
          const billPayload: any = {
            description: data.description,
            amount,
            category: data.category || null,
            notes: data.notes || null,
            payment_method: data.payment_method || null,
            due_date: newDue,
          };
          await supabase.from("bills_to_pay").update(billPayload).eq("id", (b as any).id);
        }
      }

      toast({ title: "Recorrência atualizada!" });
      await fetchBills();
      await fetchRecurringBills();

      setShowFormDialog(false);
      setShowEditRecurringDialog(false);
      setSelectedBill(null);
      setSelectedRecurring(null);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleMarkAsPaid = (bill: Bill) => {
    setSelectedBill(bill);
    setPayDate(new Date());
    setShowPayDialog(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedBill) return;
    setIsPaying(true);
    try {
      const bill = selectedBill;
      const dateStr = format(payDate, "yyyy-MM-dd");
      const paidAtIso = new Date(`${dateStr}T${format(new Date(), "HH:mm:ss")}`).toISOString();

      const { error } = await supabase
        .from("bills_to_pay")
        .update({ status: "pago", paid_at: paidAtIso })
        .eq("id", bill.id);

      if (error) throw error;

      await supabase.from("transactions").insert({
        description: `Conta paga: ${bill.description}`,
        type: "saida",
        amount: bill.amount,
        payment_method: bill.payment_method,
        transaction_date: dateStr,
        transaction_time: format(new Date(), "HH:mm:ss"),
      });

      toast({ title: "Conta marcada como paga!" });
      setShowPayDialog(false);
      setSelectedBill(null);
      await triggerGeneration();
      await fetchBills();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsPaying(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBill) return;

    // If this bill belongs to a recurring rule and isn't paid, mark the month
    // as "skipped" so the generator doesn't recreate it.
    if (selectedBill.recurring_bill_id && selectedBill.status !== "pago") {
      const monthStart = selectedBill.due_date.slice(0, 7) + "-01";
      const rule = recurringBills.find((r) => r.id === selectedBill.recurring_bill_id) as any;
      const current: string[] = Array.isArray(rule?.skipped_periods) ? rule.skipped_periods : [];
      if (!current.includes(monthStart)) {
        await supabase
          .from("recurring_bills")
          .update({ skipped_periods: [...current, monthStart] } as any)
          .eq("id", selectedBill.recurring_bill_id);
      }
    }

    const { error } = await supabase.from("bills_to_pay").delete().eq("id", selectedBill.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Conta excluída!" });
      await fetchRecurringBills();
      fetchBills();
    }
    setShowDeleteDialog(false);
    setSelectedBill(null);
  };

  const handleCancelRecurrence = async () => {
    if (!selectedRecurring) return;

    const { error } = await supabase
      .from("recurring_bills")
      .update({ is_active: false })
      .eq("id", selectedRecurring.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Recorrência cancelada!", description: "As contas já geradas foram mantidas." });
      fetchRecurringBills();
    }
    setShowCancelRecurrenceDialog(false);
    setSelectedRecurring(null);
  };

  const handleDeleteRecurrence = async () => {
    if (!selectedRecurring) return;
    const { error } = await supabase
      .from("recurring_bills")
      .delete()
      .eq("id", selectedRecurring.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Recorrência excluída!" });
      fetchRecurringBills();
    }
    setShowDeleteRecurringDialog(false);
    setSelectedRecurring(null);
  };

  const handleReactivateRecurrence = async (recurring: RecurringBill) => {
    const { error } = await supabase
      .from("recurring_bills")
      .update({ is_active: true })
      .eq("id", recurring.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Recorrência reativada!" });
      await triggerGeneration();
      await fetchBills();
      await fetchRecurringBills();
    }
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    const value = e.target.value.replace(/\D/g, "");
    const numValue = parseInt(value) / 100;
    if (!isNaN(numValue)) {
      onChange(formatCurrency(numValue));
    } else {
      onChange("");
    }
  };

  const today = new Date().toISOString().split("T")[0];

  const filteredBills = bills.filter((b) => {
    const matchesSearch = b.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || b.status === filterStatus;
    const matchesCategory = filterCategory === "all" || (b.category || "outros") === filterCategory;

    // Period filter — based on filterPeriod selection
    const now = new Date();
    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    switch (filterPeriod) {
      case "mes_atual": {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
        break;
      }
      case "mes_passado": {
        periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
        periodEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
        break;
      }
      case "proximo_mes": {
        periodStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split("T")[0];
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split("T")[0];
        break;
      }
      case "ano_atual": {
        periodStart = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
        periodEnd = new Date(now.getFullYear(), 11, 31).toISOString().split("T")[0];
        break;
      }
      case "ano_passado": {
        periodStart = new Date(now.getFullYear() - 1, 0, 1).toISOString().split("T")[0];
        periodEnd = new Date(now.getFullYear() - 1, 11, 31).toISOString().split("T")[0];
        break;
      }
      case "personalizado": {
        if (customDateFrom) periodStart = format(customDateFrom, "yyyy-MM-dd");
        if (customDateTo) periodEnd = format(customDateTo, "yyyy-MM-dd");
        break;
      }
    }

    let matchesPeriod = true;
    if (periodStart) matchesPeriod = matchesPeriod && b.due_date >= periodStart;
    if (periodEnd) matchesPeriod = matchesPeriod && b.due_date <= periodEnd;

    return matchesSearch && matchesStatus && matchesPeriod && matchesCategory;
  });

  const pendingBills = filteredBills.filter(b => b.status === "pendente");
  const overdueBills = filteredBills.filter(b => b.status === "pendente" && b.due_date < today);
  const paidBills = filteredBills.filter(b => b.status === "pago");
  const totalPending = pendingBills.reduce((s, b) => s + Number(b.amount || 0), 0);
  const totalOverdue = overdueBills.reduce((s, b) => s + Number(b.amount || 0), 0);
  const totalPaid = paidBills.reduce((s, b) => s + Number(b.amount || 0), 0);

  const handleFormSubmit = (data: BillFormData) => {
    if (selectedRecurring) {
      handleSaveRecurringEdit(data);
    } else {
      onSubmit(data);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-header">Contas a Pagar</h1>
            <p className="page-subtitle">Gerencie as despesas e contas da clínica</p>
          </div>
          <Button
            className="gradient-primary border-0 text-primary-foreground"
            onClick={() => { setSelectedBill(null); setSelectedRecurring(null); setShowFormDialog(true); }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Conta
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <p className="text-sm">Pendentes</p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              R$ {totalPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">{pendingBills.length} contas</p>
          </div>
          <div className="bg-card rounded-xl border border-destructive/20 shadow-card p-4">
            <div className="flex items-center gap-2 text-destructive mb-1">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-sm">Vencidas</p>
            </div>
            <p className="text-2xl font-bold text-destructive">
              R$ {totalOverdue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">{overdueBills.length} contas</p>
          </div>
          <div className="bg-card rounded-xl border border-success/20 shadow-card p-4">
            <div className="flex items-center gap-2 text-success mb-1">
              <CheckCircle className="w-4 h-4" />
              <p className="text-sm">Pago no período</p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              R$ {totalPaid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">{paidBills.length} contas</p>
          </div>
          <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4" />
              <p className="text-sm">Total de Contas</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{filteredBills.length}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="contas">Contas</TabsTrigger>
            <TabsTrigger value="recorrencias">Recorrências</TabsTrigger>
          </TabsList>

          <TabsContent value="contas" className="space-y-4 mt-4">
            {/* Period Dropdown */}
            <div className="flex flex-wrap items-center gap-3">
              <Select value={filterPeriod} onValueChange={(v) => {
                setFilterPeriod(v);
                if (v !== "personalizado") {
                  setCustomDateFrom(undefined);
                  setCustomDateTo(undefined);
                }
              }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes_atual">Este mês</SelectItem>
                  <SelectItem value="mes_passado">Mês passado</SelectItem>
                  <SelectItem value="proximo_mes">Próximo mês</SelectItem>
                  <SelectItem value="ano_atual">Este ano</SelectItem>
                  <SelectItem value="ano_passado">Ano passado</SelectItem>
                  <SelectItem value="personalizado">Intervalo personalizado</SelectItem>
                </SelectContent>
              </Select>

              {filterPeriod === "personalizado" && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn("justify-start text-left font-normal", !customDateFrom && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateFrom ? format(customDateFrom, "dd/MM/yyyy") : "Data inicial"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={customDateFrom}
                        onSelect={setCustomDateFrom}
                        initialFocus
                        locale={ptBR}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn("justify-start text-left font-normal", !customDateTo && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateTo ? format(customDateTo, "dd/MM/yyyy") : "Data final"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={customDateTo}
                        onSelect={setCustomDateTo}
                        initialFocus
                        locale={ptBR}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </>
              )}
            </div>

            {/* Search & Status Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar contas..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Categorias</SelectItem>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <DollarSign className="w-12 h-12 text-muted-foreground/30 mb-2" />
                <p className="text-muted-foreground">Nenhuma conta encontrada</p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border/30 shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="text-left p-4 table-header">Descrição</th>
                        <th className="text-left p-4 table-header hidden sm:table-cell">Categoria</th>
                        <th className="text-left p-4 table-header">Vencimento</th>
                        <th className="text-left p-4 table-header">Status</th>
                        <th className="text-right p-4 table-header">Valor</th>
                        <th className="text-left p-4 table-header"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredBills.map((bill) => {
                        const isOverdue = bill.status === "pendente" && bill.due_date < today;
                        return (
                          <tr key={bill.id} className={cn("hover:bg-muted/30 transition-colors", isOverdue && "bg-destructive/5")}>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-foreground">{bill.description}</p>
                                {bill.recurring_bill_id && (
                                  <Repeat className="w-3.5 h-3.5 text-primary shrink-0" />
                                )}
                              </div>
                              {bill.notes && <p className="text-xs text-muted-foreground mt-0.5">{bill.notes}</p>}
                            </td>
                            <td className="p-4 hidden sm:table-cell">
                              <span className="text-sm text-muted-foreground">
                                {categoryLabels[bill.category || ""] || bill.category || "-"}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-1.5 text-sm">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className={cn(isOverdue && "text-destructive font-medium")}>
                                  {new Date(bill.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={cn(
                                "badge-status",
                                bill.status === "pago" ? "bg-success/10 text-success" :
                                isOverdue ? "bg-destructive/10 text-destructive" :
                                "bg-warning/10 text-warning"
                              )}>
                                {bill.status === "pago" ? "Pago" : isOverdue ? "Vencida" : "Pendente"}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <span className="font-semibold text-foreground">
                                R$ {bill.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
                                  {bill.status === "pendente" && (
                                    <DropdownMenuItem onClick={() => handleMarkAsPaid(bill)}>
                                      <CheckCircle className="w-4 h-4 mr-2 text-success" />
                                      Marcar como Pago
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleEditRecurringBill(bill)}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => { setSelectedBill(bill); setShowDeleteDialog(true); }}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="recorrencias" className="space-y-4 mt-4">
            {recurringBills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Repeat className="w-12 h-12 text-muted-foreground/30 mb-2" />
                <p className="text-muted-foreground">Nenhuma recorrência cadastrada</p>
                <p className="text-xs text-muted-foreground mt-1">Crie uma conta recorrente para automatizar suas despesas fixas</p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border/30 shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="text-left p-4 table-header">Descrição</th>
                        <th className="text-left p-4 table-header hidden sm:table-cell">Categoria</th>
                        <th className="text-left p-4 table-header">Faturamento</th>
                        <th className="text-left p-4 table-header">Vencimento</th>
                        <th className="text-left p-4 table-header hidden sm:table-cell">Período</th>
                        <th className="text-left p-4 table-header">Status</th>
                        <th className="text-right p-4 table-header">Valor</th>
                        <th className="text-left p-4 table-header"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {recurringBills.map((recurring) => (
                        <tr key={recurring.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-4">
                            <p className="font-medium text-foreground">{recurring.description}</p>
                            {recurring.notes && <p className="text-xs text-muted-foreground mt-0.5">{recurring.notes}</p>}
                          </td>
                          <td className="p-4 hidden sm:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {categoryLabels[recurring.category || ""] || recurring.category || "-"}
                            </span>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="text-xs">
                              Dia {recurring.billing_day}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="text-xs">
                              Dia {recurring.due_day}
                            </Badge>
                          </td>
                          <td className="p-4 hidden sm:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {new Date(recurring.start_date + "T12:00:00").toLocaleDateString("pt-BR")}
                              {recurring.end_date
                                ? ` → ${new Date(recurring.end_date + "T12:00:00").toLocaleDateString("pt-BR")}`
                                : " → Contínua"}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "badge-status",
                              recurring.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                            )}>
                              {recurring.is_active ? "Ativa" : "Cancelada"}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <span className="font-semibold text-foreground">
                              R$ {recurring.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
                                <DropdownMenuItem onClick={() => handleEditRecurringRule(recurring)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Editar Recorrência
                                </DropdownMenuItem>
                                {recurring.is_active ? (
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => { setSelectedRecurring(recurring); setShowCancelRecurrenceDialog(true); }}
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Cancelar Recorrência
                                  </DropdownMenuItem>
                                ) : (
                                  <>
                                    <DropdownMenuItem onClick={() => handleReactivateRecurrence(recurring)}>
                                      <CheckCircle className="w-4 h-4 mr-2 text-success" />
                                      Reativar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => { setSelectedRecurring(recurring); setShowDeleteRecurringDialog(true); }}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Excluir Recorrência
                                    </DropdownMenuItem>
                                  </>
                                )}
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Form Dialog */}
      <Dialog open={showFormDialog} onOpenChange={(open) => {
        setShowFormDialog(open);
        if (!open) { setSelectedBill(null); setSelectedRecurring(null); }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-primary-foreground" />
              </div>
              {selectedRecurring ? "Editar Recorrência" : selectedBill ? "Editar Conta" : "Nova Conta a Pagar"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl><Input placeholder="Ex: Aluguel do mês" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="R$ 0,00" className="pl-10" {...field} onChange={(e) => handleCurrencyChange(e, field.onChange)} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {!selectedRecurring && !isRecurring && (
                  <FormField control={form.control} name="due_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vencimento *</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="payment_method" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de Pagamento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(paymentMethodLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl><Textarea placeholder="Observações..." className="min-h-[60px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Recurring option - only for new bills */}
              {!selectedBill && !selectedRecurring && (
                <>
                  <FormField control={form.control} name="is_recurring" render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-3 rounded-lg border border-border/50 p-3 bg-muted/30">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="flex items-center gap-2">
                        <Repeat className="w-4 h-4 text-primary" />
                        <FormLabel className="!mt-0 cursor-pointer">Conta recorrente (mensal)</FormLabel>
                      </div>
                    </FormItem>
                  )} />

                  {isRecurring && (
                    <div className="space-y-4 rounded-lg border border-primary/20 p-4 bg-primary/5">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="billing_day" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dia de faturamento</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Dia" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {dayOptions.map((d) => (
                                  <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />

                        <FormField control={form.control} name="due_day" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dia de vencimento</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Dia" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {dayOptions.map((d) => (
                                  <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>Se o dia configurado não existir em algum mês (ex: dia 31 em abril), o sistema usará automaticamente o último dia do mês.</span>
                      </div>

                      <FormField control={form.control} name="start_date" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de início da recorrência</FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl>
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="continuous" render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-3">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0 cursor-pointer">Recorrência contínua (sem data de término)</FormLabel>
                        </FormItem>
                      )} />

                      {!isContinuous && (
                        <FormField control={form.control} name="end_date" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data de término</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                          </FormItem>
                        )} />
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => { setShowFormDialog(false); setSelectedBill(null); setSelectedRecurring(null); }}>Cancelar</Button>
                <Button type="submit" className="gradient-primary border-0">
                  {selectedRecurring ? "Salvar Recorrência" : selectedBill ? "Salvar" : isRecurring ? "Criar Recorrência" : "Registrar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Scope Dialog */}
      <AlertDialog open={showEditScopeDialog} onOpenChange={setShowEditScopeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar conta recorrente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta conta faz parte de uma recorrência. Como deseja aplicar as alterações?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            {[
              { value: "this" as const, label: "Apenas esta ocorrência" },
              { value: "future" as const, label: "Esta e próximas ocorrências" },
              { value: "all" as const, label: "Toda a recorrência (pendentes)" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setEditScope(option.value)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-colors",
                  editScope === option.value
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border/50 hover:bg-muted/50 text-muted-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setSelectedBill(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEditScopeConfirm} className="gradient-primary border-0">
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Recurrence Dialog */}
      <AlertDialog open={showCancelRecurrenceDialog} onOpenChange={setShowCancelRecurrenceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar recorrência</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja cancelar a recorrência <strong>{selectedRecurring?.description}</strong>?
              As contas já geradas serão mantidas, mas nenhuma nova será criada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelRecurrence} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancelar Recorrência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a conta <strong>{selectedBill?.description}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Recurrence Dialog */}
      <AlertDialog open={showDeleteRecurringDialog} onOpenChange={setShowDeleteRecurringDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recorrência</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a recorrência <strong>{selectedRecurring?.description}</strong>?
              As contas já geradas serão mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRecurrence} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Recurring Rule Dialog */}
      <Dialog open={showEditRecurringDialog} onOpenChange={(open) => {
        setShowEditRecurringDialog(open);
        if (!open) { setSelectedRecurring(null); }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <Repeat className="w-4 h-4 text-primary-foreground" />
              </div>
              Editar Recorrência
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveRecurringEdit)} className="space-y-4">
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl><Input placeholder="Ex: Aluguel do mês" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="R$ 0,00" className="pl-10" {...field} onChange={(e) => handleCurrencyChange(e, field.onChange)} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="payment_method" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de Pagamento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(paymentMethodLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="billing_day" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia de faturamento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Dia" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {dayOptions.map((d) => (
                          <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="due_day" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia de vencimento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Dia" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {dayOptions.map((d) => (
                          <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Se o dia configurado não existir em algum mês (ex: dia 31 em abril), o sistema usará automaticamente o último dia do mês.</span>
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl><Textarea placeholder="Observações..." className="min-h-[60px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="continuous" render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-3">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0 cursor-pointer">Recorrência contínua (sem data de término)</FormLabel>
                </FormItem>
              )} />

              {!isContinuous && (
                <FormField control={form.control} name="end_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de término</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                  </FormItem>
                )} />
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => { setShowEditRecurringDialog(false); setSelectedRecurring(null); }}>Cancelar</Button>
                <Button type="submit" className="gradient-primary border-0">Salvar Recorrência</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Mark as paid dialog */}
      <Dialog open={showPayDialog} onOpenChange={(open) => { if (!isPaying) { setShowPayDialog(open); if (!open) setSelectedBill(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como pago</DialogTitle>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Descrição</span><span className="font-medium text-right">{selectedBill.description}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-semibold">{formatCurrency(selectedBill.amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Vencimento</span><span>{format(new Date(selectedBill.due_date + "T00:00:00"), "dd/MM/yyyy")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Forma de pagamento</span><span>{selectedBill.payment_method ? (paymentMethodLabels[selectedBill.payment_method] || selectedBill.payment_method) : "—"}</span></div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data do pagamento</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !payDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {payDate ? format(payDate, "dd/MM/yyyy") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={payDate}
                      onSelect={(d) => d && setPayDate(d)}
                      locale={ptBR}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowPayDialog(false)} disabled={isPaying}>Cancelar</Button>
                <Button onClick={handleConfirmPayment} disabled={isPaying} className="gradient-primary border-0">
                  {isPaying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Confirmando...</> : "Confirmar pagamento"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
