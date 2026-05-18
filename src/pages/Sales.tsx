// src/pages/Sales.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, Search, Plus, Filter, ArrowUpRight, 
  Receipt, User, CreditCard, ChevronDown, CheckCircle2,
  Trash2, FileText, Printer, MoreVertical, X, Info, AlertCircle,
  ShoppingBag,
  TrendingUp,
  Download,
  History as HistoryIcon
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatBDT, formatDate } from '../lib/utils';
import { logActivity } from '../lib/activity';
import { InventoryItem, Customer } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';

export default function Sales() {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  
  // New Sale Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');
  const [totalPrice, setTotalPrice] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [receivedNow, setReceivedNow] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync Total Price when Quantity or Unit Price changes
  useEffect(() => {
    const q = parseFloat(quantity) || 0;
    const p = parseFloat(unitPrice) || 0;
    setTotalPrice((q * p).toFixed(2));
  }, [quantity, unitPrice]);

  const handleTotalPriceChange = (val: string) => {
    setTotalPrice(val);
    const q = parseFloat(quantity) || 1;
    const tp = parseFloat(val) || 0;
    setUnitPrice((tp / q).toFixed(2));
  };

  // Edit/Delete State
  const [saleToEdit, setSaleToEdit] = useState<any>(null);
  const [saleToDelete, setSaleToDelete] = useState<any>(null);
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);

  useScrollLock(!!saleToEdit || !!saleToDelete);

  // Fetch Data
  const { data: items = [] } = useQuery({
    queryKey: ['inventory', business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_items').select('*').eq('business_id', business?.id).gt('current_stock', 0);
      if (error) throw error;
      return data as InventoryItem[];
    },
    enabled: !!business?.id,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*').eq('business_id', business?.id);
      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!business?.id,
  });

  const { data: sales = [], isPending: isLoadingSales } = useQuery({
    queryKey: ['sales', business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*, customers(name, phone, shop_name, address), inventory_items(name)')
        .eq('business_id', business?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const [historySearchTerm, setHistorySearchTerm] = useState('');

  // Calculate Sale
  const selectedItem = items.find(i => i.id === selectedItemId);
  const qty = parseInt(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  const disc = parseFloat(discount) || 0;
  const paid = parseFloat(receivedNow) || 0;

  const subtotal = qty * price;
  const total = subtotal - disc;
  const due = Math.max(0, total - paid);
  
  // Profit calculation
  const landedCost = selectedItem?.last_landed_cost_cents || 0;
  const estProfit = (Math.round(price * 100) - landedCost) * qty - Math.round(disc * 100);

  const filteredSales = useMemo(() => {
    if (!historySearchTerm.trim()) return sales;
    const term = historySearchTerm.toLowerCase();
    return sales.filter((sale: any) => {
      const invNo = (sale.invoice_no || '').toLowerCase();
      const custName = (sale.customers?.name || '').toLowerCase();
      const custPhone = (sale.customers?.phone || '').toLowerCase();
      const shopName = (sale.customers?.shop_name || '').toLowerCase();
      
      return invNo.includes(term) || 
             custName.includes(term) || 
             custPhone.includes(term) || 
             shopName.includes(term);
    });
  }, [sales, historySearchTerm]);

  useEffect(() => {
    if (selectedItem) {
      setUnitPrice((selectedItem.default_selling_price_cents / 100).toString());
    }
  }, [selectedItemId, selectedItem]);

  const mutation = useMutation({
    mutationFn: async () => {
      setError(null);
      setSuccess(null);
      
      if (!selectedItemId) throw new Error('Please select an item');
      if (qty <= 0) throw new Error('Quantity must be greater than zero');
      if (!business?.id) throw new Error('Business context not found');
      
      const invoiceNo = `INV-${Date.now()}`;
      
      // 1. Create Sale
      const { data: sale, error: sError } = await supabase.from('sales').insert({
        business_id: business.id,
        user_id: user?.id,
        invoice_no: invoiceNo,
        customer_id: selectedCustomerId || null,
        item_id: selectedItemId,
        quantity: qty,
        unit_price_bdt_cents: Math.round(price * 100),
        discount_cents: Math.round(disc * 100),
        total_cents: Math.round(total * 100),
        received_now_bdt_cents: Math.round(paid * 100),
        due_cents: Math.round(due * 100),
        cost_rate_cents: landedCost,
        expected_profit_cents: estProfit,
        payment_method: paymentMethod,
        notes: notes
      }).select().single();

      if (sError) throw sError;

      // 2. Decrement Stocks
      const { error: rpcError } = await supabase.rpc('decrement_inventory_stock', { item_id: selectedItemId, amount: qty });
      if (rpcError) throw rpcError;

      // 3. Update Customer Ledger if needed
      if (due > 0 && selectedCustomerId) {
        const { error: lError } = await supabase.from('customer_ledger').insert({
          business_id: business.id,
          user_id: user?.id,
          customer_id: selectedCustomerId,
          transaction_type: 'sale',
          amount_cents: Math.round(due * 100),
          reference_id: sale.id
        });
        if (lError) throw lError;

        // Update Customer Total Due
        const currentCustomer = customers.find(c => c.id === selectedCustomerId);
        const newDue = (currentCustomer?.total_due_cents || 0) + Math.round(due * 100);
        await supabase.from('customers').update({ total_due_cents: newDue }).eq('id', selectedCustomerId);
      }

      // 4. Partner Profit Distribution (Accrual Basis - Full Profit Realized upon Sale)
      if (estProfit > 0) {
        // Distribute the entire estimated profit immediately as it is "earned" upon selling
        const realizedProfit = estProfit;
        
        if (realizedProfit > 0) {
          // Fetch current partners and their capital contributions to determine share ratio
          const [
            { data: currentPartners },
            { data: capitalContributions }
          ] = await Promise.all([
            supabase.from('partners').select('*').eq('business_id', business.id).eq('status', 'active'),
            supabase.from('capital_contributions').select('*').eq('business_id', business.id)
          ]);

          if (currentPartners && currentPartners.length > 0) {
            // Calculate actual capital for each partner in BDT
            const partnerCapitalMap: Record<string, number> = {};
            let totalBusinessCapital = 0;

            capitalContributions?.forEach(cap => {
              const amount = parseFloat(cap.amount || '0');
              const amountBDT = cap.currency === 'RMB' ? amount * (business.exchange_rate || 1) : amount;
              partnerCapitalMap[cap.partner_id] = (partnerCapitalMap[cap.partner_id] || 0) + amountBDT;
              totalBusinessCapital += amountBDT;
            });

            const distributions = currentPartners.map(p => {
              const partnerCapital = partnerCapitalMap[p.id] || 0;
              const shareRatio = totalBusinessCapital > 0 ? partnerCapital / totalBusinessCapital : 0;
              const share = shareRatio * realizedProfit;
              
              return {
                business_id: business.id,
                partner_id: p.id,
                sale_id: sale.id,
                amount_cents: Math.floor(share),
                notes: `Profit from Sale ${invoiceNo} (Cap share: ${(shareRatio * 100).toFixed(2)}%)`
              };
            }).filter(d => d.amount_cents > 0);

            if (distributions.length > 0) {
              await supabase.from('partner_profit_distributions').insert(distributions);
              
              // Update partner balances
              for (const dist of distributions) {
                await supabase.rpc('increment_partner_balance', { 
                  p_id: dist.partner_id, 
                  amount_cents: dist.amount_cents 
                });
              }

              // Track distributed profit on sale
              await supabase.from('sales').update({
                distributed_profit_cents: realizedProfit
              }).eq('id', sale.id);
            }
          }
        }
      }

      await logActivity({
        business_id: business.id,
        user_id: user?.id,
        action: 'NEW_SALE',
        details: {
          title: `New Sale: ${selectedItem?.name || 'Item'}`,
          sub: `Invoice #${invoiceNo}`,
          amount: `+৳${total.toLocaleString()}`,
          type: 'sale'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      setSuccess('Sale confirmed successfully!');
      setTimeout(() => {
        setActiveTab('history');
        setSuccess(null);
      }, 1500);
      
      // Reset form
      setSelectedItemId('');
      setQuantity('1');
      setReceivedNow('0');
      setDiscount('0');
      setNotes('');
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to process sale');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (sale: any) => {
      // 1. Restore inventory
      await supabase.rpc('increment_inventory_stock', { item_id: sale.item_id, amount: sale.quantity });
      
      // 2. Remove ledger entry
      await supabase.from('customer_ledger').delete().eq('reference_id', sale.id);

      // Restore Customer Balance
      if (sale.due_cents > 0 && sale.customer_id) {
         const { data: customer } = await supabase.from('customers').select('total_due_cents').eq('id', sale.customer_id).single();
         if (customer) {
            await supabase.from('customers').update({ 
               total_due_cents: Math.max(0, customer.total_due_cents - sale.due_cents) 
            }).eq('id', sale.customer_id);
         }
      }
      
      // 3. Delete sale
      // First, get distributions to reverse balance
      const { data: distributions } = await supabase
        .from('partner_profit_distributions')
        .select('*')
        .eq('sale_id', sale.id);

      if (distributions && distributions.length > 0) {
        for (const dist of distributions) {
          await supabase.rpc('increment_partner_balance', { 
            p_id: dist.partner_id, 
            amount_cents: -dist.amount_cents 
          });
        }
        await supabase.from('partner_profit_distributions').delete().eq('sale_id', sale.id);
      }

      const { error } = await supabase.from('sales').delete().eq('id', sale.id);
      if (error) throw error;

      // Log Activity
      await logActivity({
        business_id: business?.id || '',
        user_id: user?.id,
        action: 'DELETE_SALE',
        details: {
          title: `Deleted Sale: ${sale.invoice_no}`,
          sub: 'Transaction Voided',
          amount: `-${formatBDT(sale.total_cents)}`,
          type: 'sale'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      setSaleToDelete(null);
    }
  });

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex border-b border-slate-100 mb-4">
          <button 
            onClick={() => setActiveTab('new')}
            className={`flex-1 py-3 text-sm font-semibold uppercase tracking-widest transition-all relative ${activeTab === 'new' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            New Sale
            {activeTab === 'new' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-sm font-semibold uppercase tracking-widest transition-all relative ${activeTab === 'history' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            Order History
            {activeTab === 'history' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {!business && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 border border-amber-100 p-6 rounded-[32px] flex items-center gap-6 mb-6"
            >
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-900">Experience Restricted</h3>
                <p className="text-sm font-medium text-amber-700 mt-1 leading-relaxed max-w-2xl">
                  You are currently in demo mode. To create real invoices and track your actual sales profit, you need to connect your business first.
                </p>
                <button 
                  onClick={() => navigate('/onboarding')}
                  className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-amber-200 active:scale-95 transition-all"
                >
                  Setup Business Now
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'new' ? (
            <motion.div 
              key="new"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-4"
            >
              {/* Form Section */}
              <div className="lg:col-span-2 space-y-3">
                 <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
                       <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                         <ShoppingBag className="w-3.5 h-3.5" />
                       </div>
                       <h2 className="text-xs lg:text-sm font-bold uppercase tracking-widest text-slate-900">Sale Details</h2>
                    </div>
                    <div className="p-4 space-y-4 text-left">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex items-end gap-2">
                             <SelectInput 
                               label="Customer" 
                               value={selectedCustomerId} 
                               onChange={setSelectedCustomerId} 
                               options={customers.map(c => ({ value: c.id, label: `${c.name} - Due: ${formatBDT(c.total_due_cents || 0)}` }))}
                               placeholder="Walk-in Customer"
                             />
                             <button 
                               type="button"
                               onClick={() => setIsAddCustomerModalOpen(true)}
                               className="h-10 px-3 bg-blue-50 text-blue-600 rounded-lg border border-slate-100 hover:bg-blue-100 transition-all flex items-center justify-center shrink-0 mb-[1px]"
                               title="Add New Customer"
                             >
                               <Plus className="w-4 h-4" />
                             </button>
                          </div>
                          <SelectInput 
                            label="Product" 
                            value={selectedItemId} 
                            onChange={setSelectedItemId} 
                            options={items.map(i => ({ value: i.id, label: `${i.name} (Stk: ${i.current_stock})` }))}
                            placeholder="Choose item..."
                          />
                       </div>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <Input label="Quantity" type="number" value={quantity} onChange={setQuantity} />
                          <Input label="Unit Price" type="number" value={unitPrice} onChange={setUnitPrice} />
                          <Input label="Total Price" type="number" value={totalPrice} onChange={handleTotalPriceChange} />
                          <Input label="Discount" type="number" value={discount} onChange={setDiscount} />
                       </div>
                       <div className="grid grid-cols-3 gap-2 md:gap-3">
                          <Input label="Received" type="number" value={receivedNow} onChange={setReceivedNow} />
                          <div className="space-y-1 text-left">
                             <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Subtotal</label>
                             <div className="h-10 px-2 flex items-center bg-slate-50 border border-slate-100 rounded-lg font-mono font-bold text-slate-900 border-dashed border-slate-200 overflow-hidden whitespace-nowrap text-[11px] md:text-sm">
                                {formatBDT(subtotal * 100)}
                             </div>
                          </div>
                          <SelectInput 
                             label="Method" 
                             value={paymentMethod} 
                             onChange={setPaymentMethod} 
                             options={[
                               { value: 'cash', label: 'Cash' },
                               { value: 'bkash', label: 'bKash' },
                               { value: 'nagad', label: 'Nagad' },
                               { value: 'bank', label: 'Bank' },
                             ]}
                          />
                       </div>
                       <div className="space-y-1">
                          {/* Notes label removed */}
                          <textarea 
                            className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-base md:text-sm font-medium min-h-[60px]"
                            placeholder="Transaction notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                          />
                       </div>
                    </div>
                 </section>
              </div>

              {/* Summary Sticky Section */}
              <div className="space-y-4">
                 <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5 sticky top-16">
                    <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest border-b border-slate-50 pb-3">Checkout</h3>
                    
                    <div className="space-y-2.5">
                       <SummaryRow label="Subtotal" value={formatBDT(subtotal * 100)} />
                       <SummaryRow label="Discount" value={`- ${formatBDT(disc * 100)}`} color="text-red-500" />
                       <div className="h-px bg-slate-100 my-1.5" />
                       <SummaryRow label="Total" value={formatBDT(total * 100)} total />
                       <SummaryRow label="Paid" value={formatBDT(paid * 100)} color="text-emerald-600" />
                       {selectedCustomerId && (
                         <SummaryRow 
                           label="Previous Due" 
                           value={formatBDT(customers.find(c => c.id === selectedCustomerId)?.total_due_cents || 0)} 
                           color="text-red-400" 
                         />
                       )}
                       <SummaryRow label="Due" value={formatBDT(due * 100)} color={due > 0 ? "text-red-500" : "text-slate-400"} />
                       {selectedCustomerId && due > 0 && (
                         <SummaryRow 
                           label="Total Balance" 
                           value={formatBDT((customers.find(c => c.id === selectedCustomerId)?.total_due_cents || 0) + (due * 100))} 
                           total 
                         />
                       )}
                    </div>

                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">Profit</span>
                       </div>
                       <span className={`font-mono font-bold text-xs ${estProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                         ৳{(estProfit / 100).toLocaleString()}
                       </span>
                    </div>

                    {error && (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-[10px] font-bold uppercase">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {error}
                      </div>
                    )}
                    
                    <button 
                      onClick={() => business ? mutation.mutate() : navigate('/onboarding')}
                      disabled={mutation.isPending}
                      className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-[0.15em] shadow-lg shadow-blue-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {mutation.isPending ? 'Working...' : (business ? 'Finish Sale' : 'Setup Business')}
                    </button>
                    
                    <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-tight">One-click invoice generation</p>
                 </section>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* History Search Bar */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input 
                  type="text"
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  placeholder="Search by invoice, name, phone or shop..."
                  className="block w-full pl-11 pr-4 py-3.5 bg-white border border-slate-100 rounded-2xl text-sm font-semibold text-slate-900 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/20 outline-none transition-all shadow-sm placeholder:text-slate-400 placeholder:font-medium"
                />
              </div>

              <div className="space-y-3">
                {filteredSales.map((sale: any) => (
                  <div key={sale.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-blue-100 transition-all">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                       <Receipt className="w-4 h-4" />
                     </div>
                     <div className="text-left">
                        <h4 className="text-sm lg:text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{sale.invoice_no}</h4>
                        <p className="text-xs lg:text-sm font-medium text-slate-400 uppercase tracking-widest mt-0.5">
                          {sale.customers?.name || 'Walk-in'} • {formatDate(sale.created_at)}
                        </p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="text-right">
                        <p className="text-sm lg:text-base font-mono font-bold text-slate-900 tracking-tighter">{formatBDT(sale.total_cents)}</p>
                        {sale.due_cents > 0 ? (
                          <span className="text-xs lg:text-sm font-semibold text-red-500 uppercase tracking-tight">৳{(sale.due_cents/100).toLocaleString()} Due</span>
                        ) : (
                          <span className="inline-flex h-4 items-center px-1.5 bg-emerald-50 text-emerald-500 text-[11px] lg:text-xs font-semibold uppercase rounded">Paid</span>
                        )}
                     </div>
                     <button 
                       onClick={() => {
                         if (business) {
                           const saleData = {
                             invoiceNo: sale.invoice_no,
                             date: sale.created_at, // Pass ISO string
                             items: [
                               {
                                 name: sale.inventory_items?.name || 'Product',
                                 quantity: sale.quantity,
                                 unitPrice: sale.unit_price_bdt_cents / 100,
                                 total: (sale.unit_price_bdt_cents * sale.quantity) / 100
                               }
                             ],
                             subtotal: (sale.unit_price_bdt_cents * sale.quantity) / 100,
                             discount: sale.discount_cents / 100,
                             total: sale.total_cents / 100,
                             received: (sale.total_cents - sale.due_cents) / 100,
                             due: sale.due_cents / 100
                           };
                           
                           const customerInfo = {
                             name: sale.customers?.name || 'Walk-in Customer',
                             phone: sale.customers?.phone || '',
                             address: sale.customers?.address || '',
                             shopName: sale.customers?.shop_name || ''
                           };
                           
                           const businessInfo = {
                             name: business.name,
                             phone: business.phone || '',
                             address: business.address || '',
                             email: business.email || ''
                           };
                           
                           import('../lib/pdfGenerator').then(module => {
                             module.generateSaleInvoice(businessInfo, customerInfo, saleData);
                           });
                         }
                       }}
                       className="p-2 bg-white text-slate-400 rounded-xl hover:text-blue-600 hover:shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                       title="Download Invoice"
                     >
                        <Download className="w-4 h-4" />
                     </button>
                     <div className="relative">
                        <button 
                          onClick={() => setShowOptionsId(showOptionsId === sale.id ? null : sale.id)}
                          className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:text-slate-700 active:scale-95 transition-all"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                        
                        {showOptionsId === sale.id && (
                          <div className="absolute right-0 mt-2 w-36 bg-white rounded-2xl border border-slate-100 shadow-xl z-20 py-2 overflow-hidden animate-in fade-in zoom-in duration-200">
                             <button 
                               onClick={() => {
                                 if (business) {
                                   const saleData = {
                                     invoiceNo: sale.invoice_no,
                                     date: sale.created_at, // Pass raw ISO
                                     items: [
                                       {
                                         name: sale.inventory_items?.name || 'Product',
                                         quantity: sale.quantity,
                                         unitPrice: sale.unit_price_bdt_cents / 100,
                                         total: (sale.unit_price_bdt_cents * sale.quantity) / 100
                                       }
                                     ],
                                     subtotal: (sale.unit_price_bdt_cents * sale.quantity) / 100,
                                     discount: sale.discount_cents / 100,
                                     total: sale.total_cents / 100,
                                     received: (sale.total_cents - sale.due_cents) / 100,
                                     due: sale.due_cents / 100
                                   };
                                   
                                   const customerInfo = {
                                     name: sale.customers?.name || 'Walk-in Customer',
                                     phone: sale.customers?.phone || '',
                                     address: sale.customers?.address || '',
                                     shopName: sale.customers?.shop_name || ''
                                   };
                                   
                                   const businessInfo = {
                                     name: business.name,
                                     phone: business.phone || '',
                                     address: business.address || '',
                                     email: business.email || ''
                                   };
                                   
                                   import('../lib/pdfGenerator').then(module => {
                                     module.generateSaleInvoice(businessInfo, customerInfo, saleData);
                                   });
                                 }
                                 setShowOptionsId(null);
                               }}
                               className="w-full px-4 py-2 text-left text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                             >
                                <Printer className="w-3.5 h-3.5" /> Invoice
                             </button>
                             <button 
                               onClick={() => { setSaleToEdit(sale); setShowOptionsId(null); }}
                               className="w-full px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                             >
                                <FileText className="w-3.5 h-3.5" /> Edit
                             </button>
                             <button 
                               onClick={() => { setSaleToDelete(sale); setShowOptionsId(null); }}
                               className="w-full px-4 py-2 text-left text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2"
                             >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                             </button>
                          </div>
                        )}
                     </div>
                  </div>
                </div>
              ))}
              </div>

              {filteredSales.length === 0 && !isLoadingSales && (
                <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                  <HistoryIcon className="w-16 h-16 mb-4 opacity-10" />
                  <p className="text-xs font-bold uppercase tracking-widest">
                    {historySearchTerm ? `No results for "${historySearchTerm}"` : 'No sale history'}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {saleToDelete && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSaleToDelete(null)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95, y: 20 }}
                 animate={{ opacity: 1, scale: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.95, y: 20 }}
                 className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl relative overflow-hidden z-10 p-8 text-center"
               >
                 <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Trash2 className="w-8 h-8" />
                 </div>
                 <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Delete Sale?</h2>
                 <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                    Invoice <span className="font-bold text-slate-900">#{saleToDelete.invoice_no}</span> will be permanently removed. Inventory and ledger will be reverted.
                 </p>
                 <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => deleteMutation.mutate(saleToDelete)}
                      disabled={deleteMutation.isPending}
                      className="w-full h-14 bg-red-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete Sale'}
                    </button>
                    <button onClick={() => setSaleToDelete(null)} className="w-full py-3 text-slate-400 font-bold text-xs uppercase tracking-widest">Cancel</button>
                 </div>
               </motion.div>
            </div>
          )}

          {saleToEdit && (
            <EditSaleModal 
              sale={saleToEdit}
              customers={customers}
              items={items}
              onClose={() => setSaleToEdit(null)}
            />
          )}

          {isAddCustomerModalOpen && (
            <QuickAddCustomerModal 
              onClose={() => setIsAddCustomerModalOpen(false)}
              onSuccess={(customerId: string) => {
                setSelectedCustomerId(customerId);
                setIsAddCustomerModalOpen(false);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </MainLayout>
  );
}

function QuickAddCustomerModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: (id: string) => void }) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: { name: string, phone: string, address: string }) => {
      if (!business?.id) throw new Error("Business context not found");
      if (!data.name.trim()) throw new Error("Name is required");
      if (data.phone && data.phone.replace(/\D/g, '').length < 11) {
        throw new Error("Phone number must be at least 11 digits");
      }

      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
          business_id: business.id,
          user_id: user?.id,
          name: data.name,
          phone: data.phone,
          address: data.address,
          total_due_cents: 0
        })
        .select()
        .single();

      if (error) throw error;

      await logActivity({
        business_id: business.id,
        user_id: user?.id,
        action: 'ADD_CUSTOMER',
        details: {
          title: `New Customer: ${data.name}`,
          sub: `Quick added from sales`,
          amount: 'JOINED',
          type: 'customer'
        }
      });

      return newCustomer;
    },
    onSuccess: (newCustomer) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      onSuccess(newCustomer.id);
    },
    onError: (err: any) => setError(err.message)
  });

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 text-left">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl relative overflow-hidden z-10 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Quick Add Customer</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded-xl border border-red-100 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </div>
          )}
          
          <Input 
            label="Full Name *" 
            value={formData.name} 
            onChange={(v: string) => setFormData({...formData, name: v})} 
            placeholder="Customer name"
          />
          <Input 
            label="Phone Number" 
            value={formData.phone} 
            onChange={(v: string) => setFormData({...formData, phone: v})} 
            placeholder="01XXXXXXXXX"
          />
          <Input 
            label="Address" 
            value={formData.address} 
            onChange={(v: string) => setFormData({...formData, address: v})} 
            placeholder="Customer address"
          />

          <div className="flex gap-3 pt-2">
            <button 
              onClick={onClose}
              className="flex-1 py-3 bg-slate-50 text-slate-500 rounded-xl font-bold text-[10px] uppercase tracking-widest"
            >
              Cancel
            </button>
            <button 
              onClick={() => mutation.mutate(formData)}
              disabled={mutation.isPending}
              className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100"
            >
              {mutation.isPending ? 'Saving...' : 'Save & Select'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function EditSaleModal({ sale, customers, items, onClose }: any) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    customer_id: sale.customer_id || '',
    quantity: sale.quantity.toString(),
    unit_price: (sale.unit_price_bdt_cents / 100).toString(),
    total_price: ((sale.unit_price_bdt_cents * sale.quantity) / 100).toString(),
    discount: (sale.discount_cents / 100).toString(),
    received_now: (sale.received_now_bdt_cents / 100).toString(),
    payment_method: sale.payment_method,
    notes: sale.notes || ''
  });
  const [error, setError] = useState<string | null>(null);

  // Sync Total Price in Edit Modal
  useEffect(() => {
    const q = parseFloat(formData.quantity) || 0;
    const p = parseFloat(formData.unit_price) || 0;
    setFormData(prev => ({ ...prev, total_price: (q * p).toFixed(2) }));
  }, [formData.quantity, formData.unit_price]);

  const handleEditTotalPriceChange = (val: string) => {
    const q = parseFloat(formData.quantity) || 1;
    const tp = parseFloat(val) || 0;
    setFormData(prev => ({ 
      ...prev, 
      total_price: val,
      unit_price: (tp / q).toFixed(2)
    }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const gQty = parseInt(formData.quantity) || 0;
      const gPrice = parseFloat(formData.unit_price) || 0;
      const gDisc = parseFloat(formData.discount) || 0;
      const gTotal = (gQty * gPrice) - gDisc;
      const gPaid = parseFloat(formData.received_now) || 0;
      const gDue = Math.max(0, gTotal - gPaid);

      // 1. Reverse previous stock
      await supabase.rpc('increment_inventory_stock', { item_id: sale.item_id, amount: sale.quantity });
      
      // 2. Apply new stock
      const { error: rpcError } = await supabase.rpc('decrement_inventory_stock', { item_id: sale.item_id, amount: gQty });
      if (rpcError) throw rpcError;

      // 3. Update Sale
      const { error: sError } = await supabase.from('sales').update({
        customer_id: formData.customer_id || null,
        user_id: user?.id,
        quantity: gQty,
        unit_price_bdt_cents: Math.round(gPrice * 100),
        discount_cents: Math.round(gDisc * 100),
        total_cents: Math.round(gTotal * 100),
        received_now_bdt_cents: Math.round(gPaid * 100),
        due_cents: Math.round(gDue * 100),
        payment_method: formData.payment_method,
        notes: formData.notes
      }).eq('id', sale.id);

      if (sError) throw sError;

      // 4. Update Ledger
      await supabase.from('customer_ledger').delete().eq('reference_id', sale.id);
      
      // Update customer total due (Subtractive then Additive)
      if (sale.customer_id) {
        const { data: oldC } = await supabase.from('customers').select('total_due_cents').eq('id', sale.customer_id).single();
        if (oldC) {
           await supabase.from('customers').update({ 
              total_due_cents: Math.max(0, oldC.total_due_cents - sale.due_cents) 
           }).eq('id', sale.customer_id);
        }
      }

      if (gDue > 0 && formData.customer_id) {
        await supabase.from('customer_ledger').insert({
          business_id: sale.business_id,
          user_id: user?.id,
          customer_id: formData.customer_id,
          transaction_type: 'sale',
          amount_cents: Math.round(gDue * 100),
          reference_id: sale.id
        });
        
        const { data: newC } = await supabase.from('customers').select('total_due_cents').eq('id', formData.customer_id).single();
        if (newC) {
           await supabase.from('customers').update({ 
              total_due_cents: newC.total_due_cents + Math.round(gDue * 100) 
           }).eq('id', formData.customer_id);
        }
      }

      await logActivity({
        business_id: sale.business_id,
        user_id: user?.id,
        action: 'EDIT_SALE',
        details: {
          title: `Updated Sale: ${sale.invoice_no}`,
          sub: `Total: ৳${gTotal.toLocaleString()}`,
          amount: 'EDITED',
          type: 'sale'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      onClose();
    },
    onError: (err: any) => setError(err.message)
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl relative overflow-hidden z-10"
      >
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
           <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Edit Sale</h2>
              <p className="text-sm text-slate-400 font-medium">Invoice #{sale.invoice_no}</p>
           </div>
           <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-50">
             <X className="w-6 h-6" />
           </button>
        </div>
        <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
           {error && (
             <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl border border-red-100 flex items-center gap-2">
               <AlertCircle className="w-4 h-4" /> {error}
             </div>
           )}
           <SelectInput 
              label="Customer" 
              value={formData.customer_id} 
              onChange={(v: string) => setFormData({...formData, customer_id: v})} 
              options={customers.map((c: any) => ({ value: c.id, label: c.name }))}
              placeholder="Walk-in"
           />
           <div className="grid grid-cols-3 gap-4">
             <Input label="Quantity" value={formData.quantity} onChange={(v: string) => setFormData({...formData, quantity: v})} type="number" />
             <Input label="Price" value={formData.unit_price} onChange={(v: string) => setFormData({...formData, unit_price: v})} type="number" />
             <Input label="Total" value={formData.total_price} onChange={handleEditTotalPriceChange} type="number" />
           </div>
           <div className="grid grid-cols-2 gap-4">
             <Input label="Discount" value={formData.discount} onChange={(v: string) => setFormData({...formData, discount: v})} type="number" />
             <Input label="Received" value={formData.received_now} onChange={(v: string) => setFormData({...formData, received_now: v})} type="number" />
           </div>
           <SelectInput 
              label="Payment" 
              value={formData.payment_method} 
              onChange={(v: string) => setFormData({...formData, payment_method: v})} 
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'bkash', label: 'bKash' },
                { value: 'nagad', label: 'Nagad' },
              ]}
           />
        </div>
        <div className="p-8 bg-slate-50 flex gap-4">
           <button onClick={onClose} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-xs uppercase tracking-widest">Cancel</button>
           <button 
             onClick={() => mutation.mutate()}
             disabled={mutation.isPending}
             className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95"
           >
             {mutation.isPending ? 'Updating...' : 'Update Sale'}
           </button>
        </div>
      </motion.div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }: any) {
  return (
    <div className="space-y-1 flex-1 text-left">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 ml-1">{label}</label>
      <input 
        type={type}
        className="w-full bg-slate-50 border border-slate-100 h-10 px-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-base md:text-sm font-medium"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          onChange('');
        }}
        onBlur={(e) => {
          if (type === 'number' && value) {
            const num = parseFloat(value);
            if (!isNaN(num)) {
              onChange(num.toFixed(2));
            }
          }
        }}
        placeholder={placeholder}
      />
    </div>
  );
}

function SelectInput({ label, value, onChange, options, placeholder }: any) {
  return (
    <div className="space-y-1 flex-1 text-left">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 ml-1">{label}</label>
      <div className="relative">
        <select 
          className="w-full bg-slate-50 border border-slate-100 h-10 px-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none transition-all text-base md:text-sm font-medium pr-8"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt: any) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

function SummaryRow({ label, value, total, color }: any) {
  return (
    <div className={`flex justify-between items-center ${total ? 'text-[13px] font-bold uppercase tracking-tight' : 'text-[11px] font-bold text-slate-500'}`}>
      <span className={total ? 'text-slate-900' : ''}>{label}</span>
      <span className={color || (total ? 'text-slate-900 font-mono' : 'text-slate-900 font-bold')}>{value}</span>
    </div>
  );
}
