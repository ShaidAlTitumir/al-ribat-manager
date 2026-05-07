// src/context/BusinessContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Business } from '../types';
import { useAuth } from './AuthContext';

interface BusinessContextType {
  business: Business | null;
  loading: boolean;
  refreshBusiness: () => Promise<void>;
  updateExchangeRate: (rate: number) => Promise<void>;
  setActiveBusiness: (businessId: string) => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const BusinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBusiness = async (businessId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching business:', error);
        setBusiness(null);
      } else if (!data) {
        console.warn('Business not found for ID:', businessId);
        setBusiness(null);
      } else {
        setBusiness(data);
      }
    } catch (err) {
      console.error('Business fetch unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshBusiness = async () => {
    if (profile?.business_id) {
      await fetchBusiness(profile.business_id);
    } else {
      setBusiness(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.business_id) {
      fetchBusiness(profile.business_id);
    } else if (profile === null) {
      // Profile explicitly null (logged out)
      setBusiness(null);
      setLoading(false);
    }
  }, [profile?.business_id, profile === null]);

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

  const setActiveBusiness = async (businessId: string) => {
    if (!profile?.id) return;
    
    setLoading(true);
    try {
      // 1. Get the user's role in this business
      const { data: memberData, error: mError } = await supabase
        .from('business_members')
        .select('role')
        .eq('business_id', businessId)
        .eq('user_id', profile.id)
        .maybeSingle();
      
      if (mError) throw mError;
      
      const newRole = memberData?.role || 'user';

      // 2. Update profile with new business and role
      const { error } = await supabase
        .from('profiles')
        .update({ 
          business_id: businessId,
          role: newRole
        })
        .eq('id', profile.id);
        
      if (error) throw error;
      await fetchBusiness(businessId);
    } catch (err) {
      console.error('Error setting active business:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BusinessContext.Provider value={{ business, loading, refreshBusiness, updateExchangeRate, setActiveBusiness }}>
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
