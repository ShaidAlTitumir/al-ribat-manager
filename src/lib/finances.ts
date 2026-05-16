// src/lib/finances.ts
import { supabase } from './supabase';

export interface FinancialMetrics {
  bdtBalance: number;
  rmbBalance: number;
  inventoryValue: number;
  customerDue: number; // Accounts Receivable
  stockInTransit: number; // Pending Shipments
  totalAssets: number;
  totalLiabilities: number; // Accounts Payable
  businessValue: number;
  partnerShare: number;
}

export async function fetchFinancialMetrics(businessId: string, exchangeRate: number): Promise<FinancialMetrics> {
  const [
    { data: sales },
    { data: expenses },
    { data: capital },
    { data: distribution },
    { data: exchanges },
    { data: ledger },
    { data: inventory },
    { data: shipments },
    { data: purchases }
  ] = await Promise.all([
    supabase.from('sales').select('received_now_bdt_cents').eq('business_id', businessId),
    supabase.from('expenses').select('amount_cents, currency, exchange_rate_used').eq('business_id', businessId),
    supabase.from('capital_contributions').select('amount, currency').eq('business_id', businessId),
    supabase.from('partner_profit_distributions').select('amount_cents').eq('business_id', businessId),
    supabase.from('exchanges').select('*').eq('business_id', businessId),
    supabase.from('customer_ledger').select('amount_cents, transaction_type').eq('business_id', businessId),
    supabase.from('inventory_items').select('current_stock, last_landed_cost_cents').eq('business_id', businessId),
    supabase.from('shipments').select('total_shipping_cost_cents, status').eq('business_id', businessId).eq('status', 'in_transit'),
    supabase.from('purchase_transactions').select('total_landed_cost_bdt_cents, paid').eq('business_id', businessId)
  ]);

  let bdtCents = 0;
  let rmbCents = 0;

  // 1. Calculate Balances (Wallet logic)
  sales?.forEach(s => bdtCents += (s.received_now_bdt_cents || 0));
  
  ledger?.forEach(l => {
    if (l.transaction_type === 'payment') bdtCents += (l.amount_cents || 0);
    else if (l.transaction_type === 'return') bdtCents -= (l.amount_cents || 0);
  });

  capital?.forEach(c => {
    const amt = Math.round(parseFloat(c.amount || '0') * 100);
    if (c.currency === 'BDT') bdtCents += amt;
    else rmbCents += amt;
  });

  expenses?.forEach(e => {
    if (e.currency === 'BDT') bdtCents -= (e.amount_cents || 0);
    else rmbCents -= (e.amount_cents || 0); // User didn't specify converting RMB expense to BDT for the wallet balance, usually wallet is currency specific
  });

  exchanges?.forEach((ex: any) => {
    if (ex.from_currency === 'BDT') {
      bdtCents -= ex.amount_from_cents;
      rmbCents += ex.amount_to_cents;
    } else {
      rmbCents -= ex.amount_from_cents;
      bdtCents += ex.amount_to_cents;
    }
  });

  // 2. Inventory Value
  const inventoryValueCents = inventory?.reduce((acc, i) => acc + (i.current_stock * (i.last_landed_cost_cents || 0)), 0) || 0;

  // 3. Accounts Receivable (Customer Dues)
  // Fetching from customer_ledger instead of customers table might be more accurate or we can just fetch from customers
  // Dashboard used customers.current_due_cents. Let's stick to that for simplicity if available.
  const { data: customerDues } = await supabase.from('customers').select('total_due_cents').eq('business_id', businessId);
  const totalCustomerDueCents = customerDues?.reduce((acc, c) => acc + (c.total_due_cents || 0), 0) || 0;

  // 4. Pending Shipments
  const pendingShipmentsValueCents = shipments?.reduce((acc, s) => acc + (s.total_shipping_cost_cents || 0), 0) || 0;

  // 5. Total Liabilities (Accounts Payable)
  const accountsPayableCents = purchases?.filter(p => !p.paid).reduce((acc, p) => acc + (p.total_landed_cost_bdt_cents || 0), 0) || 0;

  // Final Calculations
  const bdtBalance = bdtCents / 100;
  const rmbBalance = rmbCents / 100;
  const inventoryValue = inventoryValueCents / 100;
  const customerDue = totalCustomerDueCents / 100;
  const stockInTransit = pendingShipmentsValueCents / 100;
  const totalLiabilities = accountsPayableCents / 100;

  // Total Assets = BDT Balance + (RMB Balance × BDT Exchange Rate) + Inventory Value + Accounts Receivable + Pending Shipments
  const rmbInBDT = rmbBalance * exchangeRate;
  const totalAssets = bdtBalance + rmbInBDT + inventoryValue + customerDue + stockInTransit;

  // Business Value = Total Assets − Total Liabilities
  const businessValue = totalAssets - totalLiabilities;

  // Partner Share = Business Value / 3
  const partnerShare = businessValue / 3;

  return {
    bdtBalance,
    rmbBalance,
    inventoryValue,
    customerDue,
    stockInTransit,
    totalAssets,
    totalLiabilities,
    businessValue,
    partnerShare
  };
}
