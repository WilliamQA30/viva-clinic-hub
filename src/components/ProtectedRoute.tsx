import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { PendingApprovalScreen } from "./PendingApprovalScreen";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireApproval?: boolean;
}

const SUPER_ADMIN_EMAIL = "suporte.codxis@gmail.com";

export function ProtectedRoute({ children, requireApproval = true }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile-approval", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("is_approved")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }
      return data;
    },
    enabled: !!user && requireApproval,
  });

  if (loading || (requireApproval && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Super admin is always approved
  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
  
  // Check if user is approved
  if (requireApproval && !isSuperAdmin && profile && !profile.is_approved) {
    return <PendingApprovalScreen />;
  }

  return <>{children}</>;
}
