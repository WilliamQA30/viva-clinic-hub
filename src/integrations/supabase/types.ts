export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointment_patients: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          patient_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          patient_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_patients_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_patients_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_mode: string | null
          appointment_time: string
          clinic_percentage: number | null
          consultation_value: number | null
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          id: string
          is_package: boolean | null
          modality: string | null
          no_show_charged: boolean
          notes: string | null
          package_session_number: number | null
          package_total_sessions: number | null
          patient_id: string
          payment_method: string | null
          payment_status: string | null
          professional_id: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_mode?: string | null
          appointment_time: string
          clinic_percentage?: number | null
          consultation_value?: number | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          is_package?: boolean | null
          modality?: string | null
          no_show_charged?: boolean
          notes?: string | null
          package_session_number?: number | null
          package_total_sessions?: number | null
          patient_id: string
          payment_method?: string | null
          payment_status?: string | null
          professional_id: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_mode?: string | null
          appointment_time?: string
          clinic_percentage?: number | null
          consultation_value?: number | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          is_package?: boolean | null
          modality?: string | null
          no_show_charged?: boolean
          notes?: string | null
          package_session_number?: number | null
          package_total_sessions?: number | null
          patient_id?: string
          payment_method?: string | null
          payment_status?: string | null
          professional_id?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      bills_to_pay: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          recurring_bill_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          recurring_bill_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          recurring_bill_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_to_pay_recurring_bill_id_fkey"
            columns: ["recurring_bill_id"]
            isOneToOne: false
            referencedRelation: "recurring_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      birthday_messages_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_preview: string | null
          patient_id: string
          patient_name: string
          phone: string
          sent_at: string
          sent_year: number
          success: boolean
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_preview?: string | null
          patient_id: string
          patient_name: string
          phone: string
          sent_at?: string
          sent_year: number
          success?: boolean
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_preview?: string | null
          patient_id?: string
          patient_name?: string
          phone?: string
          sent_at?: string
          sent_year?: number
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "birthday_messages_log_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      daily_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          note_date: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          note_date?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          address: string | null
          birth_date: string | null
          cpf: string
          created_at: string
          crm_notes: string | null
          crm_status: string | null
          crm_status_locked: boolean
          crm_status_updated_at: string | null
          crm_tags: string[]
          email: string | null
          emergency_contact: string | null
          guardian_cpf: string | null
          guardian_name: string | null
          guardian_phone: string | null
          guardian_relationship: string | null
          id: string
          inactivated_at: string | null
          inactivation_reason: string | null
          inactivation_reason_other: string | null
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string
          referral_detail: string | null
          referral_source: string | null
          registration_date: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          cpf: string
          created_at?: string
          crm_notes?: string | null
          crm_status?: string | null
          crm_status_locked?: boolean
          crm_status_updated_at?: string | null
          crm_tags?: string[]
          email?: string | null
          emergency_contact?: string | null
          guardian_cpf?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relationship?: string | null
          id?: string
          inactivated_at?: string | null
          inactivation_reason?: string | null
          inactivation_reason_other?: string | null
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone: string
          referral_detail?: string | null
          referral_source?: string | null
          registration_date?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          cpf?: string
          created_at?: string
          crm_notes?: string | null
          crm_status?: string | null
          crm_status_locked?: boolean
          crm_status_updated_at?: string | null
          crm_tags?: string[]
          email?: string | null
          emergency_contact?: string | null
          guardian_cpf?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relationship?: string | null
          id?: string
          inactivated_at?: string | null
          inactivation_reason?: string | null
          inactivation_reason_other?: string | null
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string
          referral_detail?: string | null
          referral_source?: string | null
          registration_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      professional_blocks: {
        Row: {
          block_type: string
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          professional_id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          block_type?: string
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          professional_id: string
          reason?: string | null
          start_date: string
        }
        Update: {
          block_type?: string
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          professional_id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_payments: {
        Row: {
          appointment_id: string
          clinic_amount: number
          created_at: string
          id: string
          is_paid: boolean | null
          paid_at: string | null
          payment_destination: string
          payment_method: string | null
          professional_amount: number
          professional_id: string
          total_value: number
        }
        Insert: {
          appointment_id: string
          clinic_amount: number
          created_at?: string
          id?: string
          is_paid?: boolean | null
          paid_at?: string | null
          payment_destination?: string
          payment_method?: string | null
          professional_amount: number
          professional_id: string
          total_value: number
        }
        Update: {
          appointment_id?: string
          clinic_amount?: number
          created_at?: string
          id?: string
          is_paid?: boolean | null
          paid_at?: string | null
          payment_destination?: string
          payment_method?: string | null
          professional_amount?: number
          professional_id?: string
          total_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_payments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_shifts: {
        Row: {
          created_at: string
          day_of_week: string
          id: string
          professional_id: string
          room: string
          shift_period: string
        }
        Insert: {
          created_at?: string
          day_of_week: string
          id?: string
          professional_id: string
          room: string
          shift_period: string
        }
        Update: {
          created_at?: string
          day_of_week?: string
          id?: string
          professional_id?: string
          room?: string
          shift_period?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_shifts_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          address: string | null
          approach: string | null
          birth_date: string | null
          consultation_value: number
          cpf: string | null
          created_at: string
          crp: string | null
          education: string | null
          email: string | null
          id: string
          is_active: boolean | null
          mini_curriculum: string | null
          name: string
          phone: string | null
          registration_date: string
          services: string[] | null
          specialty: string
          target_audience: string | null
          updated_at: string
          user_id: string | null
          work_days: string[] | null
          work_hours_end: string
          work_hours_start: string
        }
        Insert: {
          address?: string | null
          approach?: string | null
          birth_date?: string | null
          consultation_value?: number
          cpf?: string | null
          created_at?: string
          crp?: string | null
          education?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          mini_curriculum?: string | null
          name: string
          phone?: string | null
          registration_date?: string
          services?: string[] | null
          specialty: string
          target_audience?: string | null
          updated_at?: string
          user_id?: string | null
          work_days?: string[] | null
          work_hours_end?: string
          work_hours_start?: string
        }
        Update: {
          address?: string | null
          approach?: string | null
          birth_date?: string | null
          consultation_value?: number
          cpf?: string | null
          created_at?: string
          crp?: string | null
          education?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          mini_curriculum?: string | null
          name?: string
          phone?: string | null
          registration_date?: string
          services?: string[] | null
          specialty?: string
          target_audience?: string | null
          updated_at?: string
          user_id?: string | null
          work_days?: string[] | null
          work_hours_end?: string
          work_hours_start?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean | null
          is_approved: boolean | null
          phone: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean | null
          is_approved?: boolean | null
          phone?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_approved?: boolean | null
          phone?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_bills: {
        Row: {
          amount: number
          billing_day: number
          category: string | null
          created_at: string
          created_by: string | null
          description: string
          due_day: number
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean
          last_generated_date: string | null
          notes: string | null
          payment_method: string | null
          skipped_periods: string[]
          start_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          billing_day?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_day?: number
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          notes?: string | null
          payment_method?: string | null
          skipped_periods?: string[]
          start_date: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_day?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_day?: number
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          notes?: string | null
          payment_method?: string | null
          skipped_periods?: string[]
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      reminder_settings: {
        Row: {
          channel: string
          created_at: string
          hours_before: number
          id: string
          is_active: boolean | null
          message_template: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          hours_before?: number
          id?: string
          is_active?: boolean | null
          message_template?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          hours_before?: number
          id?: string
          is_active?: boolean | null
          message_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          action: string
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          payment_method: string | null
          professional_id: string | null
          transaction_date: string
          transaction_time: string
          type: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          payment_method?: string | null
          professional_id?: string | null
          transaction_date?: string
          transaction_time?: string
          type: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          payment_method?: string | null
          professional_id?: string | null
          transaction_date?: string
          transaction_time?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_super_admin: { Args: never; Returns: boolean }
      is_user_approved: { Args: never; Returns: boolean }
      recompute_patient_crm_status: {
        Args: { _patient_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
