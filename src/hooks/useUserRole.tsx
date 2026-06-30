import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "profissional" | "recepcionista";

interface UseUserRoleReturn {
  role: UserRole;
  isAdmin: boolean;
  canAccessReports: boolean;
  canAccessSettings: boolean;
  canManageUsers: boolean;
  isLoading: boolean;
}

export function useUserRole(): UseUserRoleReturn {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>("recepcionista");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchUserRole() {
      if (!user) {
        setRole("recepcionista");
        setIsLoading(false);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (profile?.role) {
          setRole(profile.role as UserRole);
        } else {
          // Default to admin for existing users without explicit role
          setRole("admin");
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        // Default to admin for safety during transition
        setRole("admin");
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserRole();
  }, [user]);

  const isAdmin = role === "admin";
  const canAccessReports = role === "admin" || role === "profissional";
  const canAccessSettings = role === "admin";
  const canManageUsers = role === "admin";

  return {
    role,
    isAdmin,
    canAccessReports,
    canAccessSettings,
    canManageUsers,
    isLoading,
  };
}