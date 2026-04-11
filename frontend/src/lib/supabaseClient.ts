import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

let supabaseClient: any = null;

// Lazy initialize Supabase client to avoid build-time errors
export function getSupabaseClient() {
  if (!supabaseClient) {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    } catch (err) {
      console.error('Failed to initialize Supabase:', err);
      // Return a mock client to avoid crashes
      return {
        auth: {
          getSession: async () => ({ data: { session: null } }),
          signInWithPassword: async () => ({ error: new Error('Supabase not configured') }),
          signUp: async () => ({ error: new Error('Supabase not configured') }),
          signOut: async () => ({ error: new Error('Supabase not configured') }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ error: new Error('Database not available') }),
            }),
          }),
          insert: async () => ({ error: new Error('Database not available') }),
          update: async () => ({ error: new Error('Database not available') }),
        }),
      };
    }
  }
  return supabaseClient;
}

// For backward compatibility, create a default export
export const supabase = new Proxy({}, {
  get(target, prop) {
    return getSupabaseClient()[prop as string];
  },
}) as any;

export function isSupabaseConfigured(): boolean {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== undefined &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== '' &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== ''
  );
}

export type Database = any;



