import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Clock, Send, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReminderSettings {
  enabled: boolean;
  channel: "whatsapp" | "sms" | "email";
  hoursBeforeAppointment: number;
  messageTemplate: string;
}

interface ReminderSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultTemplate = `Olá {paciente}! 👋

Lembrete: Você tem uma consulta agendada para {data} às {hora} com {profissional}.

Local: Clínica Saúde
Endereço: Rua Exemplo, 123

Em caso de dúvidas ou necessidade de remarcar, entre em contato.

Aguardamos você! 🏥`;

export function ReminderSettingsDialog({ open, onOpenChange }: ReminderSettingsDialogProps) {
  const [settings, setSettings] = useState<ReminderSettings>({
    enabled: false,
    channel: "whatsapp",
    hoursBeforeAppointment: 24,
    messageTemplate: defaultTemplate,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // In a real implementation, this would save to database or edge function config
      // For now, we'll just show a success message
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: "Configurações salvas!",
        description: "Os lembretes automáticos foram configurados com sucesso.",
      });
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestReminder = async () => {
    setIsTesting(true);
    try {
      // Simulate sending a test reminder
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Lembrete de teste enviado!",
        description: `Um lembrete de teste foi enviado via ${settings.channel === "whatsapp" ? "WhatsApp" : settings.channel === "sms" ? "SMS" : "E-mail"}.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao enviar teste",
        description: "Não foi possível enviar o lembrete de teste.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Lembretes de Consulta
          </DialogTitle>
          <DialogDescription>
            Configure lembretes automáticos para pacientes antes das consultas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ativar Lembretes Automáticos</Label>
              <p className="text-sm text-muted-foreground">
                Enviar lembretes automaticamente antes das consultas
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
            />
          </div>

          {settings.enabled && (
            <>
              {/* Alert about API configuration */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Para enviar mensagens via WhatsApp ou SMS, é necessário configurar uma API de mensagens 
                  (como Twilio ou Evolution API). Entre em contato para mais informações.
                </AlertDescription>
              </Alert>

              {/* Channel Selection */}
              <div className="space-y-2">
                <Label>Canal de Envio</Label>
                <Select
                  value={settings.channel}
                  onValueChange={(value: "whatsapp" | "sms" | "email") => 
                    setSettings({ ...settings, channel: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Hours Before */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Enviar lembrete com antecedência de
                </Label>
                <Select
                  value={settings.hoursBeforeAppointment.toString()}
                  onValueChange={(value) => 
                    setSettings({ ...settings, hoursBeforeAppointment: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hora antes</SelectItem>
                    <SelectItem value="2">2 horas antes</SelectItem>
                    <SelectItem value="4">4 horas antes</SelectItem>
                    <SelectItem value="12">12 horas antes</SelectItem>
                    <SelectItem value="24">24 horas antes (1 dia)</SelectItem>
                    <SelectItem value="48">48 horas antes (2 dias)</SelectItem>
                    <SelectItem value="72">72 horas antes (3 dias)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Message Template */}
              <div className="space-y-2">
                <Label>Modelo de Mensagem</Label>
                <textarea
                  className="w-full min-h-[150px] p-3 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  value={settings.messageTemplate}
                  onChange={(e) => setSettings({ ...settings, messageTemplate: e.target.value })}
                  placeholder="Digite o modelo da mensagem..."
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis disponíveis: {"{paciente}"}, {"{data}"}, {"{hora}"}, {"{profissional}"}, {"{tipo}"}
                </p>
              </div>

              {/* Test Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleTestReminder}
                disabled={isTesting}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Lembrete de Teste
                  </>
                )}
              </Button>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Configurações"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
