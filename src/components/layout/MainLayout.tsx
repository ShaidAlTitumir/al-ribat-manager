// src/components/layout/MainLayout.tsx
import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Package, ShoppingCart, Users, RefreshCw, 
  Settings, LogOut, Bell, Menu, X, Receipt, 
  ArrowLeftRight, Wallet, FileText, ChevronRight,
  LayoutGrid, Truck, History as HistoryIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { motion, AnimatePresence } from 'motion/react';
import { useScrollLock } from '../../hooks/useScrollLock';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { profile, signOut } = useAuth();
  const { business, updateExchangeRate } = useBusiness();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRateEditing, setIsRateEditing] = useState(false);
  const [tempRate, setTempRate] = useState(business?.exchange_rate?.toString() || '');
  const navigate = useNavigate();
  const location = useLocation();

  useScrollLock(isDrawerOpen);

  const menuItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/sales', label: 'Sales', icon: Receipt },
    { path: '/customers', label: 'Customers', icon: Users },
    { path: '/suppliers', label: 'Suppliers', icon: Truck },
    { path: '/partners', label: 'Partners', icon: Users },
    { path: '/inventory', label: 'Inventory', icon: Package },
    { path: '/wallet', label: 'Money Exchange', icon: RefreshCw },
    { path: '/transactions', label: 'Transfers', icon: ArrowLeftRight },
    { path: '/expenses', label: 'Expenses', icon: Wallet },
    { path: '/reports', label: 'Reports', icon: FileText },
    { path: '/activities', label: 'Activities', icon: HistoryIcon },
    { path: '/businesses', label: 'Businesses', icon: LayoutGrid },
  ];

  const handleRateUpdate = async () => {
    try {
      await updateExchangeRate(parseFloat(tempRate));
      setIsRateEditing(false);
    } catch (err) {
      alert('Failed to update rate');
    }
  };

  const activeLabel = [
    ...menuItems,
    { path: '/profile', label: 'Profile' },
    { path: '/businesses', label: 'Businesses' }
  ].find(item => item.path === location.pathname)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Drawer Overlay */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[260px] bg-white z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-3 flex items-center justify-between border-b border-slate-50">
                <div 
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => { setIsDrawerOpen(false); navigate('/businesses'); }}
                >
                  <img src="/logo.jpg" className="w-10 h-10 rounded-xl object-contain group-hover:scale-110 transition-transform shadow-sm" 
                    alt="Logo" 
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h2 className="font-bold text-sm text-slate-900 truncate max-w-[140px] group-hover:text-blue-600 transition-colors">
                      {business?.name || 'Personal Account'}
                    </h2>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      {business ? profile?.role : 'No Business'}
                      <ChevronRight className="w-2 h-2" />
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsDrawerOpen(false)} className="p-1.5 rounded-xl hover:bg-slate-50 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {!business && (
                  <div className="px-3 py-4 bg-blue-50/50 rounded-2xl mb-2 border border-blue-100/50">
                    <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-2 text-center text-balance leading-tight">Business Not Setup</p>
                    <button 
                      onClick={() => {
                        setIsDrawerOpen(false);
                        navigate('/onboarding');
                      }}
                      className="w-full py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-200 active:scale-95 transition-all"
                    >
                      Connect Business
                    </button>
                  </div>
                )}
                {menuItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsDrawerOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2 rounded-xl transition-all active:scale-95
                      ${isActive ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50 font-medium'}
                    `}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="text-sm">{item.label}</span>
                  </NavLink>
                ))}
              </div>

              <div className="p-3 border-t border-slate-50 space-y-1.5">
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => { setIsDrawerOpen(false); navigate('/profile'); }}>
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-[10px] uppercase">
                    {profile?.full_name?.substring(0, 2) || profile?.username?.substring(0, 2) || '??'}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-slate-900 leading-tight">{profile?.full_name}</p>
                    <p className="text-[10px] text-slate-400 lowercase tracking-widest">@{profile?.username}</p>
                  </div>
                </div>
                <button 
                  onClick={signOut}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 font-bold transition-all active:scale-95 text-xs"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 h-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsDrawerOpen(true)} className="p-1.5 rounded-xl hover:bg-slate-50 transition-all">
            <Menu className="w-5 h-5 text-slate-900" />
          </button>
          <h1 className="text-sm font-bold text-slate-900 tracking-tight uppercase">{activeLabel}</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Exchange Rate Widget */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">
            <RefreshCw className="w-3 h-3 text-slate-400" />
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">¥1 =</span>
              {isRateEditing ? (
                <div className="flex items-center gap-1">
                  <input 
                    className="w-12 bg-white border border-blue-200 rounded px-1 py-0.5 text-xs font-bold text-blue-600 outline-none"
                    value={tempRate}
                    onChange={(e) => setTempRate(e.target.value)}
                    autoFocus
                  />
                  <button onClick={handleRateUpdate} className="text-blue-600 p-0.5"><X className="w-2.5 h-2.5 rotate-45" /></button>
                </div>
              ) : (
                <button onClick={() => setIsRateEditing(true)} className="text-xs font-black font-mono text-slate-900">
                  ৳{business?.exchange_rate?.toFixed(3) || '18.000'}
                </button>
              )}
            </div>
          </div>
          <button className="p-1.5 rounded-xl hover:bg-slate-50 relative">
            <Bell className="w-4 h-4 text-slate-400" />
            <span className="absolute top-1.5 right-1.5 w-1 h-1 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16 pb-16 px-4 max-w-6xl mx-auto w-full">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 flex items-center justify-around h-12 px-1 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.02)] md:hidden">
        {[
          { path: '/', label: 'Home', icon: Home },
          { path: '/inventory', label: 'Stock', icon: Package },
          { path: '/sales', label: 'Sales', icon: Receipt },
          { path: '/partners', label: 'Partners', icon: Users },
        ].map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all
              ${isActive ? 'text-blue-600' : 'text-slate-400'}
            `}
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-5 h-5 ${isActive ? 'fill-current' : ''}`} />
                <span className="text-[9px] font-bold uppercase tracking-widest">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
