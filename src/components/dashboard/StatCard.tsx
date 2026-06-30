import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface BreakdownItem {
  label: string;
  value: string | number;
  tone?: "success" | "warning" | "destructive" | "muted";
}

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: "primary" | "success" | "warning" | "accent";
  isLoading?: boolean;
  breakdown?: BreakdownItem[];
}

const iconColorClasses = {
  primary: "gradient-primary",
  success: "gradient-success",
  warning: "bg-warning",
  accent: "gradient-accent",
};

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor = "primary",
  isLoading = false,
  breakdown,
}: StatCardProps) {
  if (isLoading) {
    return (
      <div className="stat-card animate-fade-in">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="w-12 h-12 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {change && (
            <p
              className={cn(
                "text-sm font-medium",
                changeType === "positive" && "text-success",
                changeType === "negative" && "text-destructive",
                changeType === "neutral" && "text-muted-foreground"
              )}
            >
              {change}
            </p>
          )}
          {breakdown && breakdown.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
              {breakdown.map((item) => (
                <div key={item.label} className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">{item.label}:</span>
                  <span
                    className={cn(
                      "font-semibold",
                      item.tone === "success" && "text-success",
                      item.tone === "warning" && "text-warning",
                      item.tone === "destructive" && "text-destructive",
                      (!item.tone || item.tone === "muted") && "text-foreground"
                    )}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            iconColorClasses[iconColor]
          )}
        >
          <Icon className="w-6 h-6 text-primary-foreground" />
        </div>
      </div>
    </div>
  );
}
