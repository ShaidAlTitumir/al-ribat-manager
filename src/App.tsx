// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { BusinessProvider } from './context/BusinessContext';
import { ProtectedRoute, NoBusinessGuard } from './components/auth/Guards';

// Lazy load pages
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Sales = React.lazy(() => import('./pages/Sales'));
const Customers = React.lazy(() => import('./pages/Customers'));
const Suppliers = React.lazy(() => import('./pages/Suppliers'));
const Partners = React.lazy(() => import('./pages/Partners'));
const Inventory = React.lazy(() => import('./pages/Inventory'));
const Wallet = React.lazy(() => import('./pages/Wallet'));
const Transactions = React.lazy(() => import('./pages/Transactions'));
const Expenses = React.lazy(() => import('./pages/Expenses'));
const Reports = React.lazy(() => import('./pages/Reports'));
const Activities = React.lazy(() => import('./pages/Activities'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Businesses = React.lazy(() => import('./pages/Businesses'));
const Login = React.lazy(() => import('./pages/auth/Login'));
const Onboarding = React.lazy(() => import('./pages/auth/Onboarding'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BusinessProvider>
          <BrowserRouter future={{ v7_relativeSplatPath: true }}>
            <React.Suspense fallback={
              <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <Routes>
                <Route path="/login" element={<Login />} />
                
                <Route element={<ProtectedRoute />}>
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/" element={<Dashboard />} />
                  
                  <Route element={<NoBusinessGuard />}>
                    <Route path="/sales" element={<Sales />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/suppliers" element={<Suppliers />} />
                    <Route path="/partners" element={<Partners />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/wallet" element={<Wallet />} />
                    <Route path="/transactions" element={<Transactions />} />
                    <Route path="/expenses" element={<Expenses />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/activities" element={<Activities />} />
                  </Route>
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/businesses" element={<Businesses />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </React.Suspense>
          </BrowserRouter>
        </BusinessProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
