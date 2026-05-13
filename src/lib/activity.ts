import { supabase } from './supabase';

export type ActivityType = 
  | 'sale' 
  | 'expense' 
  | 'capital' 
  | 'payment' 
  | 'return' 
  | 'purchase' 
  | 'transfer' 
  | 'customer' 
  | 'partner' 
  | 'inventory'
  | 'business'
  | 'supplier'
  | 'wallet'
  | 'activity';

interface LogOptions {
  business_id: string;
  user_id?: string;
  action: string;
  details: {
    title: string;
    sub: string;
    amount?: string | number;
    type: ActivityType;
    metadata?: any;
  };
}

export async function logActivity({ business_id, user_id, action, details }: LogOptions) {
  try {
    const { error } = await supabase
      .from('activity_log')
      .insert({
        business_id,
        user_id,
        action,
        details,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error logging activity:', error);
    }
  } catch (err) {
    console.error('Activity log fatal error:', err);
  }
}
