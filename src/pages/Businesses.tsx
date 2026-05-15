// src/pages/Businesses.tsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { 
  Plus, Building2, ChevronRight, CheckCircle2, 
  Search, ArrowUpRight, Loader2, PlusCircle, LayoutGrid,
  Pencil, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MainLayout from '../components/layout/MainLayout';
import { useScrollLock } from '../hooks/useScrollLock';

export default function Businesses() {
  const { user, profile } = useAuth();
  const { business: activeBusiness, setActiveBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<any>(null);
  const [businessToDelete, setBusinessToDelete] = useState<any>(null);

  const [newBusinessName, setNewBusinessName] = useState('');
  const [newBusinessCurrency, setNewBusinessCurrency] = useState('BDT');
  const [newBusinessType, setNewBusinessType] = useState('partnership');
  const [newBusinessAddress, setNewBusinessAddress] = useState('');
  const [newBusinessPhone, setNewBusinessPhone] = useState('');
  const [newBusinessEmail, setNewBusinessEmail] = useState('');
  const [newBusinessWebsite, setNewBusinessWebsite] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useScrollLock(showCreateModal || showEditModal);

  // Fetch all businesses user is a member of
  const { data: userBusinesses = [], isLoading } = useQuery({
    queryKey: ['user-businesses', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_members')
        .select(`
          business_id,
          role,
          businesses (*)
        `)
        .eq('user_id', user?.id);

      if (error) throw error;
      return data.map(item => ({
        ...item.businesses,
        user_role: item.role
      }));
    },
    enabled: !!user?.id
  });

  const createBusinessMutation = useMutation({
    mutationFn: async () => {
      if (!newBusinessName.trim()) throw new Error('Business name is required');
      if (newBusinessPhone && newBusinessPhone.replace(/\D/g, '').length < 11) {
        throw new Error('Phone number must be at least 11 digits');
      }
      
      setIsCreating(true);
      
      // 1. Create Business
      const { data: business, error: bError } = await supabase
        .from('businesses')
        .insert({
          name: newBusinessName,
          currency: newBusinessCurrency,
          owner_id: user?.id,
          business_type: newBusinessType,
          address: newBusinessAddress,
          phone: newBusinessPhone,
          email: newBusinessEmail,
          website: newBusinessWebsite
        })
        .select()
        .single();
        
      if (bError) throw bError;

      // 2. Add as owner in business_members
      const { error: mError } = await supabase
        .from('business_members')
        .insert({
          business_id: business.id,
          user_id: user?.id,
          role: 'owner'
        });
        
      if (mError) throw mError;
      
      return business;
    },
    onSuccess: (newB) => {
      queryClient.invalidateQueries({ queryKey: ['user-businesses'] });
      setShowCreateModal(false);
      // Reset form
      setNewBusinessName('');
      setNewBusinessCurrency('BDT');
      setNewBusinessType('partnership');
      setNewBusinessAddress('');
      setNewBusinessPhone('');
      setNewBusinessEmail('');
      setNewBusinessWebsite('');
      
      setActiveBusiness(newB.id);
    },
    onError: (err: any) => {
      alert(err.message);
    },
    onSettled: () => {
      setIsCreating(false);
    }
  });

  const updateBusinessMutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.phone && data.phone.replace(/\D/g, '').length < 11) {
        throw new Error('Phone number must be at least 11 digits');
      }
      setIsUpdating(true);
      const { error } = await supabase
        .from('businesses')
        .update({
          name: data.name,
          currency: data.currency,
          business_type: data.business_type,
          address: data.address,
          phone: data.phone,
          email: data.email,
          website: data.website
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-businesses'] });
      setShowEditModal(false);
      setEditingBusiness(null);
    },
    onError: (err: any) => {
      alert(err.message);
    },
    onSettled: () => {
      setIsUpdating(false);
    }
  });

  const deleteBusinessMutation = useMutation({
    mutationFn: async (id: string) => {
      // Manual cascade delete since we don't know if DB has ON DELETE CASCADE
      // Order matters if there are internal dependencies, but business_id usually points to businesses
      const tables = [
        'business_members',
        'inventory',
        'customers',
        'partners',
        'expenses',
        'exchanges',
        'sales_items', // if it exists
        'sales',
        'transactions',
        'join_requests'
      ];

      for (const table of tables) {
        try {
          await supabase
            .from(table)
            .delete()
            .eq('business_id', id);
        } catch (e) {
          // Ignore errors for tables that might not exist or don't have business_id
          console.warn(`Could not clean up table ${table}:`, e);
        }
      }

      const { error } = await supabase
        .from('businesses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-businesses'] });
      // If the deleted business was the active one, clear it
      if (activeBusiness?.id === businessToDelete?.id) {
        setActiveBusiness(null);
      }
      setBusinessToDelete(null);
    },
    onError: (err: any) => {
      alert('Delete failed: ' + err.message);
    }
  });

  const selectBusiness = async (id: string | null) => {
    await setActiveBusiness(id);
    navigate('/');
  };

  return (
    <MainLayout>
      <div className="space-y-6 md:space-y-8 px-2 md:px-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Your Businesses</h2>
            <p className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest mt-0.5 md:mt-1 leading-tight">
              Select or create an entity
            </p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="p-2.5 md:p-3 bg-blue-600 text-white rounded-xl md:rounded-2xl shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 md:py-20">
            <Loader2 className="w-6 h-6 md:w-8 md:h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {userBusinesses.map((b: any) => {
              const isActive = activeBusiness?.id === b.id;
              return (
                <motion.div
                  key={b.id}
                  whileHover={{ y: -2 }}
                  className={`
                    group relative p-4 md:p-6 rounded-[24px] md:rounded-[32px] border transition-all cursor-pointer shadow-sm
                    ${isActive ? 'bg-blue-600 border-blue-600 text-white shadow-blue-100' : 'bg-white border-slate-100 text-slate-900 hover:border-blue-200'}
                  `}
                  onClick={() => selectBusiness(b.id)}
                >
                  <div className="flex items-start justify-between mb-3 md:mb-4">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className={`
                        w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center font-black text-base md:text-lg transition-colors
                        ${isActive ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}
                      `}>
                        {b.name?.substring(0, 2).toUpperCase()}
                      </div>
                      {(b.user_role === 'owner' || b.user_role === 'admin') && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingBusiness(b);
                            setShowEditModal(true);
                          }}
                          className={`
                            p-1.5 md:p-2 rounded-lg md:rounded-xl transition-all
                            ${isActive ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-blue-600'}
                          `}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {b.user_role === 'owner' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setBusinessToDelete(b);
                          }}
                          className={`
                            p-1.5 md:p-2 rounded-lg md:rounded-xl transition-all
                            ${isActive ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-red-600'}
                          `}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {isActive ? (
                      <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 md:w-6 md:h-6 text-slate-200 group-hover:text-blue-600 transition-colors" />
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-black text-base md:text-lg tracking-tight mb-0.5 md:mb-1">{b.name}</h3>
                    <div className="flex items-center gap-2">
                       <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${isActive ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                         {b.user_role}
                       </span>
                       <span className={`text-[9px] md:text-[10px] font-bold ${isActive ? 'text-white/60' : 'text-slate-400'}`}>
                         • {b.currency || 'BDT'}
                       </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <button 
              onClick={() => setShowCreateModal(true)}
              className="group p-4 md:p-6 rounded-[24px] md:rounded-[32px] border-2 border-dashed border-slate-100 hover:border-blue-200 flex flex-col items-center justify-center text-slate-300 hover:text-blue-600 transition-all gap-3 md:gap-4 min-h-[120px] md:min-h-[160px]"
            >
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform">
                <PlusCircle className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Launch New Venture</p>
            </button>
          </div>
        )}

        <div className="bg-slate-900 rounded-[28px] md:rounded-[32px] p-6 md:p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-lg md:text-xl font-black tracking-tight mb-1.5 md:mb-2">Join a Business?</h3>
            <p className="text-slate-400 text-[11px] md:text-sm font-medium mb-4 md:mb-6 max-w-sm">
              Linked shared businesses will appear in the list above.
            </p>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg w-fit">
              <Search className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[9px] font-bold lowercase tracking-widest">Handle: @{profile?.username}</span>
            </div>
          </div>
          <LayoutGrid className="absolute -right-6 md:-right-8 -bottom-6 md:-bottom-8 w-32 md:w-40 h-32 md:h-40 text-white/5 rotate-12" />
        </div>
      </div>


      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 pb-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                 <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6 font-bold">
                    <Building2 className="w-6 h-6" />
                 </div>
                 <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Launch Venture</h3>
                 <p className="text-sm font-medium text-slate-500 mb-8">Ready to track another business? Give it a name and start operating.</p>
                 
                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Business Identity *</label>
                       <input 
                         type="text"
                         placeholder="e.g. Acme Tech Solutions"
                         value={newBusinessName}
                         onChange={(e) => setNewBusinessName(e.target.value)}
                         className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-600 transition-all outline-none font-bold text-slate-900"
                       />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Primary Currency</label>
                         <select 
                           value={newBusinessCurrency}
                           onChange={(e) => setNewBusinessCurrency(e.target.value)}
                           className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-600 transition-all outline-none font-bold text-slate-900 appearance-none"
                         >
                           <option value="BDT">Bangladeshi Taka (BDT)</option>
                           <option value="USD">US Dollar (USD)</option>
                           <option value="CNY">Chinese Yuan (CNY)</option>
                         </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Business Type</label>
                         <select 
                           value={newBusinessType}
                           onChange={(e) => setNewBusinessType(e.target.value)}
                           className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-600 transition-all outline-none font-bold text-slate-900 appearance-none"
                         >
                           <option value="partnership">Partnership</option>
                           <option value="sole_proprietorship">Sole Proprietorship</option>
                           <option value="corporation">Corporation</option>
                           <option value="llc">LLC</option>
                         </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Physical Address</label>
                       <textarea 
                         placeholder="Full business address..."
                         value={newBusinessAddress}
                         onChange={(e) => setNewBusinessAddress(e.target.value)}
                         className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-600 transition-all outline-none font-bold text-slate-900 min-h-[100px]"
                       />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contact Phone</label>
                         <input 
                           type="tel"
                           placeholder="+880..."
                           value={newBusinessPhone}
                           onChange={(e) => setNewBusinessPhone(e.target.value)}
                           className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-600 transition-all outline-none font-bold text-slate-900"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contact Email</label>
                         <input 
                           type="email"
                           placeholder="contact@business.com"
                           value={newBusinessEmail}
                           onChange={(e) => setNewBusinessEmail(e.target.value)}
                           className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-600 transition-all outline-none font-bold text-slate-900"
                         />
                      </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Website URL</label>
                       <input 
                         type="url"
                         placeholder="https://..."
                         value={newBusinessWebsite}
                         onChange={(e) => setNewBusinessWebsite(e.target.value)}
                         className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-600 transition-all outline-none font-bold text-slate-900"
                       />
                    </div>
                 </div>
              </div>
              
              <div className="p-8 flex gap-3">
                 <button 
                   onClick={() => setShowCreateModal(false)}
                   className="flex-1 h-14 rounded-2xl bg-slate-50 text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={() => createBusinessMutation.mutate()}
                   disabled={isCreating || !newBusinessName}
                   className="flex-[2] h-14 rounded-2xl bg-blue-600 text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                 >
                   {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                   Launch Now
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && editingBusiness && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowEditModal(false); setEditingBusiness(null); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 pb-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                 <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6 font-bold">
                    <Building2 className="w-6 h-6" />
                 </div>
                 <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Edit Business</h3>
                 <p className="text-sm font-medium text-slate-500 mb-8">Update your business profile and contact information.</p>
                 
                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Business Identity *</label>
                       <input 
                         type="text"
                         value={editingBusiness.name}
                         onChange={(e) => setEditingBusiness({...editingBusiness, name: e.target.value})}
                         className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-600 transition-all outline-none font-bold text-slate-900"
                       />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Primary Currency</label>
                         <select 
                           value={editingBusiness.currency}
                           onChange={(e) => setEditingBusiness({...editingBusiness, currency: e.target.value})}
                           className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-600 transition-all outline-none font-bold text-slate-900 appearance-none"
                         >
                           <option value="BDT">Bangladeshi Taka (BDT)</option>
                           <option value="USD">US Dollar (USD)</option>
                           <option value="CNY">Chinese Yuan (CNY)</option>
                         </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Business Type</label>
                         <select 
                           value={editingBusiness.business_type}
                           onChange={(e) => setEditingBusiness({...editingBusiness, business_type: e.target.value})}
                           className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-600 transition-all outline-none font-bold text-slate-900 appearance-none"
                         >
                           <option value="partnership">Partnership</option>
                           <option value="sole_proprietorship">Sole Proprietorship</option>
                           <option value="corporation">Corporation</option>
                           <option value="llc">LLC</option>
                         </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Physical Address</label>
                       <textarea 
                         value={editingBusiness.address || ''}
                         onChange={(e) => setEditingBusiness({...editingBusiness, address: e.target.value})}
                         className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-600 transition-all outline-none font-bold text-slate-900 min-h-[100px]"
                       />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contact Phone</label>
                         <input 
                           type="tel"
                           value={editingBusiness.phone || ''}
                           onChange={(e) => setEditingBusiness({...editingBusiness, phone: e.target.value})}
                           className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-600 transition-all outline-none font-bold text-slate-900"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contact Email</label>
                         <input 
                           type="email"
                           value={editingBusiness.email || ''}
                           onChange={(e) => setEditingBusiness({...editingBusiness, email: e.target.value})}
                           className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-600 transition-all outline-none font-bold text-slate-900"
                         />
                      </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Website URL</label>
                       <input 
                         type="url"
                         value={editingBusiness.website || ''}
                         onChange={(e) => setEditingBusiness({...editingBusiness, website: e.target.value})}
                         className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-600 transition-all outline-none font-bold text-slate-900"
                       />
                    </div>
                 </div>
              </div>
              
              <div className="p-8 flex gap-3">
                 <button 
                   onClick={() => { setShowEditModal(false); setEditingBusiness(null); }}
                   className="flex-1 h-14 rounded-2xl bg-slate-50 text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={() => updateBusinessMutation.mutate(editingBusiness)}
                   disabled={isUpdating || !editingBusiness.name}
                   className="flex-[2] h-14 rounded-2xl bg-blue-600 text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                 >
                   {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                   Save Changes
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {businessToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBusinessToDelete(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[40px] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Trash2 className="w-10 h-10" />
              </div>
              
              <h2 className="text-2xl font-black text-slate-900 mb-2">Delete Business?</h2>
              <p className="text-slate-500 text-sm font-medium mb-8">
                Are you sure you want to delete <span className="font-bold text-slate-900">{businessToDelete.name}</span>? 
                This action is permanent and will remove all associated data.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setBusinessToDelete(null)}
                  className="h-14 rounded-2xl bg-slate-50 text-slate-600 text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => deleteBusinessMutation.mutate(businessToDelete.id)}
                  disabled={deleteBusinessMutation.isPending}
                  className="h-14 rounded-2xl bg-red-600 text-white text-xs font-black uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deleteBusinessMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Now'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MainLayout>
  );
}
