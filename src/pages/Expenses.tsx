// src/pages/Expenses.tsx
import React, { useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, Plus, Search, Filter, History, Trash2, 
  ArrowUpRight, ArrowDownRight, Tag, Bookmark,
  CreditCard, Banknote, MoreVertical, X, Edit,
  AlertCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatBDT, formatDate } from '../lib/utils';
import { logActivity } from '../lib/activity';
import { useScrollLock } from '../hooks/useScrollLock';

export default function Expenses() {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<any>(null);

  useScrollLock(isAddModalOpen || isDeleteModalOpen);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('business_id', business?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const totalExpenseBDT = expenses.reduce((acc: number, ex: any) => {
    return acc + (ex.currency === 'BDT' ? ex.amount_cents : ex.amount_cents * (business?.exchange_rate || 18));
  }, 0);

  const categories = Array.from(new Set(expenses.map((e: any) => e.category || 'Uncategorized')));
  const categoryStats = categories.map(cat => {
    const total = expenses
      .filter((e: any) => (e.category || 'Uncategorized') === cat)
      .reduce((acc: number, ex: any) => {
        return acc + (ex.currency === 'BDT' ? ex.amount_cents : ex.amount_cents * (business?.exchange_rate || 18));
      }, 0);
    return { label: cat, amount: total };
  }).sort((a, b) => b.amount - a.amount).slice(0, 4);

  const filteredExpenses = expenses.filter((ex: any) => 
    ex.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ex.category || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: expense } = await supabase.from('expenses').select('*').eq('id', id).single();
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;

      // Log Activity
      if (expense) {
        await logActivity({
          business_id: business?.id || '',
          user_id: user?.id,
          action: 'DELETE_EXPENSE',
          details: {
            title: `Deleted Expense: ${expense.title}`,
            sub: 'Expense Record Removed',
            amount: `${expense.currency === 'RMB' ? '¥' : '৳'} ${expense.amount_cents/100}`,
            type: 'expense'
          }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      setIsDeleteModalOpen(false);
      setExpenseToDelete(null);
    }
  });

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 px-2 md:px-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
           <div>
              <h1 className="text-xl lg:text-3xl font-bold text-slate-900 tracking-tight uppercase">Expenses</h1>
              <p className="text-slate-500 text-xs lg:text-sm font-medium">Track your operational overheads.</p>
           </div>
           <button 
             onClick={() => { setSelectedExpense(null); setIsAddModalOpen(true); }}
             className="w-full md:w-auto px-5 md:px-6 py-2.5 md:py-3 bg-red-500 text-white rounded-xl md:rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-100"
           >
              <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" /> Log Expense
           </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
           <div className="bg-slate-900 p-6 md:p-8 rounded-[32px] md:rounded-[40px] text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-red-500/20 blur-[40px] md:blur-[60px]" />
              <div className="relative z-10">
                 <span className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Total Monthly Burn</span>
                 <p className="text-2xl lg:text-4xl font-mono font-bold tracking-tighter mt-1 md:mt-2">{formatBDT(totalExpenseBDT)}</p>
                 <div className="mt-4 md:mt-6 flex items-center gap-3 md:gap-4">
                    <div className="flex items-center gap-1.5"><div className="w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-slate-400" /><span className="text-[10px] lg:text-xs font-medium text-white/40 uppercase">Operational Expenses</span></div>
                 </div>
              </div>
           </div>

           <div className="md:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {categoryStats.map(stat => (
                <CategoryStat key={stat.label} label={stat.label} amount={formatBDT(stat.amount)} icon={Tag} />
              ))}
              {categoryStats.length === 0 && (
                <div className="col-span-full bg-white p-6 md:p-10 rounded-[28px] md:rounded-[32px] border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                   <Bookmark className="w-8 h-8 md:w-10 md:h-10 mb-2 opacity-10" />
                   <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest">No active categories</p>
                </div>
              )}
           </div>
        </div>

        <div className="bg-white rounded-[28px] md:rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
           <div className="p-4 md:p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0">
              <h3 className="text-xs lg:text-sm font-bold text-slate-900 uppercase tracking-widest">Voucher History</h3>
              <div className="relative w-full md:w-64">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
                 <input 
                   className="bg-slate-50 border-none h-9 md:h-10 pl-9 md:pl-10 pr-4 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold outline-none w-full" 
                   placeholder="Search..." 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                 />
              </div>
           </div>

           <div className="divide-y divide-slate-50">
              {filteredExpenses.map((ex: any) => (
                <div key={ex.id} className="p-4 sm:p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-slate-50 transition-all">
                   <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-red-50 group-hover:text-red-500 transition-colors">
                         <Bookmark className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                      <div>
                         <p className="text-sm lg:text-base font-semibold text-slate-900">{ex.title}</p>
                         <p className="text-xs lg:text-sm font-medium text-slate-400 uppercase tracking-widest mt-px md:mt-0.5">{ex.category || 'General'} • {formatDate(ex.created_at)}</p>
                      </div>
                   </div>
                   <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 ml-0 sm:ml-2 pt-3 sm:pt-0 border-t border-slate-50 sm:border-none shrink-0">
                      <p className={`text-sm lg:text-base font-mono font-bold tracking-tight whitespace-nowrap ${ex.currency === 'RMB' ? 'text-emerald-600' : 'text-slate-900'}`}>
                         {ex.currency === 'BDT' ? '৳' : '¥'} {(ex.amount_cents/100).toLocaleString()}
                      </p>
                      <div className="flex gap-1.5 md:gap-2">
                        <button 
                          onClick={() => { setSelectedExpense(ex); setIsAddModalOpen(true); }}
                          className="p-1 px-2 md:p-2.5 bg-slate-50 text-slate-400 rounded-lg md:rounded-xl hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95 flex items-center justify-center gap-1 text-[10px] sm:text-xs font-semibold font-sans"
                        >
                           <Edit className="w-3.5 h-3.5 md:w-4 md:h-4" />
                           <span className="sm:hidden">Edit</span>
                        </button>
                        <button 
                          onClick={() => { setExpenseToDelete(ex); setIsDeleteModalOpen(true); }}
                          className="p-1 px-2 md:p-2.5 bg-slate-50 text-slate-400 rounded-lg md:rounded-xl hover:text-red-600 hover:bg-red-50 transition-all active:scale-95 flex items-center justify-center gap-1 text-[10px] sm:text-xs font-semibold font-sans"
                        >
                           <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                           <span className="sm:hidden">Delete</span>
                        </button>
                      </div>
                   </div>
                </div>
              ))}

              {filteredExpenses.length === 0 && !isLoading && (
                 <div className="py-20 flex flex-col items-center justify-center text-slate-200">
                    <Wallet className="w-16 h-16 mb-4 opacity-5" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">No expenses found</p>
                 </div>
              )}
           </div>
        </div>
      </div>

      <AnimatePresence>
         {isAddModalOpen && (
           <AddExpenseModal 
             expense={selectedExpense} 
             onClose={() => { setIsAddModalOpen(false); setSelectedExpense(null); }} 
           />
         )}
         {isDeleteModalOpen && (
           <DeleteConfirmModal 
             title="Delete Expense?"
             desc={`Are you sure you want to delete "${expenseToDelete?.title}"? This action cannot be undone.`}
             onConfirm={() => deleteMutation.mutate(expenseToDelete.id)}
             onCancel={() => { setIsDeleteModalOpen(false); setExpenseToDelete(null); }}
             isPending={deleteMutation.isPending}
           />
         )}
      </AnimatePresence>
    </MainLayout>
  );
}

function CategoryStat({ label, amount, icon: Icon }: any) {
  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-blue-100 transition-all cursor-pointer">
       <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
       </div>
       <div className="mt-3 sm:mt-4">
          <p className="text-[9px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-widest truncate">{label}</p>
          <p className="text-xs sm:text-sm lg:text-base font-bold text-slate-900 tracking-tight mt-0.5">{amount}</p>
       </div>
    </div>
  );
}

function AddExpenseModal({ expense, onClose }: { expense?: any, onClose: () => void }) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ 
    title: expense?.title || '', 
    category: expense?.category || '', 
    amount: expense ? (expense.amount_cents / 100).toString() : '', 
    currency: expense?.currency || 'BDT' 
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (!data.title || !data.amount) throw new Error('Title and Amount are required');
      
      const payload = {
        title: data.title,
        category: data.category,
        amount_cents: Math.round(parseFloat(data.amount) * 100),
        currency: data.currency,
        business_id: business?.id
      };

      if (expense) {
        const { error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', expense.id);
        if (error) throw error;

        await logActivity({
          business_id: business?.id || '',
          user_id: user?.id,
          action: 'EDIT_EXPENSE',
          details: {
            title: `Updated Expense: ${data.title}`,
            sub: data.category || 'General',
            amount: `${data.currency === 'RMB' ? '¥' : '৳'} ${data.amount}`,
            type: 'expense'
          }
        });
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert(payload);
        if (error) throw error;

        await logActivity({
          business_id: business?.id || '',
          user_id: user?.id,
          action: 'ADD_EXPENSE',
          details: {
            title: `New Expense: ${data.title}`,
            sub: data.category || 'General',
            amount: `${data.currency === 'RMB' ? '¥' : '৳'} ${data.amount}`,
            type: 'expense'
          }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      onClose();
    },
    onError: (err: any) => setError(err.message)
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
       <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         exit={{ opacity: 0, scale: 0.95, y: 20 }}
         className="bg-white w-full max-w-lg rounded-[28px] sm:rounded-[40px] shadow-2xl relative overflow-hidden z-10"
       >
         <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
           <div className="p-6 sm:p-8 border-b border-slate-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 sm:gap-4">
                 <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-500 rounded-[16px] sm:rounded-[20px] flex items-center justify-center text-white shadow-lg shadow-red-200 shrink-0">
                    <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />
                 </div>
                 <div>
                    <h2 className="text-base sm:text-lg lg:text-xl font-bold text-slate-900 tracking-tight">{expense ? 'Edit Expense' : 'Log Expense'}</h2>
                    <p className="text-[11px] sm:text-xs lg:text-sm font-medium text-slate-400">Record operational overhead costs.</p>
                 </div>
              </div>
              <button type="button" onClick={onClose} className="p-1.5 sm:p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors shrink-0">
                 <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
           </div>

           <div className="p-6 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-2.5 text-red-600 text-xs font-bold animate-shake">
                   <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
              
              <div className="space-y-4 sm:space-y-5">
                 <Input label="Expense Title *" value={formData.title} onChange={(v: string) => setFormData({...formData, title: v})} placeholder="e.g. FB Ads - Jan" required />
                 <Input label="Category" value={formData.category} onChange={(v: string) => setFormData({...formData, category: v})} placeholder="e.g. Marketing" />
                 
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-1 shadow-sm">
                       <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Currency</label>
                       <select 
                         className="w-full bg-slate-50 border border-slate-100 h-14 px-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-base md:text-sm"
                         value={formData.currency}
                         onChange={(e) => setFormData({...formData, currency: e.target.value})}
                       >
                          <option value="BDT">BDT (৳)</option>
                          <option value="RMB">RMB (¥)</option>
                       </select>
                    </div>
                    <div className="sm:col-span-2">
                       <Input label="Amount *" type="number" value={formData.amount} onChange={(v: string) => setFormData({...formData, amount: v})} placeholder="0.00" required />
                    </div>
                 </div>
              </div>
           </div>

           <div className="p-6 sm:p-8 bg-slate-50 flex gap-3 sm:gap-4 shrink-0 font-sans">
              <button type="button" onClick={onClose} className="flex-1 py-3.5 sm:py-4 bg-white border border-slate-200 rounded-2xl text-[10px] sm:text-xs font-bold uppercase tracking-widest active:scale-95 transition-all hover:bg-slate-100">Cancel</button>
              <button 
                 type="submit"
                 disabled={mutation.isPending}
                 className="flex-[2] py-3.5 sm:py-4 bg-red-500 text-white rounded-2xl text-[10px] sm:text-xs font-bold uppercase tracking-widest shadow-xl shadow-red-100 active:scale-95 transition-all disabled:bg-slate-300 disabled:shadow-none"
              >
                 {mutation.isPending ? 'Processing...' : (expense ? 'Update Voucher' : 'Confirm Log')}
              </button>
           </div>
         </form>
       </motion.div>
    </div>
  );
}

function DeleteConfirmModal({ title, desc, onCancel, onConfirm, isPending }: any) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
       <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         exit={{ opacity: 0, scale: 0.95, y: 20 }}
         className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl relative overflow-hidden z-10 p-8 text-center"
       >
         <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Trash2 className="w-8 h-8" />
         </div>
         <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">{title}</h2>
         <p className="text-sm text-slate-500 mb-8 leading-relaxed">{desc}</p>
         <div className="flex flex-col gap-3">
            <button 
              onClick={onConfirm}
              disabled={isPending}
              className="w-full h-14 bg-red-500 text-white rounded-2xl font-medium text-xs lg:text-sm uppercase tracking-widest shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50"
            >
              {isPending ? 'Deleting...' : 'Yes, Delete'}
            </button>
            <button onClick={onCancel} className="w-full py-3 text-slate-400 font-medium text-xs lg:text-sm uppercase tracking-widest transition-colors hover:text-slate-600">Cancel</button>
         </div>
       </motion.div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, required }: any) {
  return (
    <div className="space-y-1.5 flex-1">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 ml-1">{label}</label>
      <input 
        type={type}
        className="w-full bg-slate-50 border border-slate-100 h-14 px-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-base md:text-sm font-medium"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
