export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      availability_rules: {
        Row: {
          end_time: string
          id: string
          kind: Database["public"]["Enums"]["availability_kind"]
          provider_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          kind?: Database["public"]["Enums"]["availability_kind"]
          provider_id: string
          start_time: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          kind?: Database["public"]["Enums"]["availability_kind"]
          provider_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          buffer_end_at: string
          created_at: string
          customer_id: string
          end_at: string
          id: string
          notes: string | null
          price_cents: number
          provider_id: string
          service_id: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          buffer_end_at: string
          created_at?: string
          customer_id: string
          end_at: string
          id?: string
          notes?: string | null
          price_cents: number
          provider_id: string
          service_id: string
          start_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          buffer_end_at?: string
          created_at?: string
          customer_id?: string
          end_at?: string
          id?: string
          notes?: string | null
          price_cents?: number
          provider_id?: string
          service_id?: string
          start_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      providers: {
        Row: {
          address: string
          bio: string
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          id: string
          is_active: boolean
          lat: number
          lng: number
          name: string
          neighborhood: string
          rating: number
          review_count: number
          time_zone: string
          user_id: string | null
        }
        Insert: {
          address?: string
          bio?: string
          category: Database["public"]["Enums"]["service_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          lat: number
          lng: number
          name: string
          neighborhood?: string
          rating?: number
          review_count?: number
          time_zone: string
          user_id?: string | null
        }
        Update: {
          address?: string
          bio?: string
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          lat?: number
          lng?: number
          name?: string
          neighborhood?: string
          rating?: number
          review_count?: number
          time_zone?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          buffer_minutes: number
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          description: string
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price_cents: number
          provider_id: string
        }
        Insert: {
          buffer_minutes?: number
          category: Database["public"]["Enums"]["service_category"]
          created_at?: string
          description?: string
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          provider_id: string
        }
        Update: {
          buffer_minutes?: number
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          description?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_booking: {
        Args: { p_notes?: string; p_service_id: string; p_start_at: string }
        Returns: {
          buffer_end_at: string
          created_at: string
          customer_id: string
          end_at: string
          id: string
          notes: string | null
          price_cents: number
          provider_id: string
          service_id: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_busy_intervals: {
        Args: { p_from: string; p_provider_id: string; p_to: string }
        Returns: {
          end_at: string
          start_at: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_valid_time_zone: { Args: { tz: string }; Returns: boolean }
      owns_provider: { Args: { p_provider_id: string }; Returns: boolean }
      replace_availability_rules: {
        Args: { p_provider_id: string; p_rules: Json }
        Returns: {
          end_time: string
          id: string
          kind: Database["public"]["Enums"]["availability_kind"]
          provider_id: string
          start_time: string
          weekday: number
        }[]
        SetofOptions: {
          from: "*"
          to: "availability_rules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      availability_kind: "working" | "break"
      booking_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      service_category:
        | "hair"
        | "beauty"
        | "wellness"
        | "fitness"
        | "home"
        | "pets"
      user_role: "customer" | "provider" | "admin"
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
    Enums: {
      availability_kind: ["working", "break"],
      booking_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      service_category: [
        "hair",
        "beauty",
        "wellness",
        "fitness",
        "home",
        "pets",
      ],
      user_role: ["customer", "provider", "admin"],
    },
  },
} as const

