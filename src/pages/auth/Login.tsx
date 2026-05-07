// src/pages/auth/Login.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, Lock, Mail, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const isUnverified = location.state?.unverified;
  const unverifiedEmail = location.state?.email;

  useEffect(() => {
    if (isUnverified && unverifiedEmail) {
      setEmail(unverifiedEmail);
      setShowConfirmation(true);
    }
  }, [isUnverified, unverifiedEmail]);

  const handleResendVerification = async () => {
    if (!email) return;
    setResending(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });
      if (error) throw error;
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
      } else if (data.user && !data.user.email_confirmed_at) {
        // User logged in but not verified
        setLoading(false);
        setShowConfirmation(true);
        // Optional: sign them out? No, keep session so they can easily be verified upon refresh/click
      } else {
        navigate('/');
      }
    } else {
      // Sign Up
      if (!phone) {
        setError('Phone number is required');
        setLoading(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
          }
        }
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
      } else if (data.user) {
        setLoading(false);
        setShowConfirmation(true);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <AnimatePresence>
        {showConfirmation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmation(false)} 
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[40px] shadow-2xl relative overflow-hidden z-10 p-8 text-center"
            >
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Check your email</h2>
              <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
                We've sent a confirmation link to <span className="text-blue-600 font-bold">{email}</span>. 
                Please verify your account to continue.
              </p>
              
              <div className="space-y-3">
                {resendSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-xl border border-emerald-100 uppercase tracking-widest">
                    Verification link resent!
                  </div>
                )}
                
                <button 
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-[10px] border border-slate-100 flex items-center justify-center gap-2 hover:bg-slate-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                  {resending ? 'Resending...' : 'Resend Verification Link'}
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setShowConfirmation(false);
                    setIsLogin(true);
                    navigate('/login', { replace: true, state: {} });
                  }}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl shadow-slate-100 active:scale-95 transition-all"
                >
                  Back to Login
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-200">
            <Briefcase className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Al-Ribat Manager</h1>
          <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest font-semibold text-[10px]">Business & Partnership Hub</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-100 h-10 pl-11 pr-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Phone Number</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="tel"
                    required
                    className="w-full bg-slate-50 border border-slate-100 h-10 pl-11 pr-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
                    placeholder="+8801234567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="email"
                required
                className="w-full bg-slate-50 border border-slate-100 h-10 pl-11 pr-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="password"
                required
                className="w-full bg-slate-50 border border-slate-100 h-10 pl-11 pr-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium">
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {loading ? (isLogin ? 'Signing in...' : 'Creating account...') : (isLogin ? 'Sign In' : 'Create Account')}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-50 text-center">
          <p className="text-slate-400 text-xs font-medium">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
          </p>
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 font-bold text-sm mt-1 hover:underline"
          >
            {isLogin ? 'Create New Account' : 'Sign In Instead'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
