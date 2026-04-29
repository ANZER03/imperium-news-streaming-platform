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

  if (!mounted) return null; // Avoid hydration mismatch on first render

  if (!isOnboarded) {
    return <Onboarding />;
  }

  return (
    <div className="min-h-screen bg-editorial-bg text-editorial-ink font-sans flex flex-col relative">
      <div className="w-full bg-editorial-bg lg:mb-0 font-sans">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        
        <div className="grid lg:grid-cols-[250px_minmax(0,1fr)_340px] max-w-full">
          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
          
          <main className="min-w-0 border-t border-editorial-border lg:border-none relative bg-white">
            <FeedList />
            <AnimatePresence>
              {selectedArticle && (
                <ArticleView key="article-view" />
              )}
            </AnimatePresence>
          </main>
          
          <Rightbar />
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
