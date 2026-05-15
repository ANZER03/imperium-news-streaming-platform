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
    <div className="min-h-screen bg-editorial-bg text-editorial-ink font-sans flex flex-col relative">
      <div className="w-full bg-editorial-bg lg:mb-0 font-sans">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />

        <div className="max-w-[1280px] mx-auto">
          <div className="grid justify-center lg:grid-cols-[275px_minmax(0,600px)_350px]">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <main className="min-w-0 border-t border-editorial-border lg:border-t-0 lg:border-x lg:border-editorial-border relative bg-editorial-bg">
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
      </div>
      <MobileNav />
    </div>
  );
}
