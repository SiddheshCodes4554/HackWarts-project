'use client';

import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { useEffect } from 'react';

export default function HomeRedirect() {
  const router = useRouter();
  const { user, profile, loading } = useUser();

  useEffect(() => {
    // Wait for auth check to complete
    if (loading) {
      return;
    }

    // If not authenticated, redirect to login
    if (!user) {
      router.replace('/login');
      return;
    }

    // If authenticated but no profile, redirect to onboarding
    if (!profile) {
      router.replace('/onboarding');
      return;
    }

    // If fully set up, redirect to home
    router.replace('/home');
  }, [user, profile, loading, router]);

  // Show loading state while checking auth
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
        <p className="text-gray-600">Loading FarmEase...</p>
      </div>
    </div>
  );
}
