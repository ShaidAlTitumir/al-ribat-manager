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
  ChevronDown, ArrowRight
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatBDT } from '../lib/utils';
import { Partner } from '../types';

export default function Transactions() {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
         .order('created_at', { ascending: false });
       if (error) throw error;
       return data;
    },
    enabled: !!business?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (transfer: any) => {
      const { error } = await supabase.from('partner_transfers').delete().eq('id', transfer.id);
      if (error) throw error;

      // Log Activity
      await supabase.from('activity_log').insert({
        business_id: business?.id,
        user_id: user?.id,
        action: 'DELETE_TRANSFER',
        details: {
          title: `Voided Partner Transfer`,
          sub: 'Internal Capital Flow Removed',
          amount: `${transfer.currency === 'RMB' ? '¥' : '৳'} ${transfer.amount_cents/100}`,
          type: 'transfer'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner_transfers'] });
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <div key={t.id} className="p-6 flex items-center justify-between group hover:bg-slate-50 transition-all">
                   <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                         <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 shadow-sm">
                            {t.from_partner?.name?.substring(0, 2).toUpperCase()}
                         </div>
                         <ArrowRight className="w-4 h-4 text-slate-200" />
                         <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-[10px] font-bold text-blue-600 shadow-sm">
                            {t.to_partner?.name?.substring(0, 2).toUpperCase()}
                         </div>
                      </div>
                      <div>
                         <p className="text-sm lg:text-base font-semibold text-slate-900">{t.from_partner?.name} → {t.to_partner?.name}</p>
                         <p className="text-xs lg:text-sm font-medium text-slate-400 uppercase tracking-widest mt-0.5">{t.method} • {new Date(t.created_at).toLocaleDateString()}</p>
                      </div>
                   </div>
                    <div className="flex items-center gap-4">
                       <p className="text-sm lg:text-base font-mono font-bold tracking-tight text-slate-900">
                         {t.currency === 'BDT' ? '৳' : '¥'} {t.amount_cents/100}
                       </p>
                       <button 
                         onClick={() => {
                           if (window.confirm('Delete this transfer log?')) {
                             deleteMutation.mutate(t);
                           }
                         }}
                         className="p-2 text-slate-300 hover:text-red-500 transition-all"
                       >
                          <Trash2 className="w-4 h-4" />
                       </button>
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
      </AnimatePresence>
    </MainLayout>
  );
}

function TransferStat({ label, value, sub, color }: any) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
       <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{label}</span>
       <p className={`text-lg lg:text-2xl font-bold tracking-tight mt-1 ${color}`}>{value}</p>
       <p className="text-[9px] font-semibold text-slate-300 uppercase tracking-tighter mt-1">{sub}</p>
    </div>
  );
}

function AddTransferModal({ onClose, partners }: { onClose: () => void, partners: Partner[] }) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    from_partner_id: '', to_partner_id: '', amount: '', currency: 'BDT', method: 'cash', notes: ''
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('partner_transfers').insert({
        ...data,
        business_id: business?.id,
        amount_cents: Math.round(parseFloat(data.amount) * 100)
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner_transfers'] });
      onClose();
    }
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
       <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         exit={{ opacity: 0, scale: 0.95, y: 20 }}
         className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl relative overflow-hidden z-10"
       >
          <div className="p-8 border-b border-slate-50 flex items-center gap-4">
             <div className="w-12 h-12 bg-blue-600 rounded-[20px] flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <ArrowLeftRight className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Log Transfer</h2>
                <p className="text-sm text-slate-400 font-medium tracking-tight">Record internal money movement.</p>
             </div>
          </div>
          <div className="p-8 space-y-6">
             <div className="grid grid-cols-2 gap-4">
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
          </div>
          <div className="p-8 bg-slate-50 flex gap-4">
             <button onClick={onClose} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold uppercase tracking-widest active:scale-95 transition-all">Cancel</button>
             <button 
              onClick={() => mutation.mutate(formData)}
              disabled={mutation.isPending}
              className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all"
             >
                {mutation.isPending ? 'Logging...' : 'Confirm Transfer'}
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
