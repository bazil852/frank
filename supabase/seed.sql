-- Seed data for lenders table
INSERT INTO public.lenders (provider, logo, product_type, amount_min, amount_max, min_years, min_monthly_turnover, vat_required, provinces_allowed, sector_exclusions, speed_days_min, speed_days_max, collateral_required, notes)
VALUES 
    ('Bridgement', '/logos/bridgement.svg', 'Working Capital', 250000, 1000000, 2, 200000, true, NULL, NULL, 3, 5, NULL, 'Fast approval for VAT-registered businesses with consistent cashflow'),
    
    ('Merchant Capital', '/logos/merchant-capital.svg', 'Merchant Cash Advance', 50000, 5000000, 1, 100000, false, NULL, NULL, 1, 2, NULL, 'Quick funding against future card sales, perfect for retail and hospitality'),
    
    ('Lulalend', '/logos/lulalend.svg', 'Term Loan', 20000, 2000000, 1, 50000, false, ARRAY['Gauteng', 'Western Cape', 'KZN'], NULL, 2, 3, NULL, 'Flexible terms for growing SMEs in major metros'),
    
    ('Retail Capital', '/logos/retail-capital.svg', 'Invoice Discounting', 100000, 10000000, 3, 500000, true, NULL, ARRAY['Hospitality'], 5, 7, NULL, 'Unlock cash from outstanding invoices for established B2B companies'),
    
    ('Fundrr', '/logos/fundrr.svg', 'Working Capital', 50000, 500000, 2, 150000, true, NULL, NULL, 3, 5, NULL, 'Transparent pricing with no hidden fees for working capital needs'),
    
    ('Spark Capital', '/logos/spark.svg', 'Asset Finance', 500000, 20000000, 5, 1000000, true, NULL, NULL, 10, 14, true, 'Equipment and vehicle financing for established businesses'),
    
    ('Grobank', '/logos/grobank.svg', 'Term Loan', 1000000, 50000000, 5, 2000000, true, NULL, ARRAY['Logistics', 'Manufacturing'], 14, 21, true, 'Traditional bank lending for qualified enterprises'),
    
    ('PayFast Capital', '/logos/payfast.svg', 'Merchant Cash Advance', 30000, 300000, 1, 80000, false, ARRAY['Gauteng', 'Western Cape'], NULL, 1, 2, NULL, 'Instant funding for PayFast merchants based on transaction history'),
    
    ('Business Partners', '/logos/business-partners.svg', 'Term Loan', 500000, 15000000, 3, 800000, true, NULL, NULL, 21, 30, NULL, 'Patient capital with mentorship for SME growth'),
    
    ('Finclusion', '/logos/finclusion.svg', 'Working Capital', 100000, 750000, 2, 250000, false, NULL, ARRAY['Retail'], 5, 7, NULL, 'Digital-first lending for service and logistics businesses');