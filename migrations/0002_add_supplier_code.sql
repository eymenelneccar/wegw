
ALTER TABLE suppliers ADD COLUMN supplier_code varchar UNIQUE;

-- Update existing suppliers with generated codes
UPDATE suppliers 
SET supplier_code = 'SUP-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 3, '0')
WHERE supplier_code IS NULL;

-- Make the column NOT NULL after setting values
ALTER TABLE suppliers ALTER COLUMN supplier_code SET NOT NULL;
