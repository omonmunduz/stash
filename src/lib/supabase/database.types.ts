export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          landing_page_title: string | null
          description: string | null
          logo_url: string | null
          hero_image_url: string | null
          subscription_tier: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          current_period_end: string | null
          grace_days: number | null
          settings: Json
          created_at: string | null
          updated_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          landing_page_title?: string | null
          description?: string | null
          logo_url?: string | null
          hero_image_url?: string | null
          subscription_tier?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          current_period_end?: string | null
          grace_days?: number | null
          settings?: Json
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          landing_page_title?: string | null
          description?: string | null
          logo_url?: string | null
          hero_image_url?: string | null
          subscription_tier?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          current_period_end?: string | null
          grace_days?: number | null
          settings?: Json
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
      }
      [key: string]: any
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
  }
}
