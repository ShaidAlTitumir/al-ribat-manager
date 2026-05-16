// src/pages/Wallet.tsx
import React, { useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activity';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet as WalletIcon, RefreshCw, ArrowRightLeft, 
  TrendingUp, TrendingDown, History, 
  ArrowUpRight, ArrowDownLeft, Zap, Coins, Calculator,
  Trash2, Pencil, X
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '../lib/utils';

export default function Wallet() {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [fromCurrency, setFromCurrency] = useState<'BDT' | 'RMB'>('BDT');
  const [amountFrom, setAmountFrom] = useState('');
  const [rate, setRate] = useState(business?.exchange_rate?.toString() || '18.0');
  const [editingExchange, setEditingExchange] = useState<any>(null);
  const [deletingExchange, setDeletingExchange] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sync rate with business default when loaded
  React.useEffect(() => {
    if (business?.exchange_rate) {
      setRate(business.exchange_rate.toString());
    }
  }, [business?.exchange_rate]);

  const toCurrency = fromCurrency === 'BDT' ? 'RMB' : 'BDT';
  const r_main = parseFloat(rate) || 1;
  const af_main = parseFloat(amountFrom) || 0;
  const amountTo = fromCurrency === 'BDT' ? (af_main / r_main) : (af_main * r_main);

  const exchangeMutation = useMutation({
    mutationFn: async () => {
      if (!amountFrom || parseFloat(amountFrom) <= 0) throw new Error('Enter a valid positive amount');
      
      const amountCents = Math.round(parseFloat(amountFrom) * 100);
      
      // Check Balance
      const currentBalance = fromCurrency === 'BDT' ? (balances?.bdt || 0) : (balances?.rmb || 0);
      if (parseFloat(amountFrom) > currentBalance) {
        throw new Error(`Insufficient ${fromCurrency} balance. Available: ${currentBalance}`);
      }

      const { error } = await supabase.from('exchanges').insert({
        business_id: business?.id,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        amount_from_cents: amountCents,
        amount_to_cents: Math.round(amountTo * 100),
        rate: parseFloat(rate)
      });
      if (error) throw error;

      await logActivity({
        business_id: business?.id || '',
        user_id: user?.id || business?.owner_id,
        action: 'EXCHANGE_CURRENCY',
        details: {
          title: `Exchanged ${fromCurrency} to ${toCurrency}`,
          sub: `Rate: ${rate}`,
          amount: `${parseFloat(amountFrom).toLocaleString()} ${fromCurrency}`,
          type: 'wallet'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      setAmountFrom('');
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  const deleteExchangeMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!business?.id) throw new Error('Business session lost');
      const { error, data } = await supabase
        .from('exchanges')
        .delete()
        .eq('id', id)
        .eq('business_id', business.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Could not delete activity. It may have already been removed or you lack permission.");
      }

      await logActivity({
        business_id: business?.id || '',
        user_id: user?.id || business?.owner_id,
        action: 'DELETE_EXCHANGE',
        details: {
          title: `Reverted Exchange`,
          sub: `${data[0].from_currency} to ${data[0].to_currency} record removed`,
          amount: 'REVERTED',
          type: 'wallet'
        }
      });
    },
    onSuccess: () => {
      // Aggressive cache reset to ensure balance and list are perfect
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
    },
    onError: (err: any) => {
      alert('Delete failed: ' + err.message);
    }
  });

  const { data: exchanges = [] } = useQuery({
    queryKey: ['exchanges', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('exchanges')
        .select('*')
        .eq('business_id', business?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!business?.id,
  });

  // Calculate Balances
  const { data: balances } = useQuery({
    queryKey: ['wallet-balances', business?.id],
    queryFn: async () => {
      if (!business?.id) return { bdt: 0, rmb: 0 };
      
      const [
        { data: sales, error: sErr },
        { data: expenses, error: eErr },
        { data: capital, error: cErr },
        { data: distribution, error: dErr },
        { data: internalExchanges, error: exErr },
        { data: ledger, error: lErr },
        { data: purchases, error: pErr }
      ] = await Promise.all([
        supabase.from('sales').select('received_now_bdt_cents').eq('business_id', business.id),
        supabase.from('expenses').select('amount_cents, currency').eq('business_id', business.id),
        supabase.from('capital_contributions').select('amount, currency').eq('business_id', business.id),
        supabase.from('partner_profit_distributions').select('amount_cents').eq('business_id', business.id),
        supabase.from('exchanges').select('*').eq('business_id', business.id),
        supabase.from('customer_ledger').select('amount_cents, transaction_type').eq('business_id', business.id),
        supabase.from('purchase_transactions').select('total_landed_cost_bdt_cents, buying_cost_per_unit_rmb_cents, quantity, exchange_rate_used, paid, additional_cost_bdt_cents, additional_cost_currency').eq('business_id', business.id).eq('paid', true)
      ]);

      if (sErr || eErr || cErr || dErr || exErr || lErr || pErr) {
        console.error('Balance calculation interrupted due to query error:', { sErr, eErr, cErr, dErr, exErr, lErr, pErr });
      }

      let bdt = 0;
      let rmb = 0;

      // Income from Sales (Cash received at point of sale)
      sales?.forEach(s => bdt += (s.received_now_bdt_cents || 0));

      // Income from Customer Payments (Dues collected later)
      ledger?.forEach(l => {
        if (l.transaction_type === 'payment') bdt += (l.amount_cents || 0);
        else if (l.transaction_type === 'return') bdt -= (l.amount_cents || 0);
      });

      // Capital Contributions
      capital?.forEach(c => {
        const amtCents = Math.round(parseFloat(c.amount || '0') * 100);
        if (c.currency === 'BDT') bdt += amtCents;
        else rmb += amtCents;
      });

      // Expenses
      expenses?.forEach(e => {
        if (e.currency === 'BDT') bdt -= (e.amount_cents || 0);
        else rmb -= (e.amount_cents || 0);
      });

      // Purchases (Inventory)
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

      // Exchanges impact (Internal transfers)
      internalExchanges?.forEach((ex: any) => {
        if (ex.from_currency === 'BDT') {
          bdt -= ex.amount_from_cents;
          rmb += ex.amount_to_cents;
        } else {
          rmb -= ex.amount_from_cents;
          bdt += ex.amount_to_cents;
        }
      });

      return { bdt: bdt / 100, rmb: rmb / 100 };
    },
    enabled: !!business?.id
  });

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2 md:px-0">
          <div>
            <div className="flex items-center gap-1.5 text-indigo-600 mb-1">
              <Zap className="w-4 h-4 fill-current" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">Currency Hub</span>
            </div>
            <h1 className="text-xl lg:text-3xl font-bold text-slate-900 tracking-tight uppercase">Money Exchange</h1>
            <p className="text-slate-500 text-xs lg:text-sm font-medium mt-0.5">Manage cross-border liquidity and reserves.</p>
          </div>
        </header>

        {/* Balance Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 px-2 md:px-0">
           <BalanceCard 
             label="Taka Balance" 
             amount={balances?.bdt || 0} 
             currency="BDT" 
             icon={<ArrowUpRight className="w-5 h-5" />} 
             color="indigo"
           />
           <BalanceCard 
             label="Yuan Reserve" 
             amount={balances?.rmb || 0} 
             currency="RMB" 
             icon={<ArrowDownLeft className="w-5 h-5" />} 
             color="emerald"
           />
           <div className="col-span-2 lg:col-span-1 bg-slate-900 p-6 md:p-8 rounded-[28px] md:rounded-[32px] text-white flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 md:p-8 opacity-10 group-hover:scale-110 transition-transform">
                 <WalletIcon className="w-16 h-16 md:w-24 md:h-24" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Market Rate</span>
              <div>
                 <div className="flex items-baseline gap-1.5 mb-1 flex-wrap">
                    <span className="text-2xl md:text-3xl font-black tabular-nums">1.00</span>
                    <span className="text-[10px] font-bold text-white/40">RMB</span>
                    <span className="text-indigo-400 mx-0.5">=</span>
                    <span className="text-2xl md:text-3xl font-black tabular-nums text-indigo-400">{business?.exchange_rate || '18.0'}</span>
                    <span className="text-[10px] font-bold text-white/40">BDT</span>
                 </div>
                 <p className="text-[9px] text-white/50 font-medium">Auto calculation based on settings.</p>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 px-2 md:px-0">
           {/* Exchange Tool - Main Focus */}
           <div className="lg:col-span-12 xl:col-span-7 bg-white p-5 md:p-10 rounded-[32px] md:rounded-[48px] border border-slate-100 shadow-lg shadow-slate-200/40">
              <div className="flex items-center justify-between mb-6 md:mb-10">
                 <div>
                    <h2 className="text-xs lg:text-sm font-bold text-slate-900 uppercase tracking-widest">Convert Currency</h2>
                    <p className="text-xs md:text-sm text-slate-500 font-medium">Shift capital between wallets.</p>
                 </div>
                 <button 
                  onClick={() => setFromCurrency(toCurrency)}
                  className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all active:rotate-180 duration-500 shadow-sm"
                 >
                    <RefreshCw className="w-5 h-5" />
                 </button>
              </div>

              <div className="space-y-8">
                 <div className="relative">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <CurrencyInput 
                             label="Selling" 
                             currency={fromCurrency} 
                             value={amountFrom} 
                             onChange={setAmountFrom} 
                             isPrimary
                          />
                          <div className="px-4 flex justify-between items-center">
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Available</span>
                             <span className={`text-[10px] font-black tabular-nums ${
                                parseFloat(amountFrom || '0') > (fromCurrency === 'BDT' ? (balances?.bdt || 0) : (balances?.rmb || 0))
                                ? 'text-red-500 underline decoration-wavy'
                                : 'text-slate-500'
                             }`}>
                                {fromCurrency === 'BDT' ? balances?.bdt?.toLocaleString() : balances?.rmb?.toLocaleString()} {fromCurrency}
                             </span>
                          </div>
                       </div>
                       <CurrencyInput 
                          label="Receiving" 
                          currency={toCurrency} 
                          value={isNaN(amountTo) ? '0.000' : amountTo.toFixed(3)} 
                          readOnly 
                       />
                    </div>
                    {/* Centered Icon */}
                    <div className="hidden md:flex absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white border-4 border-slate-50 rounded-full items-center justify-center shadow-md z-10">
                       <ArrowRightLeft className="w-4 h-4 text-slate-400" />
                    </div>
                 </div>

                 {parseFloat(amountFrom || '0') > (fromCurrency === 'BDT' ? (balances?.bdt || 0) : (balances?.rmb || 0)) && (
                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                       <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                          <Zap className="w-4 h-4" />
                       </div>
                       <p className="text-xs font-bold text-red-700">Insufficient funds in {fromCurrency} wallet for this transaction.</p>
                    </div>
                 )}

                 <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                          <TrendingUp className="w-5 h-5" />
                       </div>
                       <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Locked Rate</p>
                          <p className="text-sm font-bold text-slate-900">1 {fromCurrency} = {fromCurrency === 'BDT' ? (1/parseFloat(rate)).toFixed(4) : rate} {toCurrency}</p>
                       </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1 text-right">Adjustment</label>
                       <input 
                         type="number" 
                         value={rate} 
                         onChange={(e) => setRate(e.target.value)}
                         className="w-24 h-10 bg-white border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-right"
                       />
                    </div>
                 </div>

                 <button 
                   onClick={() => exchangeMutation.mutate()}
                   disabled={exchangeMutation.isPending || !amountFrom}
                   className="w-full h-16 bg-indigo-600 text-white rounded-[24px] font-black text-sm uppercase tracking-[0.25em] shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-4"
                 >
                    {exchangeMutation.isPending ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        Execute Conversion
                      </>
                    )}
                 </button>
              </div>
           </div>

           {/* History Sidebar */}
           <div className="lg:col-span-12 xl:col-span-5 space-y-6">
              <div className="flex items-center justify-between px-2">
                 <h3 className="text-xs lg:text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                   Recent Activity <History className="w-4 h-4 text-indigo-400" />
                 </h3>
                 <button className="text-[11px] font-semibold text-indigo-600 uppercase tracking-widest">View All</button>
              </div>

              <div className="space-y-4">
                 <AnimatePresence mode="popLayout">
                   {exchanges.map((ex: any) => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={ex.id} 
                        className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                               <div className="relative">
                                  <Coins className="w-6 h-6 text-indigo-400" />
                                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                               </div>
                            </div>
                            <div>
                               <p className="text-sm font-black text-slate-900">{ex.from_currency} to {ex.to_currency}</p>
                               <div className="flex items-center gap-3">
                                 <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-tight flex items-center gap-1.5">
                                   {formatDate(ex.created_at)} • Rate: {ex.rate}
                                 </p>
                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button 
                                     onClick={() => setEditingExchange(ex)}
                                     className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                   >
                                     <Pencil className="w-3 h-3" />
                                   </button>
                                   <button 
                                     onClick={() => setDeletingExchange(ex)}
                                     disabled={deletingId === ex.id}
                                     className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                       deletingId === ex.id 
                                       ? 'bg-slate-50 text-slate-300 cursor-not-allowed' 
                                       : 'bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50'
                                     }`}
                                   >
                                     {deletingId === ex.id ? (
                                       <RefreshCw className="w-3 h-3 animate-spin" />
                                     ) : (
                                       <Trash2 className="w-3 h-3" />
                                     )}
                                   </button>
                                </div>
                               </div>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-sm lg:text-base font-mono font-bold text-indigo-600">+{ex.amount_to_cents/100} {ex.to_currency}</p>
                            <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-tight">-{ex.amount_from_cents/100} {ex.from_currency}</p>
                         </div>
                      </motion.div>
                   ))}
                 </AnimatePresence>
                 
                 {exchanges.length === 0 && (
                    <div className="py-24 bg-slate-50/50 rounded-[40px] border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                       <RefreshCw className="w-12 h-12 mb-4 opacity-10" />
                       <p className="text-[10px] font-black uppercase tracking-widest">No transaction data</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </div>

      {editingExchange && (
        <EditExchangeModal 
          exchange={editingExchange} 
          onClose={() => setEditingExchange(null)} 
        />
      )}

      {deletingExchange && (
        <DeleteConfirmationModal 
          exchange={deletingExchange}
          isDeleting={deletingId === deletingExchange.id}
          onClose={() => setDeletingExchange(null)}
          onConfirm={async () => {
             setDeletingId(deletingExchange.id);
             try {
                await deleteExchangeMutation.mutateAsync(deletingExchange.id);
                setDeletingExchange(null);
             } finally {
                setDeletingId(null);
             }
          }}
        />
      )}
    </MainLayout>
  );
}

function DeleteConfirmationModal({ exchange, isDeleting, onClose, onConfirm }: any) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-sm bg-white rounded-[40px] shadow-2xl overflow-hidden p-8 text-center"
      >
        <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
           <Trash2 className="w-10 h-10" />
        </div>
        
        <h2 className="text-2xl font-black text-slate-900 mb-2">Delete Activity?</h2>
        <p className="text-slate-500 text-sm font-medium mb-8">
          This will revert the exchange of <span className="font-bold text-slate-900">{exchange.amount_from_cents/100} {exchange.from_currency}</span>. 
          Money will be returned to your original wallets.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={onClose}
            className="h-14 rounded-2xl bg-slate-50 text-slate-600 text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-14 rounded-2xl bg-red-600 text-white text-xs font-black uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Delete Now'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function EditExchangeModal({ exchange, onClose }: { exchange: any, onClose: () => void }) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rate, setRate] = useState(exchange.rate.toString());
  const [amountFrom, setAmountFrom] = useState((exchange.amount_from_cents / 100).toString());

  const r = parseFloat(rate) || 1;
  const af = parseFloat(amountFrom) || 0;
  const amountTo = exchange.from_currency === 'BDT' ? (af / r) : (af * r);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!amountFrom || isNaN(parseFloat(amountFrom))) throw new Error('Invalid amount');
      if (!rate || isNaN(parseFloat(rate))) throw new Error('Invalid rate');

      const newAmountCents = Math.round(parseFloat(amountFrom) * 100);
      
      // OPTIONAL: Check if editing causes a negative balance
      // Logic: (Current Balance in From Currency) + (Old Amount From) >= (New Amount From)
      // This is because Current Balance already subtracts Old Amount From.
      // So we effectively revert the old one and check if the new one fits.
      
      const { data: latestBalances } = await queryClient.fetchQuery({
        queryKey: ['wallet-balances', exchange.business_id],
      }) as any;
      
      const currentAvailable = (exchange.from_currency === 'BDT' ? latestBalances?.bdt : latestBalances?.rmb) || 0;
      const oldAmount = exchange.amount_from_cents / 100;
      
      if (parseFloat(amountFrom) > (currentAvailable + oldAmount)) {
        throw new Error(`Insufficient ${exchange.from_currency} balance for this update.`);
      }

      const { error } = await supabase.from('exchanges').update({
        amount_from_cents: newAmountCents,
        amount_to_cents: Math.round(amountTo * 100),
        rate: parseFloat(rate)
      }).eq('id', exchange.id);

      if (error) throw error;

      await logActivity({
        business_id: exchange.business_id,
        user_id: user?.id || business?.owner_id,
        action: 'EDIT_EXCHANGE',
        details: {
          title: `Updated Exchange Rate/Amount`,
          sub: `${exchange.from_currency} to ${exchange.to_currency} entry adjusted`,
          amount: 'EDITED',
          type: 'wallet'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      onClose();
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden p-8"
      >
        <div className="flex items-center justify-between mb-8">
           <div>
              <h2 className="text-xl font-black text-slate-900">Edit Exchange</h2>
              <p className="text-xs text-slate-500 font-medium">Update conversion details for this activity.</p>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <X className="w-5 h-5 text-slate-400" />
           </button>
        </div>

        <div className="space-y-6">
           <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Direction</p>
              <p className="text-sm font-bold text-slate-900">{exchange.from_currency} → {exchange.to_currency}</p>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">From Amount</label>
                 <input 
                   type="number" 
                   value={amountFrom} 
                   onChange={(e) => setAmountFrom(e.target.value)}
                   className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                 />
              </div>
              <div className="space-y-1.5">
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Exchange Rate</label>
                 <input 
                   type="number" 
                   value={rate} 
                   onChange={(e) => setRate(e.target.value)}
                   className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                 />
              </div>
           </div>

           <div className="p-6 bg-slate-900 rounded-3xl text-white">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Resulting Amount</p>
              <p className="text-2xl font-black text-indigo-400 tabular-nums">
                {amountTo.toFixed(3)} <span className="text-xs text-white/40 ml-1">{exchange.to_currency}</span>
              </p>
           </div>

           <button 
             onClick={() => updateMutation.mutate()}
             disabled={updateMutation.isPending}
             className="w-full h-14 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
           >
              {updateMutation.isPending ? 'Updating...' : 'Save Changes'}
           </button>
        </div>
      </motion.div>
    </div>
  );
}

function BalanceCard({ label, amount, currency, icon, color }: any) {
  const colors: any = {
    indigo: "bg-indigo-600 text-white shadow-indigo-100",
    emerald: "bg-white text-emerald-600 border border-emerald-50 shadow-emerald-50/50",
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className={`p-5 md:p-8 rounded-[28px] md:rounded-[32px] shadow-lg md:shadow-xl relative overflow-hidden transition-all ${colors[color]}`}
    >
       <div className={`absolute top-0 right-0 p-4 md:p-6 opacity-20 ${color === 'emerald' ? 'text-emerald-200' : 'text-white'}`}>
          {icon}
       </div>
       <p className={`text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] mb-2 md:mb-4 ${color === 'indigo' ? 'text-white/50' : 'text-slate-400'}`}>{label}</p>
       <div className="flex items-baseline gap-1 md:gap-2">
          <span className="text-xl md:text-3xl font-black tabular-nums tracking-tighter">
             {amount.toLocaleString(undefined, { minimumFractionDigits: 3 })}
          </span>
          <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest ${color === 'indigo' ? 'text-white/50' : 'text-slate-300'}`}>{currency}</span>
       </div>
       <div className="mt-4 md:mt-6 flex items-center gap-1 md:gap-1.5 border border-white/10 w-fit px-2 py-0.5 md:py-1 rounded-lg">
          <div className={`w-1 h-1 rounded-full animate-pulse ${color === 'indigo' ? 'bg-white' : 'bg-emerald-500'}`} />
          <span className={`text-[7px] md:text-[8px] font-bold uppercase tracking-widest ${color === 'indigo' ? 'text-white/40' : 'text-slate-400'}`}>Live</span>
       </div>
    </motion.div>
  );
}

function CurrencyInput({ label, currency, value, onChange, readOnly, isPrimary }: any) {
  return (
    <div className={`p-4 md:p-6 rounded-2xl md:rounded-3xl border-2 transition-all ${isPrimary ? 'bg-indigo-50/20 border-indigo-100' : 'bg-slate-50 border-slate-50'}`}>
       <div className="flex justify-between items-center mb-2 md:mb-4">
          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
          <div className="flex items-center gap-1 bg-white px-2 py-0.5 md:py-1 rounded-lg md:rounded-xl shadow-sm border border-slate-100">
             <div className={`w-1.5 md:w-2 h-1.5 md:h-2 rounded-full ${currency === 'BDT' ? 'bg-indigo-500' : 'bg-red-500'}`} />
             <span className="text-[9px] md:text-[10px] font-bold text-slate-600">{currency}</span>
          </div>
       </div>
       <div className="flex items-center gap-2">
          <input 
            type="number" 
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            readOnly={readOnly}
            placeholder="0.00"
            className="bg-transparent border-none outline-none w-full text-2xl md:text-3xl font-black tabular-nums text-slate-900 placeholder:text-slate-200"
          />
       </div>
    </div>
  );
}
