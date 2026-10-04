export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      absences: {
        Row: {
          created_at: string;
          from_date: string;
          id: string;
          reason: string;
          reduced_hours: number;
          to_date: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          from_date: string;
          id?: string;
          reason?: string;
          reduced_hours?: number;
          to_date: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          from_date?: string;
          id?: string;
          reason?: string;
          reduced_hours?: number;
          to_date?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "absences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "member_points";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "absences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_chain_head: {
        Row: {
          hash: string;
          id: boolean;
          seq: number;
        };
        Insert: {
          hash?: string;
          id?: boolean;
          seq?: number;
        };
        Update: {
          hash?: string;
          id?: boolean;
          seq?: number;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          actor_id: string | null;
          actor_role: Database["public"]["Enums"]["user_role"] | null;
          after: Json | null;
          before: Json | null;
          changes: NonNullable<Json>;
          client_at: string | null;
          client_platform: string;
          client_version: string;
          entity_id: string;
          entity_label: string;
          entity_table: string;
          event_type: Database["public"]["Enums"]["audit_event_type"];
          hash: string;
          id: string;
          occurred_at: string;
          prev_hash: string;
          project_id: string | null;
          reason: string | null;
          request_id: string;
          seq: number;
          session_id: string | null;
        };
        Insert: {
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["user_role"] | null;
          after?: Json | null;
          before?: Json | null;
          changes?: NonNullable<Json>;
          client_at?: string | null;
          client_platform: string;
          client_version: string;
          entity_id: string;
          entity_label: string;
          entity_table: string;
          event_type: Database["public"]["Enums"]["audit_event_type"];
          hash: string;
          id?: string;
          occurred_at: string;
          prev_hash: string;
          project_id?: string | null;
          reason?: string | null;
          request_id: string;
          seq: number;
          session_id?: string | null;
        };
        Update: {
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["user_role"] | null;
          after?: Json | null;
          before?: Json | null;
          changes?: NonNullable<Json>;
          client_at?: string | null;
          client_platform?: string;
          client_version?: string;
          entity_id?: string;
          entity_label?: string;
          entity_table?: string;
          event_type?: Database["public"]["Enums"]["audit_event_type"];
          hash?: string;
          id?: string;
          occurred_at?: string;
          prev_hash?: string;
          project_id?: string | null;
          reason?: string | null;
          request_id?: string;
          seq?: number;
          session_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "member_points";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_votes: {
        Row: {
          created_at: string;
          expense_id: string;
          in_favor: boolean;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expense_id: string;
          in_favor: boolean;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expense_id?: string;
          in_favor?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_votes_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expense_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "member_points";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "expense_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          before_signing: boolean;
          category: Database["public"]["Enums"]["expense_category"];
          concept: string;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_code"];
          id: string;
          paid_by: string;
          receipt_url: string | null;
          reimbursed: boolean;
          status: Database["public"]["Enums"]["expense_status"];
          void_reason: string | null;
          voided_at: string | null;
        };
        Insert: {
          amount: number;
          before_signing?: boolean;
          category?: Database["public"]["Enums"]["expense_category"];
          concept: string;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          id?: string;
          paid_by: string;
          receipt_url?: string | null;
          reimbursed?: boolean;
          status?: Database["public"]["Enums"]["expense_status"];
          void_reason?: string | null;
          voided_at?: string | null;
        };
        Update: {
          amount?: number;
          before_signing?: boolean;
          category?: Database["public"]["Enums"]["expense_category"];
          concept?: string;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          id?: string;
          paid_by?: string;
          receipt_url?: string | null;
          reimbursed?: boolean;
          status?: Database["public"]["Enums"]["expense_status"];
          void_reason?: string | null;
          voided_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_paid_by_fkey";
            columns: ["paid_by"];
            isOneToOne: false;
            referencedRelation: "member_points";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "expenses_paid_by_fkey";
            columns: ["paid_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      hours_drafts: {
        Row: {
          created_at: string;
          draft_date: string;
          entry_ids: string[];
          hours: number;
          id: string;
          measured: boolean;
          project_id: string | null;
          submitted_at: string | null;
          task_id: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          draft_date: string;
          entry_ids?: string[];
          hours?: number;
          id?: string;
          measured?: boolean;
          project_id?: string | null;
          submitted_at?: string | null;
          task_id?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          draft_date?: string;
          entry_ids?: string[];
          hours?: number;
          id?: string;
          measured?: boolean;
          project_id?: string | null;
          submitted_at?: string | null;
          task_id?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hours_drafts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hours_drafts_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hours_drafts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "member_points";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "hours_drafts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          active: boolean;
          area: Database["public"]["Enums"]["user_area"];
          created_at: string;
          id: string;
          name: string;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
          weekly_hours: number;
        };
        Insert: {
          active?: boolean;
          area?: Database["public"]["Enums"]["user_area"];
          created_at?: string;
          id: string;
          name: string;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
          weekly_hours?: number;
        };
        Update: {
          active?: boolean;
          area?: Database["public"]["Enums"]["user_area"];
          created_at?: string;
          id?: string;
          name?: string;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
          weekly_hours?: number;
        };
        Relationships: [];
      };
      project_labels: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          project_id: string;
          updated_at: string;
        };
        Insert: {
          color: string;
          created_at?: string;
          id?: string;
          name: string;
          project_id: string;
          updated_at?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          project_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_labels_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_members: {
        Row: {
          added_at: string;
          project_id: string;
          user_id: string;
        };
        Insert: {
          added_at?: string;
          project_id: string;
          user_id: string;
        };
        Update: {
          added_at?: string;
          project_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "member_points";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "project_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          status: Database["public"]["Enums"]["project_status"];
          type: Database["public"]["Enums"]["project_type"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          status?: Database["public"]["Enums"]["project_status"];
          type: Database["public"]["Enums"]["project_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          status?: Database["public"]["Enums"]["project_status"];
          type?: Database["public"]["Enums"]["project_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      recurring_expenses: {
        Row: {
          amount: number;
          before_signing: boolean;
          concept: string;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_code"];
          id: string;
          next_date: string;
          periodicity: Database["public"]["Enums"]["periodicity"];
        };
        Insert: {
          amount: number;
          before_signing?: boolean;
          concept: string;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          id?: string;
          next_date: string;
          periodicity: Database["public"]["Enums"]["periodicity"];
        };
        Update: {
          amount?: number;
          before_signing?: boolean;
          concept?: string;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          id?: string;
          next_date?: string;
          periodicity?: Database["public"]["Enums"]["periodicity"];
        };
        Relationships: [];
      };
      settings: {
        Row: {
          daily_reminder_time: string;
          daily_reminder_weekdays: number[];
          entry_edit_days: number;
          expense_approval_limit_pen: number;
          id: boolean;
          min_compliance: number;
          points_per_hour: number;
          points_per_sol: number;
          updated_at: string;
          updated_by: string | null;
          weekly_hours_reminder_time: string;
          weekly_hours_reminder_weekday: number;
          weeks_per_month: number;
        };
        Insert: {
          daily_reminder_time?: string;
          daily_reminder_weekdays?: number[];
          entry_edit_days?: number;
          expense_approval_limit_pen?: number;
          id?: boolean;
          min_compliance?: number;
          points_per_hour?: number;
          points_per_sol?: number;
          updated_at?: string;
          updated_by?: string | null;
          weekly_hours_reminder_time?: string;
          weekly_hours_reminder_weekday?: number;
          weeks_per_month?: number;
        };
        Update: {
          daily_reminder_time?: string;
          daily_reminder_weekdays?: number[];
          entry_edit_days?: number;
          expense_approval_limit_pen?: number;
          id?: boolean;
          min_compliance?: number;
          points_per_hour?: number;
          points_per_sol?: number;
          updated_at?: string;
          updated_by?: string | null;
          weekly_hours_reminder_time?: string;
          weekly_hours_reminder_weekday?: number;
          weeks_per_month?: number;
        };
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "member_points";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      sprints: {
        Row: {
          created_at: string;
          end_date: string;
          goal: string;
          id: string;
          project_id: string;
          start_date: string;
          status: Database["public"]["Enums"]["sprint_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          end_date: string;
          goal: string;
          id?: string;
          project_id: string;
          start_date: string;
          status?: Database["public"]["Enums"]["sprint_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          end_date?: string;
          goal?: string;
          id?: string;
          project_id?: string;
          start_date?: string;
          status?: Database["public"]["Enums"]["sprint_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sprints_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      task_labels: {
        Row: {
          label_id: string;
          task_id: string;
        };
        Insert: {
          label_id: string;
          task_id: string;
        };
        Update: {
          label_id?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_labels_label_id_fkey";
            columns: ["label_id"];
            isOneToOne: false;
            referencedRelation: "project_labels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_labels_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          assignee_id: string | null;
          created_at: string;
          description: string | null;
          estimate_hours: number | null;
          hours_prepared: boolean;
          id: string;
          link: string | null;
          project_id: string | null;
          sprint_id: string | null;
          status: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          assignee_id?: string | null;
          created_at?: string;
          description?: string | null;
          estimate_hours?: number | null;
          hours_prepared?: boolean;
          id?: string;
          link?: string | null;
          project_id?: string | null;
          sprint_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          assignee_id?: string | null;
          created_at?: string;
          description?: string | null;
          estimate_hours?: number | null;
          hours_prepared?: boolean;
          id?: string;
          link?: string | null;
          project_id?: string | null;
          sprint_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "member_points";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_sprint_id_project_id_fkey";
            columns: ["sprint_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "sprints";
            referencedColumns: ["id", "project_id"];
          },
        ];
      };
      time_entries: {
        Row: {
          allocations: Json | null;
          created_at: string;
          description: string | null;
          draft: boolean;
          elapsed_ms: number;
          ended_at: string | null;
          evidence_url: string | null;
          hours: number;
          id: string;
          paid: boolean;
          project_id: string | null;
          review_note: string | null;
          reviewed_by: string | null;
          segment_started_at: string | null;
          segments: Json | null;
          source: string | null;
          started_at: string;
          task_id: string | null;
          timer_state: string | null;
          user_id: string;
          validated: boolean;
          validated_at: string | null;
          validated_by: string | null;
          void_reason: string | null;
          voided_at: string | null;
        };
        Insert: {
          allocations?: Json | null;
          created_at?: string;
          description?: string | null;
          draft?: boolean;
          elapsed_ms?: number;
          ended_at?: string | null;
          evidence_url?: string | null;
          hours?: number;
          id?: string;
          paid?: boolean;
          project_id?: string | null;
          review_note?: string | null;
          reviewed_by?: string | null;
          segment_started_at?: string | null;
          segments?: Json | null;
          source?: string | null;
          started_at: string;
          task_id?: string | null;
          timer_state?: string | null;
          user_id: string;
          validated?: boolean;
          validated_at?: string | null;
          validated_by?: string | null;
          void_reason?: string | null;
          voided_at?: string | null;
        };
        Update: {
          allocations?: Json | null;
          created_at?: string;
          description?: string | null;
          draft?: boolean;
          elapsed_ms?: number;
          ended_at?: string | null;
          evidence_url?: string | null;
          hours?: number;
          id?: string;
          paid?: boolean;
          project_id?: string | null;
          review_note?: string | null;
          reviewed_by?: string | null;
          segment_started_at?: string | null;
          segments?: Json | null;
          source?: string | null;
          started_at?: string;
          task_id?: string | null;
          timer_state?: string | null;
          user_id?: string;
          validated?: boolean;
          validated_at?: string | null;
          validated_by?: string | null;
          void_reason?: string | null;
          voided_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "time_entries_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_entries_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "member_points";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "time_entries_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_entries_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "member_points";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "time_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_entries_validated_by_fkey";
            columns: ["validated_by"];
            isOneToOne: false;
            referencedRelation: "member_points";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "time_entries_validated_by_fkey";
            columns: ["validated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      member_monthly_summary: {
        Row: {
          compliance: number | null;
          hours: number | null;
          meets_minimum: boolean | null;
          minimum_hours: number | null;
          month: string | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      member_points: {
        Row: {
          hour_points: number | null;
          money_points: number | null;
          participation: number | null;
          total_points: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      add_manual_hours: {
        Args: {
          p_date: string;
          p_description?: string;
          p_evidence_url?: string;
          p_hours: number;
          p_project?: string;
          p_start_time?: string;
          p_task: string;
        };
        Returns: {
          allocations: Json | null;
          created_at: string;
          description: string | null;
          draft: boolean;
          elapsed_ms: number;
          ended_at: string | null;
          evidence_url: string | null;
          hours: number;
          id: string;
          paid: boolean;
          project_id: string | null;
          review_note: string | null;
          reviewed_by: string | null;
          segment_started_at: string | null;
          segments: Json | null;
          source: string | null;
          started_at: string;
          task_id: string | null;
          timer_state: string | null;
          user_id: string;
          validated: boolean;
          validated_at: string | null;
          validated_by: string | null;
          void_reason: string | null;
          voided_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "time_entries";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      auth_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      can_access_project: { Args: { p_project: string }; Returns: boolean };
      can_view_task: { Args: { p_task: string }; Returns: boolean };
      create_expense: {
        Args: {
          p_amount: number;
          p_before_signing?: boolean;
          p_category: Database["public"]["Enums"]["expense_category"];
          p_concept: string;
          p_currency: Database["public"]["Enums"]["currency_code"];
          p_receipt_url?: string;
        };
        Returns: {
          amount: number;
          before_signing: boolean;
          category: Database["public"]["Enums"]["expense_category"];
          concept: string;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_code"];
          id: string;
          paid_by: string;
          receipt_url: string | null;
          reimbursed: boolean;
          status: Database["public"]["Enums"]["expense_status"];
          void_reason: string | null;
          voided_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "expenses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_project: {
        Args: {
          p_member_ids?: string[];
          p_name: string;
          p_status?: Database["public"]["Enums"]["project_status"];
          p_type: Database["public"]["Enums"]["project_type"];
        };
        Returns: {
          created_at: string;
          id: string;
          name: string;
          status: Database["public"]["Enums"]["project_status"];
          type: Database["public"]["Enums"]["project_type"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_partner_or_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_project_member: { Args: { p_project: string }; Returns: boolean };
      monthly_summary: {
        Args: { p_month: string };
        Returns: {
          compliance: number;
          hours: number;
          meets_minimum: boolean;
          minimum_hours: number;
          month: string;
          user_id: string;
        }[];
      };
      move_task: {
        Args: {
          p_id: string;
          p_status: Database["public"]["Enums"]["task_status"];
        };
        Returns: {
          assignee_id: string | null;
          created_at: string;
          description: string | null;
          estimate_hours: number | null;
          hours_prepared: boolean;
          id: string;
          link: string | null;
          project_id: string | null;
          sprint_id: string | null;
          status: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "tasks";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      pause_timer: {
        Args: Record<PropertyKey, never>;
        Returns: {
          allocations: Json | null;
          created_at: string;
          description: string | null;
          draft: boolean;
          elapsed_ms: number;
          ended_at: string | null;
          evidence_url: string | null;
          hours: number;
          id: string;
          paid: boolean;
          project_id: string | null;
          review_note: string | null;
          reviewed_by: string | null;
          segment_started_at: string | null;
          segments: Json | null;
          source: string | null;
          started_at: string;
          task_id: string | null;
          timer_state: string | null;
          user_id: string;
          validated: boolean;
          validated_at: string | null;
          validated_by: string | null;
          void_reason: string | null;
          voided_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "time_entries";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      request_hours_clarification: {
        Args: { p_id: string; p_note: string };
        Returns: {
          allocations: Json | null;
          created_at: string;
          description: string | null;
          draft: boolean;
          elapsed_ms: number;
          ended_at: string | null;
          evidence_url: string | null;
          hours: number;
          id: string;
          paid: boolean;
          project_id: string | null;
          review_note: string | null;
          reviewed_by: string | null;
          segment_started_at: string | null;
          segments: Json | null;
          source: string | null;
          started_at: string;
          task_id: string | null;
          timer_state: string | null;
          user_id: string;
          validated: boolean;
          validated_at: string | null;
          validated_by: string | null;
          void_reason: string | null;
          voided_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "time_entries";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      resume_timer: {
        Args: Record<PropertyKey, never>;
        Returns: {
          allocations: Json | null;
          created_at: string;
          description: string | null;
          draft: boolean;
          elapsed_ms: number;
          ended_at: string | null;
          evidence_url: string | null;
          hours: number;
          id: string;
          paid: boolean;
          project_id: string | null;
          review_note: string | null;
          reviewed_by: string | null;
          segment_started_at: string | null;
          segments: Json | null;
          source: string | null;
          started_at: string;
          task_id: string | null;
          timer_state: string | null;
          user_id: string;
          validated: boolean;
          validated_at: string | null;
          validated_by: string | null;
          void_reason: string | null;
          voided_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "time_entries";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_project_members: {
        Args: { p_member_ids: string[]; p_project: string };
        Returns: string[];
      };
      set_task_labels: {
        Args: { p_label_ids: string[]; p_task: string };
        Returns: string[];
      };
      start_timer: {
        Args: {
          p_description?: string;
          p_evidence_url?: string;
          p_project?: string;
          p_task?: string;
        };
        Returns: {
          allocations: Json | null;
          created_at: string;
          description: string | null;
          draft: boolean;
          elapsed_ms: number;
          ended_at: string | null;
          evidence_url: string | null;
          hours: number;
          id: string;
          paid: boolean;
          project_id: string | null;
          review_note: string | null;
          reviewed_by: string | null;
          segment_started_at: string | null;
          segments: Json | null;
          source: string | null;
          started_at: string;
          task_id: string | null;
          timer_state: string | null;
          user_id: string;
          validated: boolean;
          validated_at: string | null;
          validated_by: string | null;
          void_reason: string | null;
          voided_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "time_entries";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      stop_timer: {
        Args: Record<PropertyKey, never>;
        Returns: {
          allocations: Json | null;
          created_at: string;
          description: string | null;
          draft: boolean;
          elapsed_ms: number;
          ended_at: string | null;
          evidence_url: string | null;
          hours: number;
          id: string;
          paid: boolean;
          project_id: string | null;
          review_note: string | null;
          reviewed_by: string | null;
          segment_started_at: string | null;
          segments: Json | null;
          source: string | null;
          started_at: string;
          task_id: string | null;
          timer_state: string | null;
          user_id: string;
          validated: boolean;
          validated_at: string | null;
          validated_by: string | null;
          void_reason: string | null;
          voided_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "time_entries";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_hours_drafts: {
        Args: { p_date: string; p_description?: string; p_items: Json };
        Returns: {
          allocations: Json | null;
          created_at: string;
          description: string | null;
          draft: boolean;
          elapsed_ms: number;
          ended_at: string | null;
          evidence_url: string | null;
          hours: number;
          id: string;
          paid: boolean;
          project_id: string | null;
          review_note: string | null;
          reviewed_by: string | null;
          segment_started_at: string | null;
          segments: Json | null;
          source: string | null;
          started_at: string;
          task_id: string | null;
          timer_state: string | null;
          user_id: string;
          validated: boolean;
          validated_at: string | null;
          validated_by: string | null;
          void_reason: string | null;
          voided_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "time_entries";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_hours: {
        Args: { p_id: string; p_patch: Json };
        Returns: {
          allocations: Json | null;
          created_at: string;
          description: string | null;
          draft: boolean;
          elapsed_ms: number;
          ended_at: string | null;
          evidence_url: string | null;
          hours: number;
          id: string;
          paid: boolean;
          project_id: string | null;
          review_note: string | null;
          reviewed_by: string | null;
          segment_started_at: string | null;
          segments: Json | null;
          source: string | null;
          started_at: string;
          task_id: string | null;
          timer_state: string | null;
          user_id: string;
          validated: boolean;
          validated_at: string | null;
          validated_by: string | null;
          void_reason: string | null;
          voided_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "time_entries";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      validate_hours: {
        Args: { p_ids: string[] };
        Returns: {
          allocations: Json | null;
          created_at: string;
          description: string | null;
          draft: boolean;
          elapsed_ms: number;
          ended_at: string | null;
          evidence_url: string | null;
          hours: number;
          id: string;
          paid: boolean;
          project_id: string | null;
          review_note: string | null;
          reviewed_by: string | null;
          segment_started_at: string | null;
          segments: Json | null;
          source: string | null;
          started_at: string;
          task_id: string | null;
          timer_state: string | null;
          user_id: string;
          validated: boolean;
          validated_at: string | null;
          validated_by: string | null;
          void_reason: string | null;
          voided_at: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "time_entries";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      verify_audit_chain: { Args: Record<PropertyKey, never>; Returns: number };
      void_expense: {
        Args: { p_id: string; p_reason: string };
        Returns: {
          amount: number;
          before_signing: boolean;
          category: Database["public"]["Enums"]["expense_category"];
          concept: string;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_code"];
          id: string;
          paid_by: string;
          receipt_url: string | null;
          reimbursed: boolean;
          status: Database["public"]["Enums"]["expense_status"];
          void_reason: string | null;
          voided_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "expenses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      void_hours: {
        Args: { p_id: string; p_reason: string };
        Returns: {
          allocations: Json | null;
          created_at: string;
          description: string | null;
          draft: boolean;
          elapsed_ms: number;
          ended_at: string | null;
          evidence_url: string | null;
          hours: number;
          id: string;
          paid: boolean;
          project_id: string | null;
          review_note: string | null;
          reviewed_by: string | null;
          segment_started_at: string | null;
          segments: Json | null;
          source: string | null;
          started_at: string;
          task_id: string | null;
          timer_state: string | null;
          user_id: string;
          validated: boolean;
          validated_at: string | null;
          validated_by: string | null;
          void_reason: string | null;
          voided_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "time_entries";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      vote_expense: {
        Args: { p_expense: string; p_in_favor: boolean };
        Returns: {
          amount: number;
          before_signing: boolean;
          category: Database["public"]["Enums"]["expense_category"];
          concept: string;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_code"];
          id: string;
          paid_by: string;
          receipt_url: string | null;
          reimbursed: boolean;
          status: Database["public"]["Enums"]["expense_status"];
          void_reason: string | null;
          voided_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "expenses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      audit_event_type:
        | "task.created"
        | "task.edited"
        | "task.moved"
        | "task.assigned"
        | "project.created"
        | "project.updated"
        | "project.members_changed"
        | "project_label.created"
        | "project_label.updated"
        | "sprint.created"
        | "hours.created"
        | "hours.confirmed"
        | "hours.edited"
        | "hours.approved"
        | "hours.clarification_requested"
        | "hours.voided"
        | "timer.started"
        | "timer.stopped"
        | "timer.paused"
        | "timer.resumed"
        | "timer.recovered"
        | "member.created"
        | "member.updated"
        | "member.role_changed"
        | "member.deactivated"
        | "settings.changed";
      currency_code: "PEN" | "USD";
      expense_category:
        "infrastructure" | "software" | "marketing" | "legal" | "other";
      expense_status: "pending" | "approved" | "rejected" | "voided";
      periodicity: "monthly" | "yearly";
      project_status: "active" | "paused" | "archived";
      project_type: "internal" | "product" | "client";
      sprint_status: "planned" | "active" | "closed";
      task_status: "todo" | "in_progress" | "review" | "done";
      user_area:
        "technical" | "management_finance" | "commercial" | "design_marketing";
      user_role: "admin" | "partner" | "collaborator";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      audit_event_type: [
        "task.created",
        "task.edited",
        "task.moved",
        "task.assigned",
        "project.created",
        "project.updated",
        "project.members_changed",
        "project_label.created",
        "project_label.updated",
        "sprint.created",
        "hours.created",
        "hours.confirmed",
        "hours.edited",
        "hours.approved",
        "hours.clarification_requested",
        "hours.voided",
        "timer.started",
        "timer.stopped",
        "timer.paused",
        "timer.resumed",
        "timer.recovered",
        "member.created",
        "member.updated",
        "member.role_changed",
        "member.deactivated",
        "settings.changed",
      ],
      currency_code: ["PEN", "USD"],
      expense_category: [
        "infrastructure",
        "software",
        "marketing",
        "legal",
        "other",
      ],
      expense_status: ["pending", "approved", "rejected", "voided"],
      periodicity: ["monthly", "yearly"],
      project_status: ["active", "paused", "archived"],
      project_type: ["internal", "product", "client"],
      sprint_status: ["planned", "active", "closed"],
      task_status: ["todo", "in_progress", "review", "done"],
      user_area: [
        "technical",
        "management_finance",
        "commercial",
        "design_marketing",
      ],
      user_role: ["admin", "partner", "collaborator"],
    },
  },
} as const;
