import React, { useState, useEffect } from 'react';
import { 
  Search, Send, ArrowRightLeft, Wallet, Users, 
  Building2, Smartphone, Landmark, Banknote, MoreHorizontal,
  Plus, Filter, X
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { formatBDT, formatCNY, cn, formatDate } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function SendToPartners() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState({
    totalTransfers: 0,
    totalAmount: 0,
    partnerCount: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: pData } = await supabase.from('partners').select('*');
      const { data: tData } = await supabase.from('partner_transfers').select('*, partners!from_partner_id(name), to_partner:partners!to_partner_id(name)');
      
      if (pData) setPartners(pData);
      if (tData) {
        setTransfers(tData);
        setStats({
          totalTransfers: tData.length,
          totalAmount: tData.reduce((acc, t) => acc + (t.currency === 'BDT' ? t.amount_cents : Math.round(t.amount_cents * t.exchange_rate_used / 100)), 0),
          partnerCount: pData?.length || 0
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  const filters = ['All', 'Bank', 'bKash', 'Nagad', 'Rocket', 'Cash', 'Other'];

  return (
    <div className="space-y-5 pt-2 pb-10">
      {/* Metrics Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transfers</span>
            <ArrowRightLeft className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.totalTransfers}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</span>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 truncate">৳{Math.round(stats.totalAmount / 100)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Partners</span>
            <Users className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.partnerCount}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input 
          type="text"
          placeholder="Search partner or ID..."
          className="w-full bg-white border border-slate-200 h-12 pl-12 pr-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-1">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={cn(
              "px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
              activeFilter === filter 
                ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100" 
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            )}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm min-h-[400px] flex flex-col items-center justify-center p-8">
        {transfers.length === 0 ? (
          <div className="text-center space-y-6">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
              <ArrowRightLeft className="w-10 h-10 text-slate-300" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">No transactions yet</h3>
              <p className="text-sm font-medium text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                Record your first partner-to-partner transfer.
              </p>
            </div>
            <button className="bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all flex items-center gap-3 mx-auto">
              <Send className="w-4 h-4" />
              Send Money
            </button>
          </div>
        ) : (
          <div className="w-full space-y-4">
            {transfers.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900">{t.partners?.name} → {t.to_partner?.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(t.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-sm text-slate-900">
                    {t.currency === 'CNY' ? formatCNY(t.amount_cents) : formatBDT(t.amount_cents)}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.payment_method || 'Transfer'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
