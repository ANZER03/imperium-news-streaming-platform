'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Welcome } from '@/components/Onboarding/Welcome';

export default function WelcomePage() {
  const router = useRouter();
  const isOnboarded = useAppStore((state) => state.isOnboarded);
  const userId = useAppStore((state) => state.userId);
  const [hydrated, setHydrated] = useState(false);
  const redirected = useRef(false);

  useEffect(() => {
    if (useAppStore.persist?.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAppStore.persist?.onFinishHydration(() => setHydrated(true));
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (redirected.current) return;

    if (userId) {
      redirected.current = true;
      if (isOnboarded) {
        router.replace('/');
      } else {
        router.replace('/onboarding');
      }
    }
  }, [hydrated, userId, isOnboarded, router]);

  if (!hydrated || userId) return null;

  return <Welcome />;
}
