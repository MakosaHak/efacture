export type InvoiceStatus = 'pending' | 'validated' | 'rejected';

export interface Profile {
  id: string;
  nom_commerce: string;
  telephone: string;
  adresse: string;
  quartier: string;
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
}

export interface OCRRawData {
  provider?: string;
  confidence?: number;
  raw_text?: string;
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
