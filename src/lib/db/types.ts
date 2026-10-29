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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          checked_at: string
          checked_by: string | null
          day: string
          id: string
          method: string
          participant_id: string
        }
        Insert: {
          checked_at?: string
          checked_by?: string | null
          day?: string
          id?: string
          method: string
          participant_id: string
        }
        Update: {
          checked_at?: string
          checked_by?: string | null
          day?: string
          id?: string
          method?: string
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          code: string | null
          id: boolean
          updated_at: string
        }
        Insert: {
          code?: string | null
          id?: boolean
          updated_at?: string
        }
        Update: {
          code?: string | null
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      demo_assets: {
        Row: {
          bucket: string
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
      invest_settings: {
        Row: {
          default_budget: number
          id: boolean
          open: boolean
          step: number
          updated_at: string
        }
        Insert: {
          default_budget?: number
          id?: boolean
          open?: boolean
          step?: number
          updated_at?: string
        }
        Update: {
          default_budget?: number
          id?: boolean
          open?: boolean
          step?: number
          updated_at?: string
        }
        Relationships: []
      }
      invest_tick_allocations: {
        Row: {
          amount: number
          participant_id: string
          team_id: string
          tick_id: number
        }
        Insert: {
          amount: number
          participant_id: string
          team_id: string
          tick_id: number
        }
        Update: {
          amount?: number
          participant_id?: string
          team_id?: string
          tick_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "invest_tick_allocations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invest_tick_allocations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invest_tick_allocations_tick_id_fkey"
            columns: ["tick_id"]
            isOneToOne: false
            referencedRelation: "invest_ticks"
            referencedColumns: ["id"]
          },
        ]
      }
      invest_tick_totals: {
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
            foreignKeyName: "invest_tick_totals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invest_tick_totals_tick_id_fkey"
            columns: ["tick_id"]
            isOneToOne: false
            referencedRelation: "invest_ticks"
            referencedColumns: ["id"]
          },
        ]
      }
      invest_ticks: {
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
      investment_confirmations: {
        Row: {
          allocation: Json
          budget: number
          confirmed_at: string
          id: number
          participant_id: string
          total: number
        }
        Insert: {
          allocation: Json
          budget: number
          confirmed_at?: string
          id?: never
          participant_id: string
          total: number
        }
        Update: {
          allocation?: Json
          budget?: number
          confirmed_at?: string
          id?: never
          participant_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "investment_confirmations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          amount: number
          participant_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          participant_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          participant_id?: string
          team_id?: string
          updated_at?: string
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
      participants: {
        Row: {
          access_code: string
          created_at: string
          id: string
          invest_budget: number | null
          name: string
          school: string
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          access_code?: string
          created_at?: string
          id?: string
          invest_budget?: number | null
          name: string
          school: string
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          access_code?: string
          created_at?: string
          id?: string
          invest_budget?: number | null
          name?: string
          school?: string
          team_id?: string | null
          user_id?: string | null
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
      site_content: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      staff_emails: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          note: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          note?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          note?: string
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
          table_label: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          project?: string
          table_label?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          project?: string
          table_label?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bulk_import: {
        Args: { p_delete_missing?: boolean; p_people: Json; p_teams: Json }
        Returns: Json
      }
      can_view_demo: { Args: { p_entry: string }; Returns: boolean }
      can_view_demo_path: {
        Args: { p_entry: string; p_team: string }
        Returns: boolean
      }
      check_in: { Args: { p_code: string }; Returns: string }
      claim_participant: {
        Args: { p_code: string; p_name: string }
        Returns: {
          id: string
          name: string
          school: string
          team_id: string
        }[]
      }
      confirm_investments: {
        Args: { p_alloc: Json }
        Returns: {
          allocation: Json
          budget: number
          confirmed_at: string
          id: number
          participant_id: string
          total: number
        }
        SetofOptions: {
          from: "*"
          to: "investment_confirmations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_access_code: { Args: { len?: number }; Returns: string }
      is_participant: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      my_email: { Args: never; Returns: string }
      my_team_id: { Args: never; Returns: string }
      participant_directory: {
        Args: never
        Returns: {
          id: string
          name: string
          school: string
          team_id: string
        }[]
      }
      publish_tick: {
        Args: never
        Returns: {
          id: number
          published_at: string
          published_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invest_ticks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_participant: { Args: never; Returns: undefined }
      update_my_team: {
        Args: { p_description: string; p_name: string; p_project: string }
        Returns: {
          created_at: string
          description: string
          id: string
          name: string
          project: string
          table_label: string
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      demo_status: "draft" | "published"
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
      demo_status: ["draft", "published"],
    },
  },
} as const

