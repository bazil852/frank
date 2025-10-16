-- Add new columns to lenders table for SA director requirements and repayment descriptions
-- Migration: Add SA director and repayment description columns

ALTER TABLE lenders 
ADD COLUMN sa_director_required BOOLEAN DEFAULT false,
ADD COLUMN repayment_description TEXT;

-- Add comments for clarity
COMMENT ON COLUMN lenders.sa_director_required IS 'Whether lender requires at least one South African director';
COMMENT ON COLUMN lenders.repayment_description IS 'Description of how repayment works (e.g., "Fixed monthly installments", "% of daily card sales", "Weekly debit orders")';

-- Update existing records with default values
UPDATE lenders SET sa_director_required = true WHERE sa_director_required IS NULL;

-- Example updates for common repayment descriptions (you can customize these)
UPDATE lenders SET repayment_description = 'Fixed monthly installments over agreed term' WHERE product_type = 'Term Loan' AND repayment_description IS NULL;
UPDATE lenders SET repayment_description = '% of daily card sales until paid off' WHERE product_type = 'Merchant Cash Advance' AND repayment_description IS NULL;
UPDATE lenders SET repayment_description = 'Fixed weekly or monthly debit orders' WHERE product_type = 'Working Capital' AND repayment_description IS NULL;
UPDATE lenders SET repayment_description = 'Advance against invoices, repaid when customer pays' WHERE product_type = 'Invoice Discounting' AND repayment_description IS NULL;
UPDATE lenders SET repayment_description = 'Fixed monthly payments secured against asset' WHERE product_type = 'Asset Finance' AND repayment_description IS NULL;
UPDATE lenders SET repayment_description = '% of monthly revenue until target multiple reached' WHERE product_type = 'Revenue-Based Finance' AND repayment_description IS NULL;