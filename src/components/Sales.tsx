import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, User, AlertCircle, Receipt, Trash2, Package, History, Info, CreditCard, Banknote, Smartphone, Building2, Plus, ChevronDown, TrendingUp, ShoppingBag, ReceiptText, CheckCircle2, RefreshCw } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { formatBDT, cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Sales() {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [inventory, setInventory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  
  // Form State
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bkash' | 'nagad' | 'bank'>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [exchangeRate, setExchangeRate] = useState(18.15);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: inv } = await supabase.from('inventory').select('*').gt('current_stock_qty', 0);
    const { data: cust } = await supabase.from('customers').select('*');
    const { data: sales, count } = await supabase.from('sales').select('*, customers(name)', { count: 'exact' }).order('created_at', { ascending: false }).limit(10);
    const { data: rate } = await supabase.from('exchange_rates').select('cny_to_bdt_rate').order('created_at', { ascending: false }).limit(1).single();

    if (inv) setInventory(inv);
    if (cust) setCustomers(cust);
    if (sales) setRecentSales(sales);
    if (count !== null) setHistoryCount(count);
    if (rate) setExchangeRate(rate.cny_to_bdt_rate / 100);
  }

  const handleItemChange = (itemId: string) => {
    const item = inventory.find(i => i.id === itemId);
    setSelectedItem(item);
    if (item) {
      setUnitPrice(Math.round(item.landed_cost_per_unit_cents / 100 * 1.2)); // Default 20% markup
    }
  };

  const totalAmount = (quantity * unitPrice) - discount;
  const amountDue = Math.max(0, totalAmount - receivedAmount);
  const estProfit = selectedItem ? totalAmount - (quantity * (selectedItem.landed_cost_per_unit_cents / 100)) : 0;

  const handleConfirmSale = async () => {
    if (!selectedItem) return alert('Please select an item');
    if (quantity <= 0) return alert('Quantity must be greater than 0');
    if (quantity > selectedItem.current_stock_qty) return alert('Not enough stock');

    const invoiceNo = `INV-${Date.now()}`;

    // 1. Create Sale
    const { data: sale, error: sError } = await supabase.from('sales').insert({
      invoice_no: invoiceNo,
      customer_id: selectedCustomer?.id || null,
      total_cents: Math.round(totalAmount * 100),
      payment_method: paymentMethod,
      notes: notes
    }).select().single();

    if (sError) return alert(sError.message);

    // 2. Create Sale Item
    await supabase.from('sale_items').insert({
      sale_id: sale.id,
      inventory_id: selectedItem.id,
      qty: quantity,
      sold_price_cents: Math.round(unitPrice * 100)
    });

    // 3. Update Inventory Stock
    await supabase.rpc('decrement_inventory_stock', {
      item_id: selectedItem.id,
      amount: quantity
    });

    // 4. Update Customer Due if there's a balance
    if (selectedCustomer && amountDue > 0) {
      await supabase.rpc('increment_customer_due', {
        cust_id: selectedCustomer.id,
        amount: Math.round(amountDue * 100)
      });
    }

    alert('Sale confirmed!');
    // Reset form
    setSelectedItem(null);
    setQuantity(1);
    setUnitPrice(0);
    setReceivedAmount(0);
    setDiscount(0);
    setNotes('');
    setSelectedCustomer(null);
    fetchData();
  };

  return (
    <div className="space-y-4 pt-2 pb-10">
      {/* Header */}
      <div className="flex justify-between items-center px-1">
        <h1 className="text-[15px] font-semibold text-slate-900 uppercase tracking-tight">Record Sale</h1>
        <div className="bg-slate-100 px-3 py-1.5 rounded-xl flex items-center gap-2 border border-slate-200">
          <RefreshCw className="w-3 h-3 text-slate-500" />
          <span className="font-mono text-[10px] font-semibold text-slate-700">¥1 = ৳{exchangeRate.toFixed(2)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        <button 
          onClick={() => setActiveTab('new')}
          className={cn(
            "flex-1 py-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest transition-all relative",
            activeTab === 'new' ? "text-blue-600" : "text-slate-400"
          )}
        >
          <ShoppingCart className="w-4 h-4" />
          New Sale
          {activeTab === 'new' && <motion.div layoutId="saleTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex-1 py-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest transition-all relative",
            activeTab === 'history' ? "text-blue-600" : "text-slate-400"
          )}
        >
          <ReceiptText className="w-4 h-4" />
          History ({historyCount})
          {activeTab === 'history' && <motion.div layoutId="saleTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
        </button>
      </div>

      {activeTab === 'new' ? (
        <div className="space-y-4">
          {/* Section 1: Item & Pricing */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-slate-50 flex items-center gap-3">
              <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-900">Item & Pricing</h2>
            </div>
            <div className="p-3 space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Item</label>
                <div className="relative">
                  <select 
                    className="w-full bg-slate-50 border border-slate-100 h-10 px-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-semibold text-xs text-slate-900"
                    value={selectedItem?.id || ''}
                    onChange={(e) => handleItemChange(e.target.value)}
                  >
                    <option value="">Choose item...</option>
                    {inventory.map(item => (
                      <option key={item.id} value={item.id}>{item.name} ({item.current_stock_qty} in stock)</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Quantity</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-50 border border-slate-100 h-10 px-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-semibold text-xs"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Unit Price (৳)</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-50 border border-slate-100 h-10 px-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-semibold text-xs"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Total</label>
                  <div className="w-full bg-blue-50/50 border border-blue-100 h-10 px-3 rounded-xl flex items-center font-mono font-semibold text-blue-600 text-xs">
                    ৳{totalAmount.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Received (৳)</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-50 border border-slate-100 h-10 px-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-semibold text-xs"
                    placeholder="Paid now"
                    value={receivedAmount || ''}
                    onChange={(e) => setReceivedAmount(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Payment Details */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                  <ReceiptText className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-900">Payment Details</h2>
              </div>
              <span className="text-[8px] font-semibold uppercase tracking-widest text-slate-300 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">optional</span>
            </div>
            <div className="p-3 space-y-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setPaymentMethod('cash')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 rounded-xl border text-[10px] font-semibold transition-all",
                      paymentMethod === 'cash' ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100" : "bg-white border-slate-100 text-slate-500"
                    )}
                  >
                    <Banknote className="w-3 h-3" /> Cash
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('bkash')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 rounded-xl border text-[10px] font-semibold transition-all",
                      paymentMethod === 'bkash' ? "bg-pink-600 border-pink-600 text-white shadow-md shadow-pink-100" : "bg-white border-slate-100 text-slate-500"
                    )}
                  >
                    <Smartphone className="w-3 h-3" /> bKash
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('nagad')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 rounded-xl border text-[10px] font-semibold transition-all",
                      paymentMethod === 'nagad' ? "bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-100" : "bg-white border-slate-100 text-slate-500"
                    )}
                  >
                    <Smartphone className="w-3 h-3" /> Nagad
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('bank')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 rounded-xl border text-[10px] font-semibold transition-all",
                      paymentMethod === 'bank' ? "bg-slate-100 border-slate-200 text-slate-900 shadow-sm" : "bg-white border-slate-100 text-slate-500"
                    )}
                  >
                    <Building2 className="w-3 h-3" /> Bank
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Discount (৳)</label>
                <input 
                  type="number"
                  className="w-full bg-slate-50 border border-slate-100 h-10 px-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-semibold text-xs"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Sale Notes</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-normal min-h-[60px]"
                  placeholder="Any notes about this sale..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Section 3: Customer */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                  <User className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-900">Customer</h2>
              </div>
              <span className="text-[8px] font-semibold uppercase tracking-widest text-slate-300 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">optional</span>
            </div>
            <div className="p-3 space-y-2">
              <div className="relative">
                <select 
                  className="w-full bg-slate-50 border border-slate-100 h-10 px-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-semibold text-xs text-slate-900"
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => setSelectedCustomer(customers.find(c => c.id === e.target.value))}
                >
                  <option value="">Walk-in customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
              <button className="text-[9px] font-semibold text-blue-600 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                <Plus className="w-2.5 h-2.5" /> Add new customer
              </button>
            </div>
          </section>

          {/* Summary Section */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-slate-400">Total Amount</span>
                <span className="font-mono text-xl font-semibold text-slate-900">৳{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-slate-400">Amount Due</span>
                <span className="font-mono text-base font-semibold text-slate-900">৳{amountDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="h-px bg-slate-50 my-1.5" />
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-slate-300" />
                  <span className="text-[11px] font-semibold text-slate-400">Est. Profit</span>
                </div>
                <span className="font-mono text-base font-semibold text-slate-900">৳{estProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <button 
              onClick={handleConfirmSale}
              className="w-full py-3 bg-blue-600 text-white rounded-2xl font-semibold text-xs uppercase tracking-[0.2em] shadow-lg shadow-blue-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirm Sale
            </button>
          </section>
        </div>
      ) : (
        <div className="space-y-2">
          {recentSales.map(sale => (
            <div key={sale.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs text-slate-900">{sale.invoice_no}</h3>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-tight">{sale.customers?.name || 'Walk-in Customer'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono font-semibold text-xs text-slate-900">{formatBDT(sale.total_cents)}</p>
                <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-tighter">{new Date(sale.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
          {recentSales.length === 0 && (
            <div className="py-20 text-center text-slate-300">
              <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-[10px] font-semibold uppercase tracking-widest">No sales history found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
