// src/pages/Reports.tsx
import React, { useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useBusiness } from '../context/BusinessContext';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  FileText, Download, TrendingUp, Package, 
  Users, Calculator, Calendar, ChevronRight,
  TrendingDown, DollarSign, PieChart, ShieldCheck
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatBDT } from '../lib/utils';
import { jsPDF } from 'jspdf';

export default function Reports() {
  const { business } = useBusiness();
  const [dateRange, setDateRange] = useState('This Month');

  // Basic reporting data fetching
  const { data: salesCount = 0 } = useQuery({
    queryKey: ['sales-count', business?.id],
    queryFn: async () => {
       const { count } = await supabase.from('sales').select('*', { count: 'exact', head: true }).eq('business_id', business?.id);
       return count || 0;
    }
  });

  const { data: totalRevenue = 0 } = useQuery({
    queryKey: ['total-revenue', business?.id],
    queryFn: async () => {
       const { data } = await supabase.from('sales').select('total_cents').eq('business_id', business?.id);
       return data?.reduce((acc, curr) => acc + curr.total_cents, 0) || 0;
    }
  });

  const { data: overdueCount = 0 } = useQuery({
    queryKey: ['overdue-count', business?.id],
    queryFn: async () => {
       const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true }).eq('business_id', business?.id).gt('total_due_cents', 0);
       return count || 0;
    }
  });

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text('Business Performance Report', 20, 20);
    doc.setFontSize(14);
    doc.text(`Business: ${business?.name}`, 20, 35);
    doc.text(`Date Range: ${dateRange}`, 20, 45);
    doc.text(`Total Revenue: ${formatBDT(totalRevenue)}`, 20, 60);
    doc.text(`Total Sales: ${salesCount}`, 20, 70);
    doc.save('report.pdf');
  };

  return (
    <MainLayout>
      <div className="space-y-6 md:space-y-8 pb-10 px-2 md:px-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
           <div>
              <h1 className="text-xl lg:text-3xl font-bold text-slate-900 tracking-tight uppercase">Financial Reports</h1>
              <p className="text-slate-400 text-xs lg:text-sm font-medium uppercase tracking-[0.2em] mt-0.5 md:mt-1">Deep dive into your business analytics.</p>
           </div>
           <div className="flex items-center gap-2">
              <button 
                onClick={generatePDF}
                className="w-full md:w-auto px-5 md:px-6 py-2.5 md:py-3 bg-slate-900 text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-100"
              >
                 <Download className="w-3.5 h-3.5 md:w-4 md:h-4" /> Export PDF
              </button>
           </div>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-1.5 md:gap-2 bg-white p-1.5 md:p-2 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm w-fit max-w-full overflow-x-auto no-scrollbar">
           {['Today', 'This Week', 'This Month', 'Last Month', 'Custom'].map(range => (
             <button 
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all whitespace-nowrap ${dateRange === range ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}
             >
                {range}
             </button>
           ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
           {/* P&L Snapshot */}
           <section className="bg-white p-5 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm space-y-6 md:space-y-8">
              <div className="flex items-center justify-between">
                 <h3 className="text-xs md:text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <PieChart className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-600" /> Profit & Loss
                 </h3>
                 <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{dateRange}</span>
              </div>
              
              <div className="space-y-4 md:space-y-6">
                 <ReportMetric label="Total Revenue" value={formatBDT(totalRevenue)} color="text-slate-900" />
                 <ReportMetric label="Cost of Goods (COGS)" value={formatBDT(0)} sub="Calculation in progress" color="text-red-500" isNegative />
                 <div className="h-px bg-slate-50" />
                 <ReportMetric label="Gross Profit" value={formatBDT(0)} color="text-emerald-600" large />
              </div>
           </section>

           {/* Performance Distribution */}
           <section className="bg-white p-5 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm space-y-6 md:space-y-8">
              <div className="flex items-center justify-between">
                 <h3 className="text-xs md:text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-600" /> Distribution
                 </h3>
              </div>
              <div className="space-y-4">
                 <div className="text-center py-6 md:py-10 opacity-50">
                   <PieChart className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-2 text-slate-200" />
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No distribution data available</p>
                 </div>
              </div>
           </section>
        </div>

        {/* Detailed Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
           <ReportLink title="Inventory Aging" count="0 Items" icon={Package} />
           <ReportLink title="Customer Dues Aging" count={`${overdueCount} Overdue`} icon={Users} color={overdueCount > 0 ? "text-red-500" : "text-slate-400"} />
           <ReportLink title="Portfolio Split" count="0 Live" icon={ShieldCheck} />
        </div>
      </div>
    </MainLayout>
  );
}

function ReportMetric({ label, value, sub, color, large, isNegative }: any) {
  return (
    <div className="flex items-center justify-between">
       <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
          <p className={`font-bold tracking-tighter mt-0.5 md:mt-1 ${large ? 'text-xl lg:text-3xl' : 'text-lg lg:text-2xl'} ${color}`}>
             {isNegative && '- '}{value}
          </p>
       </div>
       {sub && (
         <div className="text-right">
            <span className="text-[9px] font-semibold text-slate-300 uppercase block tracking-widest">{sub}</span>
         </div>
       )}
    </div>
  );
}

function ProgressMetric({ label, percent, value, color }: any) {
  return (
    <div className="space-y-1.5 md:space-y-2">
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
    <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group cursor-pointer hover:border-blue-100 transition-all">
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
