// src/pages/Transactions.tsx
import React, { useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeftRight, Plus, User, CreditCard, 
  Search, Filter, History, Trash2, CheckCircle2,
  Building2, Smartphone, Banknote, MoreVertical,
  ChevronDown, ArrowRight, Pencil
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatBDT, formatDate } from '../lib/utils';
import { Partner } from '../types';
import { logActivity } from '../lib/activity';

export default function Transactions() {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<any>(null);

  const { data: partners = [] } = useQuery({
    queryKey: ['partners', business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('partners').select('*').eq('business_id', business?.id);
      if (error) throw error;
      return data as Partner[];
    },
    enabled: !!business?.id,
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ['partner_transfers', business?.id],
    queryFn: async () => {
       const { data, error } = await supabase
         .from('partner_transfers')
         .select('*, from_partner:partners!from_partner_id(name), to_partner:partners!to_partner_id(name)')
         .eq('business_id', business?.id)
         .order('transfer_date', { ascending: false })
         .order('created_at', { ascending: false });
       if (error) {
         console.error('Transfers Fetch Error:', error);
         throw error;
       }
       return data;
    },
    enabled: !!business?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (transfer: any) => {
      // 1. Reverse balance changes if they were applied
      // Note: We'll assume for now we want to keep balances in sync with transfers
      await supabase.rpc('increment_partner_balance', { 
        p_id: transfer.from_partner_id, 
        amount_cents: transfer.amount_cents 
      });
      await supabase.rpc('increment_partner_balance', { 
        p_id: transfer.to_partner_id, 
        amount_cents: -transfer.amount_cents 
      });

      // 2. Delete the record
      const { error } = await supabase.from('partner_transfers').delete().eq('id', transfer.id);
      if (error) throw error;

      // 3. Log Activity
      await logActivity({
        business_id: business?.id || '',
        user_id: user?.id,
        action: 'DELETE_TRANSFER',
        details: {
          title: `Voided Partner Transfer`,
          sub: 'Internal Capital Flow Reversed',
          amount: `${transfer.currency === 'RMB' ? '¥' : '৳'} ${transfer.amount_cents/100}`,
          type: 'transfer'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner_transfers'] });
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    }
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
              <h1 className="text-xl lg:text-3xl font-bold text-slate-900 tracking-tight uppercase">Partner Transfers</h1>
              <p className="text-slate-400 text-xs lg:text-sm font-medium uppercase tracking-[0.2em] mt-1">Log money movement between partners.</p>
           </div>
           <button 
             onClick={() => setIsAddModalOpen(true)}
             className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-100"
           >
              <Plus className="w-4 h-4" /> Log Transfer
           </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
           <TransferStat label="Total Volume" value={formatBDT(transfers.reduce((acc, t) => acc + (t.currency === 'BDT' ? t.amount_cents : 0), 0))} sub="In BDT" color="text-slate-900" />
           <TransferStat label="Transactions" value={transfers.length.toString()} sub="All time" color="text-blue-600" />
           <TransferStat label="RMB Volume" value={`¥ ${(transfers.reduce((acc, t) => acc + (t.currency === 'RMB' ? t.amount_cents : 0), 0) / 100).toLocaleString()}`} sub="In RMB" color="text-emerald-600" />
           <TransferStat label="Avg. Amount" value={transfers.length > 0 ? formatBDT(transfers.reduce((acc, t) => acc + (t.currency === 'BDT' ? t.amount_cents : 0), 0) / transfers.length) : '৳ 0'} sub="Per BDT transfer" color="text-orange-500" />
        </div>

        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
           <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-xs lg:text-sm font-bold text-slate-900 uppercase tracking-widest">Recent Logs</h3>
              <div className="flex items-center gap-2">
                 <button className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:text-slate-600 transition-all"><Search className="w-4 h-4" /></button>
                 <button className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:text-slate-600 transition-all"><Filter className="w-4 h-4" /></button>
              </div>
           </div>
           <div className="divide-y divide-slate-50">
              {transfers.map((t: any) => (
                <div key={t.id} className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between group hover:bg-slate-50 transition-all gap-4">
                   <div className="flex items-center gap-3 md:gap-6">
                      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                         <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-black text-slate-900 shadow-sm transition-transform group-hover:scale-105">
                            {t.from_partner?.name?.substring(0, 2).toUpperCase()}
                         </div>
                         <div className="flex flex-col items-center gap-0.5">
                            <ArrowRight className="w-3 h-3 md:w-4 md:h-4 text-blue-500" />
                            <div className="w-1 md:w-1.5 h-0.5 bg-slate-100 rounded-full" />
                         </div>
                         <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-blue-600 border border-blue-500 flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-blue-100 transition-transform group-hover:scale-105">
                            {t.to_partner?.name?.substring(0, 2).toUpperCase()}
                         </div>
                      </div>
                      <div className="min-w-0">
                         <p className="text-sm md:text-base font-semibold text-slate-900 truncate">{t.from_partner?.name} → {t.to_partner?.name}</p>
                         <div className="flex items-center gap-2 mt-0.5">
                           <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase tracking-wider">{t.method}</span>
                           <span className="text-[10px] md:text-xs font-medium text-slate-400 uppercase tracking-widest">{formatDate(t.transfer_date || t.created_at)}</span>
                         </div>
                         {t.notes && <p className="text-xs text-slate-400 mt-1 italic font-medium line-clamp-1">"{t.notes}"</p>}
                      </div>
                   </div>
                    <div className="flex items-center justify-between md:justify-end gap-6 bg-slate-50/50 md:bg-transparent p-3 md:p-0 rounded-2xl md:rounded-none">
                       <div className="text-left md:text-right">
                          <p className="text-xs font-bold text-slate-300 uppercase tracking-[0.2em] md:hidden">Amount</p>
                          <p className="text-base md:text-lg font-mono font-bold tracking-tight text-slate-900">
                            {t.currency === 'BDT' ? '৳' : '¥'} {(t.amount_cents/100).toLocaleString()}
                          </p>
                       </div>
                       <div className="flex items-center gap-1 md:gap-2">
                         <button 
                           onClick={() => setEditingTransfer(t)}
                           className="p-2.5 md:p-2 bg-white md:bg-transparent border border-slate-100 md:border-none shadow-sm md:shadow-none rounded-xl text-slate-400 hover:text-blue-500 transition-all"
                         >
                            <History className="w-4 h-4" />
                         </button>
                         <button 
                           onClick={() => {
                             if (window.confirm('Delete this transfer log?')) {
                               deleteMutation.mutate(t);
                             }
                           }}
                           className="p-2.5 md:p-2 bg-white md:bg-transparent border border-slate-100 md:border-none shadow-sm md:shadow-none rounded-xl text-slate-400 hover:text-red-500 transition-all"
                         >
                            <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                    </div>
                </div>
              ))}
              {transfers.length === 0 && (
                 <div className="py-20 flex flex-col items-center justify-center text-slate-200">
                    <ArrowLeftRight className="w-16 h-16 mb-4 opacity-5" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">No transfer records found</p>
                 </div>
              )}
           </div>
        </div>
      </div>

      <AnimatePresence>
         {isAddModalOpen && (
           <AddTransferModal onClose={() => setIsAddModalOpen(false)} partners={partners} />
         )}
         {editingTransfer && (
           <EditTransferModal 
             transfer={editingTransfer} 
             onClose={() => setEditingTransfer(null)} 
             partners={partners} 
           />
         )}
      </AnimatePresence>
    </MainLayout>
  );
}

function TransferStat({ label, value, sub, color }: any) {
  return (
    <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
       <span className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1 md:mb-2">{label}</span>
       <p className={`text-base md:text-2xl font-black tracking-tight ${color}`}>{value}</p>
       <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter mt-1">{sub}</p>
    </div>
  );
}

function AddTransferModal({ onClose, partners }: { onClose: () => void, partners: Partner[] }) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    from_partner_id: '', 
    to_partner_id: '', 
    amount: '', 
    currency: 'BDT', 
    method: 'cash', 
    notes: '',
    transfer_date: new Date().toISOString().split('T')[0]
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (!data.from_partner_id || !data.to_partner_id || !data.amount) {
        throw new Error('Please fill in all required fields');
      }

      if (data.from_partner_id === data.to_partner_id) {
        throw new Error('From and To partners cannot be the same');
      }

      const fromPartner = partners.find(p => p.id === data.from_partner_id);
      const toPartner = partners.find(p => p.id === data.to_partner_id);

      const amountCents = Math.round(parseFloat(data.amount) * 100);
      const payload = {
        business_id: business?.id,
        user_id: user?.id,
        from_partner_id: data.from_partner_id,
        to_partner_id: data.to_partner_id,
        amount_cents: amountCents,
        currency: data.currency,
        method: data.method,
        notes: data.notes,
        transfer_date: data.transfer_date
      };

      const { error } = await supabase.from('partner_transfers').insert(payload);
      if (error) throw error;

      // Update Balances
      await supabase.rpc('increment_partner_balance', { p_id: data.from_partner_id, amount_cents: -amountCents });
      await supabase.rpc('increment_partner_balance', { p_id: data.to_partner_id, amount_cents: amountCents });

      await logActivity({
        business_id: business?.id || '',
        user_id: user?.id,
        action: 'ADD_TRANSFER',
        details: {
          title: `Partner Transfer: ${fromPartner?.name || 'Partner'} → ${toPartner?.name || 'Partner'}`,
          sub: `Method: ${data.method} | Date: ${data.transfer_date}`,
          amount: `${data.currency === 'RMB' ? '¥' : '৳'} ${data.amount}`,
          type: 'transfer',
          metadata: { notes: data.notes }
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner_transfers'] });
      onClose();
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to log transfer');
    }
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
       <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         exit={{ opacity: 0, scale: 0.95, y: 20 }}
         className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative overflow-hidden z-10 mx-auto"
       >
          <div className="p-6 md:p-8 border-b border-slate-50 flex items-center gap-4">
             <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-2xl md:rounded-[20px] flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <ArrowLeftRight className="w-5 h-5 md:w-6 md:h-6" />
             </div>
             <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Log Transfer</h2>
                <p className="text-xs md:text-sm text-slate-400 font-medium tracking-tight">Record internal money movement.</p>
             </div>
          </div>
          <div className="p-6 md:p-8 space-y-5 md:space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
             <div className="grid grid-cols-2 gap-3 md:gap-4">
                <SelectInput 
                  label="From Partner" 
                  value={formData.from_partner_id} 
                  onChange={v => setFormData({...formData, from_partner_id: v})} 
                  options={partners.map(p => ({ value: p.id, label: p.name }))}
                />
                <SelectInput 
                  label="To Partner" 
                  value={formData.to_partner_id} 
                  onChange={v => setFormData({...formData, to_partner_id: v})} 
                  options={partners.map(p => ({ value: p.id, label: p.name }))}
                />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <Input label="Amount" type="number" value={formData.amount} onChange={v => setFormData({...formData, amount: v})} />
                <Input label="Transfer Date" type="date" value={formData.transfer_date} onChange={v => setFormData({...formData, transfer_date: v})} />
             </div>
             <div className="grid grid-cols-1 gap-4">
               <SelectInput 
                 label="Currency" 
                 value={formData.currency} 
                 onChange={v => setFormData({...formData, currency: v})} 
                 options={[{ value: 'BDT', label: 'BDT (৳)' }, { value: 'RMB', label: 'RMB (¥)' }]}
               />
             </div>
             <div className="space-y-1.5 shadow-sm">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Transfer Method</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                   {['Cash', 'bKash', 'Bank', 'Other'].map(m => (
                     <button 
                      key={m}
                      onClick={() => setFormData({...formData, method: m.toLowerCase()})}
                      className={`py-3 rounded-2xl border text-[10px] font-bold uppercase tracking-widest transition-all ${formData.method === m.toLowerCase() ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-50 text-slate-400'}`}
                     >
                       {m}
                     </button>
                   ))}
                </div>
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Notes (Optional)</label>
                <textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional details about this transfer..."
                  className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium min-h-[100px] resize-none"
                />
             </div>
          </div>
          <div className="p-6 md:p-8 bg-slate-50/50 flex gap-3 md:gap-4">
             <button onClick={onClose} className="flex-1 py-3.5 md:py-4 bg-white border border-slate-200 rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-widest active:scale-95 transition-all text-slate-500">Cancel</button>
             <button 
              onClick={() => mutation.mutate(formData)}
              disabled={mutation.isPending}
              className="flex-[2] py-3.5 md:py-4 bg-blue-600 text-white rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all disabled:opacity-50"
             >
                {mutation.isPending ? 'Logging...' : 'Confirm Transfer'}
             </button>
          </div>
       </motion.div>
    </div>
  );
}

function EditTransferModal({ onClose, partners, transfer }: { onClose: () => void, partners: Partner[], transfer: any }) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    from_partner_id: transfer.from_partner_id, 
    to_partner_id: transfer.to_partner_id, 
    amount: (transfer.amount_cents / 100).toString(), 
    currency: transfer.currency, 
    method: transfer.method, 
    notes: transfer.notes || '',
    transfer_date: transfer.transfer_date || transfer.created_at?.split('T')[0] || new Date().toISOString().split('T')[0]
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (!data.from_partner_id || !data.to_partner_id || !data.amount) {
        throw new Error('Please fill in all required fields');
      }

      if (data.from_partner_id === data.to_partner_id) {
        throw new Error('From and To partners cannot be the same');
      }

      const fromPartner = partners.find(p => p.id === data.from_partner_id);
      const toPartner = partners.find(p => p.id === data.to_partner_id);
      const newAmountCents = Math.round(parseFloat(data.amount) * 100);

      // 1. Revert OLD balance changes
      await supabase.rpc('increment_partner_balance', { 
        p_id: transfer.from_partner_id, 
        amount_cents: transfer.amount_cents 
      });
      await supabase.rpc('increment_partner_balance', { 
        p_id: transfer.to_partner_id, 
        amount_cents: -transfer.amount_cents 
      });

      // 2. Apply NEW balance changes
      await supabase.rpc('increment_partner_balance', { 
        p_id: data.from_partner_id, 
        amount_cents: -newAmountCents 
      });
      await supabase.rpc('increment_partner_balance', { 
        p_id: data.to_partner_id, 
        amount_cents: newAmountCents 
      });

      const payload = {
        from_partner_id: data.from_partner_id,
        to_partner_id: data.to_partner_id,
        amount_cents: newAmountCents,
        currency: data.currency,
        method: data.method,
        notes: data.notes,
        transfer_date: data.transfer_date,
        user_id: user?.id
      };

      const { error } = await supabase.from('partner_transfers').update(payload).eq('id', transfer.id);
      if (error) throw error;

      await logActivity({
        business_id: business?.id || '',
        user_id: user?.id,
        action: 'UPDATE_TRANSFER',
        details: {
          title: `Updated Transfer: ${fromPartner?.name || 'Partner'} → ${toPartner?.name || 'Partner'}`,
          sub: `Method: ${data.method} | Date: ${data.transfer_date}`,
          amount: `${data.currency === 'RMB' ? '¥' : '৳'} ${data.amount}`,
          type: 'transfer',
          metadata: { notes: data.notes }
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner_transfers'] });
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      onClose();
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to update transfer');
    }
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
       <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         exit={{ opacity: 0, scale: 0.95, y: 20 }}
         className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative overflow-hidden z-10 mx-auto"
       >
          <div className="p-6 md:p-8 border-b border-slate-50 flex items-center gap-4">
             <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 rounded-2xl md:rounded-[20px] flex items-center justify-center text-white shadow-lg shadow-slate-200">
                <History className="w-5 h-5 md:w-6 md:h-6" />
             </div>
             <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Edit Transfer</h2>
                <p className="text-xs md:text-sm text-slate-400 font-medium tracking-tight">Modify transfer details.</p>
             </div>
          </div>
          <div className="p-6 md:p-8 space-y-5 md:space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
             <div className="grid grid-cols-2 gap-3 md:gap-4">
                <SelectInput 
                  label="From Partner" 
                  value={formData.from_partner_id} 
                  onChange={v => setFormData({...formData, from_partner_id: v})} 
                  options={partners.map(p => ({ value: p.id, label: p.name }))}
                />
                <SelectInput 
                  label="To Partner" 
                  value={formData.to_partner_id} 
                  onChange={v => setFormData({...formData, to_partner_id: v})} 
                  options={partners.map(p => ({ value: p.id, label: p.name }))}
                />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <Input label="Amount" type="number" value={formData.amount} onChange={v => setFormData({...formData, amount: v})} />
                <Input label="Transfer Date" type="date" value={formData.transfer_date} onChange={v => setFormData({...formData, transfer_date: v})} />
             </div>
             <div className="grid grid-cols-1 gap-4">
              <SelectInput 
                label="Currency" 
                value={formData.currency} 
                onChange={v => setFormData({...formData, currency: v})} 
                options={[{ value: 'BDT', label: 'BDT (৳)' }, { value: 'RMB', label: 'RMB (¥)' }]}
              />
             </div>
             <div className="space-y-1.5 shadow-sm">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Transfer Method</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                   {['Cash', 'bKash', 'Bank', 'Other'].map(m => (
                     <button 
                      key={m}
                      onClick={() => setFormData({...formData, method: m.toLowerCase()})}
                      className={`py-3 rounded-2xl border text-[10px] font-bold uppercase tracking-widest transition-all ${formData.method === m.toLowerCase() ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-50 text-slate-400'}`}
                     >
                       {m}
                     </button>
                   ))}
                </div>
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Notes (Optional)</label>
                <textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional details about this transfer..."
                  className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium min-h-[100px] resize-none"
                />
             </div>
          </div>
          <div className="p-6 md:p-8 bg-slate-50/50 flex gap-3 md:gap-4">
             <button onClick={onClose} className="flex-1 py-3.5 md:py-4 bg-white border border-slate-200 rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-widest active:scale-95 transition-all text-slate-500">Cancel</button>
             <button 
              onClick={() => mutation.mutate(formData)}
              disabled={mutation.isPending}
              className="flex-[2] py-3.5 md:py-4 bg-slate-900 text-white rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-xl shadow-slate-100 active:scale-95 transition-all disabled:opacity-50"
             >
                {mutation.isPending ? 'Saving...' : 'Update Log'}
             </button>
          </div>
       </motion.div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }: any) {
  return (
    <div className="space-y-1.5 flex-1">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 ml-1">{label}</label>
      <input 
        type={type}
        className="w-full bg-slate-50 border border-slate-100 h-14 px-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-base md:text-sm font-medium"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          if (type === 'number' && value === '0') {
            onChange('');
          }
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

function SelectInput({ label, value, onChange, options }: any) {
  return (
    <div className="space-y-1.5 flex-1 shadow-sm">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 ml-1">{label}</label>
      <div className="relative">
        <select 
          className="w-full bg-slate-50 border border-slate-50 h-14 px-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none transition-all text-base md:text-sm font-medium pr-10"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose...</option>
          {options.map((opt: any) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}
