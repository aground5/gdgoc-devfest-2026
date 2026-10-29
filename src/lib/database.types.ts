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
      demo_assets: {
        Row: {
          bucket: string
          caption: string
          created_at: string
          entry_id: string
          file_name: string
          id: string
          kind: string
          mime: string
          path: string
          size_bytes: number
          sort: number
          team_id: string
        }
        Insert: {
          bucket: string
          caption?: string
          created_at?: string
          entry_id: string
          file_name: string
          id?: string
          kind: string
          mime: string
          path: string
          size_bytes: number
          sort?: number
          team_id: string
        }
        Update: {
          bucket?: string
          caption?: string
          created_at?: string
          entry_id?: string
          file_name?: string
          id?: string
          kind?: string
          mime?: string
          path?: string
          size_bytes?: number
          sort?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_assets_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "demo_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_assets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_entries: {
        Row: {
          created_at: string
          description: string
          hidden: boolean
          hidden_reason: string | null
          id: string
          live_url: string | null
          published_at: string | null
          repo_url: string | null
          status: Database["public"]["Enums"]["demo_status"]
          team_id: string
          test_instructions: string
          title: string
          updated_at: string
          updated_by: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          hidden?: boolean
          hidden_reason?: string | null
          id?: string
          live_url?: string | null
          published_at?: string | null
          repo_url?: string | null
          status?: Database["public"]["Enums"]["demo_status"]
          team_id: string
          test_instructions?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          hidden?: boolean
          hidden_reason?: string | null
          id?: string
          live_url?: string | null
          published_at?: string | null
          repo_url?: string | null
          status?: Database["public"]["Enums"]["demo_status"]
          team_id?: string
          test_instructions?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_entry_credentials: {
        Row: {
          credentials: string
          entry_id: string
          team_id: string
        }
        Insert: {
          credentials: string
          entry_id: string
          team_id: string
        }
        Update: {
          credentials?: string
          entry_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_entry_credentials_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "demo_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_entry_credentials_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          amount: number
          participant_id: string
          team_id: string
        }
        Insert: {
          amount: number
          participant_id: string
          team_id: string
        }
        Update: {
          amount?: number
          participant_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_private: {
        Row: {
          budget: number | null
          checked_in_at: string | null
          invest_confirmed_at: string | null
          login_id: string
          participant_id: string
          user_id: string | null
        }
        Insert: {
          budget?: number | null
          checked_in_at?: string | null
          invest_confirmed_at?: string | null
          login_id?: string
          participant_id: string
          user_id?: string | null
        }
        Update: {
          budget?: number | null
          checked_in_at?: string | null
          invest_confirmed_at?: string | null
          login_id?: string
          participant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_private_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          created_at: string
          id: string
          name: string
          school: Database["public"]["Enums"]["school"]
          team_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          school: Database["public"]["Enums"]["school"]
          team_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          school?: Database["public"]["Enums"]["school"]
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          email: string
          name: string
          user_id: string | null
        }
        Insert: {
          email: string
          name?: string
          user_id?: string | null
        }
        Update: {
          email?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          project: string
          table_no: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          project?: string
          table_no?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          project?: string
          table_no?: string
        }
        Relationships: []
      }
      tick_totals: {
        Row: {
          investors: number
          team_id: string
          tick_id: number
          total: number
        }
        Insert: {
          investors: number
          team_id: string
          tick_id: number
          total: number
        }
        Update: {
          investors?: number
          team_id?: string
          tick_id?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "tick_totals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tick_totals_tick_id_fkey"
            columns: ["tick_id"]
            isOneToOne: false
            referencedRelation: "ticks"
            referencedColumns: ["id"]
          },
        ]
      }
      ticks: {
        Row: {
          id: number
          published_at: string
          published_by: string | null
        }
        Insert: {
          id?: never
          published_at?: string
          published_by?: string | null
        }
        Update: {
          id?: never
          published_at?: string
          published_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_participant: {
        Args: {
          p_name: string
          p_school: Database["public"]["Enums"]["school"]
          p_team?: string
        }
        Returns: string
      }
      can_view_entry: { Args: { p_entry: string }; Returns: boolean }
      can_view_entry_path: {
        Args: { p_entry: string; p_team: string }
        Returns: boolean
      }
      check_in: { Args: { p_code: string }; Returns: boolean }
      confirm_investments: { Args: { p_alloc: Json }; Returns: undefined }
      current_participant_id: { Args: never; Returns: string }
      delete_latest_tick: { Args: never; Returns: undefined }
      get_attendance_code: { Args: never; Returns: string }
      get_settings: {
        Args: never
        Returns: {
          default_budget: number
          invest_step: number
        }[]
      }
      hook_before_user_created: { Args: { event: Json }; Returns: Json }
      is_staff: { Args: never; Returns: boolean }
      is_team_member: { Args: { t: string }; Returns: boolean }
      live_totals: {
        Args: never
        Returns: {
          investors: number
          team_id: string
          total: number
        }[]
      }
      my_team_id: { Args: never; Returns: string }
      publish_tick: { Args: never; Returns: number }
      random_attendance_code: { Args: never; Returns: string }
      set_attendance_code: { Args: { p_code: string }; Returns: string }
      set_budgets: {
        Args: { p_amount: number; p_ids: string[] }
        Returns: undefined
      }
      set_checked_in: {
        Args: { p_ids: string[]; p_on: boolean }
        Returns: undefined
      }
      set_default_budget: { Args: { p_amount: number }; Returns: undefined }
    }
    Enums: {
      demo_status: "draft" | "published"
      school: "ku" | "yu" | "skku" | "kaist"
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
      demo_status: ["draft", "published"],
      school: ["ku", "yu", "skku", "kaist"],
    },
  },
} as const

