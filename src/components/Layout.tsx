import React, { useState, useEffect } from 'react';
import { 
  Home, Package, ShoppingCart, Users, MoreHorizontal, RefreshCw, DollarSign, 
  User, Settings, LogOut, Bell, ChevronDown, Menu, X, Briefcase, Receipt, 
  ArrowLeftRight, Wallet, RotateCcw, FileText, Moon, ChevronRight, Palette
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    async function fetchRate() {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('cny_to_bdt_rate')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        setExchangeRate(data.cny_to_bdt_rate / 100);
      }
    }
    fetchRate();
  }, []);

  const mainMenuItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'sales', label: 'Sales', icon: Receipt },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'partners', label: 'Partners', icon: Users },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'exchange', label: 'Exchange', icon: RefreshCw },
    { id: 'send_to_partners', label: 'Send to Partners', icon: ArrowLeftRight },
    { id: 'expenses', label: 'Expenses', icon: Wallet },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'style_guide', label: 'Style Guide', icon: Palette },
  ];

  const bottomMenuItems = [
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'dark_mode', label: 'Dark Mode', icon: Moon },
    { id: 'sign_out', label: 'Sign Out', icon: LogOut, color: 'text-red-500' },
  ];

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'sales', label: 'Sales', icon: Receipt },
    { id: 'partners', label: 'Partners', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans pb-20 overflow-x-hidden">
      {/* Side Drawer */}
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
              className="fixed top-0 left-0 bottom-0 w-[280px] bg-white z-[70] shadow-2xl flex flex-col"
            >
              {/* Drawer Header */}
              <div className="p-4 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center gap-3">
                  <img src="/logo.jpg" className="w-8 h-8 rounded-lg" alt="Logo" referrerPolicy="no-referrer" />
                  <div>
                    <h2 className="font-semibold text-sm text-slate-900 tracking-tight">Al-Ribat Manager</h2>
                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Test 1</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Drawer Navigation */}
              <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                {mainMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsDrawerOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all active:scale-95",
                      activeTab === item.id 
                        ? "bg-blue-50 text-blue-600 font-semibold" 
                        : "text-slate-600 hover:bg-slate-50 font-normal"
                    )}
                  >
                    <item.icon className={cn("w-4.5 h-4.5", activeTab === item.id ? "text-blue-600" : "text-slate-400")} />
                    <span className="text-xs">{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-50 space-y-1">
                {/* User Profile */}
                <div 
                  onClick={() => {
                    setActiveTab('profile');
                    setIsDrawerOpen(false);
                  }}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer mb-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-[10px]">
                      SA
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-slate-900">Shaid Al Titumir</p>
                      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Owner</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
                </div>

                {bottomMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id === 'settings' ? 'profile' : item.id);
                      setIsDrawerOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all hover:bg-slate-50 active:scale-95",
                      item.color || "text-slate-600"
                    )}
                  >
                    <item.icon className={cn("w-4.5 h-4.5", !item.color && "text-slate-400")} />
                    <span className="text-xs font-normal">{item.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm flex justify-between items-center px-4 h-12 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="p-1.5 rounded-xl hover:bg-slate-50 active:scale-95 transition-all"
          >
            <Menu className="w-5 h-5 text-slate-900" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <img src="/logo.jpg" className="w-8 h-8 rounded-lg object-contain" alt="Logo" referrerPolicy="no-referrer" />
          <div>
            <h1 className="text-[14px] font-semibold text-slate-900 leading-tight tracking-tight">Al-Ribat Manager</h1>
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Test 1</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded-xl hover:bg-slate-50 active:scale-95 transition-all relative">
            <Bell className="w-5 h-5 text-slate-900" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-10 px-3 max-w-5xl mx-auto w-full">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.03)] border-t border-slate-100 flex justify-around items-center h-12 pb-safe">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex flex-col items-center justify-center transition-all duration-200 active:scale-90 flex-1 h-full",
              activeTab === item.id ? "text-orange-500" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <item.icon className={cn("w-4.5 h-4.5", activeTab === item.id && "fill-current")} />
            <span className="text-[9px] font-semibold tracking-wider uppercase mt-1">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
