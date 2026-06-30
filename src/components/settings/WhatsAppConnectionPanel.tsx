import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, RefreshCw, Smartphone, QrCode, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ConnectionStatus {
  configured: boolean;
  connected: boolean;
  status: string;
  instanceName?: string;
  error?: string;
}

export function WhatsAppConnectionPanel() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("whatsapp-connection", {
        body: { action: "status" }
      });

      if (error) throw error;

      setStatus(data);
      
      // If connected, clear QR code
      if (data.connected) {
        setQrCode(null);
        setPairingCode(null);
      }
    } catch (error: any) {
      console.error("Error fetching status:", error);
      setStatus({
        configured: false,
        connected: false,
        status: "error",
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const createInstance = async () => {
    try {
      setActionLoading(true);
      const { data, error } = await supabase.functions.invoke("whatsapp-connection", {
        body: { action: "create" }
      });

      if (error) throw error;

      toast({
        title: "Instância criada!",
        description: "Agora escaneie o QR Code para conectar."
      });

      // After creating, get QR code
      await getQrCode();
      await fetchStatus();
    } catch (error: any) {
      console.error("Error creating instance:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar instância",
        variant: "destructive"
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getQrCode = async () => {
    try {
      setActionLoading(true);
      const { data, error } = await supabase.functions.invoke("whatsapp-connection", {
        body: { action: "qrcode" }
      });

      if (error) throw error;

      if (data.qrcode) {
        setQrCode(data.qrcode);
      }
      if (data.pairingCode) {
        setPairingCode(data.pairingCode);
      }

      // Poll for connection status
      const pollInterval = setInterval(async () => {
        const { data: statusData } = await supabase.functions.invoke("whatsapp-connection", {
          body: { action: "status" }
        });
        
        if (statusData?.connected) {
          clearInterval(pollInterval);
          setQrCode(null);
          setPairingCode(null);
          setStatus(statusData);
          toast({
            title: "WhatsApp conectado!",
            description: "Seu WhatsApp foi vinculado com sucesso."
          });
        }
      }, 3000);

      // Stop polling after 2 minutes
      setTimeout(() => clearInterval(pollInterval), 120000);

    } catch (error: any) {
      console.error("Error getting QR code:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao obter QR Code",
        variant: "destructive"
      });
    } finally {
      setActionLoading(false);
    }
  };

  const disconnect = async () => {
    try {
      setActionLoading(true);
      const { data, error } = await supabase.functions.invoke("whatsapp-connection", {
        body: { action: "disconnect" }
      });

      if (error) throw error;

      toast({
        title: "Desconectado",
        description: "WhatsApp foi desconectado."
      });

      await fetchStatus();
    } catch (error: any) {
      console.error("Error disconnecting:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao desconectar",
        variant: "destructive"
      });
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            status?.connected ? "bg-green-500/10" : "bg-muted"
          }`}>
            <Smartphone className={`w-5 h-5 ${status?.connected ? "text-green-500" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="font-medium">WhatsApp Business</p>
            <div className="flex items-center gap-2">
              {status?.connected ? (
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
                  <XCircle className="w-3 h-3 mr-1" />
                  Desconectado
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={fetchStatus}
          disabled={actionLoading}
        >
          <RefreshCw className={`w-4 h-4 ${actionLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* API Configuration Status */}
      {!status?.configured && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            <strong>Configuração necessária:</strong> As credenciais da Evolution API (EVOLUTION_API_URL e EVOLUTION_API_KEY) precisam ser configuradas para usar o WhatsApp.
          </p>
        </div>
      )}

      {/* QR Code Display */}
      {qrCode && !status?.connected && (
        <div className="flex flex-col items-center gap-4 p-6 rounded-lg bg-white dark:bg-zinc-900 border">
          <p className="text-sm text-muted-foreground text-center">
            Escaneie o QR Code com o WhatsApp do seu celular
          </p>
          <div className="p-4 bg-white rounded-lg">
            <img 
              src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
              alt="QR Code WhatsApp"
              className="w-64 h-64"
            />
          </div>
          {pairingCode && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Ou use o código de pareamento:</p>
              <code className="text-lg font-mono font-bold tracking-wider">{pairingCode}</code>
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Abra o WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {status?.configured && !status?.connected && !qrCode && (
          <>
            {status?.status === "not_found" ? (
              <Button 
                onClick={createInstance} 
                disabled={actionLoading}
                className="gradient-primary border-0"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Smartphone className="w-4 h-4 mr-2" />
                )}
                Criar Instância
              </Button>
            ) : (
              <Button 
                onClick={getQrCode} 
                disabled={actionLoading}
                className="gradient-primary border-0"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4 mr-2" />
                )}
                Conectar WhatsApp
              </Button>
            )}
          </>
        )}

        {status?.connected && (
          <Button 
            variant="outline" 
            onClick={disconnect} 
            disabled={actionLoading}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4 mr-2" />
            )}
            Desconectar
          </Button>
        )}

        {qrCode && (
          <Button 
            variant="outline" 
            onClick={() => {
              setQrCode(null);
              setPairingCode(null);
            }}
          >
            Cancelar
          </Button>
        )}
      </div>

      {/* Instance Info */}
      {status?.instanceName && status?.connected && (
        <div className="p-3 rounded-lg bg-muted/30 border">
          <p className="text-xs text-muted-foreground">
            Instância: <span className="font-mono">{status.instanceName}</span>
          </p>
        </div>
      )}
    </div>
  );
}
