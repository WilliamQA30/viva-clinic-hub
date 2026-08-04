import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import essentiaLogo from "@/assets/essentia-logo.png";

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Requisição inválida: authorization_id ausente.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await (supabase.auth as any).oauth.getAuthorizationDetails(
        authorizationId
      );
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const api = (supabase.auth as any).oauth;
    const { data, error } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou um redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3 mb-6">
          <img src={essentiaLogo} alt="Espaço Essentia" className="w-16 h-16 object-contain" />
          <h1 className="text-xl font-bold text-foreground text-center">
            Autorizar acesso ao sistema
          </h1>
        </div>

        {error ? (
          <p className="text-sm text-destructive text-center">{error}</p>
        ) : !details ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-lg bg-muted p-4 mb-6">
              <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {details.client?.name ?? "Um aplicativo externo"}
                </span>{" "}
                quer acessar o sistema em seu nome. Ele poderá consultar e alterar os dados que
                você tem permissão para ver (pacientes, agenda, financeiro e CRM).
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
                Recusar
              </Button>
              <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Autorizar"}
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
