import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/validations";
import { DollarSign, Calendar, Clock, FileText, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Label } from "@/components/ui/label";

const transactionSchema = z.object({
  description: z.string().min(3, "Descrição deve ter pelo menos 3 caracteres"),
  amount: z.string().min(1, "Valor é obrigatório"),
  type: z.enum(["entrada", "saida"]),
  payment_method: z.string().min(1, "Forma de pagamento é obrigatória"),
  transaction_date: z.string().min(1, "Data é obrigatória"),
  transaction_time: z.string().min(1, "Hora é obrigatória"),
  professional_id: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface Professional {
  id: string;
  name: string;
}

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultType?: "entrada" | "saida";
}

const paymentMethods = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
];

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function TransactionFormDialog({ open, onOpenChange, onSuccess, defaultType = "entrada" }: TransactionFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isFloorPayment, setIsFloorPayment] = useState(false);
  const [floorMonth, setFloorMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [floorGap, setFloorGap] = useState<number>(0);
  const [floorLoading, setFloorLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: "",
      amount: "",
      type: defaultType,
      payment_method: "",
      transaction_date: new Date().toISOString().split("T")[0],
      transaction_time: new Date().toTimeString().slice(0, 5),
      professional_id: "",
    },
  });

  useEffect(() => {
    if (open) {
      fetchProfessionals();
      const now = new Date();
      setFloorMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
      setIsFloorPayment(false);
      setFloorGap(0);
      form.reset({
        description: "",
        amount: "",
        type: defaultType,
        payment_method: "",
        transaction_date: new Date().toISOString().split("T")[0],
        transaction_time: new Date().toTimeString().slice(0, 5),
        professional_id: "",
      });
    }
  }, [open, defaultType, form]);

  const fetchProfessionals = async () => {
    const { data } = await supabase
      .from("professionals")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    
    if (data) setProfessionals(data);
  };

  const fetchFloorGapForProfessional = useCallback(async (profId: string, month: string) => {
    if (!profId || profId === "none") {
      setFloorGap(0);
      return;
    }

    setFloorLoading(true);
    const [year, mon] = month.split("-").map(Number);
    const startDate = new Date(year, mon - 1, 1).toISOString().split("T")[0];
    const endDate = new Date(year, mon, 0).toISOString().split("T")[0];

    const [settingsRes, shiftsRes, paymentsRes, transactionsRes] = await Promise.all([
      supabase.from("clinic_settings").select("value").eq("key", "floor_value_per_shift").maybeSingle(),
      supabase.from("professional_shifts").select("professional_id").eq("professional_id", profId),
      supabase.from("professional_payments").select("professional_id, clinic_amount, appointments(status, appointment_date)").eq("professional_id", profId),
      supabase.from("transactions").select("professional_id, amount").eq("type", "entrada").eq("professional_id", profId).gte("transaction_date", startDate).lte("transaction_date", endDate),
    ]);

    const floorPerShift = parseFloat(settingsRes.data?.value || "0");
    const shiftCount = (shiftsRes.data || []).length;
    
    const clinicRevenue = (paymentsRes.data || [])
      .filter((p: any) => {
        const d = p.appointments?.appointment_date;
        return d && d >= startDate && d <= endDate && p.appointments?.status !== "cancelado";
      })
      .reduce((sum: number, p: any) => sum + (p.clinic_amount || 0), 0);

    const directEntries = (transactionsRes.data || [])
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

    const gap = Math.max(0, (floorPerShift * shiftCount) - clinicRevenue - directEntries);
    setFloorGap(gap);
    setFloorLoading(false);
    return gap;
  }, []);

  // Recalculate when month or professional changes in floor payment mode
  useEffect(() => {
    if (isFloorPayment) {
      const profId = form.getValues("professional_id");
      if (profId && profId !== "none") {
        fetchFloorGapForProfessional(profId, floorMonth).then((gap) => {
          if (gap !== undefined && gap > 0) {
            form.setValue("amount", formatCurrency(gap));
          }
        });
      }
    }
  }, [floorMonth, isFloorPayment, fetchFloorGapForProfessional, form]);

  const onSubmit = async (data: TransactionFormData) => {
    setIsLoading(true);
    try {
      const amountValue = parseFloat(data.amount.replace(/[^\d,]/g, "").replace(",", ".")) || 
                          parseFloat(data.amount.replace(/\D/g, "")) / 100;

      const { error } = await supabase.from("transactions").insert({
        description: data.description,
        amount: amountValue,
        type: data.type,
        payment_method: data.payment_method,
        transaction_date: data.transaction_date,
        transaction_time: data.transaction_time,
        professional_id: data.professional_id && data.professional_id !== "none" ? data.professional_id : null,
      });

      if (error) throw error;

      toast({
        title: data.type === "entrada" ? "Entrada registrada!" : "Saída registrada!",
        description: `${data.description} - R$ ${amountValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erro ao registrar transação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    const value = e.target.value.replace(/\D/g, "");
    const numValue = parseInt(value) / 100;
    if (!isNaN(numValue) && numValue > 0) {
      onChange(formatCurrency(numValue));
    } else {
      onChange("");
    }
  };

  const transactionType = form.watch("type");

  const handleFloorCheckChange = (checked: boolean) => {
    setIsFloorPayment(checked);
    if (!checked) {
      setFloorGap(0);
      form.setValue("professional_id", "");
      form.setValue("amount", "");
    }
  };

  const updateTransactionDateForFloorMonth = () => {
    // Always use current date for floor payment transactions
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    form.setValue("transaction_date", `${y}-${m}-${d}`);
  };

  const handleFloorProfessionalChange = async (value: string, fieldOnChange: (v: string) => void) => {
    fieldOnChange(value);
    if (value && value !== "none") {
      const gap = await fetchFloorGapForProfessional(value, floorMonth);
      if (gap !== undefined && gap > 0) {
        form.setValue("amount", formatCurrency(gap));
        const prof = professionals.find(p => p.id === value);
        if (prof) {
          const [y, m] = floorMonth.split("-").map(Number);
          form.setValue("description", `Complemento piso - ${prof.name} - ${monthNames[m - 1]}/${y}`);
        }
      }
      updateTransactionDateForFloorMonth();
    }
  };

  // Generate month options (current + past 5 months)
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    return { value, label };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              transactionType === "entrada" ? "bg-success/10" : "bg-destructive/10"
            }`}>
              {transactionType === "entrada" ? (
                <ArrowUpRight className="w-4 h-4 text-success" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-destructive" />
              )}
            </div>
            {transactionType === "entrada" ? "Nova Entrada" : "Nova Saída"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Transação *</FormLabel>
                  <Select onValueChange={(v) => { field.onChange(v); if (v !== "entrada") { setIsFloorPayment(false); } }} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="entrada">
                        <div className="flex items-center gap-2">
                          <ArrowUpRight className="w-4 h-4 text-success" />
                          Entrada
                        </div>
                      </SelectItem>
                      <SelectItem value="saida">
                        <div className="flex items-center gap-2">
                          <ArrowDownRight className="w-4 h-4 text-destructive" />
                          Saída
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Floor payment checkbox - only for "entrada" */}
            {transactionType === "entrada" && (
              <div className="flex items-center space-x-2 rounded-lg border border-border/50 p-3 bg-muted/30">
                <Checkbox
                  id="floor-payment"
                  checked={isFloorPayment}
                  onCheckedChange={(checked) => handleFloorCheckChange(checked === true)}
                />
                <Label htmlFor="floor-payment" className="text-sm font-medium cursor-pointer">
                  Profissional pagando o restante do piso?
                </Label>
              </div>
            )}

            {/* Floor payment: month + professional */}
            {isFloorPayment && transactionType === "entrada" && (
              <div className="space-y-4 rounded-lg border border-primary/20 p-3 bg-primary/5">
                <div>
                  <Label className="text-sm font-medium">Mês de referência *</Label>
                  <Select value={floorMonth} onValueChange={(v) => { setFloorMonth(v); updateTransactionDateForFloorMonth(); }}>
                    <SelectTrigger className="mt-1.5">
                      <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <FormField
                  control={form.control}
                  name="professional_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profissional *</FormLabel>
                      <Select
                        onValueChange={(v) => handleFloorProfessionalChange(v, field.onChange)}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o profissional" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {professionals.map((prof) => (
                            <SelectItem key={prof.id} value={prof.id}>
                              {prof.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {floorLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Calculando valor do piso...
                  </div>
                )}

                {!floorLoading && floorGap > 0 && form.getValues("professional_id") && (
                  <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                    Falta R$ {floorGap.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} para atingir o piso no mês selecionado
                  </div>
                )}

                {!floorLoading && floorGap === 0 && form.getValues("professional_id") && form.getValues("professional_id") !== "none" && (
                  <div className="text-sm text-success font-medium">
                    ✓ Piso já atingido para o mês selecionado
                  </div>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Ex: Consulta - João Silva" className="pl-10" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="R$ 0,00"
                          className="pl-10"
                          {...field}
                          onChange={(e) => handleCurrencyChange(e, field.onChange)}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de Pagamento *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="transaction_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="date" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="transaction_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="time" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Regular professional selector (when NOT floor payment) */}
            {transactionType === "entrada" && !isFloorPayment && (
              <FormField
                control={form.control}
                name="professional_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profissional (opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o profissional" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {professionals.map((prof) => (
                          <SelectItem key={prof.id} value={prof.id}>
                            {prof.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className={transactionType === "entrada" ? "bg-success hover:bg-success/90" : "bg-destructive hover:bg-destructive/90"} 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  `Registrar ${transactionType === "entrada" ? "Entrada" : "Saída"}`
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
