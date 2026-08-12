export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
          store_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          store_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          store_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          product_id: string
          quantity_change: number
          reference_id: string | null
          reference_type: string | null
          stock_after: number
          stock_before: number
          store_id: string
          total_cost: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          product_id: string
          quantity_change: number
          reference_id?: string | null
          reference_type?: string | null
          stock_after: number
          stock_before: number
          store_id: string
          total_cost: number
          unit_cost: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity_change?: number
          reference_id?: string | null
          reference_type?: string | null
          stock_after?: number
          stock_before?: number
          store_id?: string
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_store_fk"
            columns: ["product_id", "store_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "inventory_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          normalized_name: string | null
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          normalized_name?: string | null
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          normalized_name?: string | null
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          buying_price: number
          category: string
          category_id: string
          created_at: string
          id: string
          image_url: string | null
          is_archived: boolean
          is_deleted: boolean
          is_demo: boolean
          name: string
          selling_price: number
          stock: number
          store_id: string
          updated_at: string
        }
        Insert: {
          buying_price?: number
          category?: string
          category_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_archived?: boolean
          is_deleted?: boolean
          is_demo?: boolean
          name: string
          selling_price?: number
          stock?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          buying_price?: number
          category?: string
          category_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_archived?: boolean
          is_deleted?: boolean
          is_demo?: boolean
          name?: string
          selling_price?: number
          stock?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_same_store_fk"
            columns: ["category_id", "store_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          category_id: string | null
          category_name: string
          cost_snapshot_source: string
          created_at: string
          id: string
          line_cogs: number
          line_gross_profit: number
          line_profit: number
          line_total: number
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          unit_cost_snapshot: number
          unit_price: number
          unit_profit: number
        }
        Insert: {
          category_id?: string | null
          category_name?: string
          cost_snapshot_source: string
          created_at?: string
          id?: string
          line_cogs: number
          line_gross_profit: number
          line_profit: number
          line_total: number
          product_id?: string | null
          product_name: string
          quantity: number
          sale_id: string
          unit_cost_snapshot: number
          unit_price: number
          unit_profit: number
        }
        Update: {
          category_id?: string | null
          category_name?: string
          cost_snapshot_source?: string
          created_at?: string
          id?: string
          line_cogs?: number
          line_gross_profit?: number
          line_profit?: number
          line_total?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          unit_cost_snapshot?: number
          unit_price?: number
          unit_profit?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_tendered: number | null
          checkout_key: string | null
          created_at: string
          created_by: string | null
          fees: Json | null
          gross_profit: number
          gross_sales: number
          id: string
          net_profit: number
          net_sales: number
          payment_method: string
          payment_reference: string | null
          store_id: string
          store_paid_deductions: number
          subtotal: number | null
          total_amount: number
          total_cogs: number
          total_profit: number
        }
        Insert: {
          amount_tendered?: number | null
          checkout_key?: string | null
          created_at?: string
          created_by?: string | null
          fees?: Json | null
          gross_profit?: number
          gross_sales?: number
          id?: string
          net_profit?: number
          net_sales?: number
          payment_method?: string
          payment_reference?: string | null
          store_id: string
          store_paid_deductions?: number
          subtotal?: number | null
          total_amount?: number
          total_cogs?: number
          total_profit?: number
        }
        Update: {
          amount_tendered?: number | null
          checkout_key?: string | null
          created_at?: string
          created_by?: string | null
          fees?: Json | null
          gross_profit?: number
          gross_sales?: number
          id?: string
          net_profit?: number
          net_sales?: number
          payment_method?: string
          payment_reference?: string | null
          store_id?: string
          store_paid_deductions?: number
          subtotal?: number | null
          total_amount?: number
          total_cogs?: number
          total_profit?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["membership_role"]
          status: Database["public"]["Enums"]["membership_status"]
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: string
          role: Database["public"]["Enums"]["membership_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_memberships_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          created_at: string
          currency: string
          fees: Json
          id: string
          name: string
          owner_id: string
          owner_name: string | null
          payment_qr_url: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string
          fees?: Json
          id?: string
          name: string
          owner_id: string
          owner_name?: string | null
          payment_qr_url?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string
          fees?: Json
          id?: string
          name?: string
          owner_id?: string
          owner_name?: string | null
          payment_qr_url?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_product_stock: {
        Args: {
          _notes?: string
          _product_id: string
          _quantity_change: number
          _reason: string
          _store_id: string
        }
        Returns: {
          buying_price: number
          category: string
          category_id: string
          created_at: string
          id: string
          image_url: string | null
          is_archived: boolean
          is_deleted: boolean
          is_demo: boolean
          name: string
          selling_price: number
          stock: number
          store_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      checkout_sale: {
        Args: {
          _amount_tendered?: number
          _checkout_key?: string
          _items: Json
          _payment_method: string
          _payment_reference?: string
          _store_id: string
        }
        Returns: Json
      }
      delete_product_category: {
        Args: {
          _category_id: string
          _replacement_category_id?: string
          _store_id: string
        }
        Returns: number
      }
      get_my_transactions: {
        Args: {
          _end_at: string
          _limit_count?: number
          _start_at: string
          _store_id: string
        }
        Returns: {
          amount_tendered: number
          created_at: string
          fees: Json
          id: string
          payment_method: string
          payment_reference: string
          sale_items: Json
          subtotal: number
          total_amount: number
        }[]
      }
      get_pos_categories: {
        Args: { _store_id: string }
        Returns: {
          color: string
          icon: string
          id: string
          name: string
          sort_order: number
        }[]
      }
      get_pos_products: {
        Args: { _store_id: string }
        Returns: {
          category: string
          category_id: string
          id: string
          image_url: string
          is_deleted: boolean
          name: string
          selling_price: number
          stock: number
          store_id: string
        }[]
      }
      get_pos_store: { Args: { _store_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reassign_category_products: {
        Args: {
          _category_id: string
          _replacement_category_id: string
          _store_id: string
        }
        Returns: number
      }
      reassign_category_products_subset: {
        Args: {
          _category_id: string
          _product_ids: string[]
          _replacement_category_id: string
          _store_id: string
        }
        Returns: number
      }
      reorder_product_category: {
        Args: { _category_id: string; _direction: number; _store_id: string }
        Returns: number
      }
      restock_product: {
        Args: {
          _notes?: string
          _product_id: string
          _purchase_unit_cost: number
          _quantity: number
          _store_id: string
        }
        Returns: {
          buying_price: number
          category: string
          category_id: string
          created_at: string
          id: string
          image_url: string | null
          is_archived: boolean
          is_deleted: boolean
          is_demo: boolean
          name: string
          selling_price: number
          stock: number
          store_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      secure_checkout: {
        Args: {
          _amount_tendered?: number
          _checkout_key?: string
          _items: Json
          _payment_method: string
          _payment_reference?: string
          _store_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "owner"
      membership_role: "admin" | "manager" | "cashier"
      membership_status: "active" | "inactive"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "owner"],
      membership_role: ["admin", "manager", "cashier"],
      membership_status: ["active", "inactive"],
    },
  },
} as const

