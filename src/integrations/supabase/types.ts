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
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_endpoint: string | null
          last_used_at: string | null
          name: string
          rate_limit_per_minute: number
          rejected_count: number
          request_count: number
          revoked_at: string | null
          window_count: number
          window_start: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_endpoint?: string | null
          last_used_at?: string | null
          name: string
          rate_limit_per_minute?: number
          rejected_count?: number
          request_count?: number
          revoked_at?: string | null
          window_count?: number
          window_start?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_endpoint?: string | null
          last_used_at?: string | null
          name?: string
          rate_limit_per_minute?: number
          rejected_count?: number
          request_count?: number
          revoked_at?: string | null
          window_count?: number
          window_start?: string | null
        }
        Relationships: []
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          duration_ms: number | null
          endpoint: string
          id: number
          ip: string | null
          method: string
          query: string | null
          status: number
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          duration_ms?: number | null
          endpoint: string
          id?: never
          ip?: string | null
          method?: string
          query?: string | null
          status: number
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          duration_ms?: number | null
          endpoint?: string
          id?: never
          ip?: string | null
          method?: string
          query?: string | null
          status?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          bodega: string
          cod_color: string
          color: string
          created_at: string
          descripcion: string
          id: string
          image_url: string
          precio_usd: number | null
          pvm: number
          pvp: number
          referencia: string
          saldo: number
          sku: string
          talla: string
          talla_lote: string
        }
        Insert: {
          bodega?: string
          cod_color?: string
          color?: string
          created_at?: string
          descripcion?: string
          id?: string
          image_url?: string
          precio_usd?: number | null
          pvm?: number
          pvp?: number
          referencia: string
          saldo?: number
          sku?: string
          talla?: string
          talla_lote?: string
        }
        Update: {
          bodega?: string
          cod_color?: string
          color?: string
          created_at?: string
          descripcion?: string
          id?: string
          image_url?: string
          precio_usd?: number | null
          pvm?: number
          pvp?: number
          referencia?: string
          saldo?: number
          sku?: string
          talla?: string
          talla_lote?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          cantidad: number
          cod_color: string
          color: string
          created_at: string
          descripcion: string
          id: string
          order_id: string
          pvm: number
          referencia: string
          sku: string
          talla: string
        }
        Insert: {
          cantidad?: number
          cod_color?: string
          color?: string
          created_at?: string
          descripcion?: string
          id?: string
          order_id: string
          pvm?: number
          referencia: string
          sku: string
          talla?: string
        }
        Update: {
          cantidad?: number
          cod_color?: string
          color?: string
          created_at?: string
          descripcion?: string
          id?: string
          order_id?: string
          pvm?: number
          referencia?: string
          sku?: string
          talla?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_name: string
          id: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          customer_name: string
          id?: string
          total_amount?: number
        }
        Update: {
          created_at?: string
          customer_name?: string
          id?: string
          total_amount?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      api_consume_key: {
        Args: { p_endpoint: string; p_key_hash: string }
        Returns: {
          allowed: boolean
          key_id: string
          key_name: string
          rate_limit: number
          reason: string
          remaining: number
          retry_after: number
        }[]
      }
      api_inventory_stats: { Args: never; Returns: Json }
      api_list_references: {
        Args: {
          p_bodega?: string
          p_code?: string
          p_color?: string
          p_con_stock?: boolean
          p_desde?: string
          p_limit?: number
          p_offset?: number
          p_talla?: string
          p_words?: string[]
        }
        Returns: Json
      }
      api_norm: { Args: { t: string }; Returns: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
