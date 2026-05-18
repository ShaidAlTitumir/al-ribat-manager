// src/context/BusinessContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Business } from '../types';
import { useAuth } from './AuthContext';

interface BusinessContextType {
  business: Business | null;
  userRole: string;
  loading: boolean;
  refreshBusiness: () => Promise<void>;
  updateExchangeRate: (rate: number) => Promise<void>;
  setActiveBusiness: (businessId: string | null) => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const BusinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [loading, setLoading] = useState(true);

  // Use a local state for the active business ID that persists in localStorage
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(() => {
    return localStorage.getItem('alribat_active_business_id');
  });

  const fetchBusinessAndRole = async (businessId: string, userId: string) => {
    setLoading(true);
    try {
      // 1. Fetch business details
      const { data: bData, error: bError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .maybeSingle();
      
      if (bError) {
        console.error('Error fetching business:', bError);
        setBusiness(null);
      } else if (!bData) {
        console.warn('Business not found for ID:', businessId);
        setBusiness(null);
        localStorage.removeItem('alribat_active_business_id');
        localStorage.removeItem('alribat_user_role');
        setActiveBusinessId(null);
        setUserRole('user');
      } else {
        setBusiness(bData);
      }

      // 2. Fetch user's role in this business
      const { data: mData, error: mError } = await supabase
        .from('business_members')
        .select('role')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!mError && mData) {
        setUserRole(mData.role);
        localStorage.setItem('alribat_user_role', mData.role);
      } else {
        setUserRole('user');
        localStorage.removeItem('alribat_user_role');
      }
    } catch (err) {
      console.error('Business fetch unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshBusiness = async () => {
    const idToFetch = activeBusinessId || profile?.business_id;
    if (idToFetch && profile?.id) {
      await fetchBusinessAndRole(idToFetch, profile.id);
    } else {
      setBusiness(null);
      setUserRole('user');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.id) {
      if (activeBusinessId) {
        fetchBusinessAndRole(activeBusinessId, profile.id);
      } else if (profile?.business_id) {
        // Fallback to profile business if no local selection exists yet
        setActiveBusinessId(profile.business_id);
        localStorage.setItem('alribat_active_business_id', profile.business_id);
        fetchBusinessAndRole(profile.business_id, profile.id);
      }
    } else if (profile === null) {
      // Profile explicitly null (logged out)
      setBusiness(null);
      setUserRole('user');
      setLoading(false);
      localStorage.removeItem('alribat_active_business_id');
      localStorage.removeItem('alribat_user_role');
      setActiveBusinessId(null);
    }
  }, [profile?.id, activeBusinessId === null, profile === null]);

  const updateExchangeRate = async (rate: number) => {
    if (!business) return;
    
    const { error } = await supabase
      .from('businesses')
      .update({ exchange_rate: rate })
      .eq('id', business.id);
    
    if (error) {
      console.error('Error updating exchange rate:', error);
      throw error;
    }
    
    setBusiness({ ...business, exchange_rate: rate });
  };

  const setActiveBusiness = async (businessId: string | null) => {
    if (!profile?.id) return;
    
    if (!businessId) {
      setActiveBusinessId(null);
      setUserRole('user');
      localStorage.removeItem('alribat_active_business_id');
      localStorage.removeItem('alribat_user_role');
      setBusiness(null);
      return;
    }

    setLoading(true);
    try {
      // 1. Update local state immediately for responsiveness
      setActiveBusinessId(businessId);
      localStorage.setItem('alribat_active_business_id', businessId);
      
      // 2. Fetch business and role data
      await fetchBusinessAndRole(businessId, profile.id);
    } catch (err) {
      console.error('Error setting active business:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BusinessContext.Provider value={{ business, userRole, loading, refreshBusiness, updateExchangeRate, setActiveBusiness }}>
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
};
