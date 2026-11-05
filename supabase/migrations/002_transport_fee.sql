-- Frais de transport / logistique (payés de main à main, saisis à la validation)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS transport_fee NUMERIC(12,2) DEFAULT 0;
