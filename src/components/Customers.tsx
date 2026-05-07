import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, ChevronRight, User, 
  RefreshCw, Phone, MapPin, Wallet,
  CheckCircle2, AlertCircle
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { formatBDT, cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  current_due_cents: number;
  created_at: string;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [exchangeRate, setExchangeRate] = useState(18.15);

  useEffect(() => {
    fetchCustomers();
    fetchExchangeRate();
  }, []);

  async function fetchExchangeRate() {
    const { data } = await supabase
      .from('exchange_rates')
      .select('cny_to_bdt_rate')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (data) setExchangeRate(data.cny_to_bdt_rate / 100);
  }

  async function fetchCustomers() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name', { ascending: true });
      
      if (data) setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const totalReceivable = customers.reduce((acc, c) => acc + c.current_due_cents, 0);
  const customersWithDue = customers.filter(c => c.current_due_cents > 0).length;

  return (
    <div className="space-y-6 pt-2 pb-20 px-1">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-[15px] font-semibold text-slate-900 uppercase tracking-tight">Customers</h1>
        <div className="bg-slate-100 px-3 py-1.5 rounded-xl flex items-center gap-2 border border-slate-200">
          <RefreshCw className="w-3 h-3 text-slate-500" />
          <span className="font-mono text-[10px] font-semibold text-slate-700">¥1 = ৳{exchangeRate.toFixed(2)}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 shadow-sm">
          <p className="text-[9px] font-semibold text-blue-600 uppercase tracking-widest mb-1">Receivable</p>
          <p className="text-xl font-semibold text-slate-900 tracking-tight">{formatBDT(totalReceivable)}</p>
        </div>
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Total</p>
          <p className="text-xl font-semibold text-slate-900 tracking-tight">{customers.length}</p>
        </div>
        <div className="bg-red-50 p-3 rounded-2xl border border-red-100 shadow-sm">
          <p className="text-[9px] font-semibold text-red-600 uppercase tracking-widest mb-1">With Due</p>
          <p className="text-xl font-semibold text-slate-900 tracking-tight">{customersWithDue}</p>
        </div>
      </div>

      {/* Search & Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-100 h-10 pl-10 pr-4 rounded-2xl font-semibold text-xs outline-none shadow-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <button className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 active:scale-90 transition-all">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Customer List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-10 text-center">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Loading Customers...</p>
          </div>
        ) : filteredCustomers.length > 0 ? (
          filteredCustomers.map((customer) => (
            <motion.div 
              key={customer.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-xs">{customer.name}</h3>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
                    {customer.phone} {customer.address && `• ${customer.address}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {customer.current_due_cents > 0 ? (
                  <span className="font-mono font-semibold text-xs text-red-500">{formatBDT(customer.current_due_cents)}</span>
                ) : (
                  <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-widest">Paid</span>
                )}
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 transition-colors" />
              </div>
            </motion.div>
          ))
        ) : (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
            <User className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest">No Customers Found</p>
            <p className="text-[10px] text-slate-300 mt-1 font-normal">Try searching for a different name or phone number.</p>
          </div>
        )}
      </div>
    </div>
  );
}
