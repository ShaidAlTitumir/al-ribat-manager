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
  CreditCard
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
    return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(val / 100);
  };

  // Performance Trend Data
  const { data: chartData = [] } = useQuery({
    queryKey: ['performanceTrend', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: sales } = await supabase
        .from('sales')
        .select('total_cents, expected_profit_cents, created_at')
        .eq('business_id', business.id)
        .gte('created_at', sevenDaysAgo.toISOString());

      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount_cents, created_at')
        .eq('business_id', business.id)
        .gte('created_at', sevenDaysAgo.toISOString());

      const days: Record<string, any> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        days[dateStr] = { 
          name: format(d, 'EEE'), 
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

      // Deduct expenses from profit if desired, or show separately
      // For trend purposes, let's just show gross revenue and profit from items
      
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
        supabase.from('sales').select('received_now_bdt_cents').eq('business_id', business.id),
        supabase.from('expenses').select('amount_cents, currency').eq('business_id', business.id),
        supabase.from('capital_contributions').select('amount, currency').eq('business_id', business.id),
        supabase.from('partner_profit_distributions').select('amount_cents').eq('business_id', business.id),
        supabase.from('exchanges').select('*').eq('business_id', business.id),
        supabase.from('customer_ledger').select('amount_cents, transaction_type').eq('business_id', business.id),
        supabase.from('purchase_transactions').select('total_landed_cost_bdt_cents, buying_cost_per_unit_rmb_cents, quantity, exchange_rate_used, paid').eq('business_id', business.id).eq('paid', true)
      ]);

      if (sErr || eErr || cErr || dErr || exErr || lErr || pErr) {
        console.error('Balance calculation interrupted due to query error:', { sErr, eErr, cErr, dErr, exErr, lErr, pErr });
      }

      let bdt = 0;
      let rmb = 0;

      sales?.forEach(s => bdt += (s.received_now_bdt_cents || 0));
      ledger?.forEach(l => {
        if (l.transaction_type === 'payment') bdt += (l.amount_cents || 0);
        else if (l.transaction_type === 'return') bdt -= (l.amount_cents || 0);
      });
      capital?.forEach(c => {
        const amtCents = Math.round(parseFloat(c.amount || '0') * 100);
        if (c.currency === 'BDT') bdt += amtCents;
        else rmb += amtCents;
      });
      distribution?.forEach(d => bdt -= (d.amount_cents || 0));
      expenses?.forEach(e => {
        if (e.currency === 'BDT') bdt -= (e.amount_cents || 0);
        else rmb -= (e.amount_cents || 0);
      });
      
      // Purchases impact
      purchases?.forEach(p => {
        const productCostRmbCents = (p.buying_cost_per_unit_rmb_cents || 0) * (p.quantity || 0);
        rmb -= productCostRmbCents;
        const productCostBDTCents = Math.round(productCostRmbCents * (p.exchange_rate_used || 1));
        const shippingAndOtherBDTCents = (p.total_landed_cost_bdt_cents || 0) - productCostBDTCents;
        bdt -= Math.max(0, shippingAndOtherBDTCents);
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
          profiles:user_id (
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
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[32px] p-8 text-white shadow-xl shadow-blue-200 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="shrink-0">
                  <img 
                    src="/logo.jpg" 
                    className="w-20 h-20 bg-white rounded-[24px] p-2 shadow-2xl shadow-blue-900/20" 
                    alt="Logo" 
                  />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black tracking-tight leading-none uppercase">Empower Your business</h2>
                  <p className="text-blue-100 font-bold text-[10px] uppercase tracking-widest leading-relaxed max-w-lg">
                    Setup your business to unlock full inventory tracking, sales management, and profit analytics.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => navigate('/onboarding')}
                className="px-8 py-4 bg-white text-blue-600 rounded-2xl font-bold text-xs uppercase tracking-[0.2em] shadow-lg hover:bg-blue-50 transition-all active:scale-95 flex items-center gap-3"
              >
                Get Started <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : null}
        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard 
            title="Business Value" 
            value={metrics ? formatCurrency(metrics.business_value) : null} 
            color="bg-blue-600 text-white" 
            subtext="Equity (Net)"
            loading={isLoading}
            icon={<DollarSign className="w-3.5 h-3.5" />}
          />
          <KpiCard 
            title="BDT Balance" 
            value={balances ? `৳${Math.round(balances.bdt).toLocaleString()}` : null} 
            subtext="Wallet (Cash)"
            loading={isLoading}
            icon={<Wallet className="w-3.5 h-3.5 text-blue-500" />}
          />
          <KpiCard 
            title="RMB Balance" 
            value={balances ? `¥${Math.round(balances.rmb).toLocaleString()}` : null} 
            subtext="Wallet (Cash)"
            loading={isLoading}
            icon={<RefreshCw className="w-3.5 h-3.5 text-emerald-500" />}
          />
          <KpiCard 
            title="Inventory" 
            value={metrics ? formatCurrency(metrics.inventory_value) : null} 
            subtext="Current Stock"
            loading={isLoading}
            icon={<Package className="w-3.5 h-3.5 text-orange-500" />}
          />
          <KpiCard 
            title="Total Assets" 
            value={metrics ? formatCurrency(metrics.total_assets) : null} 
            subtext={metrics ? `Cash + Stock + Dues` : "Gross Value"}
            loading={isLoading}
            icon={<ArrowUpRight className="w-3.5 h-3.5 text-indigo-500" />}
          />
          <KpiCard 
            title="Total Due" 
            value={metrics ? formatCurrency(metrics.receivables) : null} 
            subtext="Customer Dues"
            loading={isLoading}
            icon={<Users className="w-3.5 h-3.5 text-red-500" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Charts */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">Performance</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /><span className="text-[9px] font-bold text-slate-400 uppercase">Rev</span></div>
                  <div className="flex items-center gap-1.5 ml-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-[9px] font-bold text-slate-400 uppercase">Profit</span></div>
                </div>
              </div>
              <div className="h-[200px] w-full flex items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                      <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center">
                    <PieChart className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No chart data available</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            </div>
          </div>

          {/* Activity Sidebar */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <HistoryIcon className="w-3.5 h-3.5 text-blue-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-tighter">Recent Activities</h3>
                </div>
                <button 
                  onClick={() => navigate('/activities')}
                  className="text-[9px] font-bold text-blue-600 uppercase tracking-widest hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-100 scrollbar-track-transparent">
                <div className="space-y-4">
                  {recentActivities.map((activity, idx) => (
                    <ActivityItem 
                      key={activity.id}
                      title={activity.title}
                      sub={activity.sub}
                      amount={activity.amount}
                      time={activity.time}
                      type={activity.type}
                      index={idx}
                    />
                  ))}
                  
                  {recentActivities.length === 0 && !activityLoading && (
                    <div className="text-center py-8">
                      <HistoryIcon className="w-8 h-8 text-slate-100 mx-auto mb-3" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No activities recorded yet</p>
                    </div>
                  )}
                  
                  {activityLoading && (
                    <div className="space-y-4 animate-pulse">
                      {[1, 2, 3].map(i => (
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
              </div>
              {recentActivities.length > 6 && (
                <button 
                  onClick={() => navigate('/activities')}
                  className="w-full mt-8 py-3 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group/btn"
                >
                  View Full Audit Log <ArrowUpRight className="w-3 h-3 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function KpiCard({ title, value, color, subtext, icon, loading }: any) {
  return (
    <div className={`p-4 rounded-2xl border border-slate-100 shadow-sm ${color || 'bg-white'} transition-all`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[9px] font-black uppercase tracking-widest ${color ? 'text-white/60' : 'text-slate-400'}`}>{title}</span>
        <div className={`w-6 h-6 rounded flex items-center justify-center ${color ? 'bg-white/20' : 'bg-slate-50'}`}>
          {icon}
        </div>
      </div>
      {loading ? (
        <div className={`h-6 w-24 rounded animate-pulse ${color ? 'bg-white/20' : 'bg-slate-100'}`} />
      ) : (
        <p className="text-lg font-black tracking-tight">{value || '0'}</p>
      )}
      <p className={`text-[8px] mt-0.5 font-black ${color ? 'text-white/40' : 'text-slate-400'} uppercase tracking-tight truncate`}>{subtext}</p>
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
      className="flex items-center gap-3 group cursor-pointer"
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-active:scale-90 ${colors[type as keyof typeof colors] || 'bg-slate-50 text-slate-400'}`}>
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-[11px] font-bold text-slate-900 truncate leading-tight">{title}</h4>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">{sub}</p>
      </div>
      <div className="text-right">
        <p className={`text-[11px] font-mono font-black ${isPositive ? 'text-emerald-600' : (isNegative ? 'text-red-500' : 'text-slate-900')}`}>{amount}</p>
        <p className="text-[8px] font-bold text-slate-300 mt-0.5">{time}</p>
      </div>
    </motion.div>
  );
}
