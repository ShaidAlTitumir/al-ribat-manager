// src/pages/auth/Onboarding.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Users, ArrowRight, Building2, Ticket, RefreshCw } from 'lucide-react';

export default function Onboarding() {
  const { user, profile, refreshProfile } = useAuth();
  const [mode, setMode] = useState<'selection' | 'create'>('selection');
  const [businessName, setBusinessName] = useState('');
  const [currency, setCurrency] = useState('BDT');
  const [businessType, setBusinessType] = useState('partnership');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.business_id) {
      navigate('/');
    }
  }, [profile?.business_id]);

  useEffect(() => {
    async function checkPending() {
      if (!user) return;
      const { data } = await supabase
        .from('join_requests')
        .select('*, businesses(name)')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();
      
      if (data) {
        setPendingRequest(data);
      }
    }
    checkPending();
  }, [user]);

  const handleCreateBusiness = async () => {
    if (!businessName.trim()) return setError('Business name is required');
    if (!user) return setError('You must be logged in to create a business');
    
    setLoading(true);
    setError(null);
    
    try {
      // 1. Create Business
      const { data: business, error: bError } = await supabase
        .from('businesses')
        .insert({
          name: businessName.trim(),
          owner_id: user.id,
          business_type: businessType,
          currency: currency,
          address: address.trim(),
          phone: phone.trim(),
          email: email.trim(),
          website: website.trim()
        })
        .select()
        .maybeSingle(); 
      
      if (bError) throw bError;
      if (!business) throw new Error('No business data returned from server');

      // 2. Add as member immediately
      await supabase.from('business_members').upsert({
        business_id: business.id,
        user_id: user.id,
        role: 'owner'
      });

      // 3. Update Profile
      const { error: pError } = await supabase
        .from('profiles')
        .update({ 
          business_id: business.id, 
          role: 'owner'
        })
        .eq('id', user.id);
      
      if (pError) throw pError;

      if (refreshProfile) await refreshProfile();
      navigate('/');
    } catch (err: any) {
      console.error('Onboarding flow aborted:', err);
      setError(err.message || 'Could not complete setup. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
      <div className="max-w-2xl w-full">
        {pendingRequest ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[32px] p-10 border border-slate-100 shadow-xl text-center space-y-6"
          >
            <div className="w-20 h-20 bg-blue-50 rounded-[28px] flex items-center justify-center text-blue-600 mx-auto animate-pulse">
              <RefreshCw className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Request Pending</h1>
              <p className="text-slate-500 font-medium leading-relaxed">
                You've sent a request to join <span className="text-blue-600 font-bold">{pendingRequest.businesses?.name}</span>.
                <br />Wait for the admin to approve your access.
              </p>
            </div>
            <div className="pt-4">
              <button 
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
              >
                Check Status
              </button>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
          {mode === 'selection' && (
            <motion.div 
              key="selection"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="text-center mb-10">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome to Al-Ribat</h1>
                <p className="text-slate-500 mt-2">Let's get your business account setup.</p>
                <button 
                  onClick={() => navigate('/')}
                  className="mt-4 px-6 py-2 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-300 transition-all active:scale-95"
                >
                  Skip for now
                </button>
              </div>

              <div className="flex justify-center">
                <SelectionCard 
                  title="Create Business"
                  description="Start a new partnership or solo business and invite others."
                  icon={<Plus className="w-6 h-6" />}
                  onClick={() => setMode('create')}
                />
              </div>
            </motion.div>
          )}

          {mode === 'create' && (
            <motion.div 
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-[40px] shadow-xl border border-slate-100 p-10 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button 
                onClick={() => setMode('selection')}
                className="text-slate-400 hover:text-slate-600 mb-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
              >
                <ArrowRight className="w-4 h-4 rotate-180" /> Back to Choice
              </button>
              
              <div className="mb-10">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Setup your Business</h2>
                <p className="text-slate-400 text-sm mt-2 font-medium">Enter the core details to launch your workflow.</p>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Business Name *</label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600" />
                      <input 
                        className="w-full bg-slate-50 border border-slate-100 h-14 pl-12 pr-4 rounded-2xl focus:bg-white focus:border-blue-600 outline-none transition-all font-bold text-slate-900"
                        placeholder="e.g. Al-Ribat Imports"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Primary Currency</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-100 h-14 px-5 rounded-2xl focus:bg-white focus:border-blue-600 outline-none transition-all font-bold text-slate-900 appearance-none"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                    >
                      <option value="BDT">Bangladeshi Taka (BDT)</option>
                      <option value="USD">US Dollar (USD)</option>
                      <option value="CNY">Chinese Yuan (CNY)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Business Type</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-100 h-14 px-5 rounded-2xl focus:bg-white focus:border-blue-600 outline-none transition-all font-bold text-slate-900 appearance-none"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                  >
                    <option value="partnership">Partnership</option>
                    <option value="sole_proprietorship">Sole Proprietorship</option>
                    <option value="corporation">Corporation</option>
                    <option value="llc">LLC</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Address</label>
                  <textarea 
                    className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl focus:bg-white focus:border-blue-600 outline-none transition-all font-bold text-slate-900 min-h-[100px]"
                    placeholder="Headquarters address..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Phone</label>
                    <input 
                      className="w-full bg-slate-50 border border-slate-100 h-14 px-5 rounded-2xl focus:bg-white focus:border-blue-600 outline-none transition-all font-bold text-slate-900"
                      placeholder="+880..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Email</label>
                    <input 
                      className="w-full bg-slate-50 border border-slate-100 h-14 px-5 rounded-2xl focus:bg-white focus:border-blue-600 outline-none transition-all font-bold text-slate-900"
                      placeholder="office@business.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Website (Optional)</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-100 h-14 px-5 rounded-2xl focus:bg-white focus:border-blue-600 outline-none transition-all font-bold text-slate-900"
                    placeholder="https://..."
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-600 rounded-full" /> {error}
                  </div>
                )}

                <button 
                  onClick={handleCreateBusiness}
                  disabled={loading}
                  className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[20px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-100 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                >
                  {loading ? 'Launching...' : 'Setup Business Now'}
                  {!loading && <ArrowRight className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
      </div>
    </div>
  );
}

function SelectionCard({ title, description, icon, onClick }: any) {
  return (
    <button 
      id="onboarding-join-card" // Added ID for easier targeting
      onClick={onClick}
      className={cn(
        "bg-white p-8 rounded-[32px] border border-slate-100 transition-all text-left flex flex-col group active:scale-95",
        "shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(59,130,246,0.12)] hover:border-blue-200/50"
      )}
    >
      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-6 group-hover:bg-blue-600 group-hover:text-white group-hover:rotate-6 transition-all duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">{title}</h3>
      <p className="text-slate-500 text-sm mt-2 font-medium leading-relaxed">{description}</p>
      <div className="mt-8 flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest">
        {title.split(' ')[0]} Now <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-2" />
      </div>
    </button>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
