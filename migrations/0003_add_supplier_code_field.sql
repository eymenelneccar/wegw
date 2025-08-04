
-- Add supplier_code column to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplier_code VARCHAR;

-- Add unique constraint
ALTER TABLE suppliers ADD CONSTRAINT suppliers_supplier_code_unique UNIQUE (supplier_code);

-- Update existing suppliers with default codes
UPDATE suppliers 
SET supplier_code = 'SUP-' || LPAD((ROW_NUMBER() OVER (ORDER BY created_at))::text, 3, '0')
WHERE supplier_code IS NULL;

-- Make supplier_code NOT NULL
ALTER TABLE suppliers ALTER COLUMN supplier_code SET NOT NULL;
