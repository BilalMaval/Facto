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
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role: string
          status?: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_notes: string | null
          created_at: string
          hidden_nav_tabs: string[]
          id: string
          monthly_fee: number | null
          name: string
          paid_until: string | null
          subscribed_at: string | null
          subscription_status: string
          suspension_note: string | null
          trial_ends_at: string | null
          week_start_day: string
        }
        Insert: {
          billing_notes?: string | null
          created_at?: string
          hidden_nav_tabs?: string[]
          id?: string
          monthly_fee?: number | null
          name: string
          paid_until?: string | null
          subscribed_at?: string | null
          subscription_status?: string
          suspension_note?: string | null
          trial_ends_at?: string | null
          week_start_day?: string
        }
        Update: {
          billing_notes?: string | null
          created_at?: string
          hidden_nav_tabs?: string[]
          id?: string
          monthly_fee?: number | null
          name?: string
          paid_until?: string | null
          subscribed_at?: string | null
          subscription_status?: string
          suspension_note?: string | null
          trial_ends_at?: string | null
          week_start_day?: string
        }
        Relationships: []
      }
      owner_plans: {
        Row: {
          created_at: string
          tier: string
          upgraded_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          tier?: string
          upgraded_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          tier?: string
          upgraded_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_submissions: {
        Row: {
          amount: number
          id: string
          method: string
          organization_id: string
          payment_date: string
          proof_filename: string | null
          proof_path: string
          purpose: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string
          transaction_reference: string
        }
        Insert: {
          amount: number
          id?: string
          method: string
          organization_id: string
          payment_date: string
          proof_filename?: string | null
          proof_path: string
          purpose?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by: string
          transaction_reference: string
        }
        Update: {
          amount?: number
          id?: string
          method?: string
          organization_id?: string
          payment_date?: string
          proof_filename?: string | null
          proof_path?: string
          purpose?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          transaction_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          note: string | null
          organization_id: string
          payment_date: string
          worker_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          note?: string | null
          organization_id: string
          payment_date: string
          worker_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          organization_id?: string
          payment_date?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          bank_account_number: string | null
          bank_account_title: string | null
          bank_iban: string | null
          bank_name: string | null
          bank_note: string | null
          easypaisa_note: string | null
          easypaisa_number: string | null
          easypaisa_title: string | null
          id: boolean
          jazzcash_note: string | null
          jazzcash_number: string | null
          jazzcash_title: string | null
          multi_business_price: number
          plan_features: string[]
          plan_price: number
          support_email: string | null
          updated_at: string
        }
        Insert: {
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_note?: string | null
          easypaisa_note?: string | null
          easypaisa_number?: string | null
          easypaisa_title?: string | null
          id?: boolean
          jazzcash_note?: string | null
          jazzcash_number?: string | null
          jazzcash_title?: string | null
          multi_business_price?: number
          plan_features?: string[]
          plan_price?: number
          support_email?: string | null
          updated_at?: string
        }
        Update: {
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_note?: string | null
          easypaisa_note?: string | null
          easypaisa_number?: string | null
          easypaisa_title?: string | null
          id?: boolean
          jazzcash_note?: string | null
          jazzcash_number?: string | null
          jazzcash_title?: string | null
          multi_business_price?: number
          plan_features?: string[]
          plan_price?: number
          support_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_platform_admin: boolean
          sender_id: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_platform_admin?: boolean
          sender_id: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_platform_admin?: boolean
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_last_read_at: string | null
          created_at: string
          created_by: string
          id: string
          org_last_read_at: string | null
          organization_id: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          admin_last_read_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          org_last_read_at?: string | null
          organization_id: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          admin_last_read_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          org_last_read_at?: string | null
          organization_id?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_slips: {
        Row: {
          advance_delta: number
          created_at: string
          final_amount: number | null
          finalized_at: string | null
          finalized_by: string | null
          grand_total: number
          id: string
          organization_id: string
          paid_amount: number
          payable_balance: number
          reopened_at: string | null
          reopened_by: string | null
          status: string
          week_end: string
          week_start: string
          work_amount: number
          worker_id: string
        }
        Insert: {
          advance_delta?: number
          created_at?: string
          final_amount?: number | null
          finalized_at?: string | null
          finalized_by?: string | null
          grand_total?: number
          id?: string
          organization_id: string
          paid_amount?: number
          payable_balance?: number
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          week_end: string
          week_start: string
          work_amount?: number
          worker_id: string
        }
        Update: {
          advance_delta?: number
          created_at?: string
          final_amount?: number | null
          finalized_at?: string | null
          finalized_by?: string | null
          grand_total?: number
          id?: string
          organization_id?: string
          paid_amount?: number
          payable_balance?: number
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          week_end?: string
          week_start?: string
          work_amount?: number
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_slips_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_slips_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      work_codes: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          organization_id: string
          rate: number
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          organization_id: string
          rate: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          entry_date: string
          id: string
          organization_id: string
          quantity: number
          rate_snapshot: number
          work_code_id: string
          worker_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by: string
          entry_date: string
          id?: string
          organization_id: string
          quantity: number
          rate_snapshot?: number
          work_code_id: string
          worker_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          entry_date?: string
          id?: string
          organization_id?: string
          quantity?: number
          rate_snapshot?: number
          work_code_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_entries_work_code_id_fkey"
            columns: ["work_code_id"]
            isOneToOne: false
            referencedRelation: "work_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          address: string | null
          advance_balance: number
          age: number | null
          cnic: string | null
          contact_no: string | null
          created_at: string
          date_of_birth: string | null
          designation: string | null
          father_name: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          photo_url: string | null
          worker_code: string
        }
        Insert: {
          address?: string | null
          advance_balance?: number
          age?: number | null
          cnic?: string | null
          contact_no?: string | null
          created_at?: string
          date_of_birth?: string | null
          designation?: string | null
          father_name?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          photo_url?: string | null
          worker_code: string
        }
        Update: {
          address?: string | null
          advance_balance?: number
          age?: number | null
          cnic?: string | null
          contact_no?: string | null
          created_at?: string
          date_of_birth?: string | null
          designation?: string | null
          father_name?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          photo_url?: string | null
          worker_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "workers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      admin_adjust_billing_dates: {
        Args: {
          p_org_id: string
          p_paid_until: string
          p_subscribed_at: string
          p_suspension_note: string
        }
        Returns: {
          billing_notes: string | null
          created_at: string
          hidden_nav_tabs: string[]
          id: string
          monthly_fee: number | null
          name: string
          paid_until: string | null
          subscribed_at: string | null
          subscription_status: string
          suspension_note: string | null
          trial_ends_at: string | null
          week_start_day: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_list_org_owner_emails: {
        Args: never
        Returns: {
          email: string
          organization_id: string
        }[]
      }
      admin_rename_organization: {
        Args: { p_name: string; p_org_id: string }
        Returns: {
          billing_notes: string | null
          created_at: string
          hidden_nav_tabs: string[]
          id: string
          monthly_fee: number | null
          name: string
          paid_until: string | null
          subscribed_at: string | null
          subscription_status: string
          suspension_note: string | null
          trial_ends_at: string | null
          week_start_day: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_hidden_tabs: {
        Args: { p_hidden_tabs: string[]; p_org_id: string }
        Returns: {
          billing_notes: string | null
          created_at: string
          hidden_nav_tabs: string[]
          id: string
          monthly_fee: number | null
          name: string
          paid_until: string | null
          subscribed_at: string | null
          subscription_status: string
          suspension_note: string | null
          trial_ends_at: string | null
          week_start_day: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_invitation: {
        Args: { p_email: string; p_org_id: string; p_role: string }
        Returns: string
      }
      create_organization: { Args: { p_name: string }; Returns: string }
      create_support_ticket: {
        Args: { p_body: string; p_org_id: string; p_subject: string }
        Returns: string
      }
      finalize_weekly_slip: {
        Args: {
          p_final_amount: number
          p_org_id: string
          p_week_end: string
          p_week_start: string
          p_worker_id: string
        }
        Returns: {
          advance_delta: number
          created_at: string
          final_amount: number | null
          finalized_at: string | null
          finalized_by: string | null
          grand_total: number
          id: string
          organization_id: string
          paid_amount: number
          payable_balance: number
          reopened_at: string | null
          reopened_by: string | null
          status: string
          week_end: string
          week_start: string
          work_amount: number
          worker_id: string
        }
        SetofOptions: {
          from: "*"
          to: "weekly_slips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_invitation_preview: {
        Args: { p_token: string }
        Returns: {
          email: string
          expires_at: string
          organization_name: string
          role: string
          status: string
        }[]
      }
      has_org_role: {
        Args: { p_org_id: string; p_roles: string[] }
        Returns: boolean
      }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      mark_ticket_read: { Args: { p_ticket_id: string }; Returns: undefined }
      post_ticket_message: {
        Args: { p_body: string; p_ticket_id: string }
        Returns: string
      }
      reopen_weekly_slip: {
        Args: { p_slip_id: string }
        Returns: {
          advance_delta: number
          created_at: string
          final_amount: number | null
          finalized_at: string | null
          finalized_by: string | null
          grand_total: number
          id: string
          organization_id: string
          paid_amount: number
          payable_balance: number
          reopened_at: string | null
          reopened_by: string | null
          status: string
          week_end: string
          week_start: string
          work_amount: number
          worker_id: string
        }
        SetofOptions: {
          from: "*"
          to: "weekly_slips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_payment_submission: {
        Args: { p_approve: boolean; p_note: string; p_submission_id: string }
        Returns: {
          amount: number
          id: string
          method: string
          organization_id: string
          payment_date: string
          proof_filename: string | null
          proof_path: string
          purpose: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string
          transaction_reference: string
        }
        SetofOptions: {
          from: "*"
          to: "payment_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      set_ticket_status: {
        Args: { p_status: string; p_ticket_id: string }
        Returns: {
          admin_last_read_at: string | null
          created_at: string
          created_by: string
          id: string
          org_last_read_at: string | null
          organization_id: string
          status: string
          subject: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "support_tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_free_trial: {
        Args: { p_org_id: string }
        Returns: {
          billing_notes: string | null
          created_at: string
          hidden_nav_tabs: string[]
          id: string
          monthly_fee: number | null
          name: string
          paid_until: string | null
          subscribed_at: string | null
          subscription_status: string
          suspension_note: string | null
          trial_ends_at: string | null
          week_start_day: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_organization_billing: {
        Args: {
          p_billing_notes: string
          p_monthly_fee: number
          p_org_id: string
          p_subscription_status: string
        }
        Returns: {
          billing_notes: string | null
          created_at: string
          hidden_nav_tabs: string[]
          id: string
          monthly_fee: number | null
          name: string
          paid_until: string | null
          subscribed_at: string | null
          subscription_status: string
          suspension_note: string | null
          trial_ends_at: string | null
          week_start_day: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
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
