// Типы схемы БД в формате `supabase gen types typescript`.
// Благодаря им клиент Supabase типизирован: опечатка в имени таблицы, колонки
// или аргумента RPC ловится при сборке, а не в рантайме.
// После изменения схемы их можно перегенерировать:
//   npx supabase gen types typescript --project-id <project-ref> --schema public > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          role: Database['public']['Enums']['user_role'];
        };
        Insert: {
          created_at?: string;
          full_name: string;
          id: string;
          role: Database['public']['Enums']['user_role'];
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          role?: Database['public']['Enums']['user_role'];
        };
        Relationships: [];
      };
      projects: {
        Row: {
          address: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          address: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          address?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      task_history: {
        Row: {
          changed_by: string;
          comment: string | null;
          created_at: string;
          from_status: Database['public']['Enums']['task_status'] | null;
          id: number;
          task_id: string;
          to_status: Database['public']['Enums']['task_status'];
        };
        Insert: {
          changed_by: string;
          comment?: string | null;
          created_at?: string;
          from_status?: Database['public']['Enums']['task_status'] | null;
          id?: never;
          task_id: string;
          to_status: Database['public']['Enums']['task_status'];
        };
        Update: {
          changed_by?: string;
          comment?: string | null;
          created_at?: string;
          from_status?: Database['public']['Enums']['task_status'] | null;
          id?: never;
          task_id?: string;
          to_status?: Database['public']['Enums']['task_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'task_history_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_history_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      task_status_transitions: {
        Row: {
          allowed_role: Database['public']['Enums']['user_role'];
          from_status: Database['public']['Enums']['task_status'];
          requires_comment: boolean;
          to_status: Database['public']['Enums']['task_status'];
        };
        Insert: {
          allowed_role: Database['public']['Enums']['user_role'];
          from_status: Database['public']['Enums']['task_status'];
          requires_comment?: boolean;
          to_status: Database['public']['Enums']['task_status'];
        };
        Update: {
          allowed_role?: Database['public']['Enums']['user_role'];
          from_status?: Database['public']['Enums']['task_status'];
          requires_comment?: boolean;
          to_status?: Database['public']['Enums']['task_status'];
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          assignee_id: string;
          author_id: string;
          created_at: string;
          description: string;
          id: string;
          project_id: string;
          status: Database['public']['Enums']['task_status'];
          title: string;
          updated_at: string;
        };
        Insert: {
          assignee_id: string;
          author_id?: string;
          created_at?: string;
          description?: string;
          id?: string;
          project_id: string;
          status?: Database['public']['Enums']['task_status'];
          title: string;
          updated_at?: string;
        };
        Update: {
          assignee_id?: string;
          author_id?: string;
          created_at?: string;
          description?: string;
          id?: string;
          project_id?: string;
          status?: Database['public']['Enums']['task_status'];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_assignee_id_fkey';
            columns: ['assignee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      change_task_status: {
        Args: {
          p_comment?: string;
          p_new_status: Database['public']['Enums']['task_status'];
          p_task_id: string;
        };
        Returns: {
          assignee_id: string;
          author_id: string;
          created_at: string;
          description: string;
          id: string;
          project_id: string;
          status: Database['public']['Enums']['task_status'];
          title: string;
          updated_at: string;
        };
      };
    };
    Enums: {
      task_status: 'new' | 'in_progress' | 'under_review' | 'needs_revision' | 'accepted';
      user_role: 'manager' | 'assignee';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
