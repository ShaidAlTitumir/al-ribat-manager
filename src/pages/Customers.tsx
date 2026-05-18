// src/pages/Customers.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Search, Plus, Phone, Store, MapPin, 
  ArrowRight, FileText, ArrowDownLeft, Trash2, 
  MoreVertical, ChevronRight, UserCircle, Calculator,
  Filter, X, AlertCircle, Download, Info, Pencil, Printer
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatBDT, formatDate, formatDateTime, isValidDate } from '../lib/utils';
import { logActivity } from '../lib/activity';
import { Customer } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';

export default function Customers() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useScrollLock(isAddModalOpen || isEditModalOpen || !!customerToDelete || (!!selectedCustomer && !isEditModalOpen));

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', business?.id)
        .order('total_due_cents', { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!business?.id,
  });

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.shop_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery)
  );

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl lg:text-3xl font-bold text-slate-900 tracking-tight uppercase">Customer Hub</h1>
            <p className="text-slate-500 text-[10px] lg:text-xs font-medium">Manage your CRM and accounts receivable.</p>
          </div>
          <button 
            onClick={() => business ? setIsAddModalOpen(true) : navigate('/onboarding')}
            className="flex-1 md:flex-none px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
          >
            <Plus className="w-3.5 h-3.5" /> Add Customer
          </button>
        </div>

        {!business && (
          <div className="bg-amber-50 border border-amber-100 p-6 rounded-[32px] flex items-center gap-6">
            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
               <Users className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-amber-900">Partner CRM Paused</h3>
              <p className="text-sm font-medium text-amber-700 mt-1 leading-relaxed">
                Connect your business to start adding customers and tracking their due amounts. Demo mode is active.
              </p>
              <button 
                onClick={() => navigate('/onboarding')}
                className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-amber-200 active:scale-95 transition-all"
              >
                Connect Now
              </button>
            </div>
          </div>
        )}

        {/* Stats Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
           <div className="bg-white p-3 lg:p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2 lg:gap-3">
              <div className="w-8 h-8 lg:w-9 lg:h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                 <Users className="w-4 h-4" />
              </div>
              <div>
                 <p className="text-[8px] lg:text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Clients</p>
                 <p className="text-sm lg:text-base font-bold text-slate-900 tracking-tight">{customers.length}</p>
              </div>
           </div>
           <div className="bg-white p-3 lg:p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2 lg:gap-3">
              <div className="w-8 h-8 lg:w-9 lg:h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                 <ArrowDownLeft className="w-4 h-4" />
              </div>
              <div>
                 <p className="text-[8px] lg:text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Collectors</p>
                 <p className="text-sm lg:text-base font-bold text-emerald-600 tracking-tight leading-tight">{customers.filter(c => c.total_due_cents > 0).length}</p>
              </div>
           </div>
           <div className="col-span-2 lg:col-span-1 bg-white p-3 lg:p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2 lg:gap-3">
              <div className="w-8 h-8 lg:w-9 lg:h-9 bg-red-50 rounded-xl flex items-center justify-center text-red-500">
                 <Calculator className="w-4 h-4" />
              </div>
              <div>
                 <p className="text-[8px] lg:text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Dues</p>
                 <p className="text-sm lg:text-base font-bold text-red-500 tracking-tight">{formatBDT(customers.reduce((acc, c) => acc + c.total_due_cents, 0))}</p>
              </div>
           </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input 
            className="w-full bg-white border border-slate-100 h-9 pl-9 pr-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-xs font-medium"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
           {filteredCustomers.map((customer, idx) => (
             <CustomerCard 
               key={`${customer.id}-${idx}`} 
               customer={customer} 
               onClick={() => setSelectedCustomer(customer)} 
               onEdit={() => { setSelectedCustomer(customer); setIsEditModalOpen(true); }}
               onDelete={() => setCustomerToDelete(customer)}
             />
           ))}
           {filteredCustomers.length === 0 && !isLoading && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300">
                <UserCircle className="w-16 h-16 mb-4 opacity-10" />
                <p className="text-xs font-bold uppercase tracking-widest">No customers found</p>
              </div>
           )}
        </div>
      </div>

      <AnimatePresence>
         {isAddModalOpen && <AddCustomerModal onClose={() => setIsAddModalOpen(false)} />}
         {isEditModalOpen && selectedCustomer && (
            <EditCustomerModal 
              customer={selectedCustomer} 
              onClose={() => { setIsEditModalOpen(false); setSelectedCustomer(null); }} 
            />
         )}
         {customerToDelete && (
            <DeleteCustomerModal 
              customer={customerToDelete} 
              onClose={() => setCustomerToDelete(null)} 
              onSuccess={() => setSelectedCustomer(null)}
            />
         )}
         {selectedCustomer && !isEditModalOpen && (
            <CustomerDetailDrawer 
              customer={selectedCustomer} 
              onClose={() => setSelectedCustomer(null)}
              onEdit={() => setIsEditModalOpen(true)}
              onDelete={() => setCustomerToDelete(selectedCustomer)}
            />
         )}
      </AnimatePresence>
    </MainLayout>
  );
}

function CustomerCard({ customer, onClick, onEdit, onDelete }: { customer: Customer, onClick: () => void, onEdit: () => void, onDelete: () => void }) {
  const isDue = customer.total_due_cents > 0;
  return (
    <motion.div 
      layout
      onClick={onClick}
      className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group flex flex-col cursor-pointer active:scale-95"
    >
       <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <Store className="w-3.5 h-3.5" />
             </div>
             <div className="text-left">
                <h3 className="text-xs lg:text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{customer.name}</h3>
                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{customer.shop_name || 'Individual'}</p>
             </div>
          </div>
          <div className="flex gap-1">
             <button 
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all"
             >
                <MoreVertical className="w-3 h-3" />
             </button>
             <div className="p-1.5 rounded-lg bg-slate-50 text-slate-400">
                <ChevronRight className="w-3 h-3" />
             </div>
          </div>
       </div>

       <div className="space-y-1 mb-2 text-left">
          <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500">
             <Phone className="w-2.5 h-2.5 text-slate-300" /> {customer.phone || 'N/A'}
          </div>
          <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 truncate">
             <MapPin className="w-2.5 h-2.5 text-slate-300" /> {customer.address || 'No address provided'}
          </div>
       </div>

       <div className="mt-auto pt-2 border-t border-slate-50 flex items-center justify-between">
          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest text-[8px]">Balance Due</span>
          <p className={`text-sm font-bold tracking-tight ${isDue ? 'text-red-500' : 'text-emerald-500'}`}>
             {formatBDT(customer.total_due_cents)}
          </p>
       </div>
    </motion.div>
  );
}

function AddCustomerModal({ onClose }: { onClose: () => void }) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ name: '', shop_name: '', phone: '', address: '' });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (!business?.id) throw new Error("Business not found. Please reload.");
      if (!user?.id) throw new Error("User session not found.");
      if (!data.name.trim()) throw new Error("Customer name is required.");
      if (data.phone && data.phone.replace(/\D/g, '').length < 11) {
        throw new Error("Phone number must be at least 11 digits");
      }
      
      const { error } = await supabase
        .from('customers')
        .insert({ 
          name: data.name,
          shop_name: data.shop_name,
          phone: data.phone,
          address: data.address,
          business_id: business.id,
          user_id: user.id
        });
        
      if (error) throw error;

      await logActivity({
        business_id: business.id,
        user_id: user.id,
        action: 'ADD_CUSTOMER',
        details: {
          title: `New Customer: ${data.name}`,
          sub: data.shop_name || 'Individual',
          amount: 'JOINED',
          type: 'customer'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to save customer. Please try again.");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
       <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         exit={{ opacity: 0, scale: 0.95, y: 20 }}
         className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl relative overflow-hidden z-10"
       >
         <form onSubmit={handleSubmit}>
           <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                 <h2 className="text-lg lg:text-xl font-bold text-slate-900 tracking-tight">New Customer</h2>
                 <p className="text-xs lg:text-sm font-medium text-slate-400">Add a new partner shop to your roster.</p>
              </div>
              <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 transition-colors">
                <X className="w-6 h-6" />
              </button>
           </div>
           
           <div className="p-8 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
                <Input 
                  label="Customer Name *" 
                  value={formData.name} 
                  onChange={(v: string) => setFormData({...formData, name: v})} 
                  placeholder="e.g. Rahim Ali" 
                  required
                />
                <Input 
                  label="Shop Name" 
                  value={formData.shop_name} 
                  onChange={(v: string) => setFormData({...formData, shop_name: v})} 
                  placeholder="e.g. Rahim Store" 
                />
                <Input 
                  label="Phone Number" 
                  value={formData.phone} 
                  onChange={(v: string) => setFormData({...formData, phone: v})} 
                  placeholder="017xxxxxxxx" 
                />
                <Input 
                  label="Address" 
                  value={formData.address} 
                  onChange={(v: string) => setFormData({...formData, address: v})} 
                  placeholder="Full address..." 
                />
              </div>
           </div>
           
           <div className="p-8 bg-slate-50 flex gap-4">
              <button type="button" onClick={onClose} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-slate-50">Cancel</button>
              <button 
                type="submit"
                disabled={mutation.isPending}
                className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
              >
                {mutation.isPending ? 'Saving...' : 'Save Customer'}
              </button>
           </div>
         </form>
       </motion.div>
    </div>
  );
}

function CustomerDetailDrawer({ customer, onClose, onEdit, onDelete }: { customer: Customer, onClose: () => void, onEdit: () => void, onDelete: () => void }) {
  const { business } = useBusiness();
  const [activeTab, setActiveTab] = useState<'ledger' | 'purchases' | 'profile' | 'report'>('ledger');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [editingLedgerEntry, setEditingLedgerEntry] = useState<any>(null);
  const [ledgerEntryToDelete, setLedgerEntryToDelete] = useState<any>(null);

  const { data: ledger = [], refetch: refetchLedger } = useQuery({
    queryKey: ['customer_ledger', customer.id],
    queryFn: async () => {
       const { data, error } = await supabase
         .from('customer_ledger')
         .select('*')
         .eq('customer_id', customer.id)
         .order('created_at', { ascending: false });
       if (error) throw error;
       return data;
    }
  });

  const { data: customerSales = [], refetch: refetchSales } = useQuery({
    queryKey: ['customer_sales', customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*, inventory_items(name)')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
       <motion.div 
         initial={{ x: '100%' }}
         animate={{ x: 0 }}
         exit={{ x: '100%' }}
         transition={{ type: 'spring', damping: 30, stiffness: 300 }}
         className="bg-white w-full max-w-xl relative p-0 flex flex-col shadow-2xl"
       >
          {/* Drawer Header */}
          <div className="p-6 border-b border-slate-50 bg-slate-900 text-white flex items-center justify-between">
             <div className="flex items-center gap-4">
                <button onClick={onClose} className="p-2 rounded-xl bg-white/10 text-white">
                   <ArrowRight className="w-5 h-5 rotate-180" />
                </button>
                <div>
                   <h2 className="text-xl font-bold tracking-tight leading-none mb-1">{customer.name}</h2>
                   <div className="flex items-center gap-4">
                      <button onClick={onEdit} className="text-[10px] font-bold text-blue-400 uppercase tracking-widest hover:text-blue-300">Edit</button>
                      <button onClick={onDelete} className="text-[10px] font-bold text-red-400 uppercase tracking-widest hover:text-red-300">Delete</button>
                   </div>
                </div>
             </div>
             <div className="text-right flex flex-col items-end gap-2">
                <div>
                   <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Total Due</span>
                   <p className="text-lg font-mono font-bold text-red-400 leading-none">{formatBDT(customer.total_due_cents)}</p>
                </div>
                {customer.total_due_cents > 0 && (
                   <button 
                     onClick={() => setShowPaymentModal(true)}
                     className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-950/40 active:scale-95"
                   >
                     Collect
                   </button>
                )}
             </div>
          </div>

          <div className="flex border-b border-slate-100">
             {['ledger', 'purchases', 'report', 'profile'].map(tab => (
               <button 
                 key={tab}
                 onClick={() => setActiveTab(tab as any)}
                 className={`flex-1 py-4 text-[11px] font-semibold uppercase tracking-widest relative ${activeTab === tab ? 'text-blue-600' : 'text-slate-400'}`}
               >
                 {tab}
                 {activeTab === tab && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
               </button>
             ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
             {activeTab === 'report' && (
               <div className="space-y-6">
                  <div className="p-6 rounded-[32px] bg-slate-50 border border-slate-100">
                     <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight mb-4">Statement Period</h3>
                     <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="space-y-1">
                           <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">From</label>
                           <input 
                              type="date" 
                              className="w-full bg-white border border-slate-200 h-10 px-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                           />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">To</label>
                           <input 
                              type="date" 
                              className="w-full bg-white border border-slate-200 h-10 px-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                           />
                        </div>
                     </div>
                     <button 
                        onClick={async () => {
                          if (!business) return;
                          
                          const startIso = isValidDate(startDate) ? new Date(startDate).toISOString() : new Date().toISOString();
                          const endIso = isValidDate(endDate) ? new Date(endDate + 'T23:59:59').toISOString() : new Date().toISOString();

                          const { data: salesData, error: sError } = await supabase
                            .from('sales')
                            .select('*, inventory_items(name)')
                            .eq('customer_id', customer.id)
                            .gte('created_at', startIso)
                            .lte('created_at', endIso);

                          const { data: ledgerData, error: lError } = await supabase
                            .from('customer_ledger')
                            .select('*')
                            .eq('customer_id', customer.id)
                            .eq('transaction_type', 'payment')
                            .gte('created_at', startIso)
                            .lte('created_at', endIso);
                            
                          if (sError || lError) {
                            alert('Failed to fetch data for statement');
                            return;
                          }

                          const businessInfo = {
                            name: business.name,
                            phone: business.phone || '',
                            address: business.address || '',
                            email: business.email || ''
                          };

                          const customerInfo = {
                            name: customer.name,
                            phone: customer.phone || '',
                            address: customer.address || '',
                            shopName: customer.shop_name || ''
                          };

                          import('../lib/pdfGenerator').then(module => {
                            module.generateCustomerStatement(
                              businessInfo, 
                              customerInfo, 
                              salesData || [], 
                              ledgerData || [],
                              { start: isValidDate(startDate) ? new Date(startDate) : new Date(), end: isValidDate(endDate) ? new Date(endDate) : new Date() }
                            );
                          });
                        }}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-blue-100 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                     >
                        <Download className="w-4 h-4" /> Download Statement
                     </button>
                  </div>
                  
                  <div className="p-6 rounded-[32px] bg-slate-900 text-white">
                     <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                           <Info className="w-4 h-4 text-blue-400" />
                        </div>
                        <h4 className="text-[11px] font-bold uppercase tracking-widest">Helpful Tip</h4>
                     </div>
                     <p className="text-[10px] font-medium text-white/60 leading-relaxed uppercase tracking-widest">
                        Generating a statement helps reconcile payments and due amounts with your partners. Use it for monthly settlements.
                     </p>
                  </div>
               </div>
             )}

             {activeTab === 'ledger' && (
               <div className="space-y-4">
                  {ledger.map((entry: any) => (
                    <div key={entry.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 group">
                       <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${entry.transaction_type === 'payment' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                             {entry.transaction_type === 'payment' ? <ArrowDownLeft className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          </div>
                          <div>
                             <p className="text-xs font-bold text-slate-900 uppercase">{entry.transaction_type}</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{formatDateTime(entry.created_at)}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                        <p className={`text-sm font-mono font-bold ${entry.transaction_type === 'payment' ? 'text-emerald-600' : 'text-red-500'}`}>
                           {entry.transaction_type === 'payment' ? '-' : '+'}{formatBDT(entry.amount_cents)}
                        </p>
                        {entry.transaction_type === 'payment' && (
                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                            <button 
                              onClick={() => setEditingLedgerEntry(entry)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => {
                                if (business) {
                                  import('../lib/pdfGenerator').then(module => {
                                    module.generatePaymentReceipt(
                                      {
                                        name: business.name,
                                        phone: business.phone,
                                        address: business.address
                                      },
                                      {
                                        name: customer.name,
                                        shopName: customer.shop_name,
                                        phone: customer.phone,
                                        address: customer.address
                                      },
                                      {
                                        date: entry.created_at,
                                        amount: entry.amount_cents / 100,
                                        method: 'Collected',
                                        remainingDue: customer.total_due_cents / 100
                                      }
                                    );
                                  });
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-xl transition-all"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => setLedgerEntryToDelete(entry)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                       </div>
                    </div>
                  ))}
                  {ledger.length === 0 && (
                    <div className="py-20 text-center">
                       <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">No transactions yet</p>
                    </div>
                  )}
               </div>
             )}

             {activeTab === 'purchases' && (
                <div className="space-y-4">
                   {customerSales?.map((sale: any) => (
                    <div key={sale.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 group">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                             <FileText className="w-4 h-4" />
                          </div>
                          <div>
                             <p className="text-xs font-bold text-slate-900 uppercase">{sale.invoice_no}</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{formatDate(sale.created_at)}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <div className="text-right">
                             <p className="text-sm font-bold text-slate-900">{formatBDT(sale.total_cents)}</p>
                          </div>
                          <button 
                            onClick={() => {
                              if (business) {
                                const saleData = {
                                  invoiceNo: sale.invoice_no,
                                  date: sale.created_at,
                                  items: [
                                    {
                                      name: sale.inventory_items?.name || 'Product',
                                      quantity: sale.quantity,
                                      unitPrice: sale.unit_price_bdt_cents / 100,
                                      total: (sale.unit_price_bdt_cents * sale.quantity) / 100
                                    }
                                  ],
                                  subtotal: (sale.unit_price_bdt_cents * sale.quantity) / 100,
                                  discount: sale.discount_cents / 100,
                                  total: sale.total_cents / 100,
                                  received: (sale.total_cents - sale.due_cents) / 100,
                                  due: sale.due_cents / 100
                                };
                                
                                const customerInfo = {
                                  name: customer.name,
                                  phone: customer.phone || '',
                                  address: customer.address || '',
                                  shopName: customer.shop_name || ''
                                };
                                
                                const businessInfo = {
                                  name: business.name,
                                  phone: business.phone || '',
                                  address: business.address || '',
                                  email: business.email || ''
                                };
                                
                                import('../lib/pdfGenerator').then(module => {
                                  module.generateSaleInvoice(businessInfo, customerInfo, saleData);
                                });
                              }
                            }}
                            className="p-2 bg-white text-slate-400 rounded-xl hover:text-blue-600 hover:shadow-md transition-all"
                          >
                             <Download className="w-4 h-4" />
                          </button>
                       </div>
                    </div>
                  ))}
                  {customerSales?.length === 0 && (
                    <div className="py-20 text-center">
                       <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">No purchases yet</p>
                    </div>
                  )}
                </div>
             )}

             {activeTab === 'profile' && (
               <div className="space-y-6">
                  <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Contact Information</h3>
                    <div className="space-y-4">
                      <div>
                        <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Phone</span>
                        <p className="text-sm font-bold text-slate-900">{customer.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Address</span>
                        <p className="text-sm font-bold text-slate-900">{customer.address || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => { onEdit(); }}
                      className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-slate-200 active:scale-95 transition-all"
                    >
                      Edit Profile
                    </button>
                    <button 
                      onClick={() => { onDelete(); onClose(); }}
                      className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 active:scale-95 transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
               </div>
             )}
          </div>
       </motion.div>
       <AnimatePresence>
          {showPaymentModal && (
            <RecordPaymentModal 
              customer={customer} 
              onClose={() => setShowPaymentModal(false)} 
            />
          )}
          {editingLedgerEntry && (
            <EditLedgerEntryModal 
              entry={editingLedgerEntry}
              customer={customer}
              onClose={() => setEditingLedgerEntry(null)}
              onSuccess={() => {
                refetchLedger();
                refetchSales();
              }}
            />
          )}
          {ledgerEntryToDelete && (
            <DeleteLedgerEntryModal 
              entry={ledgerEntryToDelete}
              customer={customer}
              onClose={() => setLedgerEntryToDelete(null)}
              onSuccess={() => {
                refetchLedger();
                refetchSales();
              }}
            />
          )}
       </AnimatePresence>
    </div>
  );
}

function EditCustomerModal({ customer, onClose }: { customer: Customer, onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ 
    name: customer.name, 
    shop_name: customer.shop_name || '', 
    phone: customer.phone || '', 
    address: customer.address || '' 
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.phone && data.phone.replace(/\D/g, '').length < 11) {
        throw new Error("Phone number must be at least 11 digits");
      }
      const { error } = await supabase
        .from('customers')
        .update(data)
        .eq('id', customer.id);
      if (error) throw error;

      await logActivity({
        business_id: customer.business_id,
        user_id: customer.user_id,
        action: 'EDIT_CUSTOMER',
        details: {
          title: `Updated Customer: ${data.name}`,
          sub: data.shop_name || 'CRM Update',
          amount: 'EDITED',
          type: 'customer'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to update customer.");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
       <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         exit={{ opacity: 0, scale: 0.95, y: 20 }}
         className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl relative overflow-hidden z-10"
       >
         <form onSubmit={handleSubmit}>
           <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                 <h2 className="text-lg lg:text-xl font-bold text-slate-900 tracking-tight">Edit Customer</h2>
                 <p className="text-xs lg:text-sm font-medium text-slate-400">Update profile for {customer.name}</p>
              </div>
              <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 transition-colors">
                <X className="w-6 h-6" />
              </button>
           </div>
           
           <div className="p-8 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
                <Input label="Customer Name" value={formData.name} onChange={(v: string) => setFormData({...formData, name: v})} placeholder="e.g. Rahim Ali" required />
                <Input label="Shop Name" value={formData.shop_name} onChange={(v: string) => setFormData({...formData, shop_name: v})} placeholder="e.g. Rahim Store" />
                <Input label="Phone Number" value={formData.phone} onChange={(v: string) => setFormData({...formData, phone: v})} placeholder="017xxxxxxxx" />
                <Input label="Address" value={formData.address} onChange={(v: string) => setFormData({...formData, address: v})} placeholder="Full address..." />
              </div>
           </div>
           
           <div className="p-8 bg-slate-50 flex gap-4">
              <button type="button" onClick={onClose} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-slate-50">Cancel</button>
              <button 
                type="submit"
                disabled={mutation.isPending}
                className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
              >
                {mutation.isPending ? 'Updating...' : 'Update Customer'}
              </button>
           </div>
         </form>
       </motion.div>
    </div>
  );
}

function DeleteCustomerModal({ customer, onClose, onSuccess }: { customer: Customer, onClose: () => void, onSuccess?: () => void }) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [forceDelete, setForceDelete] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!forceDelete) {
        // Check for related data first to give better error messages
        const { count: ledgerCount } = await supabase
          .from('customer_ledger')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', customer.id);

        const { count: salesCount } = await supabase
          .from('sales')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', customer.id);

        if ((ledgerCount && ledgerCount > 0) || (salesCount && salesCount > 0)) {
          throw new Error("Cannot delete customer with existing transactions. Check the 'delete history' box below to force delete.");
        }
      } else {
        // 1. Get all related activity IDs first to reverse balances
        const [
          { data: relatedSales },
          { data: relatedLedger }
        ] = await Promise.all([
          supabase.from('sales').select('id').eq('customer_id', customer.id),
          supabase.from('customer_ledger').select('id').eq('customer_id', customer.id)
        ]);

        const saleIds = (relatedSales || []).map(s => s.id);
        const ledgerIds = (relatedLedger || []).map(l => l.id);

        if (saleIds.length > 0 || ledgerIds.length > 0) {
          // Fetch all distributions linked to this customer's sales or payments
          const { data: distributions } = await supabase
            .from('partner_profit_distributions')
            .select('partner_id, amount_cents')
            .or(`sale_id.in.(${saleIds.join(',') || '00000000-0000-0000-0000-000000000000'}),ledger_id.in.(${ledgerIds.join(',') || '00000000-0000-0000-0000-000000000000'})`);

          if (distributions && distributions.length > 0) {
            for (const dist of distributions) {
              await supabase.rpc('increment_partner_balance', { 
                p_id: dist.partner_id, 
                amount_cents: -dist.amount_cents 
              });
            }
            // Delete these distributions explicitly to avoid FK issues during sequential deletes
            await supabase.from('partner_profit_distributions')
              .delete()
              .or(`sale_id.in.(${saleIds.join(',') || '00000000-0000-0000-0000-000000000000'}),ledger_id.in.(${ledgerIds.join(',') || '00000000-0000-0000-0000-000000000000'})`);
          }
        }

        // 2. Delete Ledger entries
        await supabase.from('customer_ledger').delete().eq('customer_id', customer.id);
        
        // 3. Delete Sales
        await supabase.from('sales').delete().eq('customer_id', customer.id);
      }

      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customer.id);
      if (error) throw error;

      // Log Activity
      await logActivity({
        business_id: business?.id || '',
        user_id: user?.id,
        action: 'DELETE_CUSTOMER',
        details: {
          title: `Deleted Customer: ${customer.name}`,
          sub: 'CRM Record Removed',
          amount: 'DELETED',
          type: 'customer'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to delete customer.");
    }
  });

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
       <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         exit={{ opacity: 0, scale: 0.95, y: 20 }}
         className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl relative overflow-hidden z-10 p-8 text-center"
       >
         <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Trash2 className="w-8 h-8" />
         </div>
         <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Delete Customer?</h2>
         <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Are you sure you want to remove <span className="font-bold text-slate-900">"{customer.name}"</span>?
         </p>

         <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3 text-left">
            <input 
              type="checkbox" 
              id="forceDelete" 
              checked={forceDelete}
              onChange={(e) => setForceDelete(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-slate-300 text-red-500 focus:ring-red-500"
            />
            <label htmlFor="forceDelete" className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-tight cursor-pointer">
              Also delete all transaction history (Ledger & Sales)
            </label>
         </div>

         {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-[10px] font-bold uppercase tracking-wide text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
         )}

         <div className="flex flex-col gap-3">
            <button 
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className={`
                w-full h-14 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50
                ${forceDelete ? 'bg-red-600 shadow-red-200' : 'bg-red-500 shadow-red-100'}
              `}
            >
              {mutation.isPending ? 'Deleting...' : 'Confirm Delete'}
            </button>
            <button 
              onClick={onClose}
              disabled={mutation.isPending}
              className="w-full py-3 text-slate-400 font-bold text-xs uppercase tracking-widest"
            >
              Cancel
            </button>
         </div>
       </motion.div>
    </div>
  );
}

function RecordPaymentModal({ customer, onClose }: { customer: Customer, onClose: () => void }) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState((customer.total_due_cents / 100).toString());
  const [method, setMethod] = useState('cash');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!business?.id) throw new Error("Business not found");
      const amountCents = Math.round(parseFloat(amount) * 100);
      if (amountCents <= 0) throw new Error("Amount must be greater than zero");
      if (amountCents > customer.total_due_cents) throw new Error("Amount cannot exceed total due");

      // 1. Insert into ledger
      const { data: ledgerEntry, error: lError } = await supabase.from('customer_ledger').insert({
        business_id: business.id,
        user_id: user?.id,
        customer_id: customer.id,
        transaction_type: 'payment',
        amount_cents: amountCents
      }).select().single();
      
      if (lError) throw lError;

      // 2. Decrement Customer total_due_cents
      const newDue = customer.total_due_cents - amountCents;
      const { error: cError } = await supabase
        .from('customers')
        .update({ total_due_cents: newDue })
        .eq('id', customer.id);
      
      if (cError) throw cError;

      // 3. Profit Distribution for Dues (Realized Profit Unlock)
      // Logic: FIFO distribution of payment to unpaid profit portions of sales
      const { data: dueSales } = await supabase
        .from('sales')
        .select('*')
        .eq('customer_id', customer.id)
        .gt('due_cents', 0)
        .order('created_at', { ascending: true });

      if (dueSales && dueSales.length > 0) {
        let remainingPayment = amountCents;
        const [
          { data: currentPartners },
          { data: capitalContributions }
        ] = await Promise.all([
          supabase.from('partners').select('*').eq('business_id', business.id).eq('status', 'active'),
          supabase.from('capital_contributions').select('*').eq('business_id', business.id)
        ]);

        if (currentPartners && currentPartners.length > 0) {
          // Calculate actual capital for each partner in BDT
          const partnerCapitalMap: Record<string, number> = {};
          let totalBusinessCapital = 0;

          capitalContributions?.forEach(cap => {
            const amount = parseFloat(cap.amount || '0');
            const amountBDT = cap.currency === 'RMB' ? amount * (business.exchange_rate || 1) : amount;
            partnerCapitalMap[cap.partner_id] = (partnerCapitalMap[cap.partner_id] || 0) + amountBDT;
            totalBusinessCapital += amountBDT;
          });

          for (const sale of dueSales) {
            if (remainingPayment <= 0) break;

            const saleDue = sale.due_cents;
            const appliedToThisSale = Math.min(remainingPayment, saleDue);
            
            // Calculate profit portion for this payment application
            const profitToUnlock = Math.floor((appliedToThisSale / sale.total_cents) * sale.expected_profit_cents);

            if (profitToUnlock > 0) {
              const distributions = currentPartners.map(p => {
                const partnerCapital = partnerCapitalMap[p.id] || 0;
                const shareRatio = totalBusinessCapital > 0 ? partnerCapital / totalBusinessCapital : 0;
                const share = shareRatio * profitToUnlock;

                return {
                  business_id: business.id,
                  partner_id: p.id,
                  sale_id: sale.id,
                  ledger_id: ledgerEntry.id,
                  amount_cents: Math.floor(share),
                  notes: `Profit from Sale ${sale.invoice_no} (Due Payment Collected - Ratio: ${(shareRatio * 100).toFixed(3)}%)`
                };
              }).filter(d => d.amount_cents > 0);

              if (distributions.length > 0) {
                await supabase.from('partner_profit_distributions').insert(distributions);
                for (const dist of distributions) {
                  await supabase.rpc('increment_partner_balance', { p_id: dist.partner_id, amount_cents: dist.amount_cents });
                }
                
                // Update distributed profit and decrement due on sale
                await supabase.from('sales').update({
                  distributed_profit_cents: (sale.distributed_profit_cents || 0) + profitToUnlock,
                  due_cents: Math.max(0, sale.due_cents - appliedToThisSale)
                }).eq('id', sale.id);
              }
            }

            remainingPayment -= appliedToThisSale;
          }
        }
      }

      await logActivity({
        business_id: business.id,
        user_id: user?.id,
        action: 'COLLECT_PAYMENT',
        details: {
          title: `Payment: ${customer.name}`,
          sub: `Method: ${method.toUpperCase()}`,
          amount: `+${formatBDT(amountCents)}`,
          type: 'customer'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer_ledger', customer.id] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      onClose();
    },
    onError: (err: any) => setError(err.message)
  });

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
       <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         exit={{ opacity: 0, scale: 0.95, y: 20 }}
         className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl relative overflow-hidden z-10 p-8"
       >
         <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
            <ArrowDownLeft className="w-7 h-7" />
         </div>
         <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Collect Payment</h2>
         <p className="text-sm text-slate-500 mb-6 font-medium">Clear due amounts for {customer.name}.</p>
         
         <div className="space-y-4 mb-8">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded-xl border border-red-100 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </div>
            )}
            
            <Input label="Amount to Collect (৳)" type="number" value={amount} onChange={setAmount} />
            
            <div className="space-y-1">
               <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">Payment Method</label>
               <select 
                 className="w-full bg-slate-50 border border-slate-100 h-9 px-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                 value={method}
                 onChange={(e) => setMethod(e.target.value)}
               >
                 <option value="cash">Cash</option>
                 <option value="bkash">bKash</option>
                 <option value="nagad">Nagad</option>
                 <option value="bank">Bank Transfer</option>
               </select>
            </div>
         </div>

         <div className="flex flex-col gap-3">
            <button 
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full h-14 bg-emerald-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50"
            >
              {mutation.isPending ? 'Processing...' : 'Confirm Collection'}
            </button>
            <button onClick={onClose} className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Cancel</button>
         </div>
       </motion.div>
    </div>
  );
}

function DeleteLedgerEntryModal({ entry, customer, onClose, onSuccess }: any) {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsPending(true);
    setError(null);
    try {
      // 1. Revert distributed profits
      const { data: distributions } = await supabase
        .from('partner_profit_distributions')
        .select('*')
        .eq('ledger_id', entry.id);
      
      if (distributions && distributions.length > 0) {
        // Group by sale_id
        const saleUpdates: Record<string, number> = {};
        for (const dist of distributions) {
          // Revert partner balance
          await supabase.rpc('increment_partner_balance', { 
            p_id: dist.partner_id, 
            amount_cents: -dist.amount_cents 
          });
          saleUpdates[dist.sale_id] = (saleUpdates[dist.sale_id] || 0) + dist.amount_cents;
        }

        // For each sale, we need to revert due_cents and distributed_profit_cents
        for (const [saleId, profitAmount] of Object.entries(saleUpdates)) {
           const { data: sale } = await supabase.from('sales').select('*').eq('id', saleId).single();
           if (sale) {
              const appliedEstimate = sale.expected_profit_cents > 0 
                ? Math.round((profitAmount * sale.total_cents) / sale.expected_profit_cents)
                : 0; 
              
              await supabase.from('sales').update({
                distributed_profit_cents: Math.max(0, (sale.distributed_profit_cents || 0) - profitAmount),
                due_cents: sale.due_cents + appliedEstimate
              }).eq('id', saleId);
           }
        }
        // Delete distributions
        await supabase.from('partner_profit_distributions').delete().eq('ledger_id', entry.id);
      }

      // 2. Revert Customer total_due_cents
      await supabase.rpc('increment_customer_due', { 
        cust_id: customer.id, 
        amount: entry.amount_cents 
      });

      // 3. Delete ledger entry
      const { error: deleteError } = await supabase.from('customer_ledger').delete().eq('id', entry.id);
      if (deleteError) throw deleteError;

      await logActivity({
        business_id: customer.business_id,
        user_id: customer.user_id,
        action: 'DELETE_PAYMENT',
        details: {
          title: `Deleted Receipt: ${customer.name}`,
          sub: 'Payment Record Removed',
          amount: `-${formatBDT(entry.amount_cents)}`,
          type: 'customer'
        }
      });

      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
       <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl relative overflow-hidden z-10 p-8 text-center"
       >
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
             <Trash2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight uppercase">Delete Receipt?</h2>
          <p className="text-[11px] font-bold text-slate-400 mb-6 uppercase tracking-widest leading-relaxed">
             Deleting this payment will return <span className="text-slate-900">{formatBDT(entry.amount_cents)}</span> to the customer balance and reverse partner profits.
          </p>

          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded-xl border border-red-100">{error}</div>}

          <div className="flex flex-col gap-3">
             <button 
               onClick={handleDelete}
               disabled={isPending}
               className="w-full h-14 bg-red-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-100 transition-all active:scale-95 disabled:opacity-50"
             >
               {isPending ? 'Processing...' : 'Delete Now'}
             </button>
             <button onClick={onClose} className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Cancel</button>
          </div>
       </motion.div>
    </div>
  );
}

function EditLedgerEntryModal({ entry, customer, onClose, onSuccess }: any) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState((entry.amount_cents / 100).toString());
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    setIsPending(true);
    setError(null);
    try {
      if (!business?.id) throw new Error("Business not found");
      const newAmountCents = Math.round(parseFloat(amount) * 100);
      if (newAmountCents <= 0) throw new Error("Amount must be greater than zero");

      // 1. REVERT OLD 
      const { data: distributions } = await supabase.from('partner_profit_distributions').select('*').eq('ledger_id', entry.id);
      if (distributions && distributions.length > 0) {
        const saleUpdates: Record<string, number> = {};
        for (const dist of distributions) {
          await supabase.rpc('increment_partner_balance', { p_id: dist.partner_id, amount_cents: -dist.amount_cents });
          saleUpdates[dist.sale_id] = (saleUpdates[dist.sale_id] || 0) + dist.amount_cents;
        }
        for (const [saleId, profitAmount] of Object.entries(saleUpdates)) {
           const { data: sale } = await supabase.from('sales').select('*').eq('id', saleId).single();
           if (sale) {
              const appliedEstimate = sale.expected_profit_cents > 0 ? Math.round((profitAmount * sale.total_cents) / sale.expected_profit_cents) : 0;
              await supabase.from('sales').update({
                distributed_profit_cents: Math.max(0, (sale.distributed_profit_cents || 0) - profitAmount),
                due_cents: sale.due_cents + appliedEstimate
              }).eq('id', saleId);
           }
        }
        await supabase.from('partner_profit_distributions').delete().eq('ledger_id', entry.id);
      }
      await supabase.rpc('increment_customer_due', { cust_id: customer.id, amount: entry.amount_cents });
      
      // 2. APPLY NEW
      const { data: updatedCustomer } = await supabase.from('customers').select('total_due_cents').eq('id', customer.id).single();
      const currentDue = updatedCustomer?.total_due_cents || 0;
      if (newAmountCents > currentDue) throw new Error("New amount exceeds total due");

      await supabase.from('customer_ledger').update({ amount_cents: newAmountCents }).eq('id', entry.id);
      await supabase.rpc('increment_customer_due', { cust_id: customer.id, amount: -newAmountCents });

      const { data: dueSales } = await supabase
        .from('sales')
        .select('*')
        .eq('customer_id', customer.id)
        .gt('due_cents', 0)
        .order('created_at', { ascending: true });

      if (dueSales && dueSales.length > 0) {
        let remainingPayment = newAmountCents;
        const [
          { data: currentPartners },
          { data: capitalContributions }
        ] = await Promise.all([
          supabase.from('partners').select('*').eq('business_id', business.id).eq('status', 'active'),
          supabase.from('capital_contributions').select('*').eq('business_id', business.id)
        ]);

        if (currentPartners && currentPartners.length > 0) {
          const partnerCapitalMap: Record<string, number> = {};
          let totalBusinessCapital = 0;
          capitalContributions?.forEach(cap => {
            const amount = parseFloat(cap.amount || '0');
            const amountBDT = cap.currency === 'RMB' ? amount * (business.exchange_rate || 1) : amount;
            partnerCapitalMap[cap.partner_id] = (partnerCapitalMap[cap.partner_id] || 0) + amountBDT;
            totalBusinessCapital += amountBDT;
          });

          for (const sale of dueSales) {
            if (remainingPayment <= 0) break;
            const saleDue = sale.due_cents;
            const appliedToThisSale = Math.min(remainingPayment, saleDue);
            const profitToUnlock = Math.floor((appliedToThisSale / sale.total_cents) * sale.expected_profit_cents);

            if (profitToUnlock > 0) {
              const distributions = currentPartners.map(p => {
                const partnerCapital = partnerCapitalMap[p.id] || 0;
                const shareRatio = totalBusinessCapital > 0 ? partnerCapital / totalBusinessCapital : 0;
                const share = shareRatio * profitToUnlock;
                return {
                  business_id: business.id,
                  partner_id: p.id,
                  sale_id: sale.id,
                  ledger_id: entry.id,
                  amount_cents: Math.floor(share),
                  notes: `Updated Profit from Sale ${sale.invoice_no}`
                };
              }).filter(d => d.amount_cents > 0);

              if (distributions.length > 0) {
                await supabase.from('partner_profit_distributions').insert(distributions);
                for (const dist of distributions) {
                  await supabase.rpc('increment_partner_balance', { p_id: dist.partner_id, amount_cents: dist.amount_cents });
                }
                await supabase.from('sales').update({
                  distributed_profit_cents: (sale.distributed_profit_cents || 0) + profitToUnlock,
                  due_cents: Math.max(0, sale.due_cents - appliedToThisSale)
                }).eq('id', sale.id);
              }
            }
            remainingPayment -= appliedToThisSale;
          }
        }
      }

      await logActivity({
        business_id: business.id,
        user_id: user?.id,
        action: 'EDIT_PAYMENT',
        details: {
          title: `Updated Payment: ${customer.name}`,
          sub: `Original: ${formatBDT(entry.amount_cents)}`,
          amount: `NEW: ${formatBDT(newAmountCents)}`,
          type: 'customer'
        }
      });

      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
       <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl relative overflow-hidden z-10 p-8"
       >
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
             <Pencil className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2 uppercase tracking-tight">Edit Payment</h2>
          <p className="text-[11px] font-bold text-slate-400 mb-6 uppercase tracking-widest leading-relaxed">
             Adjust the receipt amount. System will re-calculate profit distributions.
          </p>
          
          <div className="space-y-4 mb-8 text-left">
             {error && <div className="p-3 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded-xl border border-red-100">{error}</div>}
             <Input label="Revised Amount (৳)" type="number" value={amount} onChange={setAmount} />
          </div>

          <div className="flex flex-col gap-3">
             <button 
               onClick={handleUpdate}
               disabled={isPending}
               className="w-full h-14 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-100 transition-all active:scale-95 disabled:opacity-50"
             >
               {isPending ? 'Updating...' : 'Save Changes'}
             </button>
             <button onClick={onClose} className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Cancel</button>
          </div>
       </motion.div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, required }: any) {
  return (
    <div className="space-y-1 flex-1 text-left">
      <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">{label}</label>
      <input 
        type={type}
        className="w-full bg-slate-50 border border-slate-100 h-9 px-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs font-bold"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          onChange('');
        }}
        onBlur={(e) => {
          if (type === 'number' && value) {
            const num = parseFloat(value);
            if (!isNaN(num)) {
              onChange(num.toFixed(2));
            }
          }
        }}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
