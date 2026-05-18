'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

/**
 * Client guard that gates everything under the (main) route group.
 *
 * Flow:
 * 1. Block render until the Zustand persist middleware has finished hydrating
 *    from localStorage (avoids a flash of "not onboarded" on first paint).
 * 2. Once hydrated, if the user is NOT onboarded, redirect to /onboarding.
 * 3. Otherwise render children.
 *
 * The inverse redirect (already onboarded → /) lives in /onboarding/page.tsx.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isOnboarded = useAppStore((state) => state.isOnboarded);

  const [hydrated, setHydrated] = useState(false);
  const redirected = useRef(false);

  useEffect(() => {
    // `persist` is only available on the client; access it inside an effect.
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
    if (isOnboarded) {
      redirected.current = false;
      return;
    }
    if (redirected.current) return;
    if (pathname === '/onboarding') return;
    redirected.current = true;
    router.replace('/onboarding');
  }, [hydrated, isOnboarded, pathname, router]);

  // While hydrating OR redirecting to /onboarding, render nothing to avoid
  // showing the protected shell briefly.
  if (!hydrated) return null;
  if (!isOnboarded) return null;

  return <>{children}</>;
}
