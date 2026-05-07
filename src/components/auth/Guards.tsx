// src/components/auth/Guards.tsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if email is verified
  // Note: supabase user object has email_confirmed_at
  if (!user.email_confirmed_at) {
    return <Navigate to="/login" state={{ unverified: true, email: user.email }} replace />;
  }

  return <Outlet />;
};

// src/components/auth/NoBusinessGuard.tsx
export const NoBusinessGuard = () => {
  const { profile, loading } = useAuth();

  if (loading) return null;

  if (!profile?.business_id) {
    return <Navigate to="/businesses" replace />;
  }

  return <Outlet />;
};
