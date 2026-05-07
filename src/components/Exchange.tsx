import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, Wallet, ArrowDownUp, Pencil, Trash2, 
  ChevronDown, Info, AlertCircle, CheckCircle2, Landmark
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { formatBDT, formatCNY, cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Exchange() {
  const [exchangeRate, setExchangeRate] = useState(18.15);
  const [bdtBalance, setBdtBalance] = useState(1308895); // In cents
  const [rmbBalance, setRmbBalance] = useState(115315); // In cents
  const [recentExchanges, setRecentExchanges] = useState<any[]>([]);
  
  // Form State
  const [fromCurrency, setFromCurrency] = useState<'BDT' | 'RMB'>('BDT');
  const [amount, setAmount] = useState(0);
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [customRate, setCustomRate] = useState(18.15);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: rate } = await supabase.from('exchange_rates').select('cny_to_bdt_rate').order('created_at', { ascending: false }).limit(1).single();
    if (rate) {
      setExchangeRate(rate.cny_to_bdt_rate / 100);
      setCustomRate(rate.cny_to_bdt_rate / 100);
    }

    // Mock recent exchanges for now
    setRecentExchanges([
      { id: 1, from: 'BDT', to: 'RMB', fromAmount: 2500000, toAmount: 137741, rate: 18.15, date: 'Mar 14' },
      { id: 2, from: 'BDT', to: 'RMB', fromAmount: 2000000, toAmount: 112359, rate: 17.8, date: 'Mar 13' },
      { id: 3, from: 'BDT', to: 'RMB', fromAmount: 1500000, toAmount: 84269, rate: 17.8, date: 'Mar 12' },
      { id: 4, from: 'BDT', to: 'RMB', fromAmount: 500000, toAmount: 28137, rate: 17.77, date: 'Mar 12' },
    ]);
  }

  const toCurrency = fromCurrency === 'BDT' ? 'RMB' : 'BDT';
  const currentRate = useCustomRate ? customRate : exchangeRate;
  
  const estimatedToAmount = fromCurrency === 'BDT' 
    ? (amount * 100) / currentRate 
    : (amount * 100) * currentRate;

  const handleExchange = async () => {
    if (amount <= 0) return alert('Please enter a valid amount');
    
    setLoading(true);
    // In a real app, we would update the wallets table and record the transaction
    setTimeout(() => {
      alert('Exchange successful!');
      setAmount(0);
      setLoading(false);
    }, 1000);
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setAmount(0);
  };

  return (
    <div className="space-y-4 pt-2 pb-10">
      {/* Header */}
      <div className="flex justify-between items-center px-1">
        <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">Wallet</h1>
        <div className="bg-slate-100 px-3 py-1.5 rounded-xl flex items-center gap-2 border border-slate-200">
          <RefreshCw className="w-3 h-3 text-slate-500" />
          <span className="font-mono text-[11px] font-bold text-slate-700">¥1 = ৳{exchangeRate.toFixed(2)}</span>
        </div>
      </div>

      {/* Wallet Cards */}
      <div className="space-y-3">
        {/* BDT Wallet */}
        <div className="relative overflow-hidden bg-white rounded-2xl border-l-4 border-blue-500 shadow-sm p-5 border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Landmark className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BDT WALLET</span>
          </div>
          <p className="text-xs font-bold text-slate-500 mb-1">BDT Balance</p>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            ৳-{(bdtBalance / 100).toFixed(2)}
          </h2>
        </div>

        {/* RMB Wallet */}
        <div className="relative overflow-hidden bg-white rounded-2xl border-l-4 border-slate-400 shadow-sm p-5 border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600">
              <RefreshCw className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">RMB WALLET</span>
          </div>
          <p className="text-xs font-bold text-slate-500 mb-1">RMB Balance</p>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            ¥{(rmbBalance / 100).toFixed(2)}
          </h2>
        </div>
      </div>

      {/* Currency Exchange Section */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Currency Exchange</h2>
          <div className="bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
            <span className="text-[10px] font-black text-blue-600 uppercase">1 RMB = {exchangeRate.toFixed(2)} BDT</span>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Custom Rate Toggle */}
          <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 border border-slate-100">
                <ArrowDownUp className="w-4 h-4 rotate-90" />
              </div>
              <span className="text-xs font-bold text-slate-600">Use custom rate for this exchange</span>
            </div>
            <button 
              onClick={() => setUseCustomRate(!useCustomRate)}
              className={cn(
                "w-11 h-6 rounded-full transition-all relative",
                useCustomRate ? "bg-blue-600" : "bg-slate-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                useCustomRate ? "left-6" : "left-1"
              )} />
            </button>
          </div>

          {useCustomRate && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-1.5 overflow-hidden"
            >
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Custom Exchange Rate</label>
              <input 
                type="number"
                className="w-full bg-slate-50 border border-slate-100 h-12 px-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                value={customRate}
                onChange={(e) => setCustomRate(Number(e.target.value))}
              />
            </motion.div>
          )}

          {/* FROM Block */}
          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FROM</span>
              <span className="text-[10px] font-bold text-slate-400">
                Balance: {fromCurrency === 'BDT' ? `৳-${(bdtBalance/100).toFixed(2)}` : `¥${(rmbBalance/100).toFixed(2)}`}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-white border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2 shadow-sm">
                <span className="text-xs font-black text-slate-900">{fromCurrency}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>
              <input 
                type="number"
                placeholder="0.00"
                className="flex-1 bg-transparent border-none focus:ring-0 text-3xl font-black text-slate-900 placeholder:text-slate-200 p-0"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center -my-6 relative z-10">
            <button 
              onClick={swapCurrencies}
              className="w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-100 flex items-center justify-center active:scale-90 transition-transform border-4 border-white"
            >
              <ArrowDownUp className="w-5 h-5" />
            </button>
          </div>

          {/* TO Block */}
          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-3 pt-8">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TO (ESTIMATED)</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-white border border-slate-100 rounded-2xl px-4 py-2 flex items-center gap-2 shadow-sm">
                <span className="text-xs font-black text-slate-900">{toCurrency}</span>
              </div>
              <div className="flex-1 text-3xl font-black text-slate-900">
                {estimatedToAmount > 0 ? (estimatedToAmount / 100).toFixed(2) : '0.00'}
              </div>
            </div>
          </div>

          <button 
            onClick={handleExchange}
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-blue-100 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4"
          >
            <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            {loading ? 'Processing...' : 'Exchange Assets'}
          </button>
        </div>
      </section>

      {/* Recent Exchanges */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-50">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Recent Exchanges</h2>
        </div>
        <div className="p-4 space-y-3">
          {recentExchanges.map(ex => (
            <div key={ex.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-900">{ex.from} → {ex.to}</h3>
                <span className="text-[10px] font-bold text-slate-400">{ex.date}</span>
              </div>
              <div className="flex justify-between items-end">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-500">
                    {ex.from === 'BDT' ? '৳' : '¥'}{ (ex.fromAmount / 100).toLocaleString() } → 
                    {ex.to === 'BDT' ? '৳' : '¥'}{ (ex.toAmount / 100).toLocaleString() }
                  </p>
                  <p className="text-[10px] font-bold text-slate-400">@ {ex.rate}</p>
                </div>
                <div className="flex gap-1">
                  <button className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
