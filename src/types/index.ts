// src/types/index.ts

export type Currency = 'BDT' | 'RMB';

export interface Business {
  id: string;
  name: string;
  owner_id: string;
  exchange_rate: number;
  business_type: 'solo' | 'partnership';
  phone?: string;
  address?: string;
  email?: string;
  created_at: string;
}

export interface Profile {
  id: string;
  business_id: string | null;
  role: 'admin' | 'user' | 'owner';
  full_name: string;
  username: string;
  phone: string;
  created_at: string;
}

export interface Partner {
  id: string;
  business_id: string;
  user_id: string | null;
  name: string;
  profit_share: number;
  balance_cents: number;
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
}

export interface InventoryItem {
  id: string;
  business_id: string;
  sku: string;
  name: string;
  category: string;
  supplier: string;
  description: string;
  unit: string;
  weight_per_unit: number;
  current_stock: number;
  low_stock_threshold: number;
  default_selling_price_cents: number;
  last_landed_cost_cents: number;
  created_at: string;
}

export interface Sale {
  id: string;
  business_id: string;
  invoice_no: string;
  customer_id: string | null;
  item_id: string;
  quantity: number;
  unit_price_bdt_cents: number;
  discount_cents: number;
  total_cents: number;
  received_now_bdt_cents: number;
  due_cents: number;
  expected_profit_cents: number;
  cost_rate_cents: number;
  payment_method: string;
  notes: string;
  created_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  user_id: string;
  name: string;
  shop_name: string;
  phone: string;
  address: string;
  total_due_cents: number;
  created_at: string;
}

export interface Supplier {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  wechat: string;
  location: string;
  shop_name: string;
  shop_link: string;
  products_list: string;
  notes: string;
  created_at: string;
}

export interface Expense {
  id: string;
  business_id: string;
  title: string;
  category: string;
  amount_cents: number;
  currency: Currency;
  created_at: string;
}

export interface Exchange {
  id: string;
  business_id: string;
  from_currency: Currency;
  to_currency: Currency;
  amount_from_cents: number;
  amount_to_cents: number;
  rate: number;
  created_at: string;
}

export interface PartnerTransfer {
  id: string;
  business_id: string;
  from_partner_id: string;
  to_partner_id: string;
  amount_cents: number;
  currency: Currency;
  method: string;
  transaction_id: string;
  notes: string;
  created_at: string;
}
