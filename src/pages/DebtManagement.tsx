// src/pages/DebtManagement.tsx
import React, { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { safeStorage } from '../lib/safeStorage';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, Plus, Search, Filter, History, Trash2, 
  ArrowUpRight, ArrowDownRight, Tag, Bookmark,
  Banknote, MoreVertical, X, Edit, AlertCircle, RefreshCw, CheckCircle, Wallet
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatBDT, formatDate } from '../lib/utils';
import { logActivity } from '../lib/activity';
import { useScrollLock } from '../hooks/useScrollLock';

export default function DebtManagement() {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'BDT' | 'RMB'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OUTSTANDING' | 'PAID'>('ALL');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [debtToPay, setDebtToPay] = useState<any>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [debtToDelete, setDebtToDelete] = useState<any>(null);

  useScrollLock(isAddModalOpen || isPayModalOpen || isDeleteModalOpen);

  // Fetch debts
  const { data: debts = [], isLoading } = useQuery({
    queryKey: ['debts', business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('business_id', business?.id)
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  // Fetch Wallet balances for Pay Debt verification
  const { data: walletBalances = { bdt: 0, rmb: 0 } } = useQuery({
    queryKey: ['wallet-balances', business?.id],
    queryFn: async () => {
      if (!business?.id) return { bdt: 0, rmb: 0 };
      
      const [
        { data: sales },
        { data: expenses },
        { data: capital },
        { data: distribution },
        { data: internalExchanges },
        { data: ledger },
        { data: purchases },
        { data: dbtRes }
      ] = await Promise.all([
        supabase.from('sales').select('item_id, total_cents, due_cents, cost_rate_cents, received_now_bdt_cents').eq('business_id', business.id),
        supabase.from('expenses').select('amount_cents, currency').eq('business_id', business.id),
        supabase.from('capital_contributions').select('amount, currency').eq('business_id', business.id),
        supabase.from('partner_profit_distributions').select('amount_cents').eq('business_id', business.id),
        supabase.from('exchanges').select('*').eq('business_id', business.id),
        supabase.from('customer_ledger').select('amount_cents, transaction_type').eq('business_id', business.id),
        supabase.from('purchase_transactions').select('total_landed_cost_bdt_cents, buying_cost_per_unit_rmb_cents, quantity, exchange_rate_used, paid, additional_cost_bdt_cents, additional_cost_currency').eq('business_id', business.id).eq('paid', true),
        supabase.from('debts').select('paid_amount, currency').eq('business_id', business.id)
      ]);

      let bdt = 0;
      let rmb = 0;

      sales?.forEach(s => {
        bdt += (s.received_now_bdt_cents || 0);
        if (!s.item_id) {
          const collectedCents = (s.total_cents || 0) - (s.due_cents || 0);
          const withheldCostCents = Math.min(collectedCents, s.cost_rate_cents || 0);
          bdt -= withheldCostCents;
        }
      });
      ledger?.forEach(l => {
        if (l.transaction_type === 'payment') bdt += (l.amount_cents || 0);
        else if (l.transaction_type === 'return') bdt -= (l.amount_cents || 0);
      });
      capital?.forEach(c => {
        const amtCents = Math.round(parseFloat(c.amount || '0') * 100);
        if (c.currency === 'BDT') bdt += amtCents;
        else rmb += amtCents;
      });
      expenses?.forEach(e => {
        if (e.currency === 'BDT') bdt -= (e.amount_cents || 0);
        else rmb -= (e.amount_cents || 0);
      });
      purchases?.forEach(p => {
        const productCostRmbCents = (p.buying_cost_per_unit_rmb_cents || 0) * (p.quantity || 0);
        rmb -= productCostRmbCents;
        const addCostBDTCents = p.additional_cost_bdt_cents || 0;
        if (p.additional_cost_currency === 'RMB') {
          rmb -= Math.round(addCostBDTCents / (p.exchange_rate_used || 1));
        } else {
          bdt -= addCostBDTCents;
        }
        const productCostBDTCents = Math.round(productCostRmbCents * (p.exchange_rate_used || 1));
        const shippingBDTCents = (p.total_landed_cost_bdt_cents || 0) - productCostBDTCents - addCostBDTCents;
        bdt -= Math.max(0, shippingBDTCents);
      });
      internalExchanges?.forEach((ex: any) => {
        if (ex.from_currency === 'BDT') {
          bdt -= ex.amount_from_cents;
          rmb += ex.amount_to_cents;
        } else {
          rmb -= ex.amount_from_cents;
          bdt += ex.amount_to_cents;
        }
      });
      dbtRes?.forEach(d => {
        const amtCents = Math.round((d.paid_amount || 0) * 100);
        if (d.currency === 'BDT') bdt -= amtCents;
        else rmb -= amtCents;
      });

      return { bdt: bdt / 100, rmb: rmb / 100 };
    },
    enabled: !!business?.id,
  });

  // Calculations for summary card
  const totalBdtDebt = debts
    .filter((d: any) => d.currency === 'BDT')
    .reduce((acc: number, d: any) => acc + parseFloat(d.debt_balance || 0), 0);

  const totalRmbDebt = debts
    .filter((d: any) => d.currency === 'RMB')
    .reduce((acc: number, d: any) => acc + parseFloat(d.debt_balance || 0), 0);

  const totalBdtPaid = debts
    .filter((d: any) => d.currency === 'BDT')
    .reduce((acc: number, d: any) => acc + parseFloat(d.paid_amount || 0), 0);

  const totalRmbPaid = debts
    .filter((d: any) => d.currency === 'RMB')
    .reduce((acc: number, d: any) => acc + parseFloat(d.paid_amount || 0), 0);

  // Filters application
  const filteredDebts = debts.filter((d: any) => {
    const textMatch = 
      d.creditor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.service_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const currencyMatch = currencyFilter === 'ALL' || d.currency === currencyFilter;
    
    const balanceVal = parseFloat(d.debt_balance || 0);
    const statusMatch = 
      statusFilter === 'ALL' ||
      (statusFilter === 'OUTSTANDING' && balanceVal > 0) ||
      (statusFilter === 'PAID' && balanceVal <= 0);

    return textMatch && currencyMatch && statusMatch;
  });

  // Delete Debt Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: debt } = await supabase.from('debts').select('*').eq('id', id).single();
      const { error } = await supabase.from('debts').delete().eq('id', id);
      if (error) throw error;

      if (debt) {
        await logActivity({
          business_id: business?.id || '',
          user_id: user?.id,
          action: 'DELETE_DEBT',
          details: {
            title: `Deleted Debt Details`,
            sub: `Removed debt to ${debt.creditor_name} for ${debt.service_name}`,
            amount: `${debt.currency === 'RMB' ? '¥' : '৳'}${parseFloat(debt.debt_balance).toLocaleString()}`,
            type: 'debt'
          }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardDebts'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      setIsDeleteModalOpen(false);
      setDebtToDelete(null);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete debt');
    }
  });

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 px-2 md:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 text-left">
           <div>
              <h1 className="text-xl lg:text-3xl font-bold text-slate-900 tracking-tight uppercase">Business Debts</h1>
              <p className="text-slate-500 text-xs lg:text-sm font-medium">Record and settle service liabilities without affecting direct inventory costs.</p>
           </div>
           <button 
             onClick={() => { setSelectedDebt(null); setIsAddModalOpen(true); }}
             className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 bg-red-500 text-white rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-bold uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-100 cursor-pointer"
           >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Record Debt
           </button>
        </div>

        {/* Dynamic top stat widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
           {/* Outstanding Cards Group */}
           <div className="grid grid-cols-2 gap-4">
              {/* BDT Debt Balance */}
              <div className="bg-slate-900 p-5 rounded-[24px] text-white relative overflow-hidden text-left flex flex-col justify-between">
                 <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/20 blur-[40px]" />
                 <div>
                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest block">BDT Debt Balance</span>
                    <p className="text-lg sm:text-xl font-bold font-mono tracking-tight mt-1.5">৳{Math.round(totalBdtDebt).toLocaleString()}</p>
                 </div>
                 <span className="text-[9px] text-white/30 tracking-tight block mt-1 uppercase">Cumulative: ৳{Math.round(totalBdtPaid + totalBdtDebt).toLocaleString()}</span>
              </div>

              {/* RMB Debt Balance */}
              <div className="bg-slate-900 p-5 rounded-[24px] text-white relative overflow-hidden text-left flex flex-col justify-between">
                 <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 blur-[40px]" />
                 <div>
                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest block">RMB Debt Balance</span>
                    <p className="text-lg sm:text-xl font-bold font-mono tracking-tight mt-1.5">¥{Math.round(totalRmbDebt).toLocaleString()}</p>
                 </div>
                 <span className="text-[9px] text-white/30 tracking-tight block mt-1 uppercase">Cumulative: ¥{Math.round(totalRmbPaid + totalRmbDebt).toLocaleString()}</span>
              </div>
           </div>

           {/* Total Paid Cards Group */}
           <div className="grid grid-cols-2 gap-4">
              {/* Total BDT Paid Card */}
              <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm text-left relative overflow-hidden flex flex-col justify-between">
                 <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Total BDT Paid</span>
                    <p className="text-lg sm:text-xl font-bold font-mono text-slate-900 tracking-tight mt-1.5">৳{Math.round(totalBdtPaid).toLocaleString()}</p>
                 </div>
                 <span className="text-[9.5px] text-emerald-500 font-bold flex items-center gap-1 mt-1 uppercase">
                   <CheckCircle className="w-3 h-3 shrink-0" /> Settled BDT
                 </span>
              </div>

              {/* Total RMB Paid Card */}
              <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm text-left relative overflow-hidden flex flex-col justify-between">
                 <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Total RMB Paid</span>
                    <p className="text-lg sm:text-xl font-bold font-mono text-slate-900 tracking-tight mt-1.5">¥{Math.round(totalRmbPaid).toLocaleString()}</p>
                 </div>
                 <span className="text-[9.5px] text-emerald-500 font-bold flex items-center gap-1 mt-1 uppercase">
                   <CheckCircle className="w-3 h-3 shrink-0" /> Settled RMB
                 </span>
              </div>
           </div>
        </div>

        {/* Search, Filter Controls */}
        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden p-4 flex flex-col md:flex-row justify-between gap-3 items-center">
           <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                className="bg-slate-50 border-none h-10 pl-9 pr-4 rounded-xl text-xs font-bold outline-none w-full" 
                placeholder="Search creditor or service..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>

           <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              {/* Currency Selector */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                {(['ALL', 'BDT', 'RMB'] as const).map(curr => (
                  <button 
                    key={curr}
                    onClick={() => setCurrencyFilter(curr)}
                    className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      currencyFilter === curr ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>

              {/* Status Selector */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                {([
                  { key: 'ALL', val: 'All' },
                  { key: 'OUTSTANDING', val: 'Active' },
                  { key: 'PAID', val: 'Settled' }
                ] as const).map(st => (
                  <button 
                    key={st.key}
                    onClick={() => setStatusFilter(st.key)}
                    className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      statusFilter === st.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    {st.val}
                  </button>
                ))}
              </div>
           </div>
        </div>

        {/* Liabilities Table / List */}
        <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden text-left">
           <div className="divide-y divide-slate-50">
              {filteredDebts.map((debt: any) => {
                const bal = parseFloat(debt.debt_balance || 0);
                const isSettled = bal <= 0;
                return (
                  <div key={debt.id} className="p-4 sm:p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-slate-50 transition-all">
                     <div className="flex items-center gap-3.5">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                          isSettled ? 'bg-emerald-50 text-emerald-650' : 'bg-rose-50 text-rose-550'
                        }`}>
                           <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                           <div className="flex items-center gap-2">
                              <p className="text-sm sm:text-base font-bold text-slate-900 truncate">{debt.creditor_name}</p>
                              <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                isSettled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                 {isSettled ? 'Settled' : 'Outstanding'}
                              </span>
                           </div>
                           <p className="text-xs sm:text-sm font-medium text-slate-400 mt-0.5 uppercase tracking-wide">
                              {debt.service_name} • {formatDate(debt.date || debt.created_at)}
                           </p>
                        </div>
                     </div>
                     
                     <div className="flex items-center justify-between sm:justify-end gap-3.5 ml-0 sm:ml-2 pt-3 sm:pt-0 border-t border-slate-100 sm:border-none shrink-0">
                        <div className="text-right flex flex-col justify-center">
                           <div className="flex items-center gap-1.5 justify-end">
                              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Balance:</span>
                              <span className="text-sm font-mono font-bold tracking-tight text-slate-900">
                                 {debt.currency === 'BDT' ? '৳' : '¥'}{parseFloat(debt.debt_balance).toLocaleString()}
                              </span>
                           </div>
                           <div className="text-[10px] font-medium text-slate-400 mt-0.5">
                              Total: {debt.currency === 'BDT' ? '৳' : '¥'}{parseFloat(debt.total_amount).toLocaleString()} • Paid: {debt.currency === 'BDT' ? '৳' : '¥'}{parseFloat(debt.paid_amount).toLocaleString()}
                           </div>
                        </div>

                        <div className="flex gap-2">
                           {!isSettled && (
                             <button
                               onClick={() => { setDebtToPay(debt); setIsPayModalOpen(true); }}
                               className="h-9 px-3.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 hover:text-emerald-700 transition-all font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 active:scale-95 cursor-pointer"
                             >
                                <Banknote className="w-3.5 h-3.5" /> Pay
                             </button>
                           )}
                           <button 
                             onClick={() => { setSelectedDebt(debt); setIsAddModalOpen(true); }}
                             className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                             title="Edit Details"
                           >
                              <Edit className="w-3.5 h-3.5" />
                           </button>
                           <button 
                             onClick={() => { setDebtToDelete(debt); setIsDeleteModalOpen(true); }}
                             className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:text-red-600 hover:bg-red-50 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                             title="Delete"
                           >
                              <Trash2 className="w-3.5 h-3.5" />
                           </button>
                        </div>
                     </div>
                  </div>
                );
              })}

              {filteredDebts.length === 0 && !isLoading && (
                 <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                    <History className="w-16 h-16 mb-4 opacity-10" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Awaiting records...</p>
                 </div>
              )}
           </div>
        </div>
      </div>

      {/* Add / Edit Modal Drawer */}
      <AnimatePresence>
         {isAddModalOpen && (
           <AddEditDebtModal 
             debt={selectedDebt} 
             onClose={() => { setIsAddModalOpen(false); setSelectedDebt(null); }} 
           />
         )}
      </AnimatePresence>

      {/* Pay Debt Modal Drawer */}
      <AnimatePresence>
         {isPayModalOpen && (
           <PayDebtModal 
             debt={debtToPay} 
             walletBalances={walletBalances}
             onClose={() => { setIsPayModalOpen(false); setDebtToPay(null); }} 
           />
         )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
         {isDeleteModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDeleteModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[32px] p-8 max-w-sm w-full relative z-10 shadow-2xl text-center">
                 <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-4">
                    <Trash2 className="w-5 h-5" />
                 </div>
                 <h3 className="text-base font-bold text-slate-900">Confirm Deletion</h3>
                 <p className="text-xs text-slate-400 font-medium leading-relaxed mt-2">Are you sure you want to delete this debt details for <span className="font-semibold text-slate-800">@{debtToDelete?.creditor_name}</span>? This layout calculation cannot be undone.</p>
                 <div className="grid grid-cols-2 gap-3 mt-6">
                    <button onClick={() => setIsDeleteModalOpen(false)} className="py-3.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-650 cursor-pointer">Cancel</button>
                    <button onClick={() => deleteMutation.mutate(debtToDelete.id)} className="py-3.5 bg-red-600 hover:bg-red-750 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest cursor-pointer">Delete</button>
                 </div>
              </motion.div>
            </div>
         )}
      </AnimatePresence>
    </MainLayout>
  );
}

/* Add / Edit Modal Component */
function AddEditDebtModal({ debt, onClose }: { debt: any, onClose: () => void }) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = !!debt;

  const [creditor, setCreditor] = useState(() => {
    if (isEdit) return debt?.creditor_name || '';
    try {
      const saved = safeStorage.getItem('draft-debt-creditor');
      if (saved) return JSON.parse(saved);
    } catch {}
    return '';
  });

  const [service, setService] = useState(() => {
    if (isEdit) return debt?.service_name || '';
    try {
      const saved = safeStorage.getItem('draft-debt-service');
      if (saved) return JSON.parse(saved);
    } catch {}
    return '';
  });

  const [date, setDate] = useState(() => {
    if (isEdit) return debt?.date ? debt.date.split('T')[0] : new Date().toISOString().split('T')[0];
    try {
      const saved = safeStorage.getItem('draft-debt-date');
      if (saved) return JSON.parse(saved);
    } catch {}
    return new Date().toISOString().split('T')[0];
  });

  const [currency, setCurrency] = useState<'BDT' | 'RMB'>(() => {
    if (isEdit) return debt?.currency || 'BDT';
    try {
      const saved = safeStorage.getItem('draft-debt-currency');
      if (saved) return JSON.parse(saved) as 'BDT' | 'RMB';
    } catch {}
    return 'BDT';
  });
  
  const [total, setTotal] = useState(() => {
    if (isEdit) return debt?.total_amount ? parseFloat(debt.total_amount).toString() : '0';
    try {
      const saved = safeStorage.getItem('draft-debt-total');
      if (saved) return JSON.parse(saved);
    } catch {}
    return '0';
  });

  const [paid, setPaid] = useState(() => {
    if (isEdit) return debt?.paid_amount ? parseFloat(debt.paid_amount).toString() : '0';
    try {
      const saved = safeStorage.getItem('draft-debt-paid');
      if (saved) return JSON.parse(saved);
    } catch {}
    return '0';
  });

  const [balance, setBalance] = useState(() => {
    if (isEdit) return debt?.debt_balance ? parseFloat(debt.debt_balance).toString() : '0';
    try {
      const saved = safeStorage.getItem('draft-debt-balance');
      if (saved) return JSON.parse(saved);
    } catch {}
    return '0';
  });
  
  // Tracks if the user modified the balance manually
  const [isBalanceManuallyEdited, setIsBalanceManuallyEdited] = useState(() => {
    if (isEdit) return false;
    try {
      const saved = safeStorage.getItem('draft-debt-balance-manual');
      if (saved) return JSON.parse(saved);
    } catch {}
    return false;
  });

  const [isDraftSavedIndicator, setIsDraftSavedIndicator] = useState(false);

  // Sync state to safeStorage on modification if !isEdit
  useEffect(() => {
    if (isEdit) return;
    
    const isDirty = creditor || service || total !== '0' || paid !== '0';
    
    if (isDirty) {
      safeStorage.setItem('draft-debt-creditor', JSON.stringify(creditor));
      safeStorage.setItem('draft-debt-service', JSON.stringify(service));
      safeStorage.setItem('draft-debt-date', JSON.stringify(date));
      safeStorage.setItem('draft-debt-currency', JSON.stringify(currency));
      safeStorage.setItem('draft-debt-total', JSON.stringify(total));
      safeStorage.setItem('draft-debt-paid', JSON.stringify(paid));
      safeStorage.setItem('draft-debt-balance', JSON.stringify(balance));
      safeStorage.setItem('draft-debt-balance-manual', JSON.stringify(isBalanceManuallyEdited));
      
      setIsDraftSavedIndicator(true);
      const timer = setTimeout(() => setIsDraftSavedIndicator(false), 2000);
      return () => clearTimeout(timer);
    } else {
      safeStorage.removeItem('draft-debt-creditor');
      safeStorage.removeItem('draft-debt-service');
      safeStorage.removeItem('draft-debt-date');
      safeStorage.removeItem('draft-debt-currency');
      safeStorage.removeItem('draft-debt-total');
      safeStorage.removeItem('draft-debt-paid');
      safeStorage.removeItem('draft-debt-balance');
      safeStorage.removeItem('draft-debt-balance-manual');
      setIsDraftSavedIndicator(false);
    }
  }, [creditor, service, date, currency, total, paid, balance, isBalanceManuallyEdited, isEdit]);

  // Handle browser tab close warning (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isDirty = !isEdit && (creditor || service || total !== '0' || paid !== '0');
      if (isDirty) {
        const message = 'You have unsaved draft data, leave anyway?';
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [creditor, service, total, paid, isEdit]);

  const clearLocalDraft = () => {
    safeStorage.removeItem('draft-debt-creditor');
    safeStorage.removeItem('draft-debt-service');
    safeStorage.removeItem('draft-debt-date');
    safeStorage.removeItem('draft-debt-currency');
    safeStorage.removeItem('draft-debt-total');
    safeStorage.removeItem('draft-debt-paid');
    safeStorage.removeItem('draft-debt-balance');
    safeStorage.removeItem('draft-debt-balance-manual');
  };

  // Auto calculate balance logic unless manually edited
  const handleTotalChange = (v: string) => {
    setTotal(v);
    const numTotal = parseFloat(v) || 0;
    const numPaid = parseFloat(paid) || 0;
    if (!isBalanceManuallyEdited) {
      setBalance(Math.max(0, numTotal - numPaid).toString());
    }
  };

  const handlePaidChange = (v: string) => {
    setPaid(v);
    const numTotal = parseFloat(total) || 0;
    const numPaid = parseFloat(v) || 0;
    if (!isBalanceManuallyEdited) {
      setBalance(Math.max(0, numTotal - numPaid).toString());
    }
  };

  const handleBalanceChange = (v: string) => {
    setBalance(v);
    setIsBalanceManuallyEdited(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!creditor.trim()) throw new Error('Creditor Name is required');
      if (!service.trim()) throw new Error('Service/Details Name is required');
      
      const payload = {
        business_id: business?.id,
        creditor_name: creditor.trim(),
        service_name: service.trim(),
        date: new Date(date).toISOString(),
        currency,
        total_amount: parseFloat(total) || 0,
        paid_amount: parseFloat(paid) || 0,
        debt_balance: parseFloat(balance) || 0
      };

      if (isEdit) {
        const { error } = await supabase
          .from('debts')
          .update(payload)
          .eq('id', debt.id);
        
        if (error) throw error;

        await logActivity({
          business_id: business?.id || '',
          user_id: user?.id,
          action: 'UPDATE_DEBT',
          details: {
            title: `Updated Debt Details`,
            sub: `Modified ${currency} debt fields for ${creditor}`,
            amount: `${currency === 'RMB' ? '¥' : '৳'}${parseFloat(balance).toLocaleString()}`,
            type: 'debt'
          }
        });
      } else {
        const { error } = await supabase
          .from('debts')
          .insert(payload);
        
        if (error) throw error;

        await logActivity({
          business_id: business?.id || '',
          user_id: user?.id,
          action: 'CREATE_DEBT',
          details: {
            title: `Recorded Service Debt`,
            sub: `Recorded ${currency} debt to ${creditor.trim()} for ${service.trim()}`,
            amount: `${currency === 'RMB' ? '¥' : '৳'}${parseFloat(balance).toLocaleString()}`,
            type: 'debt'
          }
        });
      }
    },
    onSuccess: () => {
      clearLocalDraft();
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardDebts'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      onClose();
    },
    onError: (err: any) => {
      alert(err.message || 'Error occurred while saving');
    }
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white rounded-[32px] w-full max-w-md p-6 sm:p-8 relative z-10 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between mb-6">
           <div className="text-left">
              <div className="flex items-center gap-2">
                 <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-none">{isEdit ? 'Edit Debt details' : 'Record Business Debt'}</h2>
                 {!isEdit && isDraftSavedIndicator && (
                    <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold animate-pulse">
                      Draft Auto-saved
                    </span>
                 )}
              </div>
              <p className="text-xs text-slate-400 font-medium mt-1">Specify outstanding balance to third party suppliers.</p>
           </div>
           <button onClick={onClose} className="p-1.5 hover:bg-slate-50 border border-slate-100 rounded-xl transition-colors cursor-pointer">
              <X className="w-5 h-5 text-slate-400" />
           </button>
        </div>

        <div className="space-y-4 text-left">
           {/* Creditor */}
           <div className="space-y-1">
              <label className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Creditor Name</label>
              <input 
                className="w-full bg-slate-50 border-none h-11 px-4 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-150" 
                placeholder="e.g. DHL Shipping, Wechat Logistics Agent" 
                value={creditor} 
                onChange={(e) => setCreditor(e.target.value)}
              />
           </div>

           {/* Service Name */}
           <div className="space-y-1">
              <label className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Service / Description</label>
              <input 
                className="w-full bg-slate-50 border-none h-11 px-4 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-150" 
                placeholder="e.g. October product shipping invoice, packaging" 
                value={service} 
                onChange={(e) => setService(e.target.value)}
              />
           </div>

           {/* Row 1: Date & Currency */}
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                 <label className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Date</label>
                 <input 
                   type="date"
                   className="w-full bg-slate-50 border-none h-11 px-4 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-150" 
                   value={date} 
                   onChange={(e) => setDate(e.target.value)}
                 />
              </div>

              <div className="space-y-1">
                 <label className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Currency</label>
                 <select 
                   className="w-full bg-slate-50 border-none h-11 px-4 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-150"
                   value={currency}
                   onChange={(e) => setCurrency(e.target.value as any)}
                 >
                    <option value="BDT">BDT (৳)</option>
                    <option value="RMB">RMB (¥)</option>
                 </select>
              </div>
           </div>

           {/* Row 2: Total & Paid */}
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                 <label className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Total Amount</label>
                 <input 
                   type="number"
                   step="any"
                   className="w-full bg-slate-50 border-none h-11 px-4 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-150" 
                   value={total} 
                   onChange={(e) => handleTotalChange(e.target.value)}
                 />
              </div>

              <div className="space-y-1">
                 <label className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Paid Amount</label>
                 <input 
                   type="number"
                   step="any"
                   className="w-full bg-slate-50 border-none h-11 px-4 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-150" 
                   value={paid} 
                   onChange={(e) => handlePaidChange(e.target.value)}
                 />
              </div>
           </div>

           {/* Overridable Debt Balance Field */}
           <div className="space-y-1">
              <div className="flex items-center justify-between ml-1">
                 <label className="text-[9.5px] font-black uppercase tracking-widest text-slate-300">Debt Balance</label>
                 {isBalanceManuallyEdited && (
                    <button 
                      onClick={() => {
                        setIsBalanceManuallyEdited(false);
                        const numTotal = parseFloat(total) || 0;
                        const numPaid = parseFloat(paid) || 0;
                        setBalance(Math.max(0, numTotal - numPaid).toString());
                      }} 
                      className="text-[8px] font-black uppercase tracking-widest text-indigo-500 hover:underline"
                    >
                       Reset Auto Calc
                    </button>
                 )}
              </div>
              <input 
                type="number"
                step="any"
                className="w-full bg-slate-50 border-none h-11 px-4 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-150 text-slate-800" 
                value={balance} 
                onChange={(e) => handleBalanceChange(e.target.value)}
              />
              <p className="text-[9px] font-medium text-slate-400 italic">
                {isBalanceManuallyEdited ? 'Balance manually overridden by user' : 'Calculated automatically as (Total - Paid)'}
              </p>
           </div>
        </div>

        <button 
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full h-12 bg-red-500 text-white rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 mt-6 active:scale-95 disabled:opacity-50 hover:bg-red-600 transition-all cursor-pointer shadow-md"
        >
           {saveMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : (isEdit ? 'Save Changes' : 'Confirm Debt Record')}
        </button>
      </motion.div>
    </div>
  );
}

/* Pay Debt Modal Component */
function PayDebtModal({ debt, walletBalances, onClose }: { debt: any, walletBalances: { bdt: number, rmb: number }, onClose: () => void }) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [paymentAmount, setPaymentAmount] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  const walletBalance = debt.currency === 'BDT' ? walletBalances.bdt : walletBalances.rmb;

  const handleAmountChange = (val: string) => {
    setPaymentAmount(val);
    const amt = parseFloat(val) || 0;
    
    if (amt <= 0) {
      setErrorText(null);
      return;
    }

    if (amt > walletBalance) {
      setErrorText(`Insufficient wallet balance. Available in hand: ${debt.currency === 'BDT' ? '৳' : '¥'}${Math.round(walletBalance).toLocaleString()}`);
    } else if (amt > parseFloat(debt.debt_balance)) {
      setErrorText(`Payment cannot exceed outstanding debt balance: ${debt.currency === 'BDT' ? '৳' : '¥'}${parseFloat(debt.debt_balance).toLocaleString()}`);
    } else {
      setErrorText(null);
    }
  };

  const payMutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(paymentAmount) || 0;
      if (amt <= 0) throw new Error('Please specify a valid payment amount');
      if (amt > walletBalance) throw new Error('Insufficient wallet balance');
      if (amt > parseFloat(debt.debt_balance)) throw new Error('Payment cannot exceed outstanding debt');

      const oldPaid = parseFloat(debt.paid_amount || 0);
      const oldBal = parseFloat(debt.debt_balance || 0);

      const newPaid = oldPaid + amt;
      const newBal = Math.max(0, oldBal - amt);

      // Perform update on debt row
      const { error } = await supabase
        .from('debts')
        .update({
          paid_amount: newPaid,
          debt_balance: newBal
        })
        .eq('id', debt.id);

      if (error) throw error;

      // Pushes transaction/payment representation down to the Activity Log
      await logActivity({
        business_id: business?.id || '',
        user_id: user?.id,
        action: 'PAY_DEBT',
        details: {
          title: `Paid Debt Settlement`,
          sub: `Paid ${debt.currency === 'BDT' ? '৳' : '¥'}${amt.toLocaleString()} toward ${debt.service_name} invoice to ${debt.creditor_name}`,
          amount: `-${debt.currency === 'RMB' ? '¥' : '৳'}${amt.toLocaleString()}`,
          type: 'debt'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardDebts'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      queryClient.invalidateQueries({ queryKey: ['businessMetrics'] });
      onClose();
    },
    onError: (err: any) => {
      alert(err.message || 'Payment execution failed');
    }
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white rounded-[32px] w-full max-w-sm p-6 sm:p-8 relative z-10 shadow-2xl text-left"
      >
        <div className="flex items-center justify-between mb-5">
           <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-none">Execute Debt Payment</h2>
              <p className="text-xs text-slate-400 font-medium mt-1">Deducts cash instantly from active business wallet.</p>
           </div>
           <button onClick={onClose} className="p-1.5 hover:bg-slate-50 border border-slate-100 rounded-xl transition-colors cursor-pointer">
              <X className="w-5 h-5 text-slate-400" />
           </button>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2 mt-4">
           <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-400">Creditor Name:</span>
              <span className="font-bold text-slate-800">@{debt.creditor_name}</span>
           </div>
           <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-400">Balance Owed:</span>
              <span className="font-bold text-slate-800 font-mono">{debt.currency === 'BDT' ? '৳' : '¥'}{parseFloat(debt.debt_balance).toLocaleString()}</span>
           </div>
           <div className="h-px bg-slate-200/50" />
           <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-400">Active Wallet Balance:</span>
              <span className="font-black text-indigo-650 font-mono">{debt.currency === 'BDT' ? '৳' : '¥'}{Math.round(walletBalance).toLocaleString()}</span>
           </div>
        </div>

        <div className="space-y-1.5 mt-5">
           <label className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Payment Amount ({debt.currency})</label>
           <input 
             type="number"
             step="any"
             autoFocus
             className="w-full bg-slate-50 border-none h-11 px-4 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-green-150" 
             placeholder="e.g. 1500" 
             value={paymentAmount} 
             onChange={(e) => handleAmountChange(e.target.value)}
           />
           {errorText && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-100/50 flex gap-2 items-start mt-2">
                 <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                 <p className="text-[10px] text-red-650 font-semibold leading-relaxed">{errorText}</p>
              </div>
           )}
        </div>

        <button 
          onClick={() => payMutation.mutate()}
          disabled={payMutation.isPending || !!errorText || !paymentAmount}
          className="w-full h-11 bg-emerald-600 text-white rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 mt-6 active:scale-95 disabled:opacity-50 hover:bg-emerald-750 transition-all cursor-pointer shadow-md"
        >
           {payMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Confirm wallet settlement'}
        </button>
      </motion.div>
    </div>
  );
}
