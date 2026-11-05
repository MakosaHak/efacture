export type InvoiceStatus = 'pending' | 'validated' | 'rejected';

export interface Profile {
  id: string;
  nom_commerce: string;
  telephone: string;
  adresse: string;
  quartier: string;
  /** Marge bénéficiaire par défaut en % (15 = 15 %). */
  marge_beneficiaire_defaut?: number;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  owner_id: string;
  supplier_id: string | null;
  supplier_name_raw: string;
  invoice_date: string | null;
  total_amount: number;
  transport_fee?: number;
  photo_path: string;
  status: InvoiceStatus;
  ocr_raw_data: OCRRawData;
  notes: string;
  created_at: string;
  updated_at: string;
  invoice_items?: InvoiceItem[];
}

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  frais_transport_attribues?: number | null;
  cout_de_revient_unitaire?: number | null;
  prix_de_vente_conseille?: number | null;
}

/** Dernier prix d'achat connu d'un produit (alerte de hausse). */
export interface LastPurchasePrice {
  unit_price: number;
  date: string;
  supplier_name_raw: string;
}

export interface OCRRawData {
  provider?: string;
  confidence?: number;
  raw_text?: string;
  transport_fee?: number;
}

export interface OCRResult {
  provider: string;
  raw_text: string;
  confidence: number;
  supplier_name: string;
  invoice_date: string;
  total_amount: string;
  items: OCRItem[];
}

export interface OCRItem {
  product_name: string;
  quantity: string;
  unit: string;
  unit_price: string;
  total_price: string;
}

export interface MonthlyKpis {
  total_spent: number;
  invoice_count: number;
  avg_amount: number;
}

export interface SpendingTotals {
  day: number;
  week: number;
  month: number;
}

export interface PriceAlert {
  product_name: string;
  first_price: number;
  last_price: number;
  change_pct: number;
}

export interface PriceEvolutionPoint {
  month: string;
  avg_price: number;
  count: number;
}

export interface SupplierSpending {
  supplier_name_raw: string;
  total: number;
  count: number;
}

export interface TopProduct {
  product_name: string;
  total_qty: number;
  avg_price: number;
  purchase_count: number;
}

export interface SupplierPriceForecast {
  name: string;
  last_price: number;
  predicted_price: number;
  monthly_pct: number;
  n: number;
}

export interface ProductForecast {
  product_name: string;
  last_price: number;
  predicted_price: number;
  monthly_pct: number;
  slope: number;
  r2: number;
  n: number;
  best_supplier: string | null;
  by_supplier: SupplierPriceForecast[];
}

export interface SpendingForecast {
  history: { month: string; total: number }[];
  predicted_month: string;
  predicted_total: number;
  avg_3m: number;
  inflation_pct: number;
  slope: number;
  r2: number;
  n: number;
  summary: string;
}

export interface ProductSaving {
  product_name: string;
  qty: number;
  actual_spent: number;
  optimized_spent: number;
  savings: number;
  cheapest_supplier: string;
  cheapest_unit_price: number;
  suppliers: { name: string; avg_price: number; qty: number }[];
}

export interface FinancialOptimization {
  actual_spent: number;
  optimized_spent: number;
  potential_savings: number;
  savings_pct: number;
  unnamed_count: number;
  products: ProductSaving[];
  advice: string[];
  recommended_supplier: string | null;
  predicted_savings_pct: number;
  recommendation: string | null;
}
