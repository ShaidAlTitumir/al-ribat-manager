import React, { useState, useEffect } from 'react';
import { TrendingUp, Package, Truck, Users, AlertCircle, Plus, ShoppingCart, ArrowRightLeft, Wallet, PieChart, Info } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { formatBDT, cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { fetchFinancialMetrics, FinancialMetrics } from '@/src/lib/finances';
import { useBusiness } from '@/src/context/BusinessContext';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
}

export default function Dashboard({ setActiveTab }: DashboardProps) {
  const { business } = useBusiness();
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [transitCount, setTransitCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!business?.id) return;
      setLoading(true);
      try {
        const finMetrics = await fetchFinancialMetrics(business.id, business.exchange_rate);
        setMetrics(finMetrics);

        // Fetch supplementary counts
        const [shipmentsRes, customersRes] = await Promise.all([
          supabase.from('shipments').select('id').eq('status', 'in_transit'),
          supabase.from('customers').select('total_due_cents').gt('total_due_cents', 0)
        ]);

        setTransitCount(shipmentsRes.data?.length || 0);
        setOverdueCount(customersRes.data?.length || 0);

        // Fetch Recent Activity
        const [transactionsRes, salesRes] = await Promise.all([
          supabase.from('partner_transactions').select('*, partners(name)').order('created_at', { ascending: false }).limit(5),
          supabase.from('sales').select('*, customers(name)').order('created_at', { ascending: false }).limit(5)
        ]);

        const combined = [
          ...(transactionsRes.data || []).map(t => ({
            id: t.id,
            type: 'transaction',
            title: `${t.partners?.name || 'Partner'} - ${t.type.replace('_', ' ')}`,
            subtitle: t.description || 'Equity adjustment',
            amount: t.amount_cents,
            time: new Date(t.created_at),
            color: t.amount_cents > 0 ? 'border-emerald-400' : 'border-red-400',
            icon: ArrowRightLeft
          })),
          ...(salesRes.data || []).map(s => ({
            id: s.id,
            type: 'sale',
            title: `Sale: ${s.invoice_no}`,
            subtitle: `Client: ${s.customers?.name || 'Unknown'}`,
            amount: s.total_cents,
            time: new Date(s.created_at),
            color: 'border-orange-400',
            icon: ShoppingCart
          }))
        ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 6);

        setActivities(combined);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const quickActions = [
    { label: 'Add Sale', icon: ShoppingCart, color: 'bg-blue-50 text-blue-600', tab: 'sales' },
    { label: 'Inventory', icon: Package, color: 'bg-slate-50 text-slate-600', tab: 'inventory' },
    { label: 'Partners', icon: Users, color: 'bg-slate-50 text-slate-600', tab: 'partners' },
    { label: 'Transfer', icon: ArrowRightLeft, color: 'bg-orange-50 text-orange-600', tab: 'partners' },
  ];

  return (
    <div className="space-y-5 pt-3">
      {/* Business Value (Equity) Card */}
      <motion.section 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-slate-900 p-5 rounded-3xl shadow-xl shadow-slate-200/50 text-white"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-white/40 text-[10px] lg:text-xs font-semibold tracking-[0.2em] uppercase leading-none">Net Value</p>
                <h2 className="text-xs lg:text-sm font-medium text-white tracking-tight mt-0.5">Business Value</h2>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Live Audit</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-1 mb-6">
            <h1 className={cn(
              "text-2xl lg:text-4xl font-black tabular-nums tracking-tighter",
              (metrics?.businessValue || 0) < 0 ? "text-red-400" : "text-white"
            )}>
              {formatBDT((metrics?.businessValue || 0) * 100)}
            </h1>
            <div className="flex items-center gap-2">
               <span className="text-[10px] lg:text-xs font-medium text-white/40 uppercase tracking-widest">Total Assets: {formatBDT((metrics?.totalAssets || 0) * 100)}</span>
               <span className="w-1 h-1 rounded-full bg-white/20" />
               <span className="text-[10px] lg:text-xs font-medium text-red-400/60 uppercase tracking-widest">Liabilities: -{formatBDT((metrics?.totalLiabilities || 0) * 100)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-5 border-t border-white/5">
            <div className="space-y-1">
               <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Per Partner Share</p>
               <p className="text-sm font-black text-indigo-400 font-mono tracking-tight">৳{((metrics?.partnerShare || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="text-right flex flex-col justify-end">
               <p className="text-[8px] font-medium text-white/20 italic">Based on 3 equal partners</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Metrics Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard 
          label="Inventory" 
          value={formatBDT((metrics?.inventoryValue || 0) * 100)} 
          subtext="Current Stock" 
          icon={Package}
        />
        <MetricCard 
          label="Wallet (BDT)" 
          value={formatBDT((metrics?.bdtBalance || 0) * 100)} 
          subtext="Cash/Bank" 
          icon={Wallet}
        />
        <MetricCard 
          label="Wallet (RMB)" 
          value={`¥${(metrics?.rmbBalance || 0).toLocaleString()}`} 
          subtext={`≈ ${formatBDT((metrics?.rmbBalance || 0) * (business?.exchange_rate || 0) * 100)}`} 
          icon={ArrowRightLeft}
        />
        <MetricCard 
          label="Receivables" 
          value={formatBDT((metrics?.customerDue || 0) * 100)} 
          subtext={`${overdueCount} Accounts`} 
          error={(metrics?.customerDue || 0) > 0} 
          icon={Users}
        />
      </section>

      {/* Quick Actions */}
      <section className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-4 text-center">Command Center</h2>
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((action, i) => (
            <button 
              key={i} 
              onClick={() => setActiveTab(action.tab)}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-sm group-active:scale-90 transition-transform", action.color)}>
                <action.icon className="w-4.5 h-4.5" />
              </div>
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tight">{action.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section className="pb-4">
        <div className="flex justify-between items-center mb-3 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-900">Recent Activity</h2>
          <button 
            onClick={() => setActiveTab('partners')}
            className="text-[10px] font-semibold text-orange-500 hover:text-orange-600 transition-colors"
          >
            View All
          </button>
        </div>
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Loading activity...</div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm italic">No recent activity found</div>
          ) : (
            activities.map((activity) => (
              <ActivityItem 
                key={activity.id}
                title={activity.title}
                subtitle={activity.subtitle}
                amount={formatBDT(Math.abs(activity.amount))} 
                time={activity.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                color={activity.color}
                icon={activity.icon}
                isError={activity.amount < 0 && activity.type === 'transaction'}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, subtext, icon: Icon, badge, error }: any) {
  return (
    <div className={cn(
      "bg-white p-3 rounded-2xl border border-slate-100 transition-all shadow-sm",
      error && "border-red-100"
    )}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-slate-400 text-xs lg:text-sm font-medium uppercase tracking-widest">{label}</p>
        {Icon && <Icon className="w-3 h-3 text-slate-300" />}
      </div>
      <div className="flex flex-col">
        <span className={cn("text-lg lg:text-2xl font-bold font-mono tracking-tight", error ? "text-red-600" : "text-slate-900")}>{value}</span>
        <span className={cn(
          "text-[10px] lg:text-xs flex items-center gap-1 font-normal mt-0.5",
          error ? "text-red-500" : "text-slate-400"
        )}>
          {error && <AlertCircle className="w-2 h-2" />}
          {subtext}
        </span>
      </div>
    </div>
  );
}

function ActivityItem({ title, subtitle, amount, time, color, icon: Icon, isError }: any) {
  return (
    <div className={cn("flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm", color && "border-l-4")}>
      <div className="bg-slate-50 p-1.5 rounded-lg">
        <Icon className={cn("w-3.5 h-3.5", isError ? "text-red-500" : "text-slate-500")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-900 truncate">{title}</p>
        <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-tight truncate">{subtitle}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-xs font-mono font-semibold", isError ? "text-red-600" : "text-emerald-600")}>{amount}</p>
        <p className="text-[9px] text-slate-400 font-mono font-semibold">{time}</p>
      </div>
    </div>
  );
}
