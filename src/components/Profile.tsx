import React, { useState } from 'react';
import { 
  User, Mail, Phone, MapPin, Shield, 
  Bell, Moon, LogOut, ChevronRight, 
  Camera, Building2, Globe, CreditCard,
  CheckCircle2, AlertCircle
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

export default function Profile() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const user = {
    name: "Shaid Al Titumir",
    email: "titumirtlt@gmail.com",
    phone: "+880 1700-000000",
    role: "Owner",
    business: "Al-Ribat Manager",
    location: "Dhaka, Bangladesh",
    joined: "April 2024"
  };

  return (
    <div className="space-y-8 pt-4 pb-24 px-1">
      {/* Profile Header */}
      <div className="relative">
        <div className="h-28 bg-gradient-to-r from-blue-600 to-blue-400 rounded-3xl shadow-lg shadow-blue-100" />
        <div className="absolute -bottom-10 left-6 flex items-end gap-3">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-white p-1.5 shadow-xl">
              <div className="w-full h-full rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-semibold text-2xl border-2 border-white">
                SA
              </div>
            </div>
            <button className="absolute -right-1.5 -bottom-1.5 w-7 h-7 bg-white rounded-xl shadow-md flex items-center justify-center text-slate-600 hover:text-blue-600 transition-colors border border-slate-100">
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mb-1">
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{user.name}</h1>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-semibold uppercase tracking-widest border border-blue-100">
                {user.role}
              </span>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">
                Joined {user.joined}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats / Info Grid */}
      <div className="grid grid-cols-2 gap-3 mt-12">
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Business</p>
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-sm font-semibold text-slate-900">{user.business}</span>
          </div>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Location</p>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-sm font-semibold text-slate-900">Dhaka, BD</span>
          </div>
        </div>
      </div>

      {/* Account Settings */}
      <section className="space-y-4">
        <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] ml-1">Account Settings</h2>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <SettingItem 
            icon={User} 
            label="Personal Information" 
            value={user.email}
            onClick={() => {}}
          />
          <SettingItem 
            icon={Phone} 
            label="Phone Number" 
            value={user.phone}
            onClick={() => {}}
          />
          <SettingItem 
            icon={Shield} 
            label="Security & Password" 
            value="Last changed 2 months ago"
            onClick={() => {}}
          />
          <SettingItem 
            icon={CreditCard} 
            label="Subscription Plan" 
            value="Professional Plan"
            isLast
            onClick={() => {}}
          />
        </div>
      </section>

      {/* Preferences */}
      <section className="space-y-3">
        <h2 className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.2em] ml-1">Preferences</h2>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                <Moon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Dark Mode</p>
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Adjust visual appearance</p>
              </div>
            </div>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={cn(
                "w-10 h-5 rounded-full transition-all relative",
                isDarkMode ? "bg-blue-600" : "bg-slate-200"
              )}
            >
              <div className={cn(
                "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all",
                isDarkMode ? "left-5.5" : "left-0.5"
              )} />
            </button>
          </div>
          <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors border-t border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Push Notifications</p>
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Stay updated on activity</p>
              </div>
            </div>
            <button 
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={cn(
                "w-10 h-5 rounded-full transition-all relative",
                notificationsEnabled ? "bg-blue-600" : "bg-slate-200"
              )}
            >
              <div className={cn(
                "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all",
                notificationsEnabled ? "left-5.5" : "left-0.5"
              )} />
            </button>
          </div>
          <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors border-t border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Language</p>
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">English (US)</p>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="space-y-3">
        <div className="bg-red-50 rounded-3xl border border-red-100 shadow-sm overflow-hidden">
          <button className="w-full flex items-center justify-between p-3 hover:bg-red-100/50 transition-colors text-red-600">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                <LogOut className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Sign Out</p>
                <p className="text-[9px] font-semibold opacity-60 uppercase tracking-widest">End your current session</p>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-40" />
          </button>
        </div>
      </section>
    </div>
  );
}

function SettingItem({ icon: Icon, label, value, isLast, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors text-left",
        !isLast && "border-b border-slate-50"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">{value}</p>
        </div>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
    </button>
  );
}
