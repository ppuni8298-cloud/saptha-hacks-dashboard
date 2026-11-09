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
      activity_logs: {
        Row: {
          action: string
          actor: string | null
          actor_email: string | null
          created_at: string
          details: string | null
          id: string
        }
        Insert: {
          action: string
          actor?: string | null
          actor_email?: string | null
          created_at?: string
          details?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor?: string | null
          actor_email?: string | null
          created_at?: string
          details?: string | null
          id?: string
        }
        Relationships: []
      }
      admin_score_overrides: {
        Row: {
          created_at: string
          criterion_score_id: string | null
          edited_by: string | null
          evaluation_id: string | null
          field: string | null
          id: string
          new_value: number | null
          previous_value: number | null
          reason: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string
          criterion_score_id?: string | null
          edited_by?: string | null
          evaluation_id?: string | null
          field?: string | null
          id?: string
          new_value?: number | null
          previous_value?: number | null
          reason?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string
          criterion_score_id?: string | null
          edited_by?: string | null
          evaluation_id?: string | null
          field?: string | null
          id?: string
          new_value?: number | null
          previous_value?: number | null
          reason?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_score_overrides_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      api_usage_logs: {
        Row: {
          completion_tokens: number | null
          component: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          http_status: number | null
          id: string
          model: string | null
          prompt_tokens: number | null
          status: string | null
          team_id: string | null
        }
        Insert: {
          completion_tokens?: number | null
          component?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          http_status?: number | null
          id?: string
          model?: string | null
          prompt_tokens?: number | null
          status?: string | null
          team_id?: string | null
        }
        Update: {
          completion_tokens?: number | null
          component?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          http_status?: number | null
          id?: string
          model?: string | null
          prompt_tokens?: number | null
          status?: string | null
          team_id?: string | null
        }
        Relationships: []
      }
      criterion_scores: {
        Row: {
          admin_marks: number | null
          admin_reason: string | null
          ai_evidence: string | null
          ai_explanation: string | null
          ai_marks: number | null
          confidence: number | null
          criterion_id: string | null
          criterion_name: string
          edited_at: string | null
          edited_by: string | null
          evaluation_id: string
          id: string
          max_marks: number
          needs_review: boolean
          position: number
        }
        Insert: {
          admin_marks?: number | null
          admin_reason?: string | null
          ai_evidence?: string | null
          ai_explanation?: string | null
          ai_marks?: number | null
          confidence?: number | null
          criterion_id?: string | null
          criterion_name: string
          edited_at?: string | null
          edited_by?: string | null
          evaluation_id: string
          id?: string
          max_marks: number
          needs_review?: boolean
          position?: number
        }
        Update: {
          admin_marks?: number | null
          admin_reason?: string | null
          ai_evidence?: string | null
          ai_explanation?: string | null
          ai_marks?: number | null
          confidence?: number | null
          criterion_id?: string | null
          criterion_name?: string
          edited_at?: string | null
          edited_by?: string | null
          evaluation_id?: string
          id?: string
          max_marks?: number
          needs_review?: boolean
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "criterion_scores_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_components: {
        Row: {
          key: string
          name: string
          weight: number
        }
        Insert: {
          key: string
          name: string
          weight: number
        }
        Update: {
          key?: string
          name?: string
          weight?: number
        }
        Relationships: []
      }
      evaluation_criteria: {
        Row: {
          component: string
          description: string | null
          enabled: boolean
          id: string
          instructions: string | null
          max_marks: number
          name: string
          position: number
          updated_at: string
          weight: number
        }
        Insert: {
          component: string
          description?: string | null
          enabled?: boolean
          id?: string
          instructions?: string | null
          max_marks?: number
          name: string
          position?: number
          updated_at?: string
          weight?: number
        }
        Update: {
          component?: string
          description?: string | null
          enabled?: boolean
          id?: string
          instructions?: string | null
          max_marks?: number
          name?: string
          position?: number
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_criteria_component_fkey"
            columns: ["component"]
            isOneToOne: false
            referencedRelation: "evaluation_components"
            referencedColumns: ["key"]
          },
        ]
      }
      evaluation_history: {
        Row: {
          action: string
          actor: string | null
          component: string | null
          created_at: string
          details: Json | null
          id: string
          team_id: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          component?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          team_id?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          component?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_history_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_jobs: {
        Row: {
          attempts: number
          component: string
          created_at: string
          error: string | null
          id: string
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          component: string
          created_at?: string
          error?: string | null
          id?: string
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          component?: string
          created_at?: string
          error?: string | null
          id?: string
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_jobs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_templates: {
        Row: {
          component: string
          created_at: string
          criteria: Json
          id: string
          name: string
        }
        Insert: {
          component: string
          created_at?: string
          criteria: Json
          id?: string
          name: string
        }
        Update: {
          component?: string
          created_at?: string
          criteria?: Json
          id?: string
          name?: string
        }
        Relationships: []
      }
      evaluations: {
        Row: {
          ai_score: number | null
          approved_at: string | null
          approved_by: string | null
          component: string
          confidence: number | null
          created_at: string
          error: string | null
          final_score: number | null
          id: string
          max_score: number | null
          model: string | null
          stale: boolean
          status: string
          summary: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          ai_score?: number | null
          approved_at?: string | null
          approved_by?: string | null
          component: string
          confidence?: number | null
          created_at?: string
          error?: string | null
          final_score?: number | null
          id?: string
          max_score?: number | null
          model?: string | null
          stale?: boolean
          status?: string
          summary?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          ai_score?: number | null
          approved_at?: string | null
          approved_by?: string | null
          component?: string
          confidence?: number | null
          created_at?: string
          error?: string | null
          final_score?: number | null
          id?: string
          max_score?: number | null
          model?: string | null
          stale?: boolean
          status?: string
          summary?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_component_fkey"
            columns: ["component"]
            isOneToOne: false
            referencedRelation: "evaluation_components"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "evaluations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          batch_size: number
          concurrency: number
          daily_request_limit: number
          id: number
          max_pdf_mb: number
          max_retries: number
          model: string
          queue_paused: boolean
          quota_exhausted: boolean
          quota_message: string | null
          rpm: number
          scoring_instructions: string | null
          updated_at: string
        }
        Insert: {
          batch_size?: number
          concurrency?: number
          daily_request_limit?: number
          id?: number
          max_pdf_mb?: number
          max_retries?: number
          model?: string
          queue_paused?: boolean
          quota_exhausted?: boolean
          quota_message?: string | null
          rpm?: number
          scoring_instructions?: string | null
          updated_at?: string
        }
        Update: {
          batch_size?: number
          concurrency?: number
          daily_request_limit?: number
          id?: number
          max_pdf_mb?: number
          max_retries?: number
          model?: string
          queue_paused?: boolean
          quota_exhausted?: boolean
          quota_message?: string | null
          rpm?: number
          scoring_instructions?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          email: string | null
          id: string
          name: string
          position: number
          team_id: string
        }
        Insert: {
          email?: string | null
          id?: string
          name: string
          position?: number
          team_id: string
        }
        Update: {
          email?: string | null
          id?: string
          name?: string
          position?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          email: string | null
          final_override: number | null
          final_status: string
          github_url: string | null
          id: string
          name: string
          override_reason: string | null
          pdf_path: string | null
          pdf_text: string | null
          project_description: string | null
          project_title: string | null
          remarks: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          final_override?: number | null
          final_status?: string
          github_url?: string | null
          id?: string
          name: string
          override_reason?: string | null
          pdf_path?: string | null
          pdf_text?: string | null
          project_description?: string | null
          project_title?: string | null
          remarks?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          final_override?: number | null
          final_status?: string
          github_url?: string | null
          id?: string
          name?: string
          override_reason?: string | null
          pdf_path?: string | null
          pdf_text?: string | null
          project_description?: string | null
          project_title?: string | null
          remarks?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      claim_first_admin: { Args: never; Returns: boolean }
      is_admin: { Args: { _uid: string }; Returns: boolean }
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
