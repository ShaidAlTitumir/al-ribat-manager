// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, authUser?: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
      } else if (!data) {
        // Fallback: If profile doesn't exist, it might be a race condition with the trigger
        // or the trigger failed. Let's try to create it here as a safety net.
        const user = authUser || (await supabase.auth.getUser()).data.user;
        if (user && user.id === userId) {
          const nameValue = user.user_metadata?.full_name || user.user_metadata?.name || '';
          const profileData: any = { 
            id: userId, 
            email: user.email,
            full_name: nameValue,
            phone: user.user_metadata?.phone || '',
            name: nameValue // Duplicate to handle legacy 'name' column if it exists
          };
          
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .upsert(profileData, { onConflict: 'id' })
            .select()
            .maybeSingle();
          
          if (insertError) {
            console.error('Failed to auto-create profile:', insertError);
            setProfile(null);
          } else {
            setProfile(newProfile);
          }
        } else {
          setProfile(null);
        }
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Profile fetch unexpected error:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id, user);
  };

  useEffect(() => {
    let mounted = true;

    async function handleSession(session: any) {
      if (!mounted) return;
      
      try {
        if (session?.user) {
          setUser(session.user);
          // Start fetching profile but let the session be established
          fetchProfile(session.user.id, session.user).finally(() => {
            if (mounted) setLoading(false);
          });
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Session handling error:', err);
        if (mounted) setLoading(false);
      }
    }

    // Initialize auth
    const init = async () => {
      // Safety timeout: 6 seconds to force loading false if init hangs
      const timeout = setTimeout(() => {
        if (mounted && loading) {
          console.warn('Auth initialization timed out, forcing loading false');
          setLoading(false);
        }
      }, 6000);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        } else {
          await handleSession(session);
        }
      } catch (err) {
        console.error('Init error:', err);
        if (mounted) setLoading(false);
      } finally {
        clearTimeout(timeout);
      }
    };

    init();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Only set loading if we don't have a user yet or it's a sign in
        if (!user || event === 'SIGNED_IN') {
           setLoading(true);
        }
        await handleSession(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
