import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCog,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  Brain,
  Menu,
  X,
  History,
  Bot,
  UserCheck,
  Receipt,
  HeartHandshake,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import essentiaLogo from "@/assets/essentia-logo.png";

const SUPER_ADMIN_EMAIL = "suporte.codxis@gmail.com";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, requiresAuth: false },
  { name: "Agenda", href: "/agenda", icon: Calendar, requiresAuth: false },
  { name: "Pacientes", href: "/pacientes", icon: Users, requiresAuth: false },
  { name: "CRM", href: "/crm", icon: HeartHandshake, requiresAuth: false },
  { name: "Profissionais", href: "/profissionais", icon: UserCog, requiresAuth: false },
  { name: "Financeiro", href: "/financeiro", icon: DollarSign, requiresAuth: false },
  { name: "Contas a Pagar", href: "/contas-pagar", icon: Receipt, requiresAuth: false },
  { name: "Relatórios", href: "/relatorios", icon: BarChart3, requiresReports: true },
  { name: "Assistente IA", href: "/assistente", icon: Bot, requiresAuth: false },
];

const bottomNavigation = [
  { name: "Aprovações", href: "/aprovacoes", icon: UserCheck, requiresSuperAdmin: true },
  { name: "Logs", href: "/logs", icon: History, requiresAdmin: true },
  { name: "Configurações", href: "/configuracoes", icon: Settings, requiresSettings: true },
];

export function Sidebar() {
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { signOut, user } = useAuth();
  const { canAccessReports, canAccessSettings, isAdmin } = useUserRole();
  
  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const filteredNavigation = navigation.filter(item => {
    if (item.requiresReports) return canAccessReports;
    return true;
  });

  const filteredBottomNavigation = bottomNavigation.filter(item => {
    if (item.requiresSuperAdmin) return isSuperAdmin;
    if (item.requiresAdmin) return isAdmin;
    if (item.requiresSettings) return canAccessSettings;
    return true;
  });

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-lg bg-white p-1 flex items-center justify-center">
          <img src={essentiaLogo} alt="Espaço Essentia" className="w-full h-full object-contain" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-sidebar-foreground">Espaço Essentia</h1>
          <p className="text-xs text-sidebar-foreground/60">Tianguá</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {filteredNavigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            onClick={() => setIsMobileOpen(false)}
            className={cn(
              "sidebar-item",
              isActive(item.href) && "sidebar-item-active"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        {filteredBottomNavigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            onClick={() => setIsMobileOpen(false)}
            className={cn(
              "sidebar-item",
              isActive(item.href) && "sidebar-item-active"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.name}</span>
          </Link>
        ))}
        <button
          onClick={handleSignOut}
          className="sidebar-item w-full text-destructive/80 hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-5 h-5" />
          <span>Sair</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card shadow-soft border border-border"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-sidebar transform transition-transform duration-300 ease-in-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setIsMobileOpen(false)}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-sidebar-accent"
        >
          <X className="w-5 h-5 text-sidebar-foreground" />
        </button>
        <div className="flex flex-col h-full">
          <SidebarContent />
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-sidebar">
        <SidebarContent />
      </aside>
    </>
  );
}
