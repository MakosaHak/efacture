-- E-Facture — Schéma Supabase initial
-- Exécuter dans Supabase → SQL Editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom_commerce TEXT NOT NULL,
  telephone TEXT DEFAULT '',
  adresse TEXT DEFAULT '',
  quartier TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  market TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_id, name)
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name_raw TEXT DEFAULT '',
  invoice_date DATE,
  total_amount NUMERIC(12,2) DEFAULT 0,
  photo_path TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'validated', 'rejected')),
  ocr_raw_data JSONB DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoices_owner_created ON invoices(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit TEXT DEFAULT 'pièce',
  unit_price NUMERIC(12,2) DEFAULT 0,
  total_price NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY suppliers_all ON suppliers FOR ALL
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY invoices_all ON invoices FOR ALL
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY items_select ON invoice_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.owner_id = auth.uid()));

CREATE POLICY items_insert ON invoice_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.owner_id = auth.uid()));

CREATE POLICY items_update ON invoice_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.owner_id = auth.uid()));

CREATE POLICY items_delete ON invoice_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.owner_id = auth.uid()));

-- Bucket Storage : créer "invoice-photos" (privé) dans l'UI Supabase, puis :

-- CREATE POLICY "Users read own photos" ON storage.objects FOR SELECT
--   USING (bucket_id = 'invoice-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users upload own photos" ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'invoice-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users delete own photos" ON storage.objects FOR DELETE
--   USING (bucket_id = 'invoice-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Compte démo : créer dans Auth → demo@e-facture.app / demo-e-facture-2026
-- Puis insérer le profil :
-- INSERT INTO profiles (id, nom_commerce, quartier)
-- SELECT id, 'Épicerie Demo Adawlato', 'Adawlato' FROM auth.users WHERE email = 'demo@e-facture.app';
