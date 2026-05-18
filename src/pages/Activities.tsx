// src/pages/Activities.tsx
import React, { useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useBusiness } from '../context/BusinessContext';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { 
  History as HistoryIcon, Search, Filter, Calendar, 
  Receipt, TrendingDown, Wallet, CreditCard, 
  RefreshCw, Package, ArrowLeftRight, Users,
  ShoppingCart,
  ChevronRight,
  User
} from 'lucide-react';
import { formatDateTime } from '../lib/utils';

export default function Activities() {
  const { business } = useBusiness();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activity_log', 'full', business?.id],
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
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Activities fetch error with join:', error);
        // Fallback to basic fetch
        const { data: basicData, error: basicError } = await supabase
          .from('activity_log')
          .select('*')
          .eq('business_id', business.id)
          .order('created_at', { ascending: false });
        
        if (basicError) throw basicError;
        return (basicData || []).map(a => ({
          id: a.id,
          action: a.action,
          title: a.details?.title || a.action,
          sub: a.details?.sub || 'System Activity',
          amount: a.details?.amount || '',
          time: formatDateTime(a.created_at),
          type: a.details?.type || 'activity',
          user: 'System',
          raw_date: a.created_at
        }));
      }

      return (data || []).map(a => ({
        id: a.id,
        action: a.action,
        title: a.details?.title || a.action,
        sub: a.details?.sub || (a.profiles?.full_name || a.profiles?.username || 'System Activity'),
        amount: a.details?.amount || '',
        time: formatDateTime(a.created_at),
        type: a.details?.type || 'activity',
        user: a.profiles?.full_name || a.profiles?.username || 'System',
        raw_date: a.created_at
      }));
    },
    enabled: !!business?.id
  });

  const filteredActivities = activities.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          a.sub.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || a.type === selectedType;
    return matchesSearch && matchesType;
  });

  const activityTypes = [
    { id: 'all', label: 'All', icon: HistoryIcon },
    { id: 'sale', label: 'Sales', icon: Receipt },
    { id: 'purchase', label: 'Purchases', icon: Package },
    { id: 'inventory', label: 'Inventory', icon: ShoppingCart },
    { id: 'expense', label: 'Expenses', icon: TrendingDown },
    { id: 'payment', label: 'Payments', icon: CreditCard },
    { id: 'transfer', label: 'Transfers', icon: ArrowLeftRight },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl lg:text-3xl font-bold text-slate-900 tracking-tight uppercase">Audit Trail</h1>
            <p className="text-slate-400 text-xs lg:text-sm font-medium uppercase tracking-[0.2em] mt-1">Full transparency of all business operations.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1 space-y-4">
             <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Search Logs</label>
                   <div className="relative mt-1.5">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input 
                        className="w-full bg-slate-50 border border-slate-50 h-10 pl-9 pr-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs font-bold"
                        placeholder="Search keyword..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                   </div>
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 underline decoration-slate-100 decoration-2 underline-offset-4">Filter By Type</label>
                   <div className="mt-2 relative">
                      <select 
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 h-10 px-3 pr-10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none transition-all text-[11px] font-bold uppercase tracking-widest text-slate-700 cursor-pointer"
                      >
                        {activityTypes.map(type => (
                          <option key={type.id} value={type.id}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                   </div>
                </div>
             </div>
          </div>

          <div className="lg:col-span-3">
             <div className="bg-white rounded-[32px] sm:rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                <div className="px-5 py-6 sm:p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between shrink-0">
                   <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Chronological Feed</h3>
                   <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{filteredActivities.length} Operations</span>
                </div>

                <div className="divide-y divide-slate-50 overflow-y-auto flex-1">
                   {isLoading && (
                     <div className="p-8 space-y-6">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className="flex gap-6 animate-pulse">
                             <div className="w-12 h-12 bg-slate-50 rounded-2xl" />
                             <div className="flex-1 space-y-3">
                                <div className="h-4 bg-slate-50 rounded w-1/4" />
                                <div className="h-3 bg-slate-50 rounded w-1/2" />
                             </div>
                          </div>
                        ))}
                     </div>
                   )}

                   {!isLoading && filteredActivities.length === 0 && (
                     <div className="py-40 flex flex-col items-center justify-center text-slate-200">
                        <HistoryIcon className="w-16 h-16 mb-4 opacity-5" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">No matching activities found</p>
                     </div>
                   )}

                   {!isLoading && filteredActivities.length > 0 && (
                     <div className="divide-y divide-slate-50">
                        {Object.entries(
                          filteredActivities.reduce((groups: any, activity) => {
                            const date = activity.time.split(', ')[0];
                            if (!groups[date]) groups[date] = [];
                            groups[date].push(activity);
                            return groups;
                          }, {})
                        ).map(([date, items]: [string, any]) => (
                          <div key={date} className="relative">
                            <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm px-6 py-2 border-y border-slate-100 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">{date}</span>
                              <span className="text-[8px] font-medium text-slate-400 uppercase tracking-widest">{items.length} Activities</span>
                            </div>
                            <div className="divide-y divide-slate-50 border-b border-slate-50 pb-20">
                              {items.map((activity: any, idx: number) => (
                                <ActivityRow key={`${activity.id}-${idx}-${date}`} activity={activity} />
                              ))}
                            </div>
                          </div>
                        ))}
                     </div>
                   )}
                </div>
             </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function ActivityRow({ activity }: { activity: any }) {
  const colors: Record<string, string> = {
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
    business: 'bg-blue-600 text-white',
  };

  const getIcon = () => {
    switch(activity.type) {
      case 'sale': return <Receipt className="w-5 h-5" />;
      case 'expense': return <TrendingDown className="w-5 h-5" />;
      case 'capital': return <Wallet className="w-5 h-5" />;
      case 'payment': return <CreditCard className="w-5 h-5" />;
      case 'return': return <RefreshCw className="w-5 h-5" />;
      case 'purchase': return <Package className="w-5 h-5" />;
      case 'transfer': return <ArrowLeftRight className="w-5 h-5" />;
      case 'customer': return <Users className="w-5 h-5" />;
      case 'partner': return <Users className="w-5 h-5" />;
      case 'inventory': return <ShoppingCart className="w-5 h-5" />;
      case 'supplier': return <Users className="w-5 h-5" />;
      case 'wallet': return <Wallet className="w-5 h-5" />;
      default: return <HistoryIcon className="w-5 h-5" />;
    }
  };

  return (
    <div className="p-3 md:p-6 flex items-center gap-3 md:gap-6 hover:bg-slate-50 transition-all group">
       <div className={`w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110 ${colors[activity.type] || 'bg-slate-50 text-slate-400'}`}>
          {getIcon()}
       </div>
       <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-0.5">
             <h4 className="text-sm font-bold text-slate-900 leading-tight break-words">{activity.title}</h4>
             {activity.amount && (
               <div className="flex shrink-0">
                 <span className={`text-[10px] font-mono font-bold border px-1.5 py-0.5 rounded-lg ${
                   activity.amount.startsWith('+') || ['NEW', 'JOINED', 'FUNDED', 'ADDED', 'ACTIVE'].includes(activity.amount) 
                   ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
                   : (activity.amount === 'REMOVED' || activity.amount === 'DELETED' || activity.amount === 'REVERTED' || activity.amount.startsWith('-') ? 'bg-red-50 border-red-100 text-red-500' : 'bg-slate-50 border-slate-100 text-slate-900')
                 }`}>
                   {activity.amount}
                 </span>
               </div>
             )}
          </div>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 sm:gap-x-4">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{activity.sub}</p>
             <span className="w-1 h-1 rounded-full bg-slate-200 hidden sm:block" />
             <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest underline underline-offset-4 decoration-slate-100">
                <User className="w-3 h-3" />
                {activity.user}
             </div>
          </div>
       </div>
       <div className="text-right shrink-0">
          <p className="text-[10px] sm:text-xs font-bold text-slate-900 font-mono tracking-tighter sm:tracking-tight leading-none">{activity.time.split(', ')[1]}</p>
       </div>
    </div>
  );
}
