import React, { useState, useEffect } from 'react';
import { 
  Users, ArrowRightLeft, Plus, TrendingUp, History, Info, Send, User, 
  UserPlus, Search, Landmark, Wallet, CreditCard, ChevronDown, PieChart, 
  Circle, LogOut, RefreshCw, Pencil, Trash2, Building2
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { formatBDT, formatCNY, cn, formatDate } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Partners() {
  const [partners, setPartners] = useState<any[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState(18.15);
  
  // Form States
  const [searchUsername, setSearchUsername] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [capitalAmount, setCapitalAmount] = useState(0);
  const [capitalCurrency, setCapitalCurrency] = useState<'BDT' | 'RMB'>('BDT');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: pData } = await supabase.from('partners').select('*').order('name');
    const { data: cData } = await supabase.from('partner_transfers').select('*, partners!from_partner_id(name)').order('created_at', { ascending: false }).limit(10);
    const { data: rate } = await supabase.from('exchange_rates').select('cny_to_bdt_rate').order('created_at', { ascending: false }).limit(1).single();

    if (pData) setPartners(pData);
    if (cData) setContributions(cData);
    if (rate) setExchangeRate(rate.cny_to_bdt_rate / 100);
  }

  const handleAddCapital = async () => {
    if (!selectedPartner || capitalAmount <= 0) return alert('Please select a partner and enter a valid amount');

    const amountCents = capitalAmount * 100;
    const bdtAmountCents = capitalCurrency === 'RMB' ? Math.round(amountCents * exchangeRate) : amountCents;

    const { error } = await supabase.from('partner_transfers').insert({
      from_partner_id: selectedPartner.id,
      to_partner_id: selectedPartner.id, // Self-contribution for capital
      amount_cents: amountCents,
      currency: capitalCurrency === 'RMB' ? 'CNY' : 'BDT',
      exchange_rate_used: Math.round(exchangeRate * 100)
    });

    if (error) return alert(error.message);

    // Update partner balance
    await supabase.rpc('increment_partner_balance', {
      p_id: selectedPartner.id,
      amount: bdtAmountCents
    });

    alert('Capital added successfully!');
    setCapitalAmount(0);
    setSelectedPartner(null);
    fetchData();
  };

  const totalCapitalCents = partners.reduce((acc, p) => acc + p.current_balance_cents, 0);

  return (
    <div className="space-y-4 pt-2 pb-10">
      {/* Header */}
      <div className="flex justify-between items-center px-1">
        <h1 className="text-[15px] font-semibold text-slate-900 uppercase tracking-tight">Partners</h1>
        <div className="bg-slate-100 px-3 py-1.5 rounded-xl flex items-center gap-2 border border-slate-200">
          <RefreshCw className="w-3 h-3 text-slate-500" />
          <span className="font-mono text-[10px] font-semibold text-slate-700">¥1 = ৳{exchangeRate.toFixed(2)}</span>
        </div>
      </div>

      {/* Section 1: Add Partner */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-50 flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
            <UserPlus className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-900">Add Partner</h2>
        </div>
        <div className="p-3 space-y-2">
          <label className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Search by Username</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs">@</span>
              <input 
                type="text"
                placeholder="username"
                className="w-full bg-slate-50 border border-slate-100 h-10 pl-7 pr-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-xs"
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
              />
            </div>
            <button className="bg-blue-600 text-white px-4 rounded-xl font-semibold text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all">
              Search
            </button>
          </div>
          <p className="text-[9px] text-slate-400 font-normal ml-1">Partners must set a username in Settings first.</p>
        </div>
      </section>

      {/* Section 2: Add Capital */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-50 flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-900">Add Capital</h2>
        </div>
        <div className="p-3 space-y-3">
          <div className="space-y-1">
            <label className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Select Partner</label>
            <div className="relative">
              <select 
                className="w-full bg-slate-50 border border-slate-100 h-10 px-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-semibold text-xs text-slate-900"
                value={selectedPartner?.id || ''}
                onChange={(e) => setSelectedPartner(partners.find(p => p.id === e.target.value))}
              >
                <option value="">Choose partner...</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Amount</label>
              <input 
                type="number"
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-100 h-10 px-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-semibold text-xs"
                value={capitalAmount || ''}
                onChange={(e) => setCapitalAmount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Currency</label>
              <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 h-10">
                <button 
                  onClick={() => setCapitalCurrency('BDT')}
                  className={cn(
                    "flex-1 rounded-lg text-[9px] font-semibold uppercase tracking-widest transition-all",
                    capitalCurrency === 'BDT' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"
                  )}
                >
                  BDT
                </button>
                <button 
                  onClick={() => setCapitalCurrency('RMB')}
                  className={cn(
                    "flex-1 rounded-lg text-[9px] font-semibold uppercase tracking-widest transition-all",
                    capitalCurrency === 'RMB' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"
                  )}
                >
                  RMB
                </button>
              </div>
            </div>
          </div>

          <button 
            onClick={handleAddCapital}
            className="w-full py-3 bg-blue-600 text-white rounded-2xl font-semibold text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-blue-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
          >
            <Wallet className="w-3.5 h-3.5" />
            Add Capital
          </button>
        </div>
      </section>

      {/* Section 3: Partner List */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-50 flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
            <Users className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-900">Partner List ({partners.length})</h2>
        </div>
        <div className="p-1.5 space-y-0.5">
          {partners.map(p => (
            <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-[10px]">
                  {p.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-xs text-slate-900">{p.name}</p>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Admin</p>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 transition-colors" />
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Partner Equity */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-50 flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
            <PieChart className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-900">Partner Equity</h2>
        </div>
        <div className="p-3 space-y-3">
          {partners.map(p => (
            <div key={p.id} className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-xs text-slate-900">{p.name}</p>
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Admin</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-semibold text-xs text-slate-900">{formatBDT(p.current_balance_cents)}</p>
                <p className="text-[9px] font-semibold text-blue-600 uppercase tracking-widest">
                  {totalCapitalCents > 0 ? ((p.current_balance_cents / totalCapitalCents) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
            </div>
          ))}
          <div className="pt-3 border-t border-slate-50 flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-widest">Total Capital</span>
            <span className="font-mono text-xs font-semibold text-slate-900">{formatBDT(totalCapitalCents)}</span>
          </div>
        </div>
      </section>

      {/* Section 5: Capital Contributions */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-50 flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
            <History className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-900">Capital Contributions ({contributions.length})</h2>
        </div>
        <div className="p-3 space-y-2">
          {contributions.map(c => (
            <div key={c.id} className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between border border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                  <span className="font-semibold text-xs">{c.currency === 'CNY' ? '¥' : '৳'}</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-xs text-slate-900">
                      {c.currency === 'CNY' ? formatCNY(c.amount_cents) : formatBDT(c.amount_cents)}
                    </span>
                    <span className="text-[9px] font-semibold text-slate-400">
                      (≈ {formatBDT(c.currency === 'CNY' ? Math.round(c.amount_cents * c.exchange_rate_used / 100) : c.amount_cents)})
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-tight">
                    {c.partners?.name} • {formatDate(c.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex gap-0.5">
                <button className="p-1 text-slate-300 hover:text-slate-600 transition-colors">
                  <Pencil className="w-3 h-3" />
                </button>
                <button className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm space-y-1.5">
          <div className="flex items-center gap-1.5 text-blue-600">
            <Users className="w-3.5 h-3.5" />
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Total Partners</span>
          </div>
          <p className="text-xl font-semibold text-slate-900">{partners.length}</p>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm space-y-1.5">
          <div className="flex items-center gap-1.5 text-blue-600">
            <Wallet className="w-3.5 h-3.5" />
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Total Capital</span>
          </div>
          <p className="text-xl font-semibold text-slate-900 truncate">{formatBDT(totalCapitalCents)}</p>
        </div>
      </div>

      {/* Leave Business Section */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-red-600">
            <LogOut className="w-4 h-4" />
          </div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-900">Leave Business</h2>
        </div>
        <p className="text-xs font-normal text-slate-500 leading-relaxed">
          You are the only partner. To leave, delete the business from the Settings page.
        </p>
      </section>
    </div>
  );
}
