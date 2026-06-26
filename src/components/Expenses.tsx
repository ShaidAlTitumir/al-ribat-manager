import React, { useState, useEffect } from 'react';
import { 
  Plus, Save, Receipt, Wallet, ChevronDown, 
  RefreshCw, Trash2, Pencil, Info
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { formatBDT, formatCNY, cn, formatDate } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { safeStorage } from '../lib/safeStorage';

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState(18.15);
  const [loading, setLoading] = useState(false);
  const [totalSpent, setTotalSpent] = useState(0);

  // Form State
  const [title, setTitle] = useState(() => {
    try {
      const saved = safeStorage.getItem('draft-expense-title');
      if (saved) return JSON.parse(saved);
    } catch {}
    return '';
  });
  const [amount, setAmount] = useState<number>(() => {
    try {
      const saved = safeStorage.getItem('draft-expense-amount');
      if (saved) return JSON.parse(saved);
    } catch {}
    return 0;
  });
  const [currency, setCurrency] = useState<'BDT' | 'RMB'>(() => {
    try {
      const saved = safeStorage.getItem('draft-expense-currency');
      if (saved) return JSON.parse(saved) as 'BDT' | 'RMB';
    } catch {}
    return 'BDT';
  });
  const [category, setCategory] = useState(() => {
    try {
      const saved = safeStorage.getItem('draft-expense-category');
      if (saved) return JSON.parse(saved);
    } catch {}
    return 'Shipping';
  });

  const [isDraftSavedIndicator, setIsDraftSavedIndicator] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const isDirty = title || amount > 0;
    if (isDirty) {
      safeStorage.setItem('draft-expense-title', JSON.stringify(title));
      safeStorage.setItem('draft-expense-amount', JSON.stringify(amount));
      safeStorage.setItem('draft-expense-currency', JSON.stringify(currency));
      safeStorage.setItem('draft-expense-category', JSON.stringify(category));
      
      setIsDraftSavedIndicator(true);
      const timer = setTimeout(() => setIsDraftSavedIndicator(false), 2000);
      return () => clearTimeout(timer);
    } else {
      safeStorage.removeItem('draft-expense-title');
      safeStorage.removeItem('draft-expense-amount');
      safeStorage.removeItem('draft-expense-currency');
      safeStorage.removeItem('draft-expense-category');
      setIsDraftSavedIndicator(false);
    }
  }, [title, amount, currency, category]);

  // Tab Close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isDirty = title || amount > 0;
      if (isDirty) {
        const message = 'You have unsaved draft data, leave anyway?';
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [title, amount]);

  const clearLocalDraft = () => {
    safeStorage.removeItem('draft-expense-title');
    safeStorage.removeItem('draft-expense-amount');
    safeStorage.removeItem('draft-expense-currency');
    safeStorage.removeItem('draft-expense-category');
  };

  async function fetchData() {
    const { data: rate } = await supabase.from('exchange_rates').select('cny_to_bdt_rate').order('created_at', { ascending: false }).limit(1).single();
    if (rate) setExchangeRate(rate.cny_to_bdt_rate / 100);

    const { data: exp } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
    if (exp) {
      setExpenses(exp);
      const total = exp.reduce((acc, e) => {
        const bdtAmount = e.currency === 'CNY' ? Math.round(e.amount_cents * e.exchange_rate_used / 100) : e.amount_cents;
        return acc + bdtAmount;
      }, 0);
      setTotalSpent(total);
    }
  }

  const handleSaveExpense = async () => {
    if (!title || amount <= 0) return alert('Please enter a title and valid amount');
    
    setLoading(true);
    try {
      const { error } = await supabase.from('expenses').insert({
        title,
        amount_cents: amount * 100,
        currency: currency === 'RMB' ? 'CNY' : 'BDT',
        category,
        exchange_rate_used: Math.round(exchangeRate * 100)
      });

      if (error) throw error;

      alert('Expense saved successfully!');
      clearLocalDraft();
      setTitle('');
      setAmount(0);
      fetchData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['Shipping', 'Customs', 'Rent', 'Utilities', 'Salaries', 'Marketing', 'Other'];

  return (
    <div className="space-y-5 pt-2 pb-10">
      {/* Header */}
      <div className="flex justify-between items-center px-1">
        <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">Expenses</h1>
        <div className="bg-slate-100 px-3 py-1.5 rounded-xl flex items-center gap-2 border border-slate-200">
          <RefreshCw className="w-3 h-3 text-slate-500" />
          <span className="font-mono text-[11px] font-bold text-slate-700">¥1 = ৳{exchangeRate.toFixed(3)}</span>
        </div>
      </div>

      {/* Summary Card */}
      <div className="relative overflow-hidden bg-blue-600 rounded-3xl p-6 text-white shadow-lg shadow-blue-100">
        <div className="relative z-10">
          <p className="text-blue-100 text-sm font-medium mb-1">Total Spent This Month</p>
          <h2 className="text-4xl font-bold tracking-tight">৳{Math.round(totalSpent / 100).toLocaleString()}</h2>
        </div>
        <Wallet className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
      </div>

      {/* Add New Expense Form */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Plus className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Add New Expense
              {isDraftSavedIndicator && (
                <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold animate-pulse normal-case">
                  Draft Auto-saved
                </span>
              )}
            </h2>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Title</label>
            <input 
              type="text"
              placeholder="e.g. Customs Duty"
              className="w-full bg-slate-50 border border-slate-100 h-12 px-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Amount</label>
              <input 
                type="number"
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-100 h-12 px-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-sm"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Currency</label>
              <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 h-12">
                <button 
                  onClick={() => setCurrency('BDT')}
                  className={cn(
                    "flex-1 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                    currency === 'BDT' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"
                  )}
                >
                  BDT
                </button>
                <button 
                  onClick={() => setCurrency('RMB')}
                  className={cn(
                    "flex-1 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                    currency === 'RMB' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"
                  )}
                >
                  RMB
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Category</label>
            <div className="relative">
              <select 
                className="w-full bg-slate-50 border border-slate-100 h-12 px-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-bold text-sm text-slate-900"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <button 
            onClick={handleSaveExpense}
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm uppercase tracking-[0.15em] shadow-xl shadow-blue-100 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-2"
          >
            <Save className={cn("w-5 h-5", loading && "animate-spin")} />
            {loading ? 'Saving...' : 'Save Expense'}
          </button>
        </div>
      </section>

      {/* Expense History Section */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Expense History</h2>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{expenses.length} records</span>
        </div>
        <div className="p-8">
          {expenses.length === 0 ? (
            <div className="text-center space-y-4 py-6">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto">
                <Receipt className="w-8 h-8 text-slate-200" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">No expenses yet</h3>
                <p className="text-xs font-medium text-slate-400">Add your first expense to see it here.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.map(exp => (
                <div key={exp.id} className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900">{exp.title}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{exp.category} • {formatDate(exp.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-sm text-slate-900">
                      {exp.currency === 'CNY' ? formatCNY(exp.amount_cents) : formatBDT(exp.amount_cents)}
                    </p>
                    <div className="flex gap-1 justify-end mt-1">
                      <button className="p-1 text-slate-300 hover:text-slate-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
