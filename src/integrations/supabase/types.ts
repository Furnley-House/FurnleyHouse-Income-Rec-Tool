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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cached_expectations: {
        Row: {
          adviser_name: string | null
          allocated_amount: number
          cached_at: string
          calculation_date: string | null
          client_name: string | null
          expected_amount: number
          fee_category: string | null
          id: string
          plan_reference: string | null
          provider_name: string
          remaining_amount: number
          status: string
          updated_at: string
          zoho_record_id: string | null
        }
        Insert: {
          adviser_name?: string | null
          allocated_amount?: number
          cached_at?: string
          calculation_date?: string | null
          client_name?: string | null
          expected_amount?: number
          fee_category?: string | null
          id: string
          plan_reference?: string | null
          provider_name: string
          remaining_amount?: number
          status?: string
          updated_at?: string
          zoho_record_id?: string | null
        }
        Update: {
          adviser_name?: string | null
          allocated_amount?: number
          cached_at?: string
          calculation_date?: string | null
          client_name?: string | null
          expected_amount?: number
          fee_category?: string | null
          id?: string
          plan_reference?: string | null
          provider_name?: string
          remaining_amount?: number
          status?: string
          updated_at?: string
          zoho_record_id?: string | null
        }
        Relationships: []
      }
      cached_line_items: {
        Row: {
          adviser_name: string | null
          amount: number
          cached_at: string
          client_name: string | null
          fee_category: string | null
          id: string
          match_notes: string | null
          matched_expectation_id: string | null
          payment_id: string
          plan_reference: string | null
          reason_code: string | null
          status: string
          updated_at: string
          zoho_record_id: string | null
        }
        Insert: {
          adviser_name?: string | null
          amount?: number
          cached_at?: string
          client_name?: string | null
          fee_category?: string | null
          id: string
          match_notes?: string | null
          matched_expectation_id?: string | null
          payment_id: string
          plan_reference?: string | null
          reason_code?: string | null
          status?: string
          updated_at?: string
          zoho_record_id?: string | null
        }
        Update: {
          adviser_name?: string | null
          amount?: number
          cached_at?: string
          client_name?: string | null
          fee_category?: string | null
          id?: string
          match_notes?: string | null
          matched_expectation_id?: string | null
          payment_id?: string
          plan_reference?: string | null
          reason_code?: string | null
          status?: string
          updated_at?: string
          zoho_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cached_line_items_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "cached_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      cached_payments: {
        Row: {
          amount: number
          cached_at: string
          id: string
          notes: string | null
          payment_date: string | null
          payment_reference: string | null
          period_end: string | null
          period_start: string | null
          provider_name: string
          reconciled_amount: number
          remaining_amount: number
          status: string
          updated_at: string
          zoho_record_id: string | null
        }
        Insert: {
          amount?: number
          cached_at?: string
          id: string
          notes?: string | null
          payment_date?: string | null
          payment_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          provider_name: string
          reconciled_amount?: number
          remaining_amount?: number
          status?: string
          updated_at?: string
          zoho_record_id?: string | null
        }
        Update: {
          amount?: number
          cached_at?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          provider_name?: string
          reconciled_amount?: number
          remaining_amount?: number
          status?: string
          updated_at?: string
          zoho_record_id?: string | null
        }
        Relationships: []
      }
      pending_matches: {
        Row: {
          expectation_id: string
          id: string
          line_item_id: string
          match_quality: string | null
          matched_amount: number
          matched_at: string
          notes: string | null
          payment_id: string
          synced_at: string | null
          synced_to_zoho: boolean
          variance: number
          variance_percentage: number
        }
        Insert: {
          expectation_id: string
          id?: string
          line_item_id: string
          match_quality?: string | null
          matched_amount: number
          matched_at?: string
          notes?: string | null
          payment_id: string
          synced_at?: string | null
          synced_to_zoho?: boolean
          variance?: number
          variance_percentage?: number
        }
        Update: {
          expectation_id?: string
          id?: string
          line_item_id?: string
          match_quality?: string | null
          matched_amount?: number
          matched_at?: string
          notes?: string | null
          payment_id?: string
          synced_at?: string | null
          synced_to_zoho?: boolean
          variance?: number
          variance_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "pending_matches_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "cached_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_matches_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "cached_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_status: {
        Row: {
          id: string
          is_locked: boolean
          last_download_at: string | null
          last_sync_at: string | null
          lock_reason: string | null
          pending_match_count: number
        }
        Insert: {
          id?: string
          is_locked?: boolean
          last_download_at?: string | null
          last_sync_at?: string | null
          lock_reason?: string | null
          pending_match_count?: number
        }
        Update: {
          id?: string
          is_locked?: boolean
          last_download_at?: string | null
          last_sync_at?: string | null
          lock_reason?: string | null
          pending_match_count?: number
        }
        Relationships: []
      }
      zoho_token_cache: {
        Row: {
          access_token: string
          expires_at: string
          id: string
          updated_at: string
        }
        Insert: {
          access_token: string
          expires_at: string
          id?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          expires_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
