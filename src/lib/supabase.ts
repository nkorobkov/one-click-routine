import { createClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create client with fallback empty strings if env vars are missing (for development)
// The actual auth functions will handle errors gracefully
export const supabase = createClient(
  supabaseUrl || 'https://dseijgrdislccwbuklda.supabase.co',
  supabaseAnonKey || 'sb_publishable_IGnOrt6CGkcMxgmj2qbexQ_Av4OGAPu'
);

// User type
export interface User {
  id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
}

// Authentication functions
export async function signInWithGoogle() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
  }
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
    },
  });
  
  if (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
  
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }
  
  if (!user) {
    return null;
  }
  
  // Get user metadata (name, avatar, etc.)
  const userData: User = {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    avatar_url: user.user_metadata?.avatar_url,
  };
  
  return userData;
}

// Listen to auth state changes
export function onAuthStateChange(callback: (user: User | null) => void) {
  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      const user = await getCurrentUser();
      callback(user);
    } else {
      callback(null);
    }
  });
  return data;
}
