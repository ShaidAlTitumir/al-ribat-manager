// src/pages/Reports.tsx
import React, { useState, useMemo } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useBusiness } from '../context/BusinessContext';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  FileText, Download, TrendingUp, Package, 
  Users, Calculator, Calendar, ChevronRight,
  TrendingDown, DollarSign, PieChart, ShieldCheck,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  History as HistoryIcon
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatBDT, formatDate, isValidDate } from '../lib/utils';
import { generateBusinessReport } from '../lib/pdfGenerator';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export default function Reports() {
  const { business } = useBusiness();
  const [dateRange, setDateRange] = useState('This Month');
  const [customStart, setCustomStart] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  const rangeDates = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case 'Today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'This Week':
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case 'This Month':
        return { start: startOfMonth(now), end: endOfDay(now) };
      case 'Last Month':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'Custom':
        const s = new Date(customStart);
        const e = new Date(customEnd);
        return { 
          start: startOfDay(isValidDate(s) ? s : now), 
          end: endOfDay(isValidDate(e) ? e : now) 
        };
      default:
        return { start: startOfMonth(now), end: endOfDay(now) };
    }
  }, [dateRange, customStart, customEnd]);

  const { start, end } = rangeDates;

  // 1. Sales Metrics
  const { data: salesData } = useQuery({
    queryKey: ['sales-report', business?.id, start.toISOString(), end.toISOString()],
    queryFn: async () => {
       const query = supabase.from('sales').select('total_cents, cost_rate_cents, quantity, received_now_bdt_cents').eq('business_id', business?.id);
       query.gte('created_at', start.toISOString());
       query.lte('created_at', end.toISOString());
       const { data } = await query;
       
       const count = data?.length || 0;
       const revenue = data?.reduce((acc, curr) => acc + curr.total_cents, 0) || 0;
       const cost = data?.reduce((acc, curr) => acc + (curr.cost_rate_cents * curr.quantity), 0) || 0;
       const units = data?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;
       const collectedAtSale = data?.reduce((acc, curr) => acc + (curr.received_now_bdt_cents || 0), 0) || 0;
       
       return { count, revenue, cost, units, collectedAtSale };
    },
    enabled: !!business?.id
  });

  // 2. Expenses Metrics
  const { data: expensesData } = useQuery({
    queryKey: ['expenses-report', business?.id, start.toISOString(), end.toISOString()],
    queryFn: async () => {
       const query = supabase.from('expenses').select('amount_cents, currency, category').eq('business_id', business?.id);
       query.gte('created_at', start.toISOString());
       query.lte('created_at', end.toISOString());
       const { data } = await query;
       
       const total = data?.reduce((acc, curr) => {
         const amount = curr.currency === 'BDT' ? curr.amount_cents : curr.amount_cents * (business?.exchange_rate || 18);
         return acc + amount;
       }, 0) || 0;

       const byCategory = (data || []).reduce((acc: any, curr: any) => {
          const cat = curr.category || 'General';
          if (!acc[cat]) acc[cat] = 0;
          const amt = curr.currency === 'BDT' ? curr.amount_cents : curr.amount_cents * (business?.exchange_rate || 18);
          acc[cat] += amt / 100;
          return acc;
       }, {});

       return { total, byCategory: Object.entries(byCategory).map(([category, amount]) => ({ category, amount: amount as number })) };
    },
    enabled: !!business?.id
  });

  // 3. Purchase Metrics
  const { data: purchasesTotal = 0 } = useQuery({
    queryKey: ['purchases-report', business?.id, start.toISOString(), end.toISOString()],
    queryFn: async () => {
       const query = supabase.from('purchase_transactions').select('total_landed_cost_bdt_cents').eq('business_id', business?.id);
       query.gte('created_at', start.toISOString());
       query.lte('created_at', end.toISOString());
       const { data } = await query;
       return data?.reduce((acc, curr) => acc + curr.total_landed_cost_bdt_cents, 0) || 0;
    },
    enabled: !!business?.id
  });

  // 4. Collections Metrics (Ledger payments)
  const { data: ledgerCollections = 0 } = useQuery({
    queryKey: ['ledger-collections', business?.id, start.toISOString(), end.toISOString()],
    queryFn: async () => {
       const query = supabase.from('customer_ledger').select('amount_cents').eq('business_id', business?.id).eq('transaction_type', 'payment');
       query.gte('created_at', start.toISOString());
       query.lte('created_at', end.toISOString());
       const { data } = await query;
       return data?.reduce((acc, curr) => acc + curr.amount_cents, 0) || 0;
    },
    enabled: !!business?.id
  });

  // 5. Distributions
  const { data: distributionsTotal = 0 } = useQuery({
    queryKey: ['distributions-report', business?.id, start.toISOString(), end.toISOString()],
    queryFn: async () => {
       const query = supabase.from('partner_profit_distributions').select('amount_cents').eq('business_id', business?.id);
       query.gte('created_at', start.toISOString());
       query.lte('created_at', end.toISOString());
       const { data } = await query;
       return data?.reduce((acc, curr) => acc + curr.amount_cents, 0) || 0;
    },
    enabled: !!business?.id
  });

  const { data: valuation } = useQuery({
    queryKey: ['business-valuation', business?.id],
    queryFn: async () => {
       const [valRes, salesRes, expensesRes, capitalRes, exchangesRes, purchasesRes, itemsRes] = await Promise.all([
         supabase.rpc('get_business_valuation', { p_business_id: business?.id }),
         supabase.from('sales').select('quantity, cost_rate_cents').eq('business_id', business?.id).is('item_id', null),
         supabase.from('expenses').select('amount_cents, currency').eq('business_id', business?.id),
         supabase.from('capital_contributions').select('amount, currency').eq('business_id', business?.id),
         supabase.from('exchanges').select('*').eq('business_id', business?.id),
         supabase.from('purchase_transactions').select('total_landed_cost_bdt_cents, buying_cost_per_unit_rmb_cents, quantity, exchange_rate_used, paid, additional_cost_bdt_cents, additional_cost_currency').eq('business_id', business?.id).eq('paid', true),
         supabase.from('inventory_items').select('current_stock, last_landed_cost_cents').eq('business_id', business?.id)
       ]);
       if (valRes.error) throw valRes.error;
       const rawVal = valRes.data as any;
       if (!rawVal) return null;

       const totalServiceCostCents = salesRes.data?.reduce((sum, s) => sum + ((s.cost_rate_cents || 0) * (s.quantity || 1)), 0) || 0;

       // Calculate RMB balance
       let rmbCents = 0;
       capitalRes.data?.forEach(c => {
         const amtCents = Math.round(parseFloat(c.amount || '0') * 100);
         if (c.currency === 'RMB') rmbCents += amtCents;
       });
       expensesRes.data?.forEach(e => {
         if (e.currency === 'RMB') rmbCents -= (e.amount_cents || 0);
       });
       purchasesRes.data?.forEach(p => {
         const productCostRmbCents = (p.buying_cost_per_unit_rmb_cents || 0) * (p.quantity || 0);
         rmbCents -= productCostRmbCents;
         if (p.additional_cost_currency === 'RMB') {
           rmbCents -= Math.round((p.additional_cost_bdt_cents || 0) / (p.exchange_rate_used || 1));
         }
       });
       exchangesRes.data?.forEach(ex => {
         if (ex.from_currency === 'BDT') {
           rmbCents += ex.amount_to_cents;
         } else {
           rmbCents -= ex.amount_from_cents;
         }
       });

       const rmbRate = business?.exchange_rate || 18.15;
       const rmbInBdtCents = Math.round(rmbCents * rmbRate);

       const computedInventoryValueCents = (itemsRes.data || []).reduce(
         (acc, i) => acc + (i.current_stock * (i.last_landed_cost_cents || 0)),
         0
       );

       const correctCashBdt = rawVal.cash_bdt - totalServiceCostCents;
       const correctTotalAssets = correctCashBdt + rmbInBdtCents + computedInventoryValueCents + (rawVal.receivables || 0);
       const correctBusinessValue = correctTotalAssets - (rawVal.payables || 0);

       return {
         ...rawVal,
         inventory_value: computedInventoryValueCents,
         cash_bdt: correctCashBdt,
         cash_rmb: rmbCents,
         total_assets: correctTotalAssets,
         business_value: correctBusinessValue,
       };
    },
    enabled: !!business?.id
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ['top-products', business?.id, start.toISOString(), end.toISOString()],
    queryFn: async () => {
       const query = supabase
        .from('sales')
        .select('inventory_items(name), quantity, total_cents')
        .eq('business_id', business?.id);
       query.gte('created_at', start.toISOString());
       query.lte('created_at', end.toISOString());
       const { data } = await query;
       
       const grouped = (data || []).reduce((acc: any, curr: any) => {
         const name = curr.inventory_items?.name || 'Unknown';
         if (!acc[name]) acc[name] = { name, quantity: 0, revenue: 0 };
         acc[name].quantity += curr.quantity;
         acc[name].revenue += curr.total_cents / 100;
         return acc;
       }, {});

       return Object.values(grouped)
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 5);
    },
    enabled: !!business?.id
  });

  const { data: overdueCount = 0 } = useQuery({
    queryKey: ['overdue-count', business?.id],
    queryFn: async () => {
       const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true }).eq('business_id', business?.id).gt('total_due_cents', 0);
       return count || 0;
    },
    enabled: !!business?.id
  });

  const totalRevenue = salesData?.revenue || 0;
  const totalCost = salesData?.cost || 0;
  const totalExpenses = expensesData?.total || 0;
  const grossProfit = totalRevenue - totalCost;
  const netProfit = grossProfit - totalExpenses;
  const totalCollected = (salesData?.collectedAtSale || 0) + (ledgerCollections || 0);

  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    if (!business) return;
    setGenerating(true);
    
    let periodString = dateRange;
    if (dateRange === 'Custom') {
      const startStr = isValidDate(customStart) ? format(new Date(customStart), 'dd/MM/yyyy') : 'Start';
      const endStr = isValidDate(customEnd) ? format(new Date(customEnd), 'dd/MM/yyyy') : 'End';
      periodString = `${startStr} - ${endStr}`;
    }

    try {
      generateBusinessReport(
        {
          name: business.name,
          phone: business.phone,
          address: business.address
        },
        {
          period: periodString,
          metrics: {
            totalRevenue: totalRevenue / 100,
            totalCost: totalCost / 100,
            grossProfit: grossProfit / 100,
            totalExpenses: totalExpenses / 100,
            netProfit: netProfit / 100,
            salesCount: salesData?.count || 0,
            unitsSold: salesData?.units || 0,
            overdueCount: overdueCount,
            totalPurchases: purchasesTotal / 100,
            cashCollected: totalCollected / 100,
            distributions: distributionsTotal / 100
          },
          financials: {
            cashBalance: (valuation?.cash_bdt || 0) / 100,
            receivables: (valuation?.receivables || 0) / 100,
            payables: (valuation?.payables || 0) / 100,
            inventoryValue: (valuation?.inventory_value || 0) / 100,
            rmbBalance: (valuation?.cash_rmb || 0) / 100
          },
          topProducts: topProducts as any,
          expensesByCategory: expensesData?.byCategory
        }
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-5 md:space-y-8 pb-10 px-0 sm:px-2 md:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 sm:px-0">
           <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight uppercase">Financial Reports</h1>
              <p className="text-slate-400 text-[10px] sm:text-xs lg:text-sm font-medium uppercase tracking-[0.2em] mt-1">Deep dive into your business analytics.</p>
           </div>
            <button 
              onClick={generatePDF}
              disabled={generating}
              className="w-full sm:w-auto px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200/50 disabled:opacity-50"
            >
               {generating ? (
                 <Loader2 className="w-4 h-4 animate-spin" />
               ) : (
                 <Download className="w-4 h-4" />
               )}
               {generating ? 'Generating Report...' : 'Export Excellence Report'}
            </button>
        </div>

        {/* Date Filters */}
        <div className="px-4 sm:px-0">
          <div className="flex items-center gap-1.5 md:gap-2 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm w-full overflow-x-auto no-scrollbar scroll-smooth">
             {['Today', 'This Week', 'This Month', 'Last Month', 'Custom'].map(range => (
               <button 
                key={range}
                onClick={() => setDateRange(range)}
                className={`flex-1 min-w-[85px] sm:min-w-[100px] py-2 sm:py-2.5 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${dateRange === range ? 'bg-blue-600 text-white shadow-lg shadow-blue-200/50' : 'text-slate-400 hover:bg-slate-50'}`}
               >
                  {range}
               </button>
             ))}
          </div>

          {dateRange === 'Custom' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 grid grid-cols-2 gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"
            >
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">From</label>
                <input 
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 px-3 py-2 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">To</label>
                <input 
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 px-3 py-2 outline-none"
                />
              </div>
            </motion.div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 px-4 sm:px-0">
           {/* P&L Snapshot */}
           <section className="bg-white p-6 sm:p-10 rounded-[32px] md:rounded-[48px] border border-slate-100 shadow-sm space-y-6 sm:space-y-8">
              <div className="flex items-center justify-between gap-4">
                 <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                       <PieChart className="w-4 h-4" />
                    </div>
                    <h3 className="text-[10px] sm:text-xs font-bold text-slate-900 uppercase tracking-widest">Financial Performance</h3>
                 </div>
                 <div className="hidden sm:block text-[9px] font-medium text-slate-400 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 whitespace-nowrap">
                   {format(start, 'dd MMM')} - {format(end, 'dd MMM yyyy')}
                 </div>
              </div>
              
              <div className="space-y-5 sm:space-y-10">
                 <ReportMetric label="Gross Revenue" value={formatBDT(totalRevenue)} color="text-slate-900" />
                 <ReportMetric label="Direct Costs (COGS)" value={formatBDT(totalCost)} color="text-red-500" isNegative />
                 <ReportMetric label="Operating Expenses" value={formatBDT(totalExpenses)} color="text-red-400" isNegative />
                 <div className="h-px bg-slate-100/50" />
                 <ReportMetric label="Total Net Profit" value={formatBDT(netProfit)} color={netProfit >= 0 ? "text-emerald-600" : "text-red-600"} large />
              </div>
           </section>

            {/* Performance Distribution */}
            <section className="bg-white p-6 sm:p-10 rounded-[32px] md:rounded-[48px] border border-slate-100 shadow-sm space-y-6 sm:space-y-8">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                     <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                        <TrendingUp className="w-4 h-4" />
                     </div>
                     <h3 className="text-[10px] sm:text-xs font-bold text-slate-900 uppercase tracking-widest">Top Selling Products</h3>
                  </div>
               </div>
               <div className="space-y-5 sm:space-y-6">
                  {topProducts.length > 0 ? (
                    <div className="space-y-6">
                      {topProducts.map((p: any, idx: number) => (
                        <ProgressMetric 
                          key={`${p.name}-${idx}`}
                          label={p.name}
                          value={formatBDT(p.revenue * 100)}
                          percent={Math.min(100, (p.revenue * 100 / (totalRevenue || 1)) * 100)}
                          color="bg-emerald-500"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 opacity-50 flex flex-col items-center">
                      <HistoryIcon className="w-12 h-12 mb-3 text-slate-100" />
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Inventory analytics pending...</p>
                    </div>
                  )}
               </div>
            </section>
        </div>

        {/* Detailed Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 px-4 sm:px-0">
           <ReportMetricCard 
              label="Procurement" 
              value={formatBDT(purchasesTotal)} 
              icon={Package} 
              sub="Inventory Purchases"
           />
           <ReportMetricCard 
              label="Cash Inflow" 
              value={formatBDT(totalCollected)} 
              icon={DollarSign} 
              sub="Receipts + Sales"
              color="text-emerald-600"
           />
           <ReportMetricCard 
              label="Distributions" 
              value={formatBDT(distributionsTotal)} 
              icon={TrendingDown} 
              sub="Partner Payouts"
              color="text-red-500"
           />
           <ReportMetricCard 
              label="Receivables" 
              value={formatBDT(valuation?.receivables || 0)} 
              icon={Users} 
              sub={`${overdueCount} Overdue Orders`}
           />
        </div>

        {/* Detailed Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 px-4 sm:px-0">
           <ReportLink title="Inventory Aging" count="0 Items Tracked" icon={Package} />
           <ReportLink title="Customer Dues" count={`${overdueCount} Overdue`} icon={Users} color={overdueCount > 0 ? "text-red-500" : "text-slate-400"} />
           <ReportLink title="Portfolio Split" count="Live Analytics" icon={ShieldCheck} />
        </div>
      </div>
    </MainLayout>
  );
}

function ReportMetricCard({ label, value, sub, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-3 sm:p-5 rounded-[24px] sm:rounded-3xl border border-slate-100 shadow-sm space-y-2 sm:space-y-4 text-left">
       <div className="w-7 h-7 sm:w-10 sm:h-10 bg-slate-50 rounded-lg sm:rounded-2xl flex items-center justify-center text-slate-400">
          <Icon className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
       </div>
       <div>
          <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1 sm:mb-1.5">{label}</p>
          <p className={`text-sm sm:text-lg font-bold tracking-tighter ${color || 'text-slate-900'}`}>{value}</p>
          <p className="text-[7px] sm:text-[9px] font-medium text-slate-300 uppercase tracking-widest mt-1 sm:mt-1.5">{sub}</p>
       </div>
    </div>
  );
}

function ReportMetric({ label, value, sub, color, large, isNegative }: any) {
  return (
    <div className="flex items-center justify-between gap-2 overflow-hidden">
       <div className="text-left min-w-0">
          <p className="text-[9px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5 md:mb-3 truncate">{label}</p>
          <p className={`font-bold tracking-tighter ${large ? 'text-xl sm:text-2xl lg:text-4xl' : 'text-base sm:text-lg lg:text-2xl'} ${color} truncate`}>
             {isNegative && '- '}{value}
          </p>
       </div>
       {sub && (
         <div className="text-right shrink-0">
            <span className="text-[8px] sm:text-[9px] font-medium text-slate-300 uppercase block tracking-widest">{sub}</span>
         </div>
       )}
    </div>
  );
}

function ProgressMetric({ label, percent, value, color }: any) {
  return (
    <div className="space-y-1.5 md:space-y-2 text-left">
       <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest">
          <span className="text-slate-400">{label}</span>
          <span className="text-slate-900">{value}</span>
       </div>
       <div className="h-1.5 md:h-2 w-full bg-slate-50 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full`} style={{ width: `${percent}%` }} />
       </div>
    </div>
  );
}

function ReportLink({ title, count, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group cursor-pointer hover:border-blue-100 transition-all text-left">
       <div className="flex items-center gap-3 md:gap-4">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
             <Icon className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div>
            <h4 className="text-sm lg:text-base font-semibold text-slate-900">{title}</h4>
            <p className={`text-[11px] font-semibold uppercase tracking-widest mt-0.5 ${color || 'text-slate-400'}`}>{count}</p>
          </div>
       </div>
       <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
    </div>
  );
}
