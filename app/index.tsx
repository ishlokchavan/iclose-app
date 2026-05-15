import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth/context';
import { getHomeRoute } from '../lib/auth/guards';
import { Spinner } from '../components/ui/Spinner';

export default function Index() {
  const { session, isLoading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      router.replace('/(auth)/sign-in');
    } else {
      router.replace(getHomeRoute(role) as any);
    }
  }, [session, isLoading, role, router]);

  return <Spinner fullScreen />;
}
