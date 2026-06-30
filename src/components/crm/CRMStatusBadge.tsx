import { cn } from "@/lib/utils";
import { getCrmStatusMeta } from "@/lib/crm";

export function CRMStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const meta = getCrmStatusMeta(status);
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap", meta.color, className)}>
      {meta.label}
    </span>
  );
}
