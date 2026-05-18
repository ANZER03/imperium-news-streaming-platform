'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Onboarding } from '@/components/Onboarding/Onboarding';

export default function OnboardingPage() {
  const router = useRouter();
  const isOnboarded = useAppStore((state) => state.isOnboarded);

  const [hydrated, setHydrated] = useState(false);
  const redirected = useRef(false);

  useEffect(() => {
    if (useAppStore.persist?.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAppStore.persist?.onFinishHydration(() => setHydrated(true));
    return () => {
      unsub?.();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isOnboarded) return;
    if (redirected.current) return;
    redirected.current = true;
    router.replace('/');
  }, [hydrated, isOnboarded, router]);

  if (!hydrated) return null;
  if (isOnboarded) return null;

  return <Onboarding />;
}
