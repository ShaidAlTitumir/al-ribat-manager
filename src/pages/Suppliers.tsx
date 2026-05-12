// src/pages/Suppliers.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Truck, Search, Plus, Phone, Store, MapPin, 
  Trash2, MoreVertical, ChevronRight, UserCircle,
  X, AlertCircle, Download, ExternalLink, MessageCircle, Package
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Supplier } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';
import * as XLSX from 'xlsx';

export default function Suppliers() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  useScrollLock(isAddModalOpen || isEditModalOpen || !!supplierToDelete || (!!selectedSupplier && !isEditModalOpen));

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('business_id', business?.id)
        .order('name', { ascending: true });
      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!business?.id,
  });

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.shop_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone?.includes(searchQuery) ||
    s.products_list?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const downloadExcel = () => {
    const dataToExport = suppliers.map(s => ({
      'Name': s.name,
      'Shop Name': s.shop_name || '',
      'Phone': s.phone || '',
      'WeChat': s.wechat || '',
      'Location': s.location || '',
      'Shop Link': s.shop_link || '',
      'Products List': s.products_list || '',
      'Notes': s.notes || '',
      'Added Date': new Date(s.created_at).toLocaleDateString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers');
    XLSX.writeFile(workbook, `${business?.name || 'Business'}_Suppliers.xlsx`);
  };

  return (
    <MainLayout>
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl lg:text-3xl font-bold text-slate-900 tracking-tight uppercase">Supplier Network</h1>
            <p className="text-slate-500 text-[10px] lg:text-xs font-medium">Manage sourcing and manufacturing contacts.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={downloadExcel}
              disabled={suppliers.length === 0}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button 
              onClick={() => business ? setIsAddModalOpen(true) : navigate('/onboarding')}
              className="flex-1 md:flex-none px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        {!business && (
          <div className="bg-amber-50 border border-amber-100 p-4 rounded-[24px] flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
               <Truck className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-900 leading-none">Partner Sourcing Paused</h3>
              <p className="text-[10px] font-medium text-amber-700 mt-1 leading-tight">
                Connect your business to start adding suppliers.
              </p>
            </div>
          </div>
        )}

        {/* Stats Strip */}
        <div className="grid grid-cols-1 gap-2">
           <div className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
              <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                 <Truck className="w-3.5 h-3.5" />
              </div>
              <div>
                 <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Total Suppliers</p>
                 <p className="text-xs font-bold text-slate-900 tracking-tight leading-none">{suppliers.length}</p>
              </div>
           </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input 
            className="w-full bg-white border border-slate-100 h-9 pl-9 pr-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-xs font-medium"
            placeholder="Search suppliers, products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
           {filteredSuppliers.map((supplier, idx) => (
             <SupplierCard 
               key={`${supplier.id}-${idx}`} 
               supplier={supplier} 
               onClick={() => setSelectedSupplier(supplier)} 
               onEdit={() => { setSelectedSupplier(supplier); setIsEditModalOpen(true); }}
               onDelete={() => setSupplierToDelete(supplier)}
             />
           ))}
           {filteredSuppliers.length === 0 && !isLoading && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300">
                <Truck className="w-16 h-16 mb-4 opacity-10" />
                <p className="text-xs font-bold uppercase tracking-widest">No suppliers found</p>
              </div>
           )}
        </div>
      </div>

      <AnimatePresence>
         {isAddModalOpen && <AddSupplierModal onClose={() => setIsAddModalOpen(false)} />}
         {isEditModalOpen && selectedSupplier && (
            <EditSupplierModal 
              supplier={selectedSupplier} 
              onClose={() => { setIsEditModalOpen(false); setSelectedSupplier(null); }} 
            />
         )}
         {supplierToDelete && (
            <DeleteSupplierModal 
              supplier={supplierToDelete} 
              onClose={() => setSupplierToDelete(null)} 
              onSuccess={() => setSelectedSupplier(null)}
            />
         )}
         {selectedSupplier && !isEditModalOpen && (
            <SupplierDetailDrawer 
              supplier={selectedSupplier} 
              onClose={() => setSelectedSupplier(null)}
              onEdit={() => setIsEditModalOpen(true)}
              onDelete={() => setSupplierToDelete(selectedSupplier)}
            />
         )}
      </AnimatePresence>
    </MainLayout>
  );
}

function SupplierCard({ supplier, onClick, onEdit, onDelete }: { supplier: Supplier, onClick: () => void, onEdit: () => void, onDelete: () => void }) {
  return (
    <motion.div 
      layout
      onClick={onClick}
      className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group flex flex-col cursor-pointer active:scale-95"
    >
       <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <Truck className="w-3.5 h-3.5" />
             </div>
             <div className="text-left">
                <h3 className="text-xs lg:text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{supplier.name}</h3>
                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{supplier.shop_name || 'Generic Supplier'}</p>
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
          {supplier.phone && (
            <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500">
               <Phone className="w-2.5 h-2.5 text-slate-300" /> {supplier.phone}
            </div>
          )}
          {supplier.location && (
            <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 truncate">
               <MapPin className="w-2.5 h-2.5 text-slate-300" /> {supplier.location}
            </div>
          )}
          {supplier.products_list && (
            <div className="flex items-center gap-2 text-[9px] font-semibold text-blue-600 truncate py-0.5 px-1.5 bg-blue-50 rounded-lg w-fit">
               <Package className="w-2.5 h-2.5 text-blue-400" /> {supplier.products_list}
            </div>
          )}
       </div>

       <div className="mt-auto pt-2 border-t border-slate-50 flex items-center justify-between">
          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Comm</span>
          <div className="flex items-center gap-1.5">
            {supplier.wechat && (
              <div className="px-2 py-1 bg-emerald-50 rounded text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                <MessageCircle className="w-3 h-3" /> WeChat
              </div>
            )}
            {supplier.shop_link && (
              <div className="px-2 py-1 bg-blue-50 rounded text-[9px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Link
              </div>
            )}
          </div>
       </div>
    </motion.div>
  );
}

function AddSupplierModal({ onClose }: { onClose: () => void }) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ 
    name: '', 
    shop_name: '', 
    phone: '', 
    wechat: '', 
    location: '', 
    shop_link: '', 
    products_list: '', 
    notes: '' 
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (!business?.id) throw new Error("Business not found. Please reload.");
      if (!data.name.trim()) throw new Error("Supplier name is required.");
      
      const { error } = await supabase
        .from('suppliers')
        .insert({ 
          ...data,
          business_id: business.id
        });
        
      if (error) throw error;

      // Log Activity
      await supabase.from('activity_log').insert({
        business_id: business.id,
        user_id: user?.id,
        action: 'ADD_SUPPLIER',
        details: {
          title: `Added Supplier: ${data.name}`,
          sub: data.shop_name || 'Global Network',
          amount: 'NEW',
          type: 'supplier'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to save supplier. Please try again.");
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
         className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl relative overflow-hidden z-10"
       >
         <form onSubmit={handleSubmit}>
           <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                 <h2 className="text-lg lg:text-xl font-bold text-slate-900 tracking-tight">Add Supplier</h2>
                 <p className="text-xs lg:text-sm font-medium text-slate-400">Expand your global trade network.</p>
              </div>
              <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 transition-colors">
                <X className="w-6 h-6" />
              </button>
           </div>
           
           <div className="p-8 max-h-[60vh] overflow-y-auto space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="Supplier Name *" 
                  value={formData.name} 
                  onChange={(v: string) => setFormData({...formData, name: v})} 
                  placeholder="e.g. Jack Ma" 
                  required
                />
                <Input 
                  label="Shop Name" 
                  value={formData.shop_name} 
                  onChange={(v: string) => setFormData({...formData, shop_name: v})} 
                  placeholder="e.g. Alibaba Warehouse" 
                />
                <Input 
                  label="Phone Number" 
                  value={formData.phone} 
                  onChange={(v: string) => setFormData({...formData, phone: v})} 
                  placeholder="Contact Number" 
                />
                <Input 
                  label="WeChat ID" 
                  value={formData.wechat} 
                  onChange={(v: string) => setFormData({...formData, wechat: v})} 
                  placeholder="WeChat ID" 
                />
                <Input 
                  label="Location" 
                  value={formData.location} 
                  onChange={(v: string) => setFormData({...formData, location: v})} 
                  placeholder="e.g. Guangzhou, China" 
                />
                <Input 
                  label="Shop Link" 
                  value={formData.shop_link} 
                  onChange={(v: string) => setFormData({...formData, shop_link: v})} 
                  placeholder="https://..." 
                />
                <div className="md:col-span-2">
                  <Input 
                    label="Products List" 
                    value={formData.products_list} 
                    onChange={(v: string) => setFormData({...formData, products_list: v})} 
                    placeholder="e.g. Electronics, Clothing, Gadgets" 
                  />
                </div>
                <div className="md:col-span-2">
                   <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Notes</label>
                   <textarea 
                     className="w-full bg-slate-50 border border-slate-100 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs font-bold h-24"
                     value={formData.notes}
                     onChange={(e) => setFormData({...formData, notes: e.target.value})}
                     placeholder="Any additional details..."
                   />
                </div>
              </div>
           </div>
           
           <div className="p-8 bg-slate-50 flex gap-4">
              <button type="button" onClick={onClose} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-slate-50">Cancel</button>
              <button 
                type="submit"
                disabled={mutation.isPending}
                className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
              >
                {mutation.isPending ? 'Saving...' : 'Save Supplier'}
              </button>
           </div>
         </form>
       </motion.div>
    </div>
  );
}

function EditSupplierModal({ supplier, onClose }: { supplier: Supplier, onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ 
    name: supplier.name, 
    shop_name: supplier.shop_name || '', 
    phone: supplier.phone || '', 
    wechat: supplier.wechat || '', 
    location: supplier.location || '', 
    shop_link: supplier.shop_link || '', 
    products_list: supplier.products_list || '', 
    notes: supplier.notes || '' 
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('suppliers')
        .update(data)
        .eq('id', supplier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to update supplier.");
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
         className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl relative overflow-hidden z-10"
       >
         <form onSubmit={handleSubmit}>
           <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                 <h2 className="text-lg lg:text-xl font-bold text-slate-900 tracking-tight">Edit Supplier</h2>
                 <p className="text-xs lg:text-sm font-medium text-slate-400">Update contact for {supplier.name}</p>
              </div>
              <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 transition-colors">
                <X className="w-6 h-6" />
              </button>
           </div>
           
           <div className="p-8 max-h-[60vh] overflow-y-auto space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Supplier Name *" value={formData.name} onChange={(v: string) => setFormData({...formData, name: v})} required />
                <Input label="Shop Name" value={formData.shop_name} onChange={(v: string) => setFormData({...formData, shop_name: v})} />
                <Input label="Phone Number" value={formData.phone} onChange={(v: string) => setFormData({...formData, phone: v})} />
                <Input label="WeChat ID" value={formData.wechat} onChange={(v: string) => setFormData({...formData, wechat: v})} />
                <Input label="Location" value={formData.location} onChange={(v: string) => setFormData({...formData, location: v})} />
                <Input label="Shop Link" value={formData.shop_link} onChange={(v: string) => setFormData({...formData, shop_link: v})} />
                <div className="md:col-span-2">
                  <Input label="Products List" value={formData.products_list} onChange={(v: string) => setFormData({...formData, products_list: v})} />
                </div>
                <div className="md:col-span-2">
                   <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Notes</label>
                   <textarea 
                     className="w-full bg-slate-50 border border-slate-100 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs font-bold h-24"
                     value={formData.notes}
                     onChange={(e) => setFormData({...formData, notes: e.target.value})}
                   />
                </div>
              </div>
           </div>
           
           <div className="p-8 bg-slate-50 flex gap-4">
              <button type="button" onClick={onClose} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-slate-50">Cancel</button>
              <button 
                type="submit"
                disabled={mutation.isPending}
                className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
              >
                {mutation.isPending ? 'Updating...' : 'Update Supplier'}
              </button>
           </div>
         </form>
       </motion.div>
    </div>
  );
}

function SupplierDetailDrawer({ supplier, onClose, onEdit, onDelete }: { supplier: Supplier, onClose: () => void, onEdit: () => void, onDelete: () => void }) {
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
          <div className="p-6 border-b border-slate-50 bg-blue-600 text-white flex items-center justify-between">
             <div className="flex items-center gap-4">
                <button onClick={onClose} className="p-2 rounded-xl bg-white/10 text-white">
                   <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
                <div>
                   <h2 className="text-xl font-bold tracking-tight leading-none mb-1 uppercase">{supplier.name}</h2>
                   <div className="flex items-center gap-4">
                      <button onClick={onEdit} className="text-[10px] font-bold text-blue-200 uppercase tracking-widest hover:text-white transition-colors">Edit</button>
                      <button onClick={onDelete} className="text-[10px] font-bold text-red-300 uppercase tracking-widest hover:text-red-100 transition-colors">Delete</button>
                   </div>
                </div>
             </div>
             <div className="text-right">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Shop</span>
                <p className="text-sm font-bold text-white leading-none mt-1">{supplier.shop_name || 'Individual'}</p>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8">
             <section className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Business Details</h3>
                <div className="grid grid-cols-2 gap-6">
                   <DetailItem label="Phone" value={supplier.phone} />
                   <DetailItem label="WeChat" value={supplier.wechat} />
                   <DetailItem label="Location" value={supplier.location} />
                   <DetailItem label="Products" value={supplier.products_list} />
                </div>
                {supplier.shop_link && (
                   <div className="pt-2">
                       <a 
                        href={supplier.shop_link.startsWith('http') ? supplier.shop_link : `https://${supplier.shop_link}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-2xl text-blue-700 hover:bg-blue-100 transition-all font-bold text-xs uppercase tracking-widest"
                       >
                         View Online Store <ExternalLink className="w-4 h-4" />
                       </a>
                   </div>
                )}
             </section>

             {supplier.notes && (
                <section className="space-y-4">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Notes</h3>
                   <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 italic text-slate-600 text-sm leading-relaxed">
                      "{supplier.notes}"
                   </div>
                </section>
             )}

             <section className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Action Pack</h3>
                <div className="grid grid-cols-1 gap-3">
                   <button 
                     onClick={() => window.open(supplier.shop_link?.startsWith('http') ? supplier.shop_link : `https://${supplier.shop_link}`, '_blank')}
                     disabled={!supplier.shop_link}
                     className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-100 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                   >
                     Order via Shop Link
                   </button>
                </div>
             </section>
          </div>
       </motion.div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string, value?: string }) {
   return (
      <div>
         <span className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</span>
         <p className="text-sm font-bold text-slate-900">{value || 'Not provided'}</p>
      </div>
   );
}

function DeleteSupplierModal({ supplier, onClose, onSuccess }: { supplier: Supplier, onClose: () => void, onSuccess?: () => void }) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplier.id);
      if (error) throw error;

      // Log Activity
      await supabase.from('activity_log').insert({
        business_id: business?.id,
        user_id: user?.id,
        action: 'DELETE_SUPPLIER',
        details: {
          title: `Deleted Supplier: ${supplier.name}`,
          sub: 'Network Record Removed',
          amount: 'REMOVED',
          type: 'supplier'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to delete supplier.");
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
         <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Remove Supplier?</h2>
         <p className="text-sm text-slate-500 mb-8 leading-relaxed">
            This will permanently remove <span className="font-bold text-slate-900">"{supplier.name}"</span> from your network.
         </p>

         {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[10px] font-bold uppercase text-left">
              {error}
            </div>
         )}

         <div className="flex flex-col gap-3">
            <button 
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full h-14 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-100 transition-all active:scale-95 disabled:opacity-50"
            >
              Confirm Removal
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
      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">{label}</label>
      <input 
        type={type}
        className="w-full bg-slate-50 border border-slate-100 h-9 px-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs font-bold"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
