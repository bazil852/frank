# Supabase Setup Instructions

## 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a new project
2. Note down your project URL and anon key

## 2. Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```

2. Add your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 3. Run Database Migration

In your Supabase dashboard:

1. Go to SQL Editor
2. Create a new query
3. Copy and paste the contents of `supabase/migrations/001_create_lenders_table.sql`
4. Run the query

## 4. Seed Initial Data

1. In the SQL Editor, create another query
2. Copy and paste the contents of `supabase/seed.sql`
3. Run the query

## 5. Verify Setup

The database is configured with:
- **No Row Level Security (RLS)** on the lenders table as requested
- Indexes for optimized querying
- Automatic timestamp updates
- All existing lender data migrated

## 6. Database Schema

The `lenders` table includes:
- `id` (UUID): Primary key
- `provider` (TEXT): Lender name
- `logo` (TEXT): Path to logo file
- `product_type` (TEXT): Type of financial product
- `amount_min/max` (INTEGER): Funding range
- `min_years` (INTEGER): Minimum years in business
- `min_monthly_turnover` (INTEGER): Minimum monthly revenue requirement
- `vat_required` (BOOLEAN): VAT registration requirement
- `provinces_allowed` (TEXT[]): Geographic restrictions
- `sector_exclusions` (TEXT[]): Industries not served
- `speed_days_min/max` (INTEGER): Processing time range
- `collateral_required` (BOOLEAN): Collateral requirement
- `notes` (TEXT): Additional information
- `created_at/updated_at` (TIMESTAMPTZ): Timestamps

## API Functions Available

The `lib/db-lenders.ts` file provides:
- `getLendersFromDB()`: Fetch all lenders
- `addLender()`: Add a new lender
- `updateLender()`: Update existing lender
- `deleteLender()`: Remove a lender

The system falls back to static data if Supabase is unavailable.