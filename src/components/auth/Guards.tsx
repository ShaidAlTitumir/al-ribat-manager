// src/components/auth/Guards.tsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user && !loading) {
    return <Navigate to="/login" replace />;
  }

  if (user && !user.email_confirmed_at) {
    return <Navigate to="/login" state={{ unverified: true, email: user.email }} replace />;
  }

  return <Outlet />;
};

// src/components/auth/NoBusinessGuard.tsx
export const NoBusinessGuard = () => {
  const { profile, loading, user } = useAuth();

  // If we have a user but are still loading profile, show a minimal loading state instead of blocking
  if (loading && user && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">Syncing Profile...</p>
        </div>
      </div>
    );
  }

  if (!profile?.business_id && !loading) {
    return <Navigate to="/businesses" replace />;
  }

  return <Outlet />;
};
