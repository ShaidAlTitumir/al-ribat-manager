// src/pages/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import { useBusiness } from '../context/BusinessContext';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, TrendingDown, Package, Users, 
  ArrowUpRight, ArrowDownRight, Wallet, Receipt,
  Plus, History as HistoryIcon, DollarSign, PieChart, RefreshCw, ArrowLeftRight,
  ShoppingCart,
  CreditCard,
  ShieldCheck
} from 'lucide-react';
import { formatDateTime } from '../lib/utils';
import { format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BusinessMetrics {
  cash_bdt: number;
  inventory_value: number;
  receivables: number;
  payables: number;
  total_assets: number;
  business_value: number;
}

export default function Dashboard() {
  const { business } = useBusiness();
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useState<'1w' | '1m' | '6m' | '1y'>('1w');

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['businessMetrics', business?.id],
    queryFn: async () => {
      if (!business?.id) return null;
      const { data, error } = await supabase.rpc('get_business_valuation', { p_business_id: business.id });
      if (error) throw error;
      return data as BusinessMetrics;
    },
    enabled: !!business?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const isLoading = metricsLoading || !business;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-BD', { 
      style: 'currency', 
      currency: 'BDT', 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(val / 100);
  };

  // Performance Trend Data
  const { data: chartData = [] } = useQuery({
    queryKey: ['performanceTrend', business?.id, timeframe],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const daysCount = timeframe === '1w' ? 7 : timeframe === '1m' ? 30 : timeframe === '6m' ? 180 : 365;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysCount);
      
      const { data: sales } = await supabase
        .from('sales')
        .select('total_cents, expected_profit_cents, created_at')
        .eq('business_id', business.id)
        .gte('created_at', startDate.toISOString());

      const days: Record<string, any> = {};
      for (let i = 0; i < daysCount; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        let name = '';
        if (timeframe === '1w') {
          name = format(d, 'EEE');
        } else if (timeframe === '1m') {
          name = format(d, 'd MMM');
        } else if (timeframe === '6m') {
          name = format(d, 'd MMM yy');
        } else {
          name = format(d, 'd MMM yy');
        }

        days[dateStr] = { 
          name: name, 
          revenue: 0, 
          profit: 0,
          date: dateStr 
        };
      }

      sales?.forEach(s => {
        const dateStr = s.created_at.split('T')[0];
        if (days[dateStr]) {
          days[dateStr].revenue += s.total_cents / 100;
          days[dateStr].profit += s.expected_profit_cents / 100;
        }
      });

      return Object.values(days).sort((a: any, b: any) => a.date.localeCompare(b.date));
    },
    enabled: !!business?.id
  });

  // Calculate Wallet Balances (Copy-pasted logic from Wallet.tsx for consistency)
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
        supabase.from('sales').select('item_id, total_cents, due_cents, cost_rate_cents, received_now_bdt_cents').eq('business_id', business.id),
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
      
      // Purchases impact
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

      return { bdt: bdt / 100, rmb: rmb / 100 };
    },
    enabled: !!business?.id
  });

  // Recent Activity Data
  const { data: recentActivities = [], isLoading: activityLoading } = useQuery({
    queryKey: ['activity_log', 'dashboard', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      
      // Attempt join first
      const { data, error } = await supabase
        .from('activity_log')
        .select(`
          *,
          profiles (
            full_name,
            username
          )
        `)
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Activity fetch error:', error);
        // Fallback to basic fetch if join fails
        const { data: basicData, error: basicError } = await supabase
          .from('activity_log')
          .select('*')
          .eq('business_id', business.id)
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (basicError) throw basicError;
        return (basicData || []).map(a => ({
          id: a.id,
          title: a.details?.title || a.action,
          sub: a.details?.sub || 'System Activity',
          amount: a.details?.amount || 'LOG',
          time: formatDateTime(a.created_at).split(', ')[1],
          type: a.details?.type || 'activity',
          raw_date: a.created_at
        }));
      }

      return (data || []).map(a => ({
        id: a.id,
        title: a.details?.title || a.action,
        sub: a.details?.sub || (a.profiles?.full_name || a.profiles?.username || 'System Activity'),
        amount: a.details?.amount || 'LOG',
        time: formatDateTime(a.created_at).split(', ')[1],
        type: a.details?.type || 'activity',
        raw_date: a.created_at
      }));
    },
    enabled: !!business?.id
  });

  return (
    <MainLayout>
      <div className="space-y-6 animate-in fade-in duration-700">
        {!business ? (
          <div className="bg-gradient-to-br from-blue-700 via-indigo-600 to-blue-800 rounded-[32px] sm:rounded-[48px] p-6 sm:p-12 text-white shadow-2xl shadow-blue-200/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 blur-3xl rounded-full -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-700" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 blur-2xl rounded-full -ml-20 -mb-20" />
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8 sm:gap-12 text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
                <div className="shrink-0">
                  <div className="w-16 h-16 sm:w-24 sm:h-24 bg-white/10 backdrop-blur-xl rounded-[24px] sm:rounded-[32px] p-3 sm:p-4 border border-white/20 shadow-2xl">
                    <img 
                      src="/logo.jpg" 
                      className="w-full h-full object-contain rounded-xl sm:rounded-2xl" 
                      alt="Logo" 
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <h2 className="text-xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-none uppercase">Ready to scale?</h2>
                  <p className="text-blue-100 font-medium text-[10px] sm:text-xs uppercase tracking-[0.2em] leading-relaxed max-w-md mx-auto md:mx-0 opacity-80 flex items-center justify-center md:justify-start gap-2">
                    <ShieldCheck className="w-4 h-4" /> Setup business for full analytics
                  </p>
                </div>
              </div>
              <button 
                onClick={() => navigate('/onboarding')}
                className="px-8 py-4 sm:px-10 sm:py-5 bg-white text-blue-700 rounded-2xl sm:rounded-3xl font-bold text-[10px] sm:text-xs uppercase tracking-[0.25em] shadow-[0_20px_50px_rgba(0,0,0,0.2)] hover:bg-blue-50 active:scale-95 transition-all flex items-center justify-center gap-4 group/btn"
              >
                Launch Now <ArrowUpRight className="w-5 h-5 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
              </button>
            </div>
          </div>
        ) : null}
        {/* Top KPI Cards */}
        {(() => {
          const rmbRate = business?.exchange_rate || 18.15;
          const rmbInBdtCents = balances ? Math.round(balances.rmb * 100 * rmbRate) : 0;

          const computedTotalAssetsCents = metrics && balances
            ? Math.round(balances.bdt * 100) + rmbInBdtCents + (metrics.inventory_value || 0) + (metrics.receivables || 0)
            : null;

          const computedBusinessValueCents = computedTotalAssetsCents !== null && metrics
            ? computedTotalAssetsCents - (metrics.payables || 0)
            : null;

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4">
              <KpiCard 
                title="Business Value" 
                value={computedBusinessValueCents !== null ? formatCurrency(computedBusinessValueCents) : (metrics ? formatCurrency(metrics.business_value) : null)} 
                color="bg-blue-600 text-white" 
                subtext="Net Worth"
                loading={isLoading}
                icon={<DollarSign className="w-3.5 h-3.5" />}
              />
              <KpiCard 
                title="BDT Balance" 
                value={balances ? `৳${Math.round(balances.bdt).toLocaleString()}` : null} 
                subtext="Cash in Hand"
                loading={isLoading}
                icon={<Wallet className="w-3.5 h-3.5 text-blue-500" />}
              />
              <KpiCard 
                title="RMB Balance" 
                value={balances ? `¥${Math.round(balances.rmb).toLocaleString()}` : null} 
                subtext="China Wallet"
                loading={isLoading}
                icon={<RefreshCw className="w-3.5 h-3.5 text-emerald-500" />}
              />
              <KpiCard 
                title="Inventory" 
                value={metrics ? formatCurrency(metrics.inventory_value) : null} 
                subtext="Asset Value"
                loading={isLoading}
                icon={<Package className="w-3.5 h-3.5 text-amber-500" />}
              />
              <KpiCard 
                title="Total Assets" 
                value={computedTotalAssetsCents !== null ? formatCurrency(computedTotalAssetsCents) : (metrics ? formatCurrency(metrics.total_assets) : null)} 
                subtext="Gross Value"
                loading={isLoading}
                icon={<ArrowUpRight className="w-3.5 h-3.5 text-indigo-500" />}
              />
              <KpiCard 
                title="Total Due" 
                value={metrics ? formatCurrency(metrics.receivables) : null} 
                subtext="Receivables"
                loading={isLoading}
                icon={<Users className="w-3.5 h-3.5 text-rose-500" />}
              />
            </div>
          );
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Charts */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] border border-slate-100 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="space-y-1 text-left">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Performance Trend</h3>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                    {timeframe === '1w' && 'Last 7 Days'}
                    {timeframe === '1m' && 'Last 30 Days'}
                    {timeframe === '6m' && 'Last 6 Months'}
                    {timeframe === '1y' && 'Last Year'} Revenue & Profit
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
                    {(['1w', '1m', '6m', '1y'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTimeframe(t)}
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all ${
                          timeframe === t
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {t === '1w' ? '1W' : t === '1m' ? '1M' : t === '6m' ? '6M' : '1Y'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-[9px] font-bold text-slate-500 uppercase">Rev</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[9px] font-bold text-slate-500 uppercase">Profit</span></div>
                  </div>
                </div>
              </div>
              <div className="h-[240px] sm:h-[280px] w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                        dy={10}
                        interval={
                          timeframe === '1w' ? 0 : 
                          timeframe === '1m' ? 6 : 
                          timeframe === '6m' ? 29 : 
                          59
                        }
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                      />
                      <Tooltip 
                        formatter={(value: number) => [value.toFixed(2), undefined]}
                        contentStyle={{ 
                          borderRadius: '20px', 
                          border: 'none', 
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                          padding: '12px'
                        }} 
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                      <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <PieChart className="w-10 h-10 text-slate-200 mb-3" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No activity found yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Activity Sidebar */}
          <div className="lg:col-span-4 h-full">
            <div className="bg-white p-6 rounded-[24px] sm:rounded-[32px] border border-slate-100 shadow-sm h-full flex flex-col">
              <div className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <HistoryIcon className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight">Recent Activity</h3>
                </div>
                <button 
                  onClick={() => navigate('/activities')}
                  className="px-3 py-1.5 bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-widest rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  History
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[330px] sm:max-h-[352px] scrollbar-thin scrollbar-thumb-slate-100 scrollbar-track-transparent">
                {recentActivities.map((activity, idx) => (
                  <ActivityItem 
                    key={`${activity.id}-${idx}`}
                    title={activity.title}
                    sub={activity.sub}
                    amount={activity.amount}
                    time={activity.time}
                    type={activity.type}
                    index={idx}
                  />
                ))}
                
                {recentActivities.length === 0 && !activityLoading && (
                  <div className="flex flex-col items-center justify-center py-12 opacity-30">
                    <HistoryIcon className="w-12 h-12 text-slate-200 mb-4" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Awaiting records...</p>
                  </div>
                )}
                
                {activityLoading && (
                  <div className="space-y-4 animate-pulse">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="flex gap-4">
                        <div className="w-10 h-10 bg-slate-50 rounded-2xl" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-slate-50 rounded w-2/3" />
                          <div className="h-2 bg-slate-50 rounded w-1/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-6 pt-4 border-t border-slate-50 shrink-0">
                <button 
                  onClick={() => navigate('/activities')}
                  className="w-full py-3 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 group/btn"
                >
                  Full Audit Log <ArrowUpRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function KpiCard({ title, value, color, subtext, icon, loading }: any) {
  return (
    <div className={`p-4 sm:p-5 rounded-[24px] sm:rounded-[32px] border border-slate-100 shadow-sm ${color || 'bg-white'} hover:shadow-md transition-all group`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.1em] ${color ? 'text-white/60' : 'text-slate-400'}`}>{title}</span>
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${color ? 'bg-white/20' : 'bg-slate-50'}`}>
          {icon}
        </div>
      </div>
      {loading ? (
        <div className={`h-6 w-20 sm:w-24 rounded animate-pulse ${color ? 'bg-white/20' : 'bg-slate-100'}`} />
      ) : (
        <p className="text-base sm:text-lg lg:text-xl font-bold tracking-tighter leading-none mb-1">{value || '0'}</p>
      )}
      <p className={`text-[8px] sm:text-[9px] font-medium ${color ? 'text-white/40' : 'text-slate-400'} uppercase tracking-widest truncate mt-1`}>{subtext}</p>
    </div>
  );
}

function ActivityItem({ title, sub, amount, time, type, index }: any) {
  const colors = {
    sale: 'bg-emerald-50 text-emerald-600',
    expense: 'bg-red-50 text-red-600',
    capital: 'bg-blue-50 text-blue-600',
    payment: 'bg-indigo-50 text-indigo-600',
    return: 'bg-orange-50 text-orange-600',
    purchase: 'bg-slate-100 text-slate-600',
    transfer: 'bg-blue-50 text-blue-600',
    customer: 'bg-purple-50 text-purple-600',
    partner: 'bg-pink-50 text-pink-600',
    inventory: 'bg-amber-50 text-amber-600',
    supplier: 'bg-indigo-50 text-indigo-600',
    wallet: 'bg-cyan-50 text-cyan-600',
  };
  
  const getIcon = () => {
    switch(type) {
      case 'sale': return <Receipt className="w-4 h-4" />;
      case 'expense': return <TrendingDown className="w-4 h-4" />;
      case 'capital': return <Wallet className="w-4 h-4" />;
      case 'payment': return <CreditCard className="w-4 h-4" />;
      case 'return': return <RefreshCw className="w-4 h-4" />;
      case 'purchase': return <Package className="w-4 h-4" />;
      case 'transfer': return <ArrowLeftRight className="w-4 h-4" />;
      case 'customer': return <Users className="w-4 h-4" />;
      case 'partner': return <Users className="w-4 h-4" />;
      case 'inventory': return <ShoppingCart className="w-4 h-4" />;
      case 'supplier': return <Users className="w-4 h-4" />;
      case 'wallet': return <Wallet className="w-4 h-4" />;
      default: return <HistoryIcon className="w-4 h-4" />;
    }
  };

  const amountString = amount || '';
  const isPositive = typeof amountString === 'string' && (amountString.startsWith('+') || ['NEW', 'JOINED', 'FUNDED', 'ADDED', 'ACTIVE'].includes(amountString));
  const isNegative = typeof amountString === 'string' && (amountString.startsWith('-') || ['REMOVED', 'DELETED', 'REVERTED'].includes(amountString));

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: (index % 10) * 0.05 }}
      className="flex items-center gap-4 group cursor-pointer p-1 -m-1 rounded-2xl hover:bg-slate-50 transition-colors"
    >
      <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-[18px] flex items-center justify-center shrink-0 transition-all group-hover:scale-105 group-active:scale-95 ${colors[type as keyof typeof colors] || 'bg-slate-50 text-slate-400'}`}>
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-[11px] sm:text-xs font-bold text-slate-900 truncate leading-none mb-1">{title}</h4>
        <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-widest">{sub}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-[11px] sm:text-xs font-mono font-bold ${isPositive ? 'text-emerald-600' : (isNegative ? 'text-red-500' : 'text-slate-900')}`}>{amount}</p>
        <p className="text-[8px] sm:text-[9px] font-medium text-slate-300 mt-1 uppercase tracking-tighter">{time}</p>
      </div>
    </motion.div>
  );
}
