import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || "";
      const isConfigError = errorMsg.includes('Supabase is not configured');
      const isFetchError = errorMsg.toLowerCase().includes('failed to fetch');

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-red-100">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-4">Something went wrong</h1>
            <div className="text-slate-600 mb-8 leading-relaxed space-y-2">
              {isConfigError ? (
                <p>It looks like the Supabase connection isn't configured yet. Please add your <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> to the Secrets panel.</p>
              ) : isFetchError ? (
                <>
                  <p><strong>Connection Error:</strong> Failed to connect to the database.</p>
                  <p className="text-sm">This usually happens if the Supabase URL is incorrect or if there's a temporary network issue. Please verify your credentials in the Secrets panel.</p>
                </>
              ) : (
                <p>{errorMsg || "An unexpected error occurred."}</p>
              )}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-[#131b2e] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95"
            >
              <RefreshCcw className="w-5 h-5" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
