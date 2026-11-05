-- Montant final réel d'une facture = montant lu sur le reçu + transport saisi à la main.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS montant_final_reel NUMERIC(12,2)
    GENERATED ALWAYS AS (COALESCE(total_amount, 0) + COALESCE(transport_fee, 0)) STORED;

-- Rattache les factures existantes à leur fiche fournisseur (supplier_id n'était pas renseigné).
UPDATE invoices i
SET supplier_id = s.id
FROM suppliers s
WHERE i.supplier_id IS NULL
  AND s.owner_id = i.owner_id
  AND lower(trim(s.name)) = lower(trim(i.supplier_name_raw))
  AND trim(i.supplier_name_raw) <> '';

CREATE INDEX IF NOT EXISTS invoices_supplier ON invoices(supplier_id);
