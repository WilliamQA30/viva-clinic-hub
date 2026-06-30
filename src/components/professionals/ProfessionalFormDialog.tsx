import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validateCPF, validatePhone, formatCPF, formatPhone, formatCurrency, normalizePhoneForStorage } from "@/lib/validations";
import { User, Mail, DollarSign, Loader2, Stethoscope, MapPin, Calendar } from "lucide-react";
import { ProfessionalShiftsTab } from "./ProfessionalShiftsTab";
import { ProfessionalHistoryTab } from "./ProfessionalHistoryTab";
import { AttachmentsTab } from "@/components/shared/AttachmentsTab";
import { InternationalPhoneInput } from "@/components/shared/InternationalPhoneInput";

const professionalSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  specialty: z.string().min(2, "Especialidade é obrigatória"),
  cpf: z.string().optional().refine((val) => !val || validateCPF(val), "CPF inválido"),
  phone: z.string().optional().refine((val) => !val || validatePhone(val), "Telefone inválido"),
  email: z.string().email("E-mail inválido").or(z.literal("")).optional(),
  consultation_value: z.string().min(1, "Valor da consulta é obrigatório"),
  is_active: z.boolean(),
  crp: z.string().optional(),
  mini_curriculum: z.string().optional(),
  education: z.string().optional(),
  target_audience: z.string().optional(),
  approach: z.string().optional(),
  services: z.string().optional(),
  address: z.string().optional(),
  registration_date: z.string().min(1, "Data de cadastro é obrigatória"),
  birth_date: z.string().optional(),
});

type ProfessionalFormData = z.infer<typeof professionalSchema>;

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
  crp?: string | null;
  mini_curriculum?: string | null;
  education?: string | null;
  target_audience?: string | null;
  approach?: string | null;
  services?: string[] | null;
  address?: string | null;
  registration_date?: string | null;
  birth_date?: string | null;
}

interface ProfessionalFormDialogProps {
  professional?: Professional | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ProfessionalFormDialog({ professional, open, onOpenChange, onSuccess }: ProfessionalFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [savedProfessionalId, setSavedProfessionalId] = useState<string | null>(null);
  const { toast } = useToast();
  const isEditing = !!professional;
  const entityId = professional?.id || savedProfessionalId;

  const form = useForm<ProfessionalFormData>({
    resolver: zodResolver(professionalSchema),
    defaultValues: {
      name: "",
      specialty: "",
      cpf: "",
      phone: "",
      email: "",
      consultation_value: "",
      is_active: true,
      crp: "",
      mini_curriculum: "",
      education: "",
      target_audience: "",
      approach: "",
      services: "",
      address: "",
      registration_date: new Date().toISOString().split("T")[0],
      birth_date: "",
    },
  });

  useEffect(() => {
    if (professional && open) {
      form.reset({
        name: professional.name,
        specialty: professional.specialty,
        cpf: professional.cpf ? formatCPF(professional.cpf) : "",
        phone: professional.phone ? formatPhone(professional.phone) : "",
        email: professional.email || "",
        consultation_value: professional.consultation_value.toString(),
        is_active: professional.is_active ?? true,
        crp: professional.crp || "",
        mini_curriculum: professional.mini_curriculum || "",
        education: professional.education || "",
        target_audience: professional.target_audience || "",
        approach: professional.approach || "",
        services: professional.services?.join(", ") || "",
        address: professional.address || "",
        registration_date: professional.registration_date || new Date().toISOString().split("T")[0],
        birth_date: professional.birth_date || "",
      });
    } else if (!professional && open) {
      setSavedProfessionalId(null);
      form.reset({
        name: "",
        specialty: "",
        cpf: "",
        phone: "",
        email: "",
        consultation_value: "",
        is_active: true,
        crp: "",
        mini_curriculum: "",
        education: "",
        target_audience: "",
        approach: "",
        services: "",
        address: "",
        registration_date: new Date().toISOString().split("T")[0],
        birth_date: "",
      });
    }
  }, [professional, open, form]);

  const onSubmit = async (data: ProfessionalFormData) => {
    setIsLoading(true);
    try {
      const servicesArray = data.services
        ? data.services.split(",").map(s => s.trim()).filter(Boolean)
        : null;

      const payload = {
        name: data.name,
        specialty: data.specialty,
        cpf: data.cpf ? data.cpf.replace(/\D/g, "") : null,
        phone: data.phone ? normalizePhoneForStorage(data.phone) : null,
        email: data.email || null,
        consultation_value: parseFloat(data.consultation_value.replace(/\D/g, "")) / 100 || parseFloat(data.consultation_value),
        is_active: data.is_active,
        crp: data.crp || null,
        mini_curriculum: data.mini_curriculum || null,
        education: data.education || null,
        target_audience: data.target_audience || null,
        approach: data.approach || null,
        services: servicesArray,
        address: data.address || null,
        registration_date: data.registration_date,
        birth_date: data.birth_date || null,
      };

      if (isEditing && professional) {
        const { error } = await supabase
          .from("professionals")
          .update(payload)
          .eq("id", professional.id);
        if (error) throw error;
        toast({ title: "Profissional atualizado!", description: `${data.name} foi atualizado com sucesso.` });
        form.reset();
        onOpenChange(false);
        onSuccess?.();
      } else if (savedProfessionalId) {
        const { error } = await supabase
          .from("professionals")
          .update(payload)
          .eq("id", savedProfessionalId);
        if (error) throw error;
        toast({ title: "Profissional atualizado!", description: `${data.name} foi atualizado com sucesso.` });
        form.reset();
        onOpenChange(false);
        onSuccess?.();
      } else {
        const { data: inserted, error } = await supabase.from("professionals").insert(payload).select("id").single();
        if (error) throw error;
        setSavedProfessionalId(inserted.id);
        toast({ title: "Profissional cadastrado!", description: `${data.name} foi salvo. Agora você pode adicionar turnos e anexos.` });
        onSuccess?.();
      }
    } catch (error: any) {
      toast({
        title: isEditing ? "Erro ao atualizar profissional" : "Erro ao cadastrar profissional",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value.length <= 11) onChange(formatCPF(value));
  };


  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    const value = e.target.value.replace(/\D/g, "");
    const numValue = parseInt(value) / 100;
    if (!isNaN(numValue)) onChange(formatCurrency(numValue));
    else onChange("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-primary-foreground" />
            </div>
            {isEditing ? "Editar Profissional" : "Novo Profissional"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados">
          <TabsList className={`grid w-full ${entityId ? "grid-cols-4" : "grid-cols-1"}`}>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            {entityId && <TabsTrigger value="turnos">Turnos</TabsTrigger>}
            {entityId && <TabsTrigger value="historico">Histórico</TabsTrigger>}
            {entityId && <TabsTrigger value="anexos">Anexos</TabsTrigger>}
          </TabsList>

          <TabsContent value="dados">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Dados Básicos */}
                <p className="text-sm font-medium text-muted-foreground">Dados Básicos</p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Nome completo *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input placeholder="Nome do profissional" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="specialty" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Especialidade *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input placeholder="Ex: Psicologia Clínica" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="crp" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CRP</FormLabel>
                      <FormControl><Input placeholder="Ex: 11/12345" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="consultation_value" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor da Consulta *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input placeholder="R$ 0,00" className="pl-10" {...field} onChange={(e) => handleCurrencyChange(e, field.onChange)} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="registration_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Cadastro *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input type="date" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="birth_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Nascimento</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input type="date" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="cpf" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl><Input placeholder="000.000.000-00" {...field} onChange={(e) => handleCPFChange(e, field.onChange)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <InternationalPhoneInput
                          value={field.value || ""}
                          onChange={field.onChange}
                          countryAriaLabel="Selecionar país do telefone do profissional"
                          numberAriaLabel="Telefone do profissional"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input placeholder="email@exemplo.com" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input placeholder="Endereço completo" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Informações Profissionais */}
                <p className="text-sm font-medium text-muted-foreground pt-2">Informações Profissionais</p>

                <FormField control={form.control} name="approach" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Abordagem</FormLabel>
                    <FormControl><Input placeholder="Ex: TCC, Psicanálise, Humanista..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="target_audience" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Público Alvo</FormLabel>
                    <FormControl><Input placeholder="Ex: Adultos, Crianças, Adolescentes, Casais..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="services" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serviços Oferecidos</FormLabel>
                    <FormControl><Input placeholder="Ex: Psicoterapia, Avaliação (separar por vírgula)" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="education" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Formações e Especializações</FormLabel>
                    <FormControl><Textarea placeholder="Descreva formações..." className="min-h-[60px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="mini_curriculum" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mini Currículo</FormLabel>
                    <FormControl><Textarea placeholder="Breve descrição profissional..." className="min-h-[60px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {isEditing && (
                  <FormField control={form.control} name="is_active" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel className="text-base">Profissional Ativo</FormLabel>
                        <p className="text-sm text-muted-foreground">Profissionais inativos não aparecem na agenda</p>
                      </div>
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )} />
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                  <Button type="submit" className="gradient-primary border-0" disabled={isLoading}>
                    {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : isEditing ? "Salvar Alterações" : "Cadastrar Profissional"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {entityId && (
            <>
              <TabsContent value="turnos">
                <ProfessionalShiftsTab professionalId={entityId} />
              </TabsContent>
              <TabsContent value="historico">
                <ProfessionalHistoryTab professionalId={entityId} />
              </TabsContent>
              <TabsContent value="anexos">
                <AttachmentsTab entityType="professional" entityId={entityId} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
