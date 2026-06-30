import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Send, Cake, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BirthdayLog {
  id: string;
  patient_name: string;
  phone: string;
  sent_at: string;
  success: boolean;
  error_message: string | null;
  sent_year: number;
}

const SETTING_KEYS = ["birthday_message_enabled", "birthday_message_time", "birthday_message_text"];

export function BirthdayMessagePanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [time, setTime] = useState("09:00");
  const [text, setText] = useState("");
  const [logs, setLogs] = useState<BirthdayLog[]>([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("clinic_settings")
      .select("key, value")
      .in("key", SETTING_KEYS);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => (map[r.key] = r.value));
    setEnabled((map["birthday_message_enabled"] ?? "true") === "true");
    setTime(map["birthday_message_time"] || "09:00");
    setText(map["birthday_message_text"] || "");

    const { data: logsData } = await supabase
      .from("birthday_messages_log")
      .select("id, patient_name, phone, sent_at, success, error_message, sent_year")
      .order("sent_at", { ascending: false })
      .limit(50);
    setLogs((logsData as BirthdayLog[]) || []);
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    const entries = [
      { key: "birthday_message_enabled", value: enabled ? "true" : "false" },
      { key: "birthday_message_time", value: time },
      { key: "birthday_message_text", value: text },
    ];
    try {
      for (const e of entries) {
        const { data: existing } = await supabase
          .from("clinic_settings")
          .select("id")
          .eq("key", e.key)
          .maybeSingle();
        if (existing) {
          await supabase.from("clinic_settings").update({ value: e.value }).eq("key", e.key);
        } else {
          await supabase.from("clinic_settings").insert(e);
        }
      }
      toast({ title: "Configurações salvas!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const runNow = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-birthday-messages", {
        body: { manual: true },
      });
      if (error) throw error;
      toast({
        title: "Execução manual concluída",
        description: `Encontrados: ${data?.found ?? 0} • Enviados: ${data?.sent ?? 0} • Já enviados: ${data?.skipped_already_sent ?? 0} • Falhas: ${data?.failed ?? 0}`,
      });
      await load();
    } catch (err: any) {
      toast({ title: "Erro na execução", description: err.message, variant: "destructive" });
    }
    setTesting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Cake className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Mensagem de Aniversário</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Envio automático via WhatsApp no dia do aniversário dos pacientes ativos
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between py-3 border-y border-border/30">
        <div>
          <p className="font-medium">Envio automático</p>
          <p className="text-sm text-muted-foreground">Ativar ou desativar o envio diário</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Horário de envio</label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <p className="text-xs text-muted-foreground">Horário de Brasília (BRT)</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Texto da mensagem</label>
        <Textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Use {nome} para incluir o primeiro nome do paciente"
        />
        <p className="text-xs text-muted-foreground">
          Variável disponível: <code className="bg-muted px-1 rounded">{"{nome}"}</code>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 justify-end pt-4 border-t">
        <Button variant="outline" onClick={runNow} disabled={testing}>
          {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Executar agora
        </Button>
        <Button className="gradient-primary border-0" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar
        </Button>
      </div>

      <div className="pt-6 border-t">
        <h3 className="font-semibold mb-3">Histórico de envios</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum envio registrado ainda.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {log.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{log.patient_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {log.phone}
                      {log.error_message ? ` • ${log.error_message}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0 ml-3">
                  {format(new Date(log.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
