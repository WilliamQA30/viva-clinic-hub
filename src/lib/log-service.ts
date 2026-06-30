import { supabase } from "@/integrations/supabase/client";

export type LogAction = 
  | "appointment_created"
  | "appointment_updated"
  | "appointment_cancelled"
  | "appointment_deleted"
  | "appointment_confirmed"
  | "appointment_rescheduled"
  | "payment_registered"
  | "patient_created"
  | "patient_updated"
  | "professional_created"
  | "professional_updated"
  | "transaction_created"
  | "transaction_deleted"
  | "professional_paid"
  | "whatsapp_sent"
  | "reminder_sent"
  | "settings_updated"
  | "login"
  | "logout";

export type EntityType = 
  | "appointment"
  | "patient"
  | "professional"
  | "transaction"
  | "settings"
  | "auth";

interface LogParams {
  action: LogAction;
  entityType: EntityType;
  entityId?: string;
  description: string;
  metadata?: Record<string, any>;
}

export async function createLog(params: LogParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from("system_logs").insert({
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      description: params.description,
      user_id: user?.id || null,
      user_name: user?.user_metadata?.full_name || user?.email || null,
      metadata: params.metadata || {},
    });
  } catch (error) {
    console.error("Error creating log:", error);
    // Don't throw - logging should not break the main flow
  }
}

export async function fetchLogs(options?: {
  limit?: number;
  action?: LogAction;
  entityType?: EntityType;
  startDate?: string;
  endDate?: string;
}) {
  let query = supabase
    .from("system_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.action) {
    query = query.eq("action", options.action);
  }

  if (options?.entityType) {
    query = query.eq("entity_type", options.entityType);
  }

  if (options?.startDate) {
    query = query.gte("created_at", options.startDate);
  }

  if (options?.endDate) {
    query = query.lte("created_at", options.endDate);
  }

  return query;
}