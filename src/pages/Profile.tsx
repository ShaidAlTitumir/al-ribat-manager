import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { User, Mail, Shield, Save, Loader2, Camera, LogOut, Store } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatDate } from '../lib/utils';
import MainLayout from '../components/layout/MainLayout';

export default function Profile() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { business, refreshBusiness } = useBusiness();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [isUsernameValid, setIsUsernameValid] = useState(true);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [phone, setPhone] = useState(profile?.phone || '');
  
  const [bizName, setBizName] = useState(business?.name || '');
  const [bizPhone, setBizPhone] = useState(business?.phone || '');
  const [bizAddress, setBizAddress] = useState(business?.address || '');
  const [bizEmail, setBizEmail] = useState(business?.email || '');
  
  const [saving, setSaving] = useState(false);
  const [bizSaving, setBizSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [bizMessage, setBizMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  useEffect(() => {
    if (!username || username === profile?.username) {
      setIsUsernameValid(true);
      setUsernameError(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsCheckingUsername(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username.toLowerCase())
          .maybeSingle();

        if (error) throw error;

        if (data && data.id !== user?.id) {
          setIsUsernameValid(false);
          setUsernameError('This username is already taken');
        } else {
          setIsUsernameValid(true);
          setUsernameError(null);
        }
      } catch (err) {
        console.error('Error checking username:', err);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username, profile?.username, user?.id]);

  useEffect(() => {
    if (business) {
      setBizName(business.name || '');
      setBizPhone(business.phone || '');
      setBizAddress(business.address || '');
      setBizEmail(business.email || '');
    }
  }, [business]);

  async function handleUpdateBusiness(e: React.FormEvent) {
    e.preventDefault();
    if (!business) return;
    
    setBizSaving(true);
    setBizMessage(null);

    if (bizPhone && bizPhone.replace(/\D/g, '').length < 11) {
      setBizMessage({ type: 'error', text: 'Business phone number must be at least 11 digits' });
      setBizSaving(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          name: bizName,
          phone: bizPhone,
          address: bizAddress,
          email: bizEmail
        })
        .eq('id', business.id);

      if (error) throw error;
      
      await refreshBusiness();
      setBizMessage({ type: 'success', text: 'Business details updated successfully!' });
    } catch (error: any) {
      console.error('Error updating business:', error);
      setBizMessage({ type: 'error', text: error.message || 'Failed to update business' });
    } finally {
      setBizSaving(false);
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!isUsernameValid) return;
    
    setSaving(true);
    setMessage(null);

    if (phone && phone.replace(/\D/g, '').length < 11) {
      setMessage({ type: 'error', text: 'Phone number must be at least 11 digits' });
      setSaving(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          username: username.toLowerCase().trim(),
          phone: phone,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      await refreshProfile();
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header Section */}
        <section className="bg-slate-900 rounded-[24px] p-6 text-white relative overflow-hidden shadow-xl shadow-slate-900/10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 blur-[100px]" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                  <User className="w-5 h-5" />
                </div>
                <h1 className="text-xl lg:text-2xl font-bold tracking-tight uppercase text-white">Identity Hub</h1>
              </div>
              <p className="text-white/70 text-[10px] font-medium uppercase tracking-widest max-w-md">Manage security and business settings.</p>
            </div>
            <button 
              onClick={() => signOut()}
              className="px-4 py-2 bg-red-400/10 hover:bg-red-400/20 text-red-400 border border-red-400/20 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Essential Info & Security */}
          <div className="lg:col-span-4 space-y-4">
            {/* Identity Card */}
            <div className="bg-white rounded-[28px] border border-slate-100 p-6 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:scale-110 transition-transform">
                <User className="w-20 h-20" />
              </div>
              
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-3">
                  <div className="w-20 h-20 bg-gradient-to-tr from-slate-800 to-slate-900 rounded-3xl flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-slate-100 uppercase overflow-hidden border-[4px] border-white ring-1 ring-slate-100">
                    {profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <button className="absolute -bottom-1 -right-1 p-1.5 bg-white rounded-lg border border-slate-100 shadow-lg text-slate-400 hover:text-blue-600 transition-all">
                    <Camera className="w-3 h-3" />
                  </button>
                </div>
                
                <h2 className="text-lg font-bold text-slate-900 tracking-tight uppercase leading-none">
                  {profile?.full_name || 'System User'}
                </h2>
                <p className="text-[11px] font-bold text-slate-400 lowercase tracking-widest mt-1.5 italic">
                  @{profile?.username}
                </p>
                <div className="mt-2 inline-flex items-center px-2 py-0.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">
                  <Shield className="w-2 h-2 mr-1.5" />
                  {profile?.role || 'User'}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-50 space-y-3">
                <div className="flex items-center text-slate-500">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center mr-3 shrink-0">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Auth Email</p>
                    <p className="text-xs font-semibold truncate text-slate-900 mt-1">{user?.email}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Pulse Card */}
            <div className="bg-slate-900 rounded-[28px] p-6 text-white relative overflow-hidden group shadow-xl shadow-slate-900/10">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-2xl rounded-full -mr-12 -mt-12" />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[9px] font-bold uppercase tracking-widest text-white/40 leading-none">Security Status</h3>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                  </div>
                  <p className="text-xl font-bold tracking-tighter text-white mb-0.5 leading-none">Encrypted</p>
                  <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest leading-none">TLS 1.3 Verified</p>
                </div>
                
                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/5 pt-3">
                  <div>
                    <span className="block text-[8px] text-white/30 uppercase tracking-widest font-bold mb-0.5">Created At</span>
                    <span className="font-bold text-[10px]">{formatDate(profile?.created_at || '')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Detailed Configuration */}
          <div className="lg:col-span-8 space-y-4">
            {/* Identity Settings */}
            <form onSubmit={handleUpdateProfile} className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden text-left font-sans">
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-blue-600" /> Account Settings
                </h3>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormInput 
                    label="Display Name" 
                    value={fullName} 
                    onChange={setFullName} 
                    placeholder="e.g. Abdullah S." 
                  />
                  <div className="space-y-1">
                    <FormInput 
                      label="Handle" 
                      value={username} 
                      onChange={(val: string) => setUsername(val.toLowerCase().replace(/[^a-z0-9_]/g, ''))} 
                      placeholder="e.g. abdullah_admin" 
                      error={usernameError}
                      loading={isCheckingUsername}
                    />
                    {usernameError && (
                      <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest ml-1 animate-pulse">
                        {usernameError}
                      </p>
                    )}
                    {!usernameError && username && username !== profile?.username && !isCheckingUsername && (
                      <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest ml-1">
                        Username is available
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormInput 
                    label="Core Email (Read Only)" 
                    value={user?.email || ''} 
                    onChange={() => {}} 
                    disabled 
                  />
                  <FormInput 
                    label="Contact Intellectual" 
                    value={phone} 
                    onChange={setPhone} 
                    placeholder="+880..." 
                  />
                </div>

                {message && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-3 rounded-xl text-[9px] font-black uppercase tracking-widest border text-center shadow-lg",
                      message.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-red-50 border-red-100 text-red-600 shadow-red-50"
                    )}
                  >
                    {message.text}
                  </motion.div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center px-6 h-10 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 disabled:bg-slate-200 shadow-xl shadow-slate-100"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Save className="w-3 h-3 mr-2" />}
                    {saving ? 'Syncing...' : 'Update Information'}
                  </button>
                </div>
              </div>
            </form>
            
            {/* Business Settings Section */}
            {(profile?.role === 'owner' || profile?.role === 'admin') && (
              <form onSubmit={handleUpdateBusiness} className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden text-left font-sans">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Store className="w-3.5 h-3.5 text-indigo-600" /> Org Management
                  </h3>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput 
                      label="Entity Name" 
                      value={bizName} 
                      onChange={setBizName} 
                      placeholder="e.g. Al-Ribat Global" 
                    />
                    <FormInput 
                      label="Business Phone" 
                      value={bizPhone} 
                      onChange={setBizPhone} 
                      placeholder="Support contact" 
                    />
                  </div>

                  <FormInput 
                    label="Headquarters Address" 
                    value={bizAddress} 
                    onChange={setBizAddress} 
                    placeholder="Full physical address" 
                  />

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={bizSaving}
                      className="inline-flex items-center justify-center px-6 h-10 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 disabled:bg-slate-200 shadow-xl shadow-indigo-100"
                    >
                      {bizSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Save className="w-3 h-3 mr-2" />}
                      {bizSaving ? 'Saving...' : 'Deploy Updates'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

    </MainLayout>
  );
}

function FormInput({ label, value, onChange, type = "text", placeholder, disabled, error, loading }: any) {
  return (
    <div className="space-y-1 flex-1 text-left">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 ml-1">{label}</label>
      <div className="relative">
        <input 
          type={type}
          disabled={disabled}
          className={cn(
            "w-full bg-slate-50 border border-slate-100 h-9 px-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium",
            disabled && "bg-slate-100 text-slate-400 cursor-not-allowed border-transparent",
            error && "border-red-300 focus:ring-red-500",
            loading && "pr-8"
          )}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
          </div>
        )}
      </div>
    </div>
  );
}
