-- Prix de vente suggérés : marge globale du commerçant + marge apprise par produit.
-- (Nommée 005 car 002_transport_fee.sql existe déjà ; 001 n'est pas modifiée.)

-- Marge globale par défaut (0.15 = 15 %).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS default_margin NUMERIC NOT NULL DEFAULT 0.15;

CREATE TABLE IF NOT EXISTS product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_key TEXT NOT NULL,
  product_name TEXT NOT NULL,
  margin NUMERIC,                       -- marge apprise ; NULL tant que jamais confirmée
  last_purchase_price NUMERIC,
  previous_purchase_price NUMERIC,
  suggested_price NUMERIC,
  selling_price NUMERIC,                -- NULL tant que jamais confirmé
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
  confirmations INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_id, product_key)
);

CREATE INDEX IF NOT EXISTS product_prices_owner_status ON product_prices(owner_id, status);

ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_prices_select ON product_prices FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY product_prices_insert ON product_prices FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY product_prices_update ON product_prices FOR UPDATE
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY product_prices_delete ON product_prices FOR DELETE USING (owner_id = auth.uid());

-- Nettoyage : l'ancien calcul automatique des prix sur invoice_items (brouillon 003, retiré)
-- est remplacé par ce module. Sans effet si 003 n'a jamais été exécutée.
DROP TRIGGER IF EXISTS invoice_items_pricing ON invoice_items;
DROP FUNCTION IF EXISTS fill_invoice_item_pricing();
DROP FUNCTION IF EXISTS round_up_price(NUMERIC, NUMERIC);
