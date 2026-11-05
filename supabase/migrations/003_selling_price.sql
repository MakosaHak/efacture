-- Prix de vente unitaire conseillé
-- Coût de revient = prix d'achat + part du transport (au prorata du montant de la ligne),
-- prix de vente conseillé = coût de revient × (1 + marge %), arrondi au palier de 50 FCFA supérieur.
-- Miroir serveur de src/lib/pricing.ts : le client envoie déjà les valeurs ; le trigger
-- ne complète que les colonnes laissées à NULL (anciens clients, insertions directes).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS marge_beneficiaire_defaut NUMERIC(6,2) NOT NULL DEFAULT 15.0
    CHECK (marge_beneficiaire_defaut >= 0 AND marge_beneficiaire_defaut <= 1000);

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS frais_transport_attribues NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS cout_de_revient_unitaire NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS prix_de_vente_conseille NUMERIC(12,2);

-- Historique des prix d'achat par produit (alerte de hausse)
CREATE INDEX IF NOT EXISTS invoice_items_product_lower ON invoice_items (lower(product_name));

CREATE OR REPLACE FUNCTION round_up_price(amount NUMERIC, step NUMERIC DEFAULT 50)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN amount <= 0 THEN 0 ELSE CEIL(amount / step) * step END;
$$;

CREATE OR REPLACE FUNCTION fill_invoice_item_pricing()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_total NUMERIC;
  v_transport NUMERIC;
  v_margin NUMERIC;
  v_sous_total NUMERIC;
  v_part NUMERIC;
BEGIN
  SELECT COALESCE(i.total_amount, 0), COALESCE(i.transport_fee, 0), COALESCE(p.marge_beneficiaire_defaut, 15)
    INTO v_total, v_transport, v_margin
  FROM invoices i
  JOIN profiles p ON p.id = i.owner_id
  WHERE i.id = NEW.invoice_id;

  v_sous_total := COALESCE(NEW.quantity, 0) * COALESCE(NEW.unit_price, 0);

  -- Montant facture illisible : on se rabat sur la somme des lignes déjà connues.
  IF v_total IS NULL OR v_total <= 0 THEN
    SELECT COALESCE(SUM(quantity * unit_price), 0) + v_sous_total INTO v_total
    FROM invoice_items WHERE invoice_id = NEW.invoice_id AND id IS DISTINCT FROM NEW.id;
  END IF;

  v_part := CASE WHEN v_total > 0 THEN (v_sous_total / v_total) * COALESCE(v_transport, 0) ELSE 0 END;

  IF NEW.frais_transport_attribues IS NULL THEN
    NEW.frais_transport_attribues := ROUND(v_part, 2);
  END IF;

  IF NEW.cout_de_revient_unitaire IS NULL THEN
    NEW.cout_de_revient_unitaire := ROUND(
      COALESCE(NEW.unit_price, 0)
        + CASE WHEN COALESCE(NEW.quantity, 0) > 0 THEN NEW.frais_transport_attribues / NEW.quantity ELSE 0 END,
      2);
  END IF;

  IF NEW.prix_de_vente_conseille IS NULL THEN
    NEW.prix_de_vente_conseille :=
      round_up_price(NEW.cout_de_revient_unitaire * (1 + COALESCE(v_margin, 15) / 100));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_items_pricing ON invoice_items;
CREATE TRIGGER invoice_items_pricing
  BEFORE INSERT OR UPDATE OF quantity, unit_price, frais_transport_attribues, cout_de_revient_unitaire, prix_de_vente_conseille
  ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION fill_invoice_item_pricing();
