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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_messages: {
        Row: {
          actions: Json | null
          content: string
          created_at: string
          id: string
          images: string[] | null
          role: string
          session_id: string
        }
        Insert: {
          actions?: Json | null
          content: string
          created_at?: string
          id?: string
          images?: string[] | null
          role: string
          session_id: string
        }
        Update: {
          actions?: Json | null
          content?: string
          created_at?: string
          id?: string
          images?: string[] | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sessions: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      belongings_daily: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          notes: string | null
          purchase_date: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          purchase_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          purchase_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      belongings_durable: {
        Row: {
          category: string
          created_at: string
          expected_lifespan_days: number
          id: string
          name: string
          notes: string | null
          purchase_date: string
          purchase_price: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          expected_lifespan_days: number
          id?: string
          name: string
          notes?: string | null
          purchase_date: string
          purchase_price: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          expected_lifespan_days?: number
          id?: string
          name?: string
          notes?: string | null
          purchase_date?: string
          purchase_price?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      calorie_records: {
        Row: {
          calories: number
          created_at: string
          date: string
          food_name: string
          id: string
          meal_type: string
          notes: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          calories: number
          created_at?: string
          date: string
          food_name: string
          id?: string
          meal_type: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          calories?: number
          created_at?: string
          date?: string
          food_name?: string
          id?: string
          meal_type?: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      finance_records: {
        Row: {
          amount: number
          amount_cny: number
          category: string
          created_at: string
          currency: string
          date: string
          exchange_rate: number
          id: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          amount_cny: number
          category: string
          created_at?: string
          currency?: string
          date: string
          exchange_rate?: number
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          amount_cny?: number
          category?: string
          created_at?: string
          currency?: string
          date?: string
          exchange_rate?: number
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pantry_items: {
        Row: {
          category: string
          created_at: string
          expiry_date: string | null
          id: string
          name: string
          notes: string | null
          purchase_date: string | null
          quantity: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          name: string
          notes?: string | null
          purchase_date?: string | null
          quantity?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          purchase_date?: string | null
          quantity?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      schedule_events: {
        Row: {
          color: string | null
          created_at: string
          end_time: string
          id: string
          importance: string | null
          notes: string | null
          parent_event_id: string | null
          recurrence: Json | null
          start_time: string
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          end_time: string
          id?: string
          importance?: string | null
          notes?: string | null
          parent_event_id?: string | null
          recurrence?: Json | null
          start_time: string
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          end_time?: string
          id?: string
          importance?: string | null
          notes?: string | null
          parent_event_id?: string | null
          recurrence?: Json | null
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "schedule_events"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          ai_api_key: string | null
          ai_base_url: string | null
          ai_mode: string | null
          ai_model: string | null
          ai_platform: string | null
          calorie_target: number | null
          created_at: string
          custom_thought_tags: Json | null
          exchange_rate_jpy_to_cny: number | null
          exchange_rate_updated_at: string | null
          fasting_start_hour: number | null
          id: string
          monthly_budget: number | null
          timezone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_api_key?: string | null
          ai_base_url?: string | null
          ai_mode?: string | null
          ai_model?: string | null
          ai_platform?: string | null
          calorie_target?: number | null
          created_at?: string
          custom_thought_tags?: Json | null
          exchange_rate_jpy_to_cny?: number | null
          exchange_rate_updated_at?: string | null
          fasting_start_hour?: number | null
          id?: string
          monthly_budget?: number | null
          timezone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_api_key?: string | null
          ai_base_url?: string | null
          ai_mode?: string | null
          ai_model?: string | null
          ai_platform?: string | null
          calorie_target?: number | null
          created_at?: string
          custom_thought_tags?: Json | null
          exchange_rate_jpy_to_cny?: number | null
          exchange_rate_updated_at?: string | null
          fasting_start_hour?: number | null
          id?: string
          monthly_budget?: number | null
          timezone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      thoughts: {
        Row: {
          content: string
          created_at: string
          icon: string | null
          id: string
          tags: string[] | null
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          icon?: string | null
          id?: string
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          icon?: string | null
          id?: string
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      todos: {
        Row: {
          category: string
          created_at: string
          detail: string | null
          id: string
          importance: string
          is_completed: boolean
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          detail?: string | null
          id?: string
          importance?: string
          is_completed?: boolean
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          detail?: string | null
          id?: string
          importance?: string
          is_completed?: boolean
          title?: string
          updated_at?: string
          user_id?: string | null
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
