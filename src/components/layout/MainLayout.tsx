import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Bell, User, Sun, Moon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-end h-16 px-4 lg:px-8">
            {/* Right side */}
            <div className="flex items-center gap-3 ml-12 lg:ml-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-lg"
              >
                {theme === "dark" ? (
                  <Sun className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <Moon className="w-5 h-5 text-muted-foreground" />
                )}
              </Button>
              
              <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full" />
              </button>
              
              <div className="flex items-center gap-3 pl-3 border-l border-border">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-foreground">
                    {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário"}
                  </p>
                  <p className="text-xs text-muted-foreground">Administrador</p>
                </div>
                <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
