'use client';

import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Rightbar } from '@/components/Rightbar';
import { MobileNav } from '@/components/MobileNav';
import { OnboardingGate } from '@/components/OnboardingGate';

/**
 * (main) route group layout — renders the shared shell (Header / Sidebar /
 * Rightbar / MobileNav) around every page in the group, gated by
 * OnboardingGate so unauthenticated users are funneled to /onboarding.
 *
 * The `modal` slot is the parallel route used by the intercepting route at
 * `@modal/(...)article/[id]/page.tsx` to overlay the article dialog while
 * keeping the underlying page mounted.
 */
export default function MainLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <OnboardingGate>
      <div className="min-h-screen bg-editorial-bg text-editorial-ink font-sans relative">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />

        <div className="flex min-h-screen w-full justify-center">
          {/* Left sidebar (desktop) */}
          <div className="hidden lg:block w-[320px] xl:w-[360px] shrink-0">
            <Sidebar
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
            />
          </div>

          {/* Mobile sidebar (drawer) */}
          <div className="lg:hidden">
            <Sidebar
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
            />
          </div>

          {/* Center content */}
          <main className="w-full max-w-[600px] border-x border-editorial-border relative bg-editorial-bg">
            {children}
          </main>

          {/* Right sidebar (desktop) */}
          <div className="hidden lg:block w-[350px] xl:w-[380px] shrink-0">
            <Rightbar />
          </div>
        </div>

        <MobileNav />
      </div>

      {/* Parallel @modal slot — rendered as an overlay above the shell. */}
      {modal}
    </OnboardingGate>
  );
}
