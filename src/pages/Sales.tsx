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
  History as HistoryIcon,
  ArrowLeft,
  Box
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
  const [activeTab, setActiveTab] = useState<'new' | 'service' | 'history'>('new');
  
  // New Sale Form State
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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
  const [customDate, setCustomDate] = useState<string>(getTodayString());
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

  // Edit/Delete/Detail State
  const [saleToEdit, setSaleToEdit] = useState<any>(null);
  const [saleToDelete, setSaleToDelete] = useState<any>(null);
  const [saleToShowDetails, setSaleToShowDetails] = useState<any>(null);
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);

  useScrollLock(!!saleToEdit || !!saleToDelete || !!saleToShowDetails);

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
      
      let saleCreatedAt: string | undefined = undefined;
      if (customDate) {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        try {
          saleCreatedAt = new Date(`${customDate}T${timeStr}`).toISOString();
        } catch (e) {
          saleCreatedAt = new Date(customDate).toISOString();
        }
      }

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
        notes: notes,
        created_at: saleCreatedAt
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
      setCustomDate(getTodayString());
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to process sale');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (sale: any) => {
      // 1. Restore inventory
      if (sale.item_id) {
        await supabase.rpc('increment_inventory_stock', { item_id: sale.item_id, amount: sale.quantity });
      }
      
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
            className={`flex-1 py-3 text-xs md:text-sm font-semibold uppercase tracking-wider transition-all relative ${activeTab === 'new' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            New Sale
            {activeTab === 'new' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('service')}
            className={`flex-1 py-3 text-xs md:text-sm font-semibold uppercase tracking-wider transition-all relative ${activeTab === 'service' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            <span className="hidden sm:inline">Service / Custom Sale</span>
            <span className="sm:hidden">Service / Custom</span>
            {activeTab === 'service' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-xs md:text-sm font-semibold uppercase tracking-wider transition-all relative ${activeTab === 'history' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            <span className="hidden sm:inline">Order History</span>
            <span className="sm:hidden">History</span>
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
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="flex items-end gap-2">
                             <SelectInput 
                               label="Customer" 
                               value={selectedCustomerId} 
                               onChange={setSelectedCustomerId} 
                               options={customers.map(c => ({ value: c.id, label: `${c.name} - Due: ${formatBDT(c.total_due_cents || 0)}` }))}
                               placeholder="Select Customer"
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
                          <div className="space-y-1 text-left">
                             <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Sale Date</label>
                             <input 
                               type="date" 
                               value={customDate} 
                               onChange={(e) => setCustomDate(e.target.value)}
                               className="w-full bg-slate-50 border border-slate-100 h-10 px-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-base md:text-sm font-medium"
                             />
                          </div>
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
          ) : activeTab === 'service' ? (
            <AddServiceView onBack={() => setActiveTab('history')} customers={customers} />
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
                  <div key={sale.id} className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 group hover:border-blue-100 transition-all">
                  <div 
                    className="flex items-start gap-3 cursor-pointer flex-1 min-w-0"
                    onClick={() => setSaleToShowDetails(sale)}
                    title="Click to view full sale details"
                  >
                     <div className="w-8 h-8 sm:w-9 sm:h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors shrink-0 mt-0.5">
                       <Receipt className="w-4 h-4" />
                     </div>
                     <div className="text-left flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                           <h4 className="text-sm md:text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight truncate break-all">{sale.invoice_no}</h4>
                           <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${sale.item_id ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                             {sale.item_id ? 'Product' : 'Service'}
                           </span>
                        </div>
                        <p className="text-xs md:text-sm font-medium text-slate-400 uppercase tracking-widest mt-1 truncate">
                          {sale.customers?.name || 'Walk-in'} • {formatDate(sale.created_at)}
                        </p>
                        {(() => {
                           const noteText = sale.notes ? (
                             sale.notes.startsWith('[Service]') 
                               ? sale.notes.replace('[Service]', '').split(' - ').slice(1).join(' - ').trim()
                               : sale.notes
                           ) : '';
                           return noteText ? (
                             <p className="text-xs text-slate-500 mt-2 max-w-full truncate font-medium bg-slate-50 px-2 py-0.5 rounded border border-slate-100/50 w-fit italic">
                               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider not-italic mr-1 text-slate-400">Note:</span>
                               "{noteText}"
                             </p>
                           ) : null;
                        })()}
                     </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3.5 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100/60 sm:min-w-[170px] shrink-0 w-full sm:w-auto">
                     <div className="text-left sm:text-right min-w-0">
                        <p className="text-sm md:text-base font-mono font-bold text-slate-900 tracking-tighter">{formatBDT(sale.total_cents)}</p>
                        {sale.due_cents > 0 ? (
                           <span className="text-[11px] sm:text-xs font-semibold text-red-500 uppercase tracking-tight block">৳{(sale.due_cents/100).toLocaleString()} Due</span>
                        ) : (
                           <span className="inline-flex h-4 items-center px-1.5 bg-emerald-50 text-emerald-500 text-[10px] sm:text-[11px] font-semibold uppercase rounded">Paid</span>
                        )}
                     </div>
                     <div className="flex items-center gap-2">
                      <button 
                       onClick={() => {
                         if (business) {
                           const saleData = {
                             invoiceNo: sale.invoice_no,
                             date: sale.created_at, // Pass ISO string
                             items: [
                               {
                                 name: sale.inventory_items?.name || (
                                   sale.notes ? (
                                     sale.notes.startsWith('[Service]') 
                                       ? sale.notes.replace('[Service]', '').split(' - ')[0].trim() 
                                       : sale.notes
                                   ) : 'Custom Sale'
                                 ),
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
                               onClick={() => { setSaleToShowDetails(sale); setShowOptionsId(null); }}
                               className="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50 pb-2 mb-1"
                             >
                                <Info className="w-3.5 h-3.5 text-blue-500" /> Details
                             </button>
                             <button 
                               onClick={() => {
                                 if (business) {
                                   const saleData = {
                                     invoiceNo: sale.invoice_no,
                                     date: sale.created_at, // Pass raw ISO
                                     items: [
                                       {
                                         name: sale.inventory_items?.name || (
                                  sale.notes ? (
                                    sale.notes.startsWith('[Service]') 
                                      ? sale.notes.replace('[Service]', '').split(' - ')[0].trim() 
                                      : sale.notes
                                  ) : 'Custom Sale'
                                ),
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

          {saleToShowDetails && (
            <SaleDetailsModal 
              sale={saleToShowDetails}
              onClose={() => setSaleToShowDetails(null)}
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

function AddServiceView({ onBack, customers = [] }: { onBack: () => void, customers?: any[] }) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [serviceName, setServiceName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [receivedNow, setReceivedNow] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [customDate, setCustomDate] = useState<string>(getTodayString());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);

  const parsedCost = parseFloat(totalCost) || 0;
  const parsedSelling = parseFloat(sellingPrice) || 0;
  const parsedDiscount = parseFloat(discount) || 0;
  const parsedReceived = parseFloat(receivedNow) || 0;

  const calculatedTotal = Math.max(0, parsedSelling - parsedDiscount);
  const calculatedDue = Math.max(0, calculatedTotal - parsedReceived);
  const calculatedProfit = calculatedTotal - parsedCost;
  const profitMargin = calculatedTotal <= 0 ? 0 : (calculatedProfit / calculatedTotal) * 100;

  const mutation = useMutation({
    mutationFn: async () => {
      setError(null);
      setSuccess(null);
      
      if (!serviceName.trim()) throw new Error('Please enter a service or custom sale name');
      if (parsedSelling <= 0) throw new Error('Selling price must be greater than zero');
      if (!business?.id) throw new Error('Business context not found');

      const invoiceNo = `SRV-${Date.now()}`;

      let saleCreatedAt: string | undefined = undefined;
      if (customDate) {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        try {
          saleCreatedAt = new Date(`${customDate}T${timeStr}`).toISOString();
        } catch (e) {
          saleCreatedAt = new Date(customDate).toISOString();
        }
      }

      // 1. Create Sale (item_id is null for custom service/sale)
      const { data: sale, error: sError } = await supabase.from('sales').insert({
        business_id: business.id,
        user_id: user?.id,
        invoice_no: invoiceNo,
        customer_id: selectedCustomerId || null,
        item_id: null,
        quantity: 1,
        unit_price_bdt_cents: Math.round(parsedSelling * 100),
        discount_cents: Math.round(parsedDiscount * 100),
        total_cents: Math.round(calculatedTotal * 100),
        received_now_bdt_cents: Math.round(parsedReceived * 100),
        due_cents: Math.round(calculatedDue * 100),
        cost_rate_cents: Math.round(parsedCost * 100),
        expected_profit_cents: Math.round(calculatedProfit * 100),
        payment_method: paymentMethod,
        notes: `[Service] ${serviceName}${notes ? ' - ' + notes : ''}`,
        created_at: saleCreatedAt
      }).select().single();

      if (sError) throw sError;

      // 2. Update Customer Ledger if needed
      if (calculatedDue > 0 && selectedCustomerId) {
        const { error: ledgerError } = await supabase.from('customer_ledger').insert({
          business_id: business.id,
          user_id: user?.id,
          customer_id: selectedCustomerId,
          transaction_type: 'sale',
          amount_cents: Math.round(calculatedDue * 100),
          reference_id: sale.id
        });
        if (ledgerError) throw ledgerError;

        // Update Customer Total Due
        const currentCustomer = customers.find((c: any) => c.id === selectedCustomerId);
        if (currentCustomer) {
          const newDue = (currentCustomer.total_due_cents || 0) + Math.round(calculatedDue * 100);
          await supabase.from('customers').update({ total_due_cents: newDue }).eq('id', selectedCustomerId);
        }
      }

      // 3. Distribution
      if (calculatedProfit > 0) {
        const profitCents = Math.round(calculatedProfit * 100);
        const [
          { data: currentPartners },
          { data: capitalContributions }
        ] = await Promise.all([
          supabase.from('partners').select('*').eq('business_id', business.id).eq('status', 'active'),
          supabase.from('capital_contributions').select('*').eq('business_id', business.id)
        ]);

        if (currentPartners && currentPartners.length > 0) {
          const partnerCapitalMap: Record<string, number> = {};
          let totalBusinessCapital = 0;

          capitalContributions?.forEach(cap => {
            const amount = parseFloat(cap.amount || '0');
            const amountBDT = cap.currency === 'RMB' ? amount * (business.exchange_rate || 1) : amount;
            partnerCapitalMap[cap.partner_id] = (partnerCapitalMap[cap.partner_id] || 0) + amountBDT;
            totalBusinessCapital += amountBDT;
          });

          const totalShare = currentPartners.reduce((acc, p) => acc + (parseFloat(p.profit_share?.toString() || '0')), 0);

          const distributions = currentPartners.map(p => {
            let shareRatio = 0;
            let notes = '';

            if (totalShare > 0) {
              const pShare = parseFloat(p.profit_share?.toString() || '0');
              shareRatio = pShare / totalShare;
              notes = `Profit from Service ${invoiceNo} (Custom share: ${pShare.toFixed(2)}%)`;
            } else {
              const partnerCapital = partnerCapitalMap[p.id] || 0;
              shareRatio = totalBusinessCapital > 0 ? partnerCapital / totalBusinessCapital : 0;
              notes = `Profit from Service ${invoiceNo} (Cap share: ${(shareRatio * 100).toFixed(2)}%)`;
            }

            const share = shareRatio * profitCents;
            
            return {
              business_id: business.id,
              partner_id: p.id,
              sale_id: sale.id,
              amount_cents: Math.floor(share),
              notes: notes
            };
          }).filter(d => d.amount_cents > 0);

          if (distributions.length > 0) {
            await supabase.from('partner_profit_distributions').insert(distributions);
            for (const dist of distributions) {
              await supabase.rpc('increment_partner_balance', { 
                p_id: dist.partner_id, 
                amount_cents: dist.amount_cents 
              });
            }

            await supabase.from('sales').update({
              distributed_profit_cents: profitCents
            }).eq('id', sale.id);
          }
        }
      }

      // 4. Log text
      await logActivity({
        business_id: business.id,
        user_id: user?.id,
        action: 'NEW_SALE',
        details: {
          title: `Service/Custom Sale: ${serviceName}`,
          sub: `Invoice #${invoiceNo}`,
          amount: `+৳${calculatedTotal.toLocaleString()}`,
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
      setSuccess('Service/Custom sale added successfully!');
      setTimeout(() => {
        onBack();
      }, 1500);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to add service');
    }
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-4 text-slate-800"
    >


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Form Column */}
        <div className="lg:col-span-2 space-y-3">
          {success && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-semibold shadow-sm">
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center animate-bounce">✓</div>
              {success}
            </div>
          )}

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                <Box className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-xs lg:text-sm font-bold uppercase tracking-widest text-slate-900">Service / Sale Details</h2>
            </div>
            
            <div className="p-4 space-y-4 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Service / Custom Item Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Jewelry delivery & packaging cargo" 
                    value={serviceName} 
                    onChange={e => setServiceName(e.target.value)}
                    onFocus={() => { if (serviceName === 'e.g. Jewelry delivery & packaging cargo') setServiceName(''); }}
                    className="w-full bg-slate-50 border border-slate-100 h-10 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Customer (Optional)</label>
                  <div className="flex gap-2">
                    <select 
                      value={selectedCustomerId} 
                      onChange={e => setSelectedCustomerId(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-100 h-10 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900 text-sm"
                    >
                      <option value="">Select Customer</option>
                      {customers.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name} {c.shop_name ? `(${c.shop_name})` : ''}</option>
                      ))}
                    </select>
                    <button 
                      type="button"
                      onClick={() => setIsAddCustomerModalOpen(true)}
                      className="h-10 px-3 bg-blue-50 text-blue-600 rounded-xl border border-slate-100 hover:bg-blue-100 transition-all flex items-center justify-center shrink-0 mb-[1px]"
                      title="Add New Customer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Total Cost (৳ BDT)</label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={totalCost} 
                    onChange={e => setTotalCost(e.target.value)}
                    onFocus={() => { if (totalCost === '0.00' || totalCost === '0') setTotalCost(''); }}
                    onBlur={() => { if (!totalCost) setTotalCost(''); else { const num = parseFloat(totalCost); if (!isNaN(num)) setTotalCost(num.toFixed(2)); } }}
                    className="w-full bg-slate-50 border border-slate-100 h-10 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Selling Price (৳ BDT)</label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={sellingPrice} 
                    onChange={e => setSellingPrice(e.target.value)}
                    onFocus={() => { if (sellingPrice === '0.00' || sellingPrice === '0') setSellingPrice(''); }}
                    onBlur={() => { if (!sellingPrice) setSellingPrice(''); else { const num = parseFloat(sellingPrice); if (!isNaN(num)) setSellingPrice(num.toFixed(2)); } }}
                    className="w-full bg-slate-50 border border-slate-100 h-10 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Discount (৳ BDT)</label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={discount} 
                    onChange={e => setDiscount(e.target.value)}
                    onFocus={() => { if (discount === '0.00' || discount === '0') setDiscount(''); }}
                    onBlur={() => { if (!discount) setDiscount(''); else { const num = parseFloat(discount); if (!isNaN(num)) setDiscount(num.toFixed(2)); } }}
                    className="w-full bg-slate-50 border border-slate-100 h-10 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Received Now (৳ BDT)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={receivedNow} 
                      onChange={e => setReceivedNow(e.target.value)}
                      onFocus={() => { if (receivedNow === '0.00' || receivedNow === '0') setReceivedNow(''); }}
                      onBlur={() => { if (!receivedNow) setReceivedNow(''); else { const num = parseFloat(receivedNow); if (!isNaN(num)) setReceivedNow(num.toFixed(2)); } }}
                      className="w-full bg-slate-50 border border-slate-100 h-10 pl-4 pr-12 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900 text-sm"
                    />
                    <button 
                      type="button" 
                      onClick={() => setReceivedNow(calculatedTotal.toString())}
                      className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-200 text-slate-700 hover:bg-slate-300 text-[9px] font-bold uppercase rounded font-sans"
                    >
                      Full
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Payment Method</label>
                  <select 
                    value={paymentMethod} 
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 h-10 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900 text-sm"
                  >
                    <option value="cash">Cash</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Notes / Description</label>
                  <input 
                    type="text" 
                    placeholder="Enter additional transaction notes..." 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)}
                    onFocus={() => { if (notes === 'Enter additional transaction notes...') setNotes(''); }}
                    className="w-full bg-slate-50 border border-slate-100 h-10 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1">Sale Date</label>
                  <input 
                    type="date" 
                    value={customDate} 
                    onChange={e => setCustomDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 h-10 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900 text-sm"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Sticky Summary Bar */}
        <div className="space-y-4 text-left">
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5 sticky top-16">
            <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest border-b border-slate-50 pb-3">Checkout Analysis</h3>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <span>Subtotal</span>
                <span className="text-slate-900">৳{parsedSelling.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-red-500">
                <span>Discount</span>
                <span>- ৳{parsedDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="h-px bg-slate-100 my-1.5" />
              <div className="flex justify-between items-center text-sm font-black uppercase tracking-tight text-slate-900">
                <span>Total Charge</span>
                <span className="font-mono">৳{calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-emerald-600">
                <span>Paid Now</span>
                <span>৳{parsedReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-red-400">
                <span>Due Balance</span>
                <span>৳{calculatedDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="h-px bg-slate-150 my-1" />
              <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <span>Total Cost</span>
                <span className="text-slate-900">৳{parsedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-1 ${calculatedProfit > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
              <div className="flex items-center gap-2">
                <TrendingUp className={`w-3.5 h-3.5 ${calculatedProfit > 0 ? 'text-emerald-600' : 'text-red-500'}`} />
                <span className={`text-[9px] font-bold uppercase tracking-widest ${calculatedProfit > 0 ? 'text-emerald-700' : 'text-red-700'}`}>Net Profit</span>
              </div>
              <p className={`text-xl font-bold tracking-tight ${calculatedProfit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                ৳{calculatedProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full ${calculatedProfit > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {profitMargin.toFixed(2)}% Margin
              </span>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-[10px] font-bold uppercase">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            <button 
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-teal-100 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {mutation.isPending ? 'Working...' : 'Save Service Sale'}
            </button>

            <button 
              onClick={onBack}
              className="w-full py-3 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
          </section>
        </div>
      </div>

      {isAddCustomerModalOpen && (
        <QuickAddCustomerModal 
          onClose={() => setIsAddCustomerModalOpen(false)}
          onSuccess={(customerId: string) => {
            setSelectedCustomerId(customerId);
            setIsAddCustomerModalOpen(false);
          }}
        />
      )}
    </motion.div>
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
      if (sale.item_id) {
        await supabase.rpc('increment_inventory_stock', { item_id: sale.item_id, amount: sale.quantity });
      }
      
      // 2. Apply new stock
      if (sale.item_id) {
        const { error: rpcError } = await supabase.rpc('decrement_inventory_stock', { item_id: sale.item_id, amount: gQty });
        if (rpcError) throw rpcError;
      }

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

function SaleDetailsModal({ sale, onClose }: { sale: any; onClose: () => void }) {
  const { business } = useBusiness();
  const [distributions, setDistributions] = useState<any[]>([]);
  const [loadingDistributions, setLoadingDistributions] = useState(false);

  useEffect(() => {
    async function loadDistributions() {
      if (!business?.id) return;
      setLoadingDistributions(true);
      try {
        const { data, error } = await supabase
          .from('partner_profit_distributions')
          .select('*, partners(name)')
          .eq('sale_id', sale.id);
        if (!error && data) {
          setDistributions(data);
        }
      } catch (err) {
        console.error('Failed to load partner distributions:', err);
      } finally {
        setLoadingDistributions(false);
      }
    }
    loadDistributions();
  }, [sale.id, business?.id]);

  const isService = !sale.item_id;
  const saleItemName = sale.inventory_items?.name || (
    sale.notes ? (
      sale.notes.startsWith('[Service]') 
        ? sale.notes.replace('[Service]', '').split(' - ')[0].trim() 
        : sale.notes
    ) : 'Custom Sale'
  );

  const cleanNotes = sale.notes ? (
    sale.notes.startsWith('[Service]') 
      ? sale.notes.replace('[Service]', '').split(' - ').slice(1).join(' - ').trim()
      : sale.notes
  ) : '';

  const handleDownloadInvoice = () => {
    if (business) {
      const saleData = {
        invoiceNo: sale.invoice_no,
        date: sale.created_at,
        items: [
          {
            name: saleItemName,
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
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
      />
      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.98 }}
        className="bg-white w-full max-w-2xl rounded-t-[24px] sm:rounded-[32px] shadow-2xl relative overflow-hidden z-10 flex flex-col max-h-[92vh] sm:max-h-[90vh]"
      >
        {/* Banner/Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-5 sm:px-6 py-4 sm:py-5 text-white flex items-center justify-between shrink-0">
          <div className="text-left min-w-0 pr-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 bg-white/20 uppercase tracking-wider rounded-full">
                {isService ? 'Service / Custom Sale' : 'New Product Sale'}
              </span>
              <span className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider rounded-full ${sale.due_cents > 0 ? 'bg-red-500/35 text-red-100' : 'bg-emerald-500/35 text-emerald-100'}`}>
                {sale.due_cents > 0 ? 'Has Due' : 'Paid'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight mt-1 truncate break-all">{sale.invoice_no}</h2>
            <p className="text-[10px] sm:text-xs text-blue-100 font-medium mt-0.5">{formatDate(sale.created_at)}</p>
          </div>
          <button onClick={onClose} className="p-2 text-white/85 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 text-left">
          {/* Main 2-column info layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            
            {/* Customer Details block */}
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-100 flex flex-col justify-between">
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-500" /> Customer Profile
                </h3>
                {sale.customers ? (
                  <div className="space-y-2">
                    <p className="text-base font-bold text-slate-800">{sale.customers.name}</p>
                    {sale.customers.shop_name && (
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight">Shop: {sale.customers.shop_name}</p>
                    )}
                    {sale.customers.phone && (
                      <p className="text-xs font-mono font-medium text-slate-600">Phone: {sale.customers.phone}</p>
                    )}
                    {sale.customers.address && (
                      <p className="text-xs text-slate-500">Address: {sale.customers.address}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-base font-bold text-slate-800">Walk-in Customer</p>
                    <p className="text-xs text-slate-400">No profile attached to this transaction.</p>
                  </div>
                )}
              </div>
              
              <div className="border-t border-slate-200/50 pt-3 mt-4">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Method</span>
                  <span className="font-bold text-slate-700 capitalize">{sale.payment_method}</span>
                </div>
              </div>
            </div>

            {/* Financial Summary panel */}
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-100 space-y-3">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-500" /> Payment Overview
              </h3>
              
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Subtotal</span>
                  <span className="font-semibold text-slate-800 font-mono">{formatBDT(sale.unit_price_bdt_cents * sale.quantity)}</span>
                </div>
                
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Discount</span>
                  <span className="font-semibold text-red-500 font-mono">- {formatBDT(sale.discount_cents)}</span>
                </div>
                
                <div className="h-px bg-slate-200/50" />
                
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-800 uppercase tracking-tight text-xs">Grand Total</span>
                  <span className="text-slate-900 font-mono">{formatBDT(sale.total_cents)}</span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Amount Received</span>
                  <span className="font-semibold text-emerald-600 font-mono">{formatBDT(sale.total_cents - sale.due_cents)}</span>
                </div>

                <div className="flex justify-between text-xs p-1.5 rounded-lg bg-white/70">
                  <span className="text-slate-500 font-medium">Remaining Due</span>
                  <span className={`font-bold font-mono ${sale.due_cents > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                    {formatBDT(sale.due_cents)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Itemized list / sold record */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-blue-500" /> Itemized Breakdown
              </span>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-slate-800 text-sm md:text-base break-words">{saleItemName}</h4>
                  <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wider">
                    {sale.quantity} Unit{sale.quantity > 1 ? 's' : ''} × {formatBDT(sale.unit_price_bdt_cents)} Unit Rate
                  </p>
                  {cleanNotes && (
                    <div className="mt-2.5 bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-600">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Specs / Notes</span>
                      <p className="text-xs font-medium italic">"{cleanNotes}"</p>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-slate-800 text-sm md:text-base">
                    {formatBDT(sale.unit_price_bdt_cents * sale.quantity)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Business Insights Block (Cost vs Profit) */}
          {business && (
            <div className="bg-blue-50/40 rounded-2xl p-4 sm:p-5 border border-blue-100/50 space-y-4">
              <div className="flex flex-wrap items-center justify-between border-b border-blue-100/40 pb-2 gap-2">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-500 block" /> Financial Balance & Profit Insights
                </span>
                <span className="text-[9px] font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded uppercase shrink-0">
                  Accrual Profit Basis
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-blue-100/30">
                  <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                    <span className="block sm:hidden">Unit Cost</span>
                    <span className="hidden sm:block">Cost rate ({isService ? 'Service' : 'Landed'})</span>
                  </span>
                  <span className="font-mono font-bold text-xs sm:text-sm md:text-base text-slate-700 mt-1 block truncate">
                    {formatBDT(sale.cost_rate_cents)}
                  </span>
                </div>
                
                <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-blue-100/30">
                  <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                    <span className="block sm:hidden">Total Cost</span>
                    <span className="hidden sm:block">Total Cost Rate</span>
                  </span>
                  <span className="font-mono font-bold text-xs sm:text-sm md:text-base text-slate-700 mt-1 block truncate">
                    {formatBDT(sale.cost_rate_cents * sale.quantity)}
                  </span>
                </div>

                <div className="bg-emerald-50 p-2.5 sm:p-3.5 rounded-xl border border-emerald-100/30">
                  <span className="text-[8px] sm:text-[9px] font-bold text-emerald-700 uppercase tracking-wider block truncate overflow-visible">
                    <span className="block sm:hidden">Profit</span>
                    <span className="hidden sm:block">Sale Gain / Profit</span>
                  </span>
                  <span className={`font-mono font-bold text-xs sm:text-sm md:text-base mt-1 block truncate ${sale.expected_profit_cents >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatBDT(sale.expected_profit_cents)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Partner distribution analysis */}
          {business?.business_type === 'partnership' && (
            <div className="border border-slate-100 rounded-2xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-500" /> Active Partner Profit Splits
                </span>
                {loadingDistributions && (
                  <span className="text-[9px] font-bold uppercase tracking-tight text-blue-500 animate-pulse">Syncing splits...</span>
                )}
              </div>
              
              <div className="p-4 space-y-3.5">
                {distributions.length > 0 ? (
                  distributions.map((dist) => (
                    <div key={dist.id} className="flex justify-between items-start text-xs border-b border-slate-100/50 last:border-0 pb-3 last:pb-0 gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 truncate">{dist.partners?.name || 'Partner'}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5 break-words line-clamp-2 sm:line-clamp-none">
                          {dist.notes || 'Profit split'}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 shrink-0 text-sm sm:text-base">
                        + {formatBDT(dist.amount_cents)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-1 font-medium">
                    {loadingDistributions ? 'Loading share rates...' : 'No partner profit split was recorded for this transaction.'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Transaction notes */}
          {cleanNotes && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Remarks / Notes</span>
              <p className="text-sm text-slate-700 font-medium leading-relaxed italic">"{cleanNotes}"</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 sm:p-5 md:p-6 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 shrink-0">
          <button 
            onClick={onClose} 
            className="w-full sm:flex-1 py-3 sm:py-3.5 bg-white border border-slate-200 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-100 shadow-sm active:scale-95 transition-all text-center"
          >
            Close Details
          </button>
          
          {business && (
            <button 
              onClick={handleDownloadInvoice}
              className="w-full sm:flex-1 py-3 sm:py-3.5 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" /> Download invoice
            </button>
          )}
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
