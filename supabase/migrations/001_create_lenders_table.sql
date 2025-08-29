-- Create lenders table
CREATE TABLE IF NOT EXISTS public.lenders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    logo TEXT NOT NULL,
    product_type TEXT NOT NULL CHECK (product_type IN ('Working Capital', 'Invoice Discounting', 'Merchant Cash Advance', 'Asset Finance', 'Term Loan')),
    amount_min INTEGER NOT NULL,
    amount_max INTEGER NOT NULL,
    min_years INTEGER NOT NULL,
    min_monthly_turnover INTEGER NOT NULL,
    vat_required BOOLEAN NOT NULL DEFAULT false,
    provinces_allowed TEXT[] DEFAULT NULL,
    sector_exclusions TEXT[] DEFAULT NULL,
    speed_days_min INTEGER NOT NULL,
    speed_days_max INTEGER NOT NULL,
    collateral_required BOOLEAN DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster filtering
CREATE INDEX idx_lenders_product_type ON public.lenders(product_type);
CREATE INDEX idx_lenders_amount_range ON public.lenders(amount_min, amount_max);
CREATE INDEX idx_lenders_turnover ON public.lenders(min_monthly_turnover);

-- Disable RLS for the lenders table (as requested)
ALTER TABLE public.lenders DISABLE ROW LEVEL SECURITY;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_lenders_updated_at
    BEFORE UPDATE ON public.lenders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();