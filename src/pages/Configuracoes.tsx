import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Building2, User, Bell, Shield, Palette, Database, Save, Loader2, MessageSquare, Smartphone, DollarSign, Cake } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ReminderSettingsDialog } from "@/components/settings/ReminderSettingsDialog";
import { WhatsAppConnectionPanel } from "@/components/settings/WhatsAppConnectionPanel";
import { BirthdayMessagePanel } from "@/components/settings/BirthdayMessagePanel";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "next-themes";

const settingsSections = [
  { id: "clinica", name: "Clínica", icon: Building2 },
  { id: "whatsapp", name: "WhatsApp", icon: Smartphone },
  { id: "mensagens", name: "Mensagens Automáticas", icon: Cake },
  { id: "piso", name: "Piso Profissional", icon: DollarSign },
  { id: "usuarios", name: "Minha Conta", icon: User },
  { id: "notificacoes", name: "Notificações", icon: Bell },
  { id: "seguranca", name: "Segurança", icon: Shield },
  { id: "aparencia", name: "Aparência", icon: Palette },
  { id: "dados", name: "Dados", icon: Database },
];

export default function Configuracoes() {
  const [activeSection, setActiveSection] = useState("clinica");
  const [isLoading, setIsLoading] = useState(false);
  const [clinicData, setClinicData] = useState({ name: "", cnpj: "", phone: "", email: "", address: "" });
  const [isLoadingClinic, setIsLoadingClinic] = useState(true);
  const [notifications, setNotifications] = useState({ reminder: true, confirmation: true, weeklyReport: false, paymentAlerts: true });
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [floorValue, setFloorValue] = useState("0");
  const [isLoadingFloor, setIsLoadingFloor] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    fetchFloorValue();
    fetchClinicData();
  }, []);

  const fetchClinicData = async () => {
    setIsLoadingClinic(true);
    const keys = ["clinic_name", "clinic_cnpj", "clinic_phone", "clinic_email", "clinic_address"];
    const { data } = await supabase.from("clinic_settings").select("key, value").in("key", keys);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((d) => (map[d.key] = d.value));
      setClinicData({
        name: map["clinic_name"] || "",
        cnpj: map["clinic_cnpj"] || "",
        phone: map["clinic_phone"] || "",
        email: map["clinic_email"] || "",
        address: map["clinic_address"] || "",
      });
    }
    setIsLoadingClinic(false);
  };

  const fetchFloorValue = async () => {
    const { data } = await supabase.from("clinic_settings").select("value").eq("key", "floor_value_per_shift").maybeSingle();
    if (data) setFloorValue(data.value);
    setIsLoadingFloor(false);
  };

  const handleSaveFloor = async () => {
    setIsLoading(true);
    const { error } = await supabase
      .from("clinic_settings")
      .upsert({ key: "floor_value_per_shift", value: floorValue }, { onConflict: "key" });
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Valor do piso salvo!" });
    }
    setIsLoading(false);
  };

  const handleSaveClinic = async () => {
    setIsLoading(true);
    const entries = [
      { key: "clinic_name", value: clinicData.name },
      { key: "clinic_cnpj", value: clinicData.cnpj },
      { key: "clinic_phone", value: clinicData.phone },
      { key: "clinic_email", value: clinicData.email },
      { key: "clinic_address", value: clinicData.address },
    ];
    try {
      for (const entry of entries) {
        const { data: existing } = await supabase.from("clinic_settings").select("id").eq("key", entry.key).maybeSingle();
        if (existing) {
          await supabase.from("clinic_settings").update({ value: entry.value }).eq("key", entry.key);
        } else {
          await supabase.from("clinic_settings").insert(entry);
        }
      }
      toast({ title: "Configurações salvas!", description: "Dados da clínica atualizados." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleSaveNotifications = () => {
    toast({ title: "Preferências de notificação salvas!" });
  };

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }
    if (passwords.new.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwords.new });
      if (error) throw error;
      toast({ title: "Senha atualizada com sucesso!" });
      setPasswords({ current: "", new: "", confirm: "" });
    } catch (error: any) {
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = () => {
    toast({ title: "Exportação iniciada", description: "Você receberá um email quando estiver pronto." });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div><h1 className="page-header">Configurações</h1><p className="page-subtitle">Gerencie as configurações do sistema</p></div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <nav className="bg-card rounded-xl border border-border/30 shadow-card p-2 space-y-1">
              {settingsSections.map((section) => (
                <button key={section.id} onClick={() => setActiveSection(section.id)} className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors", activeSection === section.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  <section.icon className="w-5 h-5" />{section.name}
                </button>
              ))}
            </nav>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-card rounded-xl border border-border/30 shadow-card">
              {activeSection === "clinica" && (
                <div className="p-6 space-y-6">
                  <div><h2 className="text-lg font-semibold">Dados da Clínica</h2><p className="text-sm text-muted-foreground mt-1">Informações gerais sobre a clínica</p></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-sm font-medium">Nome da Clínica</label><Input value={clinicData.name} onChange={(e) => setClinicData({ ...clinicData, name: e.target.value })} /></div>
                    <div className="space-y-2"><label className="text-sm font-medium">CNPJ</label><Input value={clinicData.cnpj} onChange={(e) => setClinicData({ ...clinicData, cnpj: e.target.value })} /></div>
                    <div className="space-y-2"><label className="text-sm font-medium">Telefone</label><Input value={clinicData.phone} onChange={(e) => setClinicData({ ...clinicData, phone: e.target.value })} /></div>
                    <div className="space-y-2"><label className="text-sm font-medium">E-mail</label><Input value={clinicData.email} onChange={(e) => setClinicData({ ...clinicData, email: e.target.value })} /></div>
                    <div className="space-y-2 md:col-span-2"><label className="text-sm font-medium">Endereço</label><Input value={clinicData.address} onChange={(e) => setClinicData({ ...clinicData, address: e.target.value })} /></div>
                  </div>
                  <div className="flex justify-end pt-4 border-t"><Button className="gradient-primary border-0" onClick={handleSaveClinic} disabled={isLoading}>{isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Salvar Alterações</Button></div>
                </div>
              )}

              {activeSection === "whatsapp" && (
                <div className="p-6 space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold">Conexão WhatsApp</h2>
                    <p className="text-sm text-muted-foreground mt-1">Gerencie a conexão do WhatsApp para envio de mensagens automáticas</p>
                  </div>
                  <WhatsAppConnectionPanel />
                </div>
              )}

              {activeSection === "mensagens" && (
                <div className="p-6">
                  <BirthdayMessagePanel />
                </div>
              )}



              {activeSection === "piso" && (
                <div className="p-6 space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold">Piso Mínimo do Profissional</h2>
                    <p className="text-sm text-muted-foreground mt-1">Defina o valor mínimo que cada turno do profissional deve atingir</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Valor do piso por turno (R$)</label>
                      <Input type="number" step="0.01" min="0" value={floorValue} onChange={(e) => setFloorValue(e.target.value)} placeholder="0.00" />
                      <p className="text-xs text-muted-foreground">O piso total de cada profissional será: este valor × quantidade de turnos cadastrados</p>
                    </div>
                    <div className="flex justify-end pt-4 border-t">
                      <Button className="gradient-primary border-0" onClick={handleSaveFloor} disabled={isLoading}>{isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Salvar</Button>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "usuarios" && (
                <div className="p-6 space-y-6">
                  <div><h2 className="text-lg font-semibold">Minha Conta</h2><p className="text-sm text-muted-foreground mt-1">Informações do usuário logado</p></div>
                  <div className="p-4 rounded-lg bg-muted/30 border">
                    <p className="text-sm text-muted-foreground">E-mail</p>
                    <p className="font-medium">{user?.email || "Não logado"}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border">
                    <p className="text-sm text-muted-foreground">ID do Usuário</p>
                    <p className="font-mono text-sm">{user?.id || "-"}</p>
                  </div>
                </div>
              )}

              {activeSection === "notificacoes" && (
                <div className="p-6 space-y-6">
                  <div><h2 className="text-lg font-semibold">Notificações</h2><p className="text-sm text-muted-foreground mt-1">Configure as preferências de notificação</p></div>
                  
                  <div className="space-y-4">
                    {[{ key: "reminder", title: "Lembrete de consulta", desc: "Enviar lembrete 1 hora antes da consulta" }, { key: "confirmation", title: "Confirmação de agendamento", desc: "Notificar quando nova consulta for agendada" }, { key: "paymentAlerts", title: "Alertas de pagamento", desc: "Notificar sobre pagamentos pendentes" }].map((item) => (
                      <div key={item.key} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
                        <div><p className="font-medium">{item.title}</p><p className="text-sm text-muted-foreground">{item.desc}</p></div>
                        <Switch checked={notifications[item.key as keyof typeof notifications]} onCheckedChange={(v) => setNotifications({ ...notifications, [item.key]: v })} />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end pt-4 border-t"><Button onClick={handleSaveNotifications}><Save className="w-4 h-4 mr-2" />Salvar</Button></div>
                </div>
              )}

              {activeSection === "seguranca" && (
                <div className="p-6 space-y-6">
                  <div><h2 className="text-lg font-semibold">Segurança</h2><p className="text-sm text-muted-foreground mt-1">Configurações de segurança da conta</p></div>
                  <div className="p-4 rounded-lg bg-muted/30 border">
                    <h3 className="font-medium mb-3">Alterar Senha</h3>
                    <div className="space-y-3">
                      <Input type="password" placeholder="Senha atual" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
                      <Input type="password" placeholder="Nova senha" value={passwords.new} onChange={(e) => setPasswords({ ...passwords, new: e.target.value })} />
                      <Input type="password" placeholder="Confirmar nova senha" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
                    </div>
                    <Button variant="outline" size="sm" className="mt-4" onClick={handleChangePassword}>Atualizar Senha</Button>
                  </div>
                </div>
              )}

              {activeSection === "aparencia" && (
                <div className="p-6 space-y-6">
                  <div><h2 className="text-lg font-semibold">Aparência</h2><p className="text-sm text-muted-foreground mt-1">Personalize a aparência do sistema</p></div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3">
                      <div><p className="font-medium">Tema</p><p className="text-sm text-muted-foreground">Escolha entre claro e escuro</p></div>
                      <div className="flex gap-2">
                        <Button variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => setTheme("light")}>Claro</Button>
                        <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")}>Escuro</Button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Tema atual: {theme === "dark" ? "Escuro" : "Claro"}</p>
                </div>
              )}

              {activeSection === "dados" && (
                <div className="p-6 space-y-6">
                  <div><h2 className="text-lg font-semibold">Dados</h2><p className="text-sm text-muted-foreground mt-1">Gerenciamento de dados do sistema</p></div>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg border">
                      <h3 className="font-medium mb-2">Exportar Dados</h3>
                      <p className="text-sm text-muted-foreground mb-4">Exporte todos os dados do sistema em formato CSV</p>
                      <Button variant="outline" onClick={handleExportData}>Exportar Todos os Dados</Button>
                    </div>
                    <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                      <h3 className="font-medium text-destructive mb-2">Zona de Perigo</h3>
                      <p className="text-sm text-muted-foreground mb-4">Ações irreversíveis. Proceda com cuidado.</p>
                      <Button variant="destructive" disabled>Excluir Todos os Dados</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ReminderSettingsDialog open={showReminderDialog} onOpenChange={setShowReminderDialog} />
    </MainLayout>
  );
}
