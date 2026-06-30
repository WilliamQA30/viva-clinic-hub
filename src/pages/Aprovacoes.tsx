import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Clock, Loader2, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const SUPER_ADMIN_EMAIL = "suporte.codxis@gmail.com";

export default function Aprovacoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_approved", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  const { data: allUsers } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_approved: true })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast({
        title: "Usuário aprovado",
        description: "O usuário agora pode acessar o sistema.",
      });
      setProcessingId(null);
    },
    onError: (error) => {
      toast({
        title: "Erro ao aprovar",
        description: error.message,
        variant: "destructive",
      });
      setProcessingId(null);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_approved: false })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast({
        title: "Acesso revogado",
        description: "O usuário não pode mais acessar o sistema.",
      });
      setProcessingId(null);
    },
    onError: (error) => {
      toast({
        title: "Erro ao revogar",
        description: error.message,
        variant: "destructive",
      });
      setProcessingId(null);
    },
  });

  const handleApprove = (userId: string) => {
    setProcessingId(userId);
    approveMutation.mutate(userId);
  };

  const handleRevoke = (userId: string) => {
    setProcessingId(userId);
    revokeMutation.mutate(userId);
  };

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <ShieldAlert className="w-16 h-16 mx-auto text-destructive mb-4" />
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
              Apenas o super administrador pode gerenciar aprovações de usuários.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Aprovação de Usuários</h1>
        <p className="text-muted-foreground">
          Gerencie os acessos ao sistema
        </p>
      </div>

      {/* Pending Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Aguardando Aprovação
          </CardTitle>
          <CardDescription>
            Usuários que se cadastraram e aguardam liberação de acesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : pendingUsers && pendingUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Data de Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.full_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{profile.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(profile.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(profile.user_id)}
                        disabled={processingId === profile.user_id}
                      >
                        {processingId === profile.user_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Aprovar
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário aguardando aprovação
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Users */}
      <Card>
        <CardHeader>
          <CardTitle>Todos os Usuários</CardTitle>
          <CardDescription>
            Lista completa de usuários cadastrados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allUsers && allUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.full_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{profile.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {profile.is_approved ? (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                          Aprovado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(profile.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      {profile.is_approved ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRevoke(profile.user_id)}
                          disabled={processingId === profile.user_id}
                        >
                          {processingId === profile.user_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <X className="w-4 h-4 mr-1" />
                              Revogar
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleApprove(profile.user_id)}
                          disabled={processingId === profile.user_id}
                        >
                          {processingId === profile.user_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Aprovar
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário cadastrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
