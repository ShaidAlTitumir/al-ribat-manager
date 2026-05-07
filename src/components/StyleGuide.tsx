import React from 'react';
import { 
  Palette, Type, Layout as LayoutIcon, 
  Square, Circle, Play, CheckCircle2, 
  AlertCircle, Info, Check, ChevronRight,
  Search, Bell, Menu, User, Settings, Plus
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function StyleGuide() {
  return (
    <div className="space-y-12 pt-4 pb-20 px-1">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Design System</h1>
        <p className="text-slate-500 font-medium">Al-Ribat Manager Brand Guidelines & UI Components</p>
      </header>

      {/* Typography */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <Type className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Typography</h2>
        </div>
        
        <div className="grid gap-8">
          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Font Family: Inter</p>
            <div className="space-y-2">
              <h1 className="text-4xl font-black text-slate-900">Black 900</h1>
              <h2 className="text-3xl font-extrabold text-slate-900">ExtraBold 800</h2>
              <h3 className="text-2xl font-bold text-slate-900">Bold 700</h3>
              <h4 className="text-xl font-semibold text-slate-900">SemiBold 600</h4>
              <p className="text-lg font-medium text-slate-900">Medium 500</p>
              <p className="text-base font-normal text-slate-900">Regular 400</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Material Symbols Outlined</p>
            <div className="flex flex-wrap gap-6 text-slate-600">
              <span className="material-symbols-outlined text-2xl">dashboard</span>
              <span className="material-symbols-outlined text-2xl">inventory_2</span>
              <span className="material-symbols-outlined text-2xl">payments</span>
              <span className="material-symbols-outlined text-2xl">group</span>
              <span className="material-symbols-outlined text-2xl">currency_exchange</span>
              <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
              <span className="material-symbols-outlined text-2xl">analytics</span>
              <span className="material-symbols-outlined text-2xl">settings</span>
            </div>
          </div>
        </div>
      </section>

      {/* Colors */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <Palette className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Color Palette</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ColorSwatch label="Primary" hex="#2463EB" className="bg-primary text-white" />
          <ColorSwatch label="Background" hex="#F5F5F7" className="bg-background border border-slate-200" />
          <ColorSwatch label="Card" hex="#FFFFFF" className="bg-card border border-slate-200" />
          <ColorSwatch label="Foreground" hex="#1F2937" className="bg-foreground text-white" />
          <ColorSwatch label="Success" hex="#10B981" className="bg-success text-white" />
          <ColorSwatch label="Warning" hex="#F59E0B" className="bg-warning text-white" />
          <ColorSwatch label="Destructive" hex="#DC2626" className="bg-destructive text-white" />
          <ColorSwatch label="Info" hex="#3B82F6" className="bg-info text-white" />
        </div>
      </section>

      {/* Components */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <Square className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">UI Components</h2>
        </div>

        <div className="grid gap-10">
          {/* Buttons */}
          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Buttons</p>
            <div className="flex flex-wrap gap-4 items-center">
              <button className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-100 active:scale-95 transition-all">
                Primary Button
              </button>
              <button className="px-6 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-all">
                Secondary Button
              </button>
              <button className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm active:scale-95 transition-all">
                Ghost Button
              </button>
              <button className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-100 active:scale-90 transition-all">
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Inputs */}
          <div className="space-y-4 max-w-md">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Form Inputs</p>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Label</label>
                <input 
                  type="text" 
                  placeholder="Placeholder text..."
                  className="w-full bg-white border border-slate-200 h-12 px-4 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-sm shadow-sm transition-all"
                />
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search with icon..."
                  className="w-full bg-slate-100 border-none h-12 pl-12 pr-4 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-sm transition-all"
                />
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Badges & Status</p>
            <div className="flex flex-wrap gap-3">
              <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">Active</span>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">Completed</span>
              <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-100">Pending</span>
              <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100">Overdue</span>
            </div>
          </div>

          {/* Cards */}
          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cards & Elevation</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-card hover:shadow-card-hover transition-shadow">
                <h3 className="text-lg font-black text-slate-900 mb-2">Standard Card</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  This is a standard card with a subtle shadow and rounded corners. It elevates content cleanly.
                </p>
              </div>
              <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-lg shadow-blue-100 relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-lg font-black mb-2">Primary Card</h3>
                  <p className="text-sm text-blue-100 leading-relaxed">
                    Used for high-priority information or primary calls to action.
                  </p>
                </div>
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Layout */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <LayoutIcon className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Layout & Spacing</h2>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Border Radius</p>
            <div className="flex flex-wrap gap-6">
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-slate-200 rounded-sm" />
                <span className="text-[10px] font-bold text-slate-500">SM (4px)</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-slate-200 rounded-md" />
                <span className="text-[10px] font-bold text-slate-500">MD (6px)</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-slate-200 rounded-lg" />
                <span className="text-[10px] font-bold text-slate-500">LG (8px)</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-slate-200 rounded-2xl" />
                <span className="text-[10px] font-bold text-slate-500">2XL (16px)</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-slate-200 rounded-3xl" />
                <span className="text-[10px] font-bold text-slate-500">3XL (24px)</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ColorSwatch({ label, hex, className }: { label: string, hex: string, className: string }) {
  return (
    <div className="space-y-2">
      <div className={cn("h-20 rounded-2xl flex items-end p-3", className)}>
        <Check className="w-5 h-5 opacity-20" />
      </div>
      <div>
        <p className="text-xs font-black text-slate-900">{label}</p>
        <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{hex}</p>
      </div>
    </div>
  );
}
