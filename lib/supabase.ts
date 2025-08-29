import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

export type Database = {
  public: {
    Tables: {
      lenders: {
        Row: {
          id: string;
          provider: string;
          logo: string;
          product_type: 'Working Capital' | 'Invoice Discounting' | 'Merchant Cash Advance' | 'Asset Finance' | 'Term Loan';
          amount_min: number;
          amount_max: number;
          min_years: number;
          min_monthly_turnover: number;
          vat_required: boolean;
          provinces_allowed: string[] | null;
          sector_exclusions: string[] | null;
          speed_days_min: number;
          speed_days_max: number;
          collateral_required: boolean | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          logo: string;
          product_type: 'Working Capital' | 'Invoice Discounting' | 'Merchant Cash Advance' | 'Asset Finance' | 'Term Loan';
          amount_min: number;
          amount_max: number;
          min_years: number;
          min_monthly_turnover: number;
          vat_required: boolean;
          provinces_allowed?: string[] | null;
          sector_exclusions?: string[] | null;
          speed_days_min: number;
          speed_days_max: number;
          collateral_required?: boolean | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          logo?: string;
          product_type?: 'Working Capital' | 'Invoice Discounting' | 'Merchant Cash Advance' | 'Asset Finance' | 'Term Loan';
          amount_min?: number;
          amount_max?: number;
          min_years?: number;
          min_monthly_turnover?: number;
          vat_required?: boolean;
          provinces_allowed?: string[] | null;
          sector_exclusions?: string[] | null;
          speed_days_min?: number;
          speed_days_max?: number;
          collateral_required?: boolean | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};