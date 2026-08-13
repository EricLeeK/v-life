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
      ai_entitlements: {
        Row: {
          created_at: string
          daily_request_limit: number
          expires_at: string | null
          monthly_token_limit: number
          per_minute_limit: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_request_limit?: number
          expires_at?: string | null
          monthly_token_limit?: number
          per_minute_limit?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_request_limit?: number
          expires_at?: string | null
          monthly_token_limit?: number
          per_minute_limit?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      ai_usage_logs: {
        Row: {
          created_at: string
          function_name: string
          id: string
          input_tokens: number
          model: string | null
          output_tokens: number
          source: string
          token_estimate: boolean
          total_tokens: number
          user_id: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          input_tokens?: number
          model?: string | null
          output_tokens?: number
          source?: string
          token_estimate?: boolean
          total_tokens?: number
          user_id: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          input_tokens?: number
          model?: string | null
          output_tokens?: number
          source?: string
          token_estimate?: boolean
          total_tokens?: number
          user_id?: string
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
      civil_checkins: {
        Row: {
          created_at: string | null
          date: string
          id: string
          note: string | null
          studied_minutes: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          note?: string | null
          studied_minutes?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          note?: string | null
          studied_minutes?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      civil_exams: {
        Row: {
          created_at: string | null
          exam_date: string
          exam_type: string
          id: string
          is_archived: boolean
          is_primary: boolean
          name: string
          notes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          exam_date: string
          exam_type?: string
          id?: string
          is_archived?: boolean
          is_primary?: boolean
          name: string
          notes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          exam_date?: string
          exam_type?: string
          id?: string
          is_archived?: boolean
          is_primary?: boolean
          name?: string
          notes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      civil_plan_items: {
        Row: {
          completed_at: string | null
          created_at: string | null
          detail: string | null
          end_time: string | null
          id: string
          is_completed: boolean
          plan_date: string
          sort_order: number
          source: string
          start_time: string | null
          subject_group: string
          subject_tag: string | null
          synced_schedule_id: string | null
          synced_todo_id: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          detail?: string | null
          end_time?: string | null
          id?: string
          is_completed?: boolean
          plan_date: string
          sort_order?: number
          source?: string
          start_time?: string | null
          subject_group?: string
          subject_tag?: string | null
          synced_schedule_id?: string | null
          synced_todo_id?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          detail?: string | null
          end_time?: string | null
          id?: string
          is_completed?: boolean
          plan_date?: string
          sort_order?: number
          source?: string
          start_time?: string | null
          subject_group?: string
          subject_tag?: string | null
          synced_schedule_id?: string | null
          synced_todo_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      civil_wrong_answers: {
        Row: {
          ai_draft_meta: Json | null
          content: string | null
          correct_answer: string | null
          created_at: string | null
          id: string
          image_required: boolean | null
          image_url: string | null
          knowledge_point: string | null
          last_reviewed_at: string | null
          next_review_date: string | null
          options: Json | null
          question_type: string | null
          review_interval_days: number
          review_status: string
          source_date: string
          subject_group: string
          subject_tag: string | null
          title: string
          updated_at: string | null
          user_answer: string | null
          user_id: string
          wrong_reason: string | null
        }
        Insert: {
          ai_draft_meta?: Json | null
          content?: string | null
          correct_answer?: string | null
          created_at?: string | null
          id?: string
          image_required?: boolean | null
          image_url?: string | null
          knowledge_point?: string | null
          last_reviewed_at?: string | null
          next_review_date?: string | null
          options?: Json | null
          question_type?: string | null
          review_interval_days?: number
          review_status?: string
          source_date?: string
          subject_group: string
          subject_tag?: string | null
          title: string
          updated_at?: string | null
          user_answer?: string | null
          user_id: string
          wrong_reason?: string | null
        }
        Update: {
          ai_draft_meta?: Json | null
          content?: string | null
          correct_answer?: string | null
          created_at?: string | null
          id?: string
          image_required?: boolean | null
          image_url?: string | null
          knowledge_point?: string | null
          last_reviewed_at?: string | null
          next_review_date?: string | null
          options?: Json | null
          question_type?: string | null
          review_interval_days?: number
          review_status?: string
          source_date?: string
          subject_group?: string
          subject_tag?: string | null
          title?: string
          updated_at?: string | null
          user_answer?: string | null
          user_id?: string
          wrong_reason?: string | null
        }
        Relationships: []
      }
      civil_xingce_papers: {
        Row: {
          analogy_correct: number
          analogy_total: number
          beat_rate: number | null
          common_correct: number
          common_total: number
          created_at: string | null
          data_correct: number
          data_total: number
          duration_minutes: number | null
          graphic_correct: number
          graphic_total: number
          id: string
          is_mock: boolean
          logic_correct: number
          logic_total: number
          notes: string | null
          quantity_correct: number
          quantity_total: number
          source: string
          taken_date: string
          total_score: number | null
          updated_at: string | null
          user_id: string
          verbal_correct: number
          verbal_total: number
        }
        Insert: {
          analogy_correct?: number
          analogy_total?: number
          beat_rate?: number | null
          common_correct?: number
          common_total?: number
          created_at?: string | null
          data_correct?: number
          data_total?: number
          duration_minutes?: number | null
          graphic_correct?: number
          graphic_total?: number
          id?: string
          is_mock?: boolean
          logic_correct?: number
          logic_total?: number
          notes?: string | null
          quantity_correct?: number
          quantity_total?: number
          source?: string
          taken_date: string
          total_score?: number | null
          updated_at?: string | null
          user_id: string
          verbal_correct?: number
          verbal_total?: number
        }
        Update: {
          analogy_correct?: number
          analogy_total?: number
          beat_rate?: number | null
          common_correct?: number
          common_total?: number
          created_at?: string | null
          data_correct?: number
          data_total?: number
          duration_minutes?: number | null
          graphic_correct?: number
          graphic_total?: number
          id?: string
          is_mock?: boolean
          logic_correct?: number
          logic_total?: number
          notes?: string | null
          quantity_correct?: number
          quantity_total?: number
          source?: string
          taken_date?: string
          total_score?: number | null
          updated_at?: string | null
          user_id?: string
          verbal_correct?: number
          verbal_total?: number
        }
        Relationships: []
      }
      daily_tasks: {
        Row: {
          base_points: number | null
          completed_at: string | null
          created_at: string | null
          difficulty: string | null
          id: string
          is_completed: boolean | null
          metadata: Json | null
          task_date: string
          todo_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          base_points?: number | null
          completed_at?: string | null
          created_at?: string | null
          difficulty?: string | null
          id?: string
          is_completed?: boolean | null
          metadata?: Json | null
          task_date?: string
          todo_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          base_points?: number | null
          completed_at?: string | null
          created_at?: string | null
          difficulty?: string | null
          id?: string
          is_completed?: boolean | null
          metadata?: Json | null
          task_date?: string
          todo_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_tasks_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
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
      fortune_daily_cache: {
        Row: {
          cache_date: string
          created_at: string
          id: string
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          cache_date: string
          created_at?: string
          id?: string
          payload?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          cache_date?: string
          created_at?: string
          id?: string
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fortune_readings: {
        Row: {
          created_at: string
          id: string
          payload: Json
          question: string | null
          reading: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          question?: string | null
          reading?: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          question?: string | null
          reading?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      gacha_pity: {
        Row: {
          created_at: string | null
          id: string
          pulls_since_legendary: number | null
          total_pulls: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          pulls_since_legendary?: number | null
          total_pulls?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          pulls_since_legendary?: number | null
          total_pulls?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          id: string
          is_completed: boolean
          period_start: string
          title: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_completed?: boolean
          period_start: string
          title: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_completed?: boolean
          period_start?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          completed_at: string | null
          id: string
          log_date: string
          task_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          log_date?: string
          task_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          log_date?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_courses: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      learning_notes: {
        Row: {
          content: string
          course_id: string
          created_at: string | null
          id: string
          note_date: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: string
          course_id: string
          created_at?: string | null
          id?: string
          note_date?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          course_id?: string
          created_at?: string | null
          id?: string
          note_date?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_notes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "learning_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_records: {
        Row: {
          arm: number | null
          chest: number | null
          created_at: string
          date: string
          hip: number | null
          id: string
          notes: string | null
          thigh: number | null
          updated_at: string
          user_id: string | null
          waist: number | null
        }
        Insert: {
          arm?: number | null
          chest?: number | null
          created_at?: string
          date: string
          hip?: number | null
          id?: string
          notes?: string | null
          thigh?: number | null
          updated_at?: string
          user_id?: string | null
          waist?: number | null
        }
        Update: {
          arm?: number | null
          chest?: number | null
          created_at?: string
          date?: string
          hip?: number | null
          id?: string
          notes?: string | null
          thigh?: number | null
          updated_at?: string
          user_id?: string | null
          waist?: number | null
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
      project_task_tags: {
        Row: {
          tag_id: string
          task_id: string
        }
        Insert: {
          tag_id: string
          task_id: string
        }
        Update: {
          tag_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_task_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "task_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_tags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          project_id: string
          sort_order: number
          status: string
          title: string
          type: string
          updated_at: string | null
          weight: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_id: string
          sort_order?: number
          status?: string
          title: string
          type?: string
          updated_at?: string | null
          weight?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string
          sort_order?: number
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          priority: string
          progress: number
          status: string
          target_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          priority?: string
          progress?: number
          status?: string
          target_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          priority?: string
          progress?: number
          status?: string
          target_date?: string | null
          updated_at?: string | null
          user_id?: string
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
          ai_vision_api_key: string | null
          ai_vision_base_url: string | null
          ai_vision_model: string | null
          ai_vision_platform: string | null
          app_focus_mode: string
          calorie_target: number | null
          created_at: string
          custom_thought_tags: Json | null
          display_name: string | null
          exchange_rate_jpy_to_cny: number | null
          exchange_rate_updated_at: string | null
          fasting_start_hour: number | null
          fasting_start_minute: number | null
          fortune_profile: Json | null
          hidden_features: string[] | null
          id: string
          monthly_budget: number | null
          show_goals_in_schedule: boolean | null
          target_weight: number | null
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
          ai_vision_api_key?: string | null
          ai_vision_base_url?: string | null
          ai_vision_model?: string | null
          ai_vision_platform?: string | null
          app_focus_mode?: string
          calorie_target?: number | null
          created_at?: string
          custom_thought_tags?: Json | null
          display_name?: string | null
          exchange_rate_jpy_to_cny?: number | null
          exchange_rate_updated_at?: string | null
          fasting_start_hour?: number | null
          fasting_start_minute?: number | null
          fortune_profile?: Json | null
          hidden_features?: string[] | null
          id?: string
          monthly_budget?: number | null
          show_goals_in_schedule?: boolean | null
          target_weight?: number | null
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
          ai_vision_api_key?: string | null
          ai_vision_base_url?: string | null
          ai_vision_model?: string | null
          ai_vision_platform?: string | null
          app_focus_mode?: string
          calorie_target?: number | null
          created_at?: string
          custom_thought_tags?: Json | null
          display_name?: string | null
          exchange_rate_jpy_to_cny?: number | null
          exchange_rate_updated_at?: string | null
          fasting_start_hour?: number | null
          fasting_start_minute?: number | null
          fortune_profile?: Json | null
          hidden_features?: string[] | null
          id?: string
          monthly_budget?: number | null
          show_goals_in_schedule?: boolean | null
          target_weight?: number | null
          timezone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      shop_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          item_type: string
          metadata: Json | null
          name: string
          price: number | null
          rarity: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          item_type: string
          metadata?: Json | null
          name: string
          price?: number | null
          rarity: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          item_type?: string
          metadata?: Json | null
          name?: string
          price?: number | null
          rarity?: string
        }
        Relationships: []
      }
      task_tags: {
        Row: {
          color: string
          id: string
          name: string
          project_id: string
        }
        Insert: {
          color?: string
          id?: string
          name: string
          project_id: string
        }
        Update: {
          color?: string
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          is_archived: boolean | null
          is_completed: boolean
          parent_id: string | null
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
          is_archived?: boolean | null
          is_completed?: boolean
          parent_id?: string | null
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
          is_archived?: boolean | null
          is_completed?: boolean
          parent_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "todos_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_inventory: {
        Row: {
          id: string
          is_equipped: boolean | null
          is_used: boolean | null
          item_id: string
          purchased_at: string | null
          source: string
          user_id: string
        }
        Insert: {
          id?: string
          is_equipped?: boolean | null
          is_used?: boolean | null
          item_id: string
          purchased_at?: string | null
          source: string
          user_id: string
        }
        Update: {
          id?: string
          is_equipped?: boolean | null
          is_used?: boolean | null
          item_id?: string
          purchased_at?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_points: {
        Row: {
          best_streak: number | null
          created_at: string | null
          current_streak: number | null
          id: string
          last_active_date: string | null
          rest_day_date: string | null
          skip_chore_active: boolean | null
          sleep_in_date: string | null
          total_points: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          best_streak?: number | null
          created_at?: string | null
          current_streak?: number | null
          id?: string
          last_active_date?: string | null
          rest_day_date?: string | null
          skip_chore_active?: boolean | null
          sleep_in_date?: string | null
          total_points?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          best_streak?: number | null
          created_at?: string | null
          current_streak?: number | null
          id?: string
          last_active_date?: string | null
          rest_day_date?: string | null
          skip_chore_active?: boolean | null
          sleep_in_date?: string | null
          total_points?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      weight_records: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
          weight: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
          weight?: number
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
