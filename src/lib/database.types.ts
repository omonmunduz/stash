/**
 * Database type definitions — manually maintained to match migrations.
 *
 * ⚠️  Once a Supabase project is connected, regenerate this file with:
 *     npx supabase gen types typescript --local > src/lib/database.types.ts
 *
 * Until then, this hand-written version is kept in sync with:
 *     supabase/migrations/20240723000001_initial_schema.sql
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── Enum type aliases ────────────────────────────────────────────────────────

export type UserRole = 'owner' | 'admin' | 'manager' | 'employee';
export type DbPaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'check' | 'other';
export type SaleStatus = 'draft' | 'completed' | 'cancelled';
export type DbPaymentStatus = 'unpaid' | 'partial' | 'paid';

// ── Database interface ────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {

      // ── organizations ──────────────────────────────────────────────────────
      organizations: {
        // Subscription/Stripe columns are deliberately absent — they are not in
        // the canonical schema (20240723000001_initial_schema.sql). Billing is
        // Phase 2 and arrives as its own migration.
        Row: {
          id: string;
          name: string;
          slug: string;
          settings: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
        Relationships: [];
      };

      // ── user_profiles ──────────────────────────────────────────────────────
      user_profiles: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          full_name: string;
          phone: string | null;
          role: UserRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          organization_id: string;
          email: string;
          full_name: string;
          phone?: string | null;
          role?: UserRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<Database['public']['Tables']['user_profiles']['Insert'], 'id'>>;
        Relationships: [
          { foreignKeyName: 'user_profiles_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] }
        ];
      };

      // ── customers ─────────────────────────────────────────────────────────
      customers: {
        Row: {
          id: string;
          organization_id: string;
          customer_code: string;
          name: string;
          business_name: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          city: string | null;
          credit_limit: number | null;
          current_balance: number;
          notes: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          customer_code: string;
          name: string;
          business_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          credit_limit?: number | null;
          current_balance?: number;
          notes?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<Database['public']['Tables']['customers']['Insert'], 'id' | 'organization_id'>>;
        Relationships: [
          { foreignKeyName: 'customers_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] }
        ];
      };

      // ── products ──────────────────────────────────────────────────────────
      products: {
        Row: {
          id: string;
          organization_id: string;
          sku: string;
          name: string;
          description: string | null;
          category: string | null;
          unit_of_measure: string;
          cost_price: number;
          sale_price: number;
          barcode: string | null;
          reorder_level: number | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sku: string;
          name: string;
          description?: string | null;
          category?: string | null;
          unit_of_measure?: string;
          cost_price: number;
          sale_price: number;
          barcode?: string | null;
          reorder_level?: number | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<Database['public']['Tables']['products']['Insert'], 'id' | 'organization_id'>>;
        Relationships: [];
      };

      // ── inventory ─────────────────────────────────────────────────────────
      inventory: {
        Row: {
          id: string;
          organization_id: string;
          product_id: string;
          quantity_on_hand: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          product_id: string;
          quantity_on_hand?: number;
          updated_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['inventory']['Insert'], 'id' | 'organization_id' | 'product_id'>>;
        Relationships: [];
      };

      // ── sales ─────────────────────────────────────────────────────────────
      sales: {
        Row: {
          id: string;
          organization_id: string;
          sale_number: string;
          customer_id: string;
          sale_date: string;
          due_date: string | null;
          status: SaleStatus;
          subtotal: number;
          tax: number;
          discount: number;
          total: number;
          amount_paid: number;
          amount_due: number;
          payment_status: DbPaymentStatus;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sale_number: string;
          customer_id: string;
          sale_date?: string;
          due_date?: string | null;
          status?: SaleStatus;
          subtotal?: number;
          tax?: number;
          discount?: number;
          total?: number;
          amount_paid?: number;
          amount_due?: number;
          payment_status?: DbPaymentStatus;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<Database['public']['Tables']['sales']['Insert'], 'id' | 'organization_id'>>;
        Relationships: [];
      };

      // ── sale_items ────────────────────────────────────────────────────────
      sale_items: {
        Row: {
          id: string;
          organization_id: string;
          sale_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_price: number;
          cost_price: number;
          discount: number;
          subtotal: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sale_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_price: number;
          cost_price: number;
          discount?: number;
          subtotal: number;
          created_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['sale_items']['Insert'], 'id' | 'sale_id'>>;
        Relationships: [];
      };

      // ── payments ──────────────────────────────────────────────────────────
      payments: {
        Row: {
          id: string;
          organization_id: string;
          payment_number: string;
          customer_id: string;
          sale_id: string | null;
          payment_date: string;
          amount: number;
          payment_method: DbPaymentMethod;
          reference_number: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          payment_number: string;
          customer_id: string;
          sale_id?: string | null;
          payment_date?: string;
          amount: number;
          payment_method: DbPaymentMethod;
          reference_number?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<Database['public']['Tables']['payments']['Insert'], 'id' | 'organization_id'>>;
        Relationships: [];
      };

      // ── expenses ──────────────────────────────────────────────────────────
      expenses: {
        Row: {
          id: string;
          organization_id: string;
          expense_number: string;
          expense_date: string;
          category: string;
          vendor: string | null;
          amount: number;
          payment_method: DbPaymentMethod;
          description: string;
          receipt_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          expense_number: string;
          expense_date?: string;
          category: string;
          vendor?: string | null;
          amount: number;
          payment_method: DbPaymentMethod;
          description: string;
          receipt_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<Database['public']['Tables']['expenses']['Insert'], 'id' | 'organization_id'>>;
        Relationships: [];
      };

    }; // End Tables

    // subscription_tier / subscription_status are not declared here: the
    // canonical schema never CREATEs those enum types.
    Enums: {
      user_role: UserRole;
      payment_method: DbPaymentMethod;
      sale_status: SaleStatus;
      payment_status: DbPaymentStatus;
    };
  }; // End public
}; // End Database

// ── Helper types ──────────────────────────────────────────────────────────────

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

