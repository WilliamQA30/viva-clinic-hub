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
import { validateCPF, validatePhone, formatCPF, normalizePhoneForStorage } from "@/lib/validations";
import { createLog } from "@/lib/log-service";
import { User, Mail, Calendar, MapPin, FileText, Loader2, AlertTriangle, Users } from "lucide-react";
import { AttachmentsTab } from "@/components/shared/AttachmentsTab";
import { InternationalPhoneInput } from "@/components/shared/InternationalPhoneInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REFERRAL_SOURCES } from "@/lib/crm";

const patientSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string().refine((val) => validateCPF(val), "CPF inválido"),
  phone: z.string().refine((val) => validatePhone(val), "Telefone inválido"),
  email: z.string().email("E-mail inválido").or(z.literal("")),
  birth_date: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  referral_source: z.string().min(1, "Origem de aquisição é obrigatória"),
  referral_detail: z.string().optional(),
  emergency_contact: z.string().optional(),
  registration_date: z.string().min(1, "Data de cadastro é obrigatória"),
  guardian_name: z.string().optional(),
  guardian_cpf: z.string().optional(),
  guardian_phone: z.string().optional(),
  guardian_relationship: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

interface PatientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PatientFormDialog({ open, onOpenChange, onSuccess }: PatientFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [savedPatientId, setSavedPatientId] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: "",
      cpf: "",
      phone: "",
      email: "",
      birth_date: "",
      address: "",
      notes: "",
      referral_source: "",
      referral_detail: "",
      emergency_contact: "",
      registration_date: new Date().toISOString().split("T")[0],
      guardian_name: "",
      guardian_cpf: "",
      guardian_phone: "",
      guardian_relationship: "",
    },
  });

  const birthDate = form.watch("birth_date");
  const isMinor = (() => {
    if (!birthDate) return false;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age < 18;
  })();

  useEffect(() => {
    if (open) {
      setSavedPatientId(null);
      form.reset({
        name: "",
        cpf: "",
        phone: "",
        email: "",
        birth_date: "",
        address: "",
        notes: "",
        referral_source: "",
        referral_detail: "",
        emergency_contact: "",
        registration_date: new Date().toISOString().split("T")[0],
        guardian_name: "",
        guardian_cpf: "",
        guardian_phone: "",
        guardian_relationship: "",
      });
    }
  }, [open, form]);

  const onSubmit = async (data: PatientFormData) => {
    setIsLoading(true);
    try {
      if (savedPatientId) {
        const { error } = await supabase.from("patients").update({
          name: data.name,
          cpf: data.cpf.replace(/\D/g, ""),
          phone: normalizePhoneForStorage(data.phone),
          email: data.email || null,
          birth_date: data.birth_date || null,
          address: data.address || null,
          notes: data.notes || null,
          referral_source: data.referral_source,
          referral_detail: data.referral_detail || null,
          emergency_contact: data.emergency_contact || null,
          registration_date: data.registration_date,
          guardian_name: data.guardian_name || null,
          guardian_cpf: data.guardian_cpf?.replace(/\D/g, "") || null,
          guardian_phone: data.guardian_phone ? normalizePhoneForStorage(data.guardian_phone) : null,
          guardian_relationship: data.guardian_relationship || null,
        }).eq("id", savedPatientId);
        if (error) throw error;
        toast({ title: "Paciente atualizado!" });
        form.reset();
        onOpenChange(false);
        onSuccess?.();
        return;
      }

      const { data: patientData, error } = await supabase.from("patients").insert({
        name: data.name,
        cpf: data.cpf.replace(/\D/g, ""),
        phone: normalizePhoneForStorage(data.phone),
        email: data.email || null,
        birth_date: data.birth_date || null,
        address: data.address || null,
        notes: data.notes || null,
        referral_source: data.referral_source,
        referral_detail: data.referral_detail || null,
        emergency_contact: data.emergency_contact || null,
        registration_date: data.registration_date,
        guardian_name: data.guardian_name || null,
        guardian_cpf: data.guardian_cpf?.replace(/\D/g, "") || null,
        guardian_phone: data.guardian_phone ? normalizePhoneForStorage(data.guardian_phone) : null,
        guardian_relationship: data.guardian_relationship || null,
      }).select("id").single();

      if (error) {
        if (error.code === "23505") {
          toast({ title: "CPF já cadastrado", description: "Já existe um paciente com este CPF.", variant: "destructive" });
        } else {
          throw error;
        }
        return;
      }

      await createLog({
        action: "patient_created",
        entityType: "patient",
        entityId: patientData?.id,
        description: `Paciente ${data.name} cadastrado`,
        metadata: { name: data.name, cpf: data.cpf },
      });

      setSavedPatientId(patientData.id);
      toast({ title: "Paciente cadastrado!", description: `${data.name} foi salvo. Agora você pode adicionar anexos.` });
      onSuccess?.();
    } catch (error: any) {
      toast({ title: "Erro ao cadastrar paciente", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value.length <= 11) onChange(formatCPF(value));
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <User className="w-4 h-4 text-primary-foreground" />
            </div>
            Novo Paciente
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados">
          <TabsList className={`grid w-full ${savedPatientId ? "grid-cols-2" : "grid-cols-1"}`}>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            {savedPatientId && <TabsTrigger value="anexos">Anexos</TabsTrigger>}
          </TabsList>

          <TabsContent value="dados">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input placeholder="Nome do paciente" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="000.000.000-00"
                            {...field}
                            onChange={(e) => handleCPFChange(e, field.onChange)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone *</FormLabel>
                        <FormControl>
                          <InternationalPhoneInput
                            value={field.value}
                            onChange={field.onChange}
                            countryAriaLabel="Selecionar país do telefone do paciente"
                            numberAriaLabel="Telefone do paciente"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="email@exemplo.com" className="pl-10" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="birth_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de nascimento</FormLabel>
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
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                          <Input placeholder="Endereço completo" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="referral_source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Origem de Aquisição *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a origem" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {REFERRAL_SOURCES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emergency_contact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contato de emergência</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="Nome e telefone" className="pl-10" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="referral_detail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detalhe da Origem</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: nome de quem indicou, nome da campanha, nome da escola..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isMinor && (
                  <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <Users className="w-4 h-4" />
                      Dados do Responsável (paciente menor de idade)
                    </div>
                    <FormField
                      control={form.control}
                      name="guardian_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Responsável</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome completo do responsável" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="guardian_cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF do Responsável</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="000.000.000-00"
                                {...field}
                                onChange={(e) => handleCPFChange(e, field.onChange)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="guardian_phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone do Responsável</FormLabel>
                            <FormControl>
                              <InternationalPhoneInput
                                value={field.value || ""}
                                onChange={field.onChange}
                                countryAriaLabel="Selecionar país do telefone do responsável"
                                numberAriaLabel="Telefone do responsável"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="guardian_relationship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parentesco</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Mãe, Pai, Avó..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="registration_date"
                  render={({ field }) => (
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
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <FileText className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                          <Textarea
                            placeholder="Observações sobre o paciente..."
                            className="pl-10 min-h-[80px]"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="gradient-primary border-0" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      savedPatientId ? "Salvar Alterações" : "Cadastrar Paciente"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {savedPatientId && (
            <TabsContent value="anexos">
              <AttachmentsTab entityType="patient" entityId={savedPatientId} />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
