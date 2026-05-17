'use client';
import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Onboarding } from '@/components/Onboarding/Onboarding';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Rightbar } from '@/components/Rightbar';
import { MobileNav } from '@/components/MobileNav';
import { FeedList } from '@/components/Feed/FeedList';
import { ArticleView } from '@/components/Feed/ArticleView';
import { AnimatePresence } from 'motion/react';

export default function Home() {
  const { isOnboarded, selectedArticle } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (!isOnboarded) {
    return <Onboarding />;
  }

  return (
    <div className="min-h-screen bg-editorial-bg text-editorial-ink font-sans relative">
      <Header onMenuClick={() => setIsSidebarOpen(true)} />

      <div className="flex min-h-screen w-full justify-center">
        {/* Left sidebar */}
        <div className="hidden lg:block w-[320px] xl:w-[360px] shrink-0">
          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </div>

        {/* Mobile sidebar */}
        <div className="lg:hidden">
          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </div>

        {/* Center feed */}
        <main className="w-full max-w-[600px] border-x border-editorial-border relative bg-editorial-bg">
          <FeedList />
          <AnimatePresence>
            {selectedArticle && <ArticleView key="article-view" />}
          </AnimatePresence>
        </main>

        {/* Right sidebar */}
        <div className="hidden lg:block w-[350px] xl:w-[380px] shrink-0">
          <Rightbar />
        </div>
      </div>

      <MobileNav />
    </div>
  );
}
