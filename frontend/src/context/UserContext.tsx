'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

const AUTH_BOOTSTRAP_TIMEOUT_MS = 5000;
const TIMEOUT_SENTINEL = Symbol('timeout');

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T | typeof TIMEOUT_SENTINEL> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT_SENTINEL), timeoutMs);
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

export interface UserProfile {
  id: string;
  name: string;
  location_name: string;
  latitude: number;
  longitude: number;
  land_area: number;
  primary_crop: string;
  language: string;
  role?: 'farmer' | 'buyer';
  user_type?: string;
  account_type?: string;
  created_at: string;
  updated_at: string;
}

export interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const message = 'message' in error && typeof error.message === 'string'
    ? error.message.toLowerCase()
    : '';

  return (
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found') ||
    message.includes('refresh_token_not_found') ||
    message.includes('timed out')
  );
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearLocalSession = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Ignore local sign-out cleanup issues.
    }

    setUser(null);
    setProfile(null);
    setError(null);
  };

  // Fetch user profile from Supabase
  const fetchProfile = async (userId: string) => {
    try {
      setError(null);
      const profileResult = await withTimeout(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),
        AUTH_BOOTSTRAP_TIMEOUT_MS,
      );

      if (profileResult === TIMEOUT_SENTINEL) {
        setProfile(null);
        return;
      }

      const typedProfileResult = profileResult as {
        data: UserProfile | null;
        error: { code?: string; message?: string } | null;
      };

      const { data, error: fetchError } = typedProfileResult;

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (data) {
        setProfile(data);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    }
  };

  // Check auth state and load profile
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const sessionResult = await withTimeout(supabase.auth.getSession(), AUTH_BOOTSTRAP_TIMEOUT_MS);

        if (sessionResult === TIMEOUT_SENTINEL) {
          setUser(null);
          setProfile(null);
          return;
        }

        const {
          data: { session },
        } = sessionResult as {
          data: { session: Session | null };
        };

        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        if (isInvalidRefreshTokenError(err)) {
          await clearLocalSession();
        } else {
          console.error('Error checking auth:', err);
          setError(err instanceof Error ? err.message : 'Auth error');
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: string, session: Session | null) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) throw new Error('User not authenticated');

    try {
      setError(null);
      const updateData = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile((prev) =>
        prev ? { ...prev, ...updateData } : null
      );
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      throw err;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const value: UserContextType = {
    user,
    profile,
    loading,
    error,
    updateProfile,
    refreshProfile,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
}
