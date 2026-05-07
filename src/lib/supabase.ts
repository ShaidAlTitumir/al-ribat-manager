import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

const getSupabaseConfig = () => {
  let url = (import.meta as any).env.VITE_SUPABASE_URL;
  const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

  const isPlaceholder = (s: string | undefined) => 
    !s || s.includes('your-project-id') || s.includes('your-anon-key');

  if (isPlaceholder(url) || isPlaceholder(key)) {
    return null;
  }

  // Basic sanitization: remove trailing slashes
  if (url && url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  return { url, key };
};

export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    const config = getSupabaseConfig();

    if (!config) {
      const errorMsg = 'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Secrets panel (bottom left) with real values from your Supabase project.';
      console.warn('Supabase configuration missing or placeholder detected.');
      throw new Error(errorMsg);
    }
    
    try {
      supabaseInstance = createClient(config.url, config.key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        }
      });
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      throw err;
    }
  }
  return supabaseInstance;
};

// Export a proxy or a getter-like object to minimize changes in other files if possible,
// but explicit function call is safer and follows the guidelines.
export const supabase = {
  get auth() { return getSupabase().auth; },
  get from() { return getSupabase().from.bind(getSupabase()); },
  get rpc() { return getSupabase().rpc.bind(getSupabase()); },
  get storage() { return getSupabase().storage; },
};
