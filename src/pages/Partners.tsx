// src/pages/Partners.tsx
import React, { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Plus, ArrowUpRight, DollarSign, Wallet, 
  UserPlus, UserMinus, Vote, ShieldCheck, CreditCard,
  Copy, Check, Trash2, X, ChevronRight, Edit, MoreVertical,
  AlertCircle, Search
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatBDT } from '../lib/utils';
import { Partner } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';

export default function Partners() {
  const { business } = useBusiness();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // States for Modals
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);
  const [selectedCapital, setSelectedCapital] = useState<any>(null);
  const [partnerToDelete, setPartnerToDelete] = useState<any>(null);
  const [partnerError, setPartnerError] = useState<string | null>(null);
  const [capitalToDelete, setCapitalToDelete] = useState<any>(null);
  const [showPartnerOptions, setShowPartnerOptions] = useState<string | null>(null);

  useScrollLock(isPartnerModalOpen || isCapitalModalOpen || !!partnerToDelete || !!capitalToDelete);

  // Fetch Partners
  const { data: partners = [], isLoading: isLoadingPartners } = useQuery({
    queryKey: ['partners', business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select(`
          *,
          capital_contributions(amount, currency)
        `)
        .eq('business_id', business?.id)
        .order('name', { ascending: true });
      if (error) throw error;
      return data.map(p => ({
        ...p,
        total_capital: p.capital_contributions?.reduce((acc: number, c: any) => {
          const amt = parseFloat(c.amount) || 0;
          return acc + (c.currency === 'BDT' ? amt : amt * (business?.exchange_rate || 18));
        }, 0) || 0
      }));
    },
    enabled: !!business?.id,
  });

  // Auto-init user as partner if not exists
  useEffect(() => {
    if (business && user && partners.length === 0 && !isLoadingPartners) {
      const initPartner = async () => {
        await supabase.from('partners').insert({
          business_id: business.id,
          user_id: user.id,
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Owner',
          email: user.email,
          status: 'active'
        });
        queryClient.invalidateQueries({ queryKey: ['partners'] });
      };
      initPartner();
    }
  }, [business, user, partners, isLoadingPartners]);

  // Fetch Capital Contributions
  const { data: contributions = [] } = useQuery({
    queryKey: ['contributions', business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('capital_contributions')
        .select('*, partners(name)')
        .eq('business_id', business?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const isOwner = business?.owner_id === user?.id;

  const deletePartnerMutation = useMutation({
    mutationFn: async ({ id, force }: { id: string, force: boolean }) => {
      // Get partner info first
      const { data: pData } = await supabase.from('partners').select('*').eq('id', id).single();
      
      if (!pData) throw new Error("Partner not found.");

      // Check if trying to delete owner
      if (pData.user_id === business?.owner_id && user?.id !== business?.owner_id) {
        throw new Error("You cannot remove the business creator.");
      }

      if (!force) {
        // Check for related data
        const { count: capitalCount } = await supabase
          .from('capital_contributions')
          .select('*', { count: 'exact', head: true })
          .eq('partner_id', id);
        
        const { count: transferCountFrom } = await supabase
          .from('partner_transfers')
          .select('*', { count: 'exact', head: true })
          .eq('from_partner_id', id);

        const { count: transferCountTo } = await supabase
          .from('partner_transfers')
          .select('*', { count: 'exact', head: true })
          .eq('to_partner_id', id);

        if ((capitalCount && capitalCount > 0) || (transferCountFrom && transferCountFrom > 0) || (transferCountTo && transferCountTo > 0)) {
           throw new Error("Partner has associated capital or transfer records. Delete history first or use 'Force Delete'.");
        }
      } else {
        // Delete associated records if force is true (assuming some might not be cascaded or just for safety)
        await supabase.from('capital_contributions').delete().eq('partner_id', id);
        await supabase.from('partner_transfers').delete().eq('from_partner_id', id);
        await supabase.from('partner_transfers').delete().eq('to_partner_id', id);
      }

      const { error } = await supabase.from('partners').delete().eq('id', id);
      if (error) throw error;

      // If partner was linked to a user, remove them from business members too
      if (pData?.user_id) {
        // Don't remove if they are the owner of the business? 
        // Actually, if they are being deleted as a partner, they should probably stay as member if they are owner
        // but owner usually shouldn't delete themselves.
        // Let's check if the business owner is this user
        const { data: biz } = await supabase.from('businesses').select('owner_id').eq('id', business?.id).single();
        if (biz && biz.owner_id !== pData.user_id) {
          await supabase.from('business_members').delete().eq('business_id', business?.id).eq('user_id', pData.user_id);
          await supabase.from('profiles').update({ business_id: null, role: 'user' }).eq('id', pData.user_id);
        }
      }

      // Log Activity
      await supabase.from('activity_log').insert({
        business_id: business?.id,
        user_id: user?.id,
        action: 'DELETE_PARTNER',
        details: {
          title: `Deleted Partner`,
          sub: 'Governance Record Removed',
          amount: 'DELETED',
          type: 'partner'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
      setPartnerToDelete(null);
      setPartnerError(null);
    },
    onError: (err: any) => {
      setPartnerError(err.message || "Failed to delete partner.");
    }
  });

  const deleteCapitalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('capital_contributions').delete().eq('id', id);
      if (error) throw error;

      // Log Activity
      await supabase.from('activity_log').insert({
        business_id: business?.id,
        user_id: user?.id,
        action: 'DELETE_CAPITAL',
        details: {
          title: `Deleted Capital Entry`,
          sub: 'Financial Record Removed',
          amount: 'REMOVED',
          type: 'capital'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      setCapitalToDelete(null);
    }
  });

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Info Header */}
        <section className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-900/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 blur-[100px]" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h1 className="text-xl lg:text-3xl font-bold tracking-tight uppercase text-white">Partnership Desk</h1>
              </div>
              <p className="text-white/70 text-xs lg:text-sm font-medium uppercase tracking-widest max-w-md">Manage your partner roster, equity shares, and governance workflows.</p>
            </div>
          </div>
        </section>

        {/* Section 1: Active Partners */}
        <div className="flex items-center justify-between mb-4">
           <h3 className="text-xs lg:text-sm font-bold text-slate-900 uppercase tracking-widest ml-1">Active Partners</h3>
           <button 
             onClick={() => { setSelectedPartner(null); setIsPartnerModalOpen(true); }}
             className="px-4 py-2 lg:px-5 lg:py-2.5 bg-blue-600 text-white rounded-xl text-xs lg:text-sm font-medium uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all"
           >
             <Plus className="w-4 h-4" /> Add Partner
           </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {partners.map(partner => (
             <PartnerCard 
               key={partner.id} 
               partner={partner} 
               isOwnerOfBusiness={business?.owner_id === partner.user_id}
               isCurrentUser={user?.id === partner.user_id}
               currentUserIsOwner={isOwner}
               onEdit={() => { setSelectedPartner(partner); setIsPartnerModalOpen(true); }}
               onDelete={() => setPartnerToDelete(partner)}
               showOptions={showPartnerOptions === partner.id}
               setShowOptions={(v: boolean) => setShowPartnerOptions(v ? partner.id : null)}
             />
           ))}
           {isLoadingPartners && (
             <div className="h-48 bg-white border border-slate-100 rounded-3xl animate-pulse" />
           )}
        </div>

        {/* Section 2: Dashboard/Requests Grid */}
        <div className="grid grid-cols-1 gap-8">
           {/* Equity & Transactions */}
           <div className="space-y-8">
              <section className="bg-white p-5 md:p-8 rounded-[28px] md:rounded-[32px] border border-slate-100 shadow-sm">
                 <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs lg:text-sm font-bold text-slate-900 uppercase tracking-widest">Capital Contributions</h3>
                    <button 
                      onClick={() => { setSelectedCapital(null); setIsCapitalModalOpen(true); }}
                      className="p-2 lg:p-2.5 pl-3 lg:pl-4 pr-4 lg:pr-5 bg-slate-900 text-white rounded-xl text-xs lg:text-sm font-medium uppercase tracking-widest flex items-center gap-2"
                    >
                       <Plus className="w-4 h-4" /> Add Capital
                    </button>
                 </div>
                 <div className="space-y-3">
                    {contributions.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between group p-2 hover:bg-slate-50 rounded-xl transition-all">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                            <Wallet className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-xs lg:text-sm font-medium text-slate-900">{c.partners?.name}</p>
                            <p className="text-[10px] lg:text-xs font-normal text-slate-400 uppercase tracking-tight">{new Date(c.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`text-sm lg:text-base font-mono font-bold ${c.currency === 'RMB' ? 'text-emerald-600' : 'text-slate-900'}`}>
                              {c.currency === 'RMB' ? '¥' : '৳'} {parseFloat(c.amount).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-0.5">
                            <button 
                              onClick={() => { setSelectedCapital(c); setIsCapitalModalOpen(true); }}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => setCapitalToDelete(c)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {contributions.length === 0 && (
                      <div className="py-6 text-center text-slate-300">
                        <p className="text-xs font-bold uppercase tracking-widest">No contributions</p>
                      </div>
                    )}
                 </div>
              </section>

              <section className="bg-white p-5 md:p-8 rounded-[28px] md:rounded-[32px] border border-slate-100 shadow-sm">
                 <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs lg:text-sm font-bold text-slate-900 uppercase tracking-tight">Asset Distribution</h2>
                    <div className="flex items-center gap-1.5">
                       <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                       <span className="text-[10px] lg:text-xs font-semibold text-blue-600 uppercase tracking-widest">Global</span>
                    </div>
                 </div>
                 {/* Visual Distribution Chart */}
                 <div className="h-3 bg-slate-100 rounded-full flex overflow-hidden mb-8 shadow-inner border border-slate-200/50">
                    {(() => {
                      const totalCapitalSum = partners.reduce((acc, p) => acc + (p.total_capital || 0), 0);
                      const colors = ['bg-blue-600', 'bg-emerald-500', 'bg-purple-600', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'];
                      
                      if (totalCapitalSum === 0) {
                        return partners.map((p, idx) => (
                          <div 
                            key={p.id} 
                            className={`h-full ${colors[idx % colors.length]} opacity-30`} 
                            style={{ width: `${100 / partners.length}%` }} 
                          />
                        ));
                      }

                      return partners.map((p, idx) => {
                        const share = (p.total_capital / totalCapitalSum) * 100;
                        if (share < 1) return null; // Hide tiny slices
                        return (
                          <div 
                            key={p.id} 
                            className={`h-full ${colors[idx % colors.length]} border-r border-white/20 last:border-0`} 
                            style={{ width: `${share}%` }} 
                          />
                        );
                      });
                    })()}
                 </div>

                 <div className="space-y-2">
                    {(() => {
                      const totalCapitalSum = partners.reduce((acc, p) => acc + (p.total_capital || 0), 0);
                      const colors = ['bg-blue-600', 'bg-emerald-500', 'bg-purple-600', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'];

                      return partners.map((p, idx) => {
                        const equityShare = totalCapitalSum > 0 ? (p.total_capital / totalCapitalSum) * 100 : (100 / partners.length);
                        const isCreator = p.user_id === business?.owner_id;
                        const isMe = p.user_id === user?.id;
                        const canDelete = isMe || (isOwner && !isCreator);

                        return (
                          <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-md hover:border-blue-100 transition-all group">
                             <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${colors[idx % colors.length]} shadow-sm`} />
                                <div>
                                   <span className="text-xs lg:text-sm font-medium text-slate-900 uppercase tracking-tight block flex items-center gap-2">
                                     {p.name}
                                     {isCreator && <ShieldCheck className="w-3 h-3 text-blue-600" />}
                                   </span>
                                   <p className="text-[10px] lg:text-xs font-normal text-slate-400 uppercase tracking-widest">{p.total_capital > 0 ? `৳${Math.round(p.total_capital).toLocaleString()} invested` : 'No capital yet'}</p>
                                </div>
                             </div>
                             <div className="flex items-center gap-6">
                                <div className="text-right">
                                   <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Portfolio Share</p>
                                   <p className="text-lg lg:text-2xl font-bold text-slate-900 tabular-nums">{Math.round(equityShare)}%</p>
                                </div>
                                {canDelete && (
                                  <button 
                                    onClick={() => setPartnerToDelete(p)}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                  >
                                    {isMe ? <UserMinus className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                             </div>
                          </div>
                        );
                      });
                    })()}
                 </div>
              </section>
           </div>
        </div>
      </div>
      <AnimatePresence>
        {isPartnerModalOpen && (
          <PartnerModal 
            partner={selectedPartner}
            partners={partners}
            onClose={() => setIsPartnerModalOpen(false)}
          />
        )}
        {isCapitalModalOpen && (
          <CapitalModal 
            contribution={selectedCapital}
            partners={partners}
            onClose={() => setIsCapitalModalOpen(false)}
          />
        )}
        {partnerToDelete && (
          <DeletePartnerModal 
            partner={partnerToDelete}
            isSelfRemoving={user?.id === partnerToDelete.user_id}
            isCreatorRemovingSelf={business?.owner_id === partnerToDelete.user_id && user?.id === partnerToDelete.user_id}
            onCancel={() => { setPartnerToDelete(null); setPartnerError(null); }}
            onConfirm={(force: boolean) => deletePartnerMutation.mutate({ id: partnerToDelete.id, force })}
            isPending={deletePartnerMutation.isPending}
            error={partnerError}
          />
        )}
        {capitalToDelete && (
          <DeleteConfirmModal 
            title="Delete Contribution?"
            desc={`Delete contribution of ${capitalToDelete.currency} ${capitalToDelete.amount}?`}
            onCancel={() => setCapitalToDelete(null)}
            onConfirm={() => deleteCapitalMutation.mutate(capitalToDelete.id)}
            isPending={deleteCapitalMutation.isPending}
          />
        )}
      </AnimatePresence>
    </MainLayout>
  );
}

function PartnerCard({ partner, onEdit, onDelete, showOptions, setShowOptions, isOwnerOfBusiness, isCurrentUser, currentUserIsOwner }: any) {
  const canDelete = isCurrentUser || (currentUserIsOwner && !isOwnerOfBusiness);

  return (
    <div className="bg-white p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group overflow-hidden relative">
      {/* Background Accent */}
      <div className="absolute -top-10 -right-10 w-20 h-20 bg-blue-50 rounded-full group-hover:scale-[3] transition-transform duration-700" />
      
      <div className="relative z-10 flex items-center justify-between mb-3 md:mb-4">
         <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-100 border border-white shadow-sm flex items-center justify-center text-slate-400 font-bold overflow-hidden text-[10px] md:text-xs">
               {partner.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
               <h4 className="text-base lg:text-lg font-semibold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors uppercase tracking-tight flex items-center gap-2">
                 {partner.name}
                 {isOwnerOfBusiness && <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />}
               </h4>
               <p className="text-[10px] lg:text-xs font-normal text-slate-400 uppercase tracking-widest mt-0.5 mt-px">
                 {partner.status} {isCurrentUser && '(You)'}
               </p>
            </div>
         </div>
         <div className="flex items-center gap-1.5">
            <div className="relative">
              <button 
                onClick={() => setShowOptions(!showOptions)}
                className="p-1 px-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showOptions && (
                <div className="absolute right-0 mt-1 w-32 bg-white border border-slate-100 shadow-xl rounded-2xl z-[50] py-1.5 overflow-hidden">
                  <button onClick={() => { onEdit(); setShowOptions(false); }} className="w-full px-4 py-2 text-left text-[10px] font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                    <Edit className="w-3 h-3" /> Edit
                  </button>
                  {canDelete && (
                    <button onClick={() => { onDelete(); setShowOptions(false); }} className="w-full px-4 py-2 text-left text-[10px] font-bold text-red-500 hover:bg-red-50 flex items-center gap-2">
                      {isCurrentUser ? <UserMinus className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                      {isCurrentUser ? 'Leave Business' : 'Remove Partner'}
                    </button>
                  )}
                </div>
              )}
            </div>
         </div>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-2 md:gap-3 mb-3 md:mb-4">
         <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-slate-50/50">
            <span className="text-[10px] lg:text-xs font-medium text-slate-400 uppercase tracking-widest block">Capital</span>
            <p className="text-sm lg:text-base font-bold text-slate-900 mt-0.5 tabular-nums">৳{Math.round(partner.total_capital).toLocaleString()}</p>
         </div>
         <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-slate-50/50">
            <span className="text-[10px] lg:text-xs font-medium text-slate-400 uppercase tracking-widest block">Profit</span>
            <p className="text-sm lg:text-base font-bold text-emerald-600 mt-0.5 tabular-nums">৳{(partner.balance_cents / 100).toLocaleString()}</p>
         </div>
      </div>

      <div className="relative z-10 flex items-center justify-between pt-2 md:pt-3 border-t border-slate-50">
         <button className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
           Details <ChevronRight className="w-2.5 h-2.5" />
         </button>
         <div className="flex -space-x-1">
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-full border border-white bg-slate-50 flex items-center justify-center text-slate-400 scale-90"><CreditCard className="w-2 md:w-2.5 h-2 md:h-2.5" /></div>
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-full border border-white bg-slate-50 flex items-center justify-center text-slate-400 scale-90"><DollarSign className="w-2 md:w-2.5 h-2 md:h-2.5" /></div>
         </div>
      </div>
    </div>
  );
}

function PartnerModal({ partner, partners, onClose }: any) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<any>({
    name: partner?.name || '',
    email: partner?.email || '',
    phone: partner?.phone || '',
    username: partner?.username || '',
    status: partner?.status || 'active',
    user_id: partner?.user_id || null
  });
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const isDuplicate = !partner && (
    (formData.user_id && partners.some((p: any) => p.user_id === formData.user_id)) ||
    (formData.email && partners.some((p: any) => p.email?.toLowerCase() === formData.email?.toLowerCase())) ||
    (formData.username && partners.some((p: any) => p.username?.toLowerCase() === formData.username?.toLowerCase()))
  );

  const handleModalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setError(null);
      return;
    }
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .limit(5);
      
      if (error) {
        console.error('Search error:', error);
        setError(`Search failed: ${error.message}`);
        return;
      }
      
      setSearchResults(data || []);
      if (data?.length === 0) {
        setError('No users found matching your search criteria.');
      } else {
        setError(null);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred during search.');
    } finally {
      setIsSearching(false);
    }
  };

  const selectUser = (u: any) => {
    setFormData({
      ...formData,
      name: u.full_name || '',
      email: u.email || '',
      phone: u.phone || '',
      username: u.username || '',
      user_id: u.id // Track the selected user id
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!formData.name) throw new Error('Name is required');

      if (!partner && isDuplicate) {
        throw new Error('This partner is already added to this business.');
      }

      const payload: any = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        username: formData.username || null,
        status: formData.status,
        user_id: formData.user_id || null
      };

      if (partner) {
        const { error } = await supabase.from('partners').update(payload).eq('id', partner.id);
        if (error) throw error;
      } else {
        // If it's a linked user, run the full robust process
        if (formData.user_id) {
           // 1. Check if already member
           const { data: existingMember } = await supabase
             .from('business_members')
             .select('*')
             .eq('business_id', business?.id)
             .eq('user_id', formData.user_id)
             .maybeSingle();

           if (!existingMember) {
             // 2. Add to business members
             const { error: memberError } = await supabase.from('business_members').insert({
               business_id: business?.id,
               user_id: formData.user_id,
               role: 'user'
             });
             if (memberError) throw memberError;

             // 3. Update profile business_id
             await supabase.from('profiles').update({ business_id: business?.id }).eq('id', formData.user_id);
           }
        }

        // Always create a partner record
        const { error } = await supabase.from('partners').insert({
          ...payload,
          business_id: business?.id
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      queryClient.invalidateQueries({ queryKey: ['business'] });
      onClose();
    },
    onError: (err: any) => setError(err.message)
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-md rounded-[40px] shadow-2xl relative overflow-hidden z-10"
      >
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
           <h2 className="text-xl font-bold text-slate-900 tracking-tight">{partner ? 'Edit Partner' : 'Add Partner'}</h2>
           <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-50">
             <X className="w-5 h-5" />
           </button>
        </div>
        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
           {error && (
             <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl border border-red-100 flex items-center gap-2">
               <AlertCircle className="w-4 h-4" /> {error}
             </div>
           )}

           {isDuplicate && !error && (
             <div className="p-4 bg-orange-50 text-orange-600 text-[10px] font-bold rounded-2xl border border-orange-100 flex items-center gap-2 uppercase tracking-widest">
               <AlertCircle className="w-4 h-4" /> Warning: Partner already exists in this business
             </div>
           )}

           {!partner && (
             <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-3">Quick Search Existing User</p>
                  <form onSubmit={handleModalSearch} className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                    <input 
                      type="text" 
                      placeholder="Email, Username, or Phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 bg-white border border-blue-100 rounded-xl text-xs font-bold focus:border-blue-500 transition-all outline-none"
                    />
                    <button 
                      type="submit"
                      disabled={isSearching}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>

                <AnimatePresence>
                  {searchResults.length > 0 && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      {searchResults.map((res) => (
                        <button 
                          key={res.id}
                          onClick={() => selectUser(res)}
                          className="w-full p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between hover:border-blue-500 hover:bg-blue-50 transition-all group text-left"
                        >
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] font-bold">
                                {res.full_name?.substring(0, 2).toUpperCase()}
                             </div>
                             <div>
                                <p className="text-[11px] font-bold text-slate-900">{res.full_name}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">@{res.username || 'user'}</p>
                             </div>
                          </div>
                          <Plus className="w-4 h-4 text-slate-300 group-hover:text-blue-600" />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
           )}

           <div className="space-y-4">
              <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Full Name *</label>
                 <input 
                   type="text" 
                   placeholder="Partner's Display Name"
                   value={formData.name} 
                   onChange={(e) => setFormData({...formData, name: e.target.value})}
                   className="w-full h-12 px-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 transition-all text-sm font-medium"
                 />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Email</label>
                   <input 
                     type="email" 
                     placeholder="email@example.com"
                     value={formData.email} 
                     onChange={(e) => setFormData({...formData, email: e.target.value})}
                     className="w-full h-12 px-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 transition-all text-sm font-medium"
                   />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Phone</label>
                   <input 
                     type="tel" 
                     placeholder="+880..."
                     value={formData.phone} 
                     onChange={(e) => setFormData({...formData, phone: e.target.value})}
                     className="w-full h-12 px-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 transition-all text-sm font-medium"
                   />
                </div>
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Username</label>
                 <input 
                   type="text" 
                   placeholder="@username"
                   value={formData.username} 
                   onChange={(e) => setFormData({...formData, username: e.target.value})}
                   className="w-full h-12 px-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 transition-all text-sm font-medium"
                 />
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Status</label>
                 <select 
                   value={formData.status} 
                   onChange={(e) => setFormData({...formData, status: e.target.value})}
                   className="w-full h-12 px-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                 >
                   <option value="active">Active</option>
                   <option value="inactive">Inactive</option>
                   <option value="archived">Archived</option>
                 </select>
              </div>
           </div>
        </div>
        <div className="p-8 bg-slate-50 flex gap-4">
           <button 
             onClick={() => mutation.mutate()}
             disabled={mutation.isPending}
             className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-50"
           >
             {mutation.isPending ? 'Saving...' : (partner ? 'Update Partner' : 'Create Partner')}
           </button>
        </div>
      </motion.div>
    </div>
  );
}

function CapitalModal({ contribution, partners, onClose }: any) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    partner_id: contribution?.partner_id || '',
    amount: contribution?.amount?.toString() || '',
    currency: contribution?.currency || 'BDT',
    notes: contribution?.notes || ''
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!formData.partner_id) throw new Error('Please select a partner');
      if (!formData.amount) throw new Error('Please enter an amount');

      if (contribution) {
        const { error } = await supabase.from('capital_contributions').update({
          partner_id: formData.partner_id,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          notes: formData.notes
        }).eq('id', contribution.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('capital_contributions').insert({
          business_id: business?.id,
          partner_id: formData.partner_id,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          notes: formData.notes
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      onClose();
    },
    onError: (err: any) => setError(err.message)
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-md rounded-[40px] shadow-2xl relative overflow-hidden z-10"
      >
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
           <h2 className="text-xl font-bold text-slate-900 tracking-tight">{contribution ? 'Edit Capital' : 'Add Capital Contribution'}</h2>
           <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-50">
             <X className="w-5 h-5" />
           </button>
        </div>
        <div className="p-8 space-y-4">
           {error && (
             <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl border border-red-100 flex items-center gap-2">
               <AlertCircle className="w-4 h-4" /> {error}
             </div>
           )}
           <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Partner</label>
              <select 
                value={formData.partner_id} 
                onChange={(e) => setFormData({...formData, partner_id: e.target.value})}
                className="w-full h-12 px-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 transition-all text-sm font-medium appearance-none"
              >
                <option value="">Select Partner</option>
                {partners.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Amount</label>
                <input 
                  type="number" 
                  value={formData.amount} 
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full h-12 px-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 transition-all text-sm font-medium"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Currency</label>
                <select 
                  value={formData.currency} 
                  onChange={(e) => setFormData({...formData, currency: e.target.value})}
                  className="w-full h-12 px-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                >
                  <option value="BDT">BDT (৳)</option>
                  <option value="RMB">RMB (¥)</option>
                </select>
              </div>
           </div>
           <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Notes</label>
              <textarea 
                value={formData.notes} 
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 transition-all text-sm font-medium"
                rows={3}
              />
           </div>
        </div>
        <div className="p-8 bg-slate-50 flex gap-4">
           <button 
             onClick={() => mutation.mutate()}
             disabled={mutation.isPending}
             className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-50"
           >
             {mutation.isPending ? 'Saving...' : 'Save Contribution'}
           </button>
        </div>
      </motion.div>
    </div>
  );
}

function DeletePartnerModal({ partner, isSelfRemoving, isCreatorRemovingSelf, onCancel, onConfirm, isPending, error }: any) {
  const [forceDelete, setForceDelete] = useState(false);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
       <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         exit={{ opacity: 0, scale: 0.95, y: 20 }}
         className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl relative overflow-hidden z-10 p-10 text-center"
       >
         <div className={`w-16 h-16 ${isSelfRemoving ? 'bg-orange-50 text-orange-500' : 'bg-red-50 text-red-500'} rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm`}>
            {isSelfRemoving ? <UserMinus className="w-8 h-8" /> : <Trash2 className="w-8 h-8" />}
         </div>
         <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
           {isSelfRemoving ? (isCreatorRemovingSelf ? 'Close Partnership?' : 'Leave Business?') : 'Remove Partner?'}
         </h2>
         <p className="text-sm text-slate-500 mb-6 leading-relaxed">
           {isSelfRemoving 
            ? `Are you sure you want to leave the partnership of ${partner.name}? This will revoke your access to this business record.`
            : `Are you sure you want to remove ${partner.name} from the business?`}
         </p>

         <div className="mb-8 p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-start gap-4 text-left">
            <input 
              type="checkbox" 
              id="forceDeletePartner" 
              checked={forceDelete}
              onChange={(e) => setForceDelete(e.target.checked)}
              className="mt-1 w-5 h-5 rounded-lg border-slate-300 text-red-600 focus:ring-red-600 transition-all cursor-pointer"
            />
            <label htmlFor="forceDeletePartner" className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-normal cursor-pointer">
              Also clean up all associated capital and transfer records
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
              onClick={() => onConfirm(forceDelete)}
              disabled={isPending}
              className={`
                w-full h-14 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50
                ${isSelfRemoving 
                   ? 'bg-orange-500 shadow-orange-100' 
                   : (forceDelete ? 'bg-red-600 shadow-red-200' : 'bg-red-500 shadow-red-100')}
              `}
            >
              {isPending ? (isSelfRemoving ? 'Leaving...' : 'Removing...') : (isSelfRemoving ? 'Confirm Leave' : 'Confirm Removal')}
            </button>
            <button onClick={onCancel} disabled={isPending} className="w-full py-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600 transition-all">Cancel</button>
         </div>
       </motion.div>
    </div>
  );
}

function DeleteConfirmModal({ title, desc, onCancel, onConfirm, isPending }: any) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
       <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         exit={{ opacity: 0, scale: 0.95, y: 20 }}
         className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl relative overflow-hidden z-10 p-8 text-center"
       >
         <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Trash2 className="w-8 h-8" />
         </div>
         <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">{title}</h2>
         <p className="text-sm text-slate-500 mb-8 leading-relaxed">{desc}</p>
         <div className="flex flex-col gap-3">
            <button 
              onClick={onConfirm}
              disabled={isPending}
              className="w-full h-14 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50"
            >
              {isPending ? 'Deleting...' : 'Yes, Delete'}
            </button>
            <button onClick={onCancel} className="w-full py-3 text-slate-400 font-bold text-xs uppercase tracking-widest">Cancel</button>
         </div>
       </motion.div>
    </div>
  );
}

const ChevronRightIcon = ({ className }: { className?: string }) => {
  return <ArrowUpRight className={className} />;
};

