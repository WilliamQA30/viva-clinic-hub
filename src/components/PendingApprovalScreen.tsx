import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function PendingApprovalScreen() {
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
          <CardTitle className="text-2xl">Aguardando Aprovação</CardTitle>
          <CardDescription className="text-base mt-2">
            Sua conta foi criada com sucesso, mas ainda não foi aprovada pelo administrador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Você receberá acesso ao sistema assim que o administrador aprovar sua conta.
            </p>
          </div>
          
          <div className="text-center text-sm text-muted-foreground">
            <p>Conectado como:</p>
            <p className="font-medium text-foreground">{user?.email}</p>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => signOut()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair da Conta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
