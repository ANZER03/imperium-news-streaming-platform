'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { AnimatePresence, motion } from 'motion/react';
import { topicService } from '@/lib/services';
import { Topic } from '@/lib/types';

interface HeaderProps {
  onMenuClick: () => void;
}

const SPECIAL_TOPICS = ['For You', 'Latest'];

export function TopicCarousel({ className = '' }: { className?: string }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { activeTopic, activeView, setTopic } = useAppStore();
  const [topics, setTopics] = useState<Topic[]>([]);

  useEffect(() => {
    topicService.getAll().then(setTopics).catch(() => {});
  }, []);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  return (
    <div className={`relative border-b border-editorial-border px-4 md:px-8 bg-editorial-bg flex items-center group ${className}`}>
      <button 
        onClick={scrollLeft}
        className="absolute left-0 z-10 hidden h-full items-center justify-center bg-gradient-to-r from-editorial-bg via-editorial-bg to-transparent px-2 md:px-4 text-editorial-muted hover:text-editorial-ink group-hover:flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <nav 
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto no-scrollbar scroll-smooth"
      >
        <div className="flex min-w-max items-center gap-6 md:gap-8 text-[15px] font-medium text-editorial-muted font-sans pb-0">
          {SPECIAL_TOPICS.map((label) => {
            const key = label === 'For You' ? 'All' : label;
            const isSelected = activeView === 'feed' && activeTopic === key;
            return (
              <button
                key={label}
                onClick={() => setTopic(key)}
                className={`py-3.5 transition font-sans ${
                  isSelected
                    ? 'border-b-[3px] border-editorial-accent text-editorial-ink'
                    : 'hover:text-editorial-ink'
                }`}
              >
                {label}
              </button>
            );
          })}

          {topics.map(({ topicId, displayName }) => {
            const isSelected = activeView === 'feed' && activeTopic === topicId;
            return (
              <button
                key={topicId}
                onClick={() => setTopic(topicId)}
                className={`py-3.5 transition font-sans ${
                  isSelected
                    ? 'border-b-[3px] border-editorial-accent text-editorial-ink'
                    : 'hover:text-editorial-ink'
                }`}
              >
                {displayName}
              </button>
            );
          })}
        </div>
      </nav>

      <button 
        onClick={scrollRight}
        className="absolute right-0 z-10 hidden h-full items-center justify-center bg-gradient-to-l from-editorial-bg via-editorial-bg to-transparent px-2 md:px-4 text-editorial-muted hover:text-editorial-ink group-hover:flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

export function Header({ onMenuClick }: HeaderProps) {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const visible = useScrollDirection();

  return (
    <header className={`sticky top-0 border-b border-editorial-border bg-editorial-bg z-40 flex flex-col transition-transform duration-300 lg:hidden ${visible ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="flex items-center justify-between gap-3 px-2 py-3 w-full">
        {/* LOGO — taps to toggle sidebar */}
        <button onClick={onMenuClick} className="flex items-center shrink-0">
          <img
            src="/logo.svg"
            alt="Imperium"
            className="h-9 w-auto object-contain"
          />
        </button>

        {/* SEARCH (Right) */}
        <div className="flex items-center gap-3 md:gap-6 flex-1 justify-end">
          {/* Mobile Search Input With Animation */}
          <div className="flex flex-1 justify-end relative h-10 w-full max-w-[200px]">
            <AnimatePresence initial={false}>
              {!isMobileSearchOpen ? (
                <motion.button 
                  key="search-btn"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 flex h-10 w-10 items-center justify-center rounded-xl text-editorial-muted z-10"
                  onClick={() => setIsMobileSearchOpen(true)}
                >
                  <Search className="h-6 w-6 text-editorial-ink" />
                </motion.button>
              ) : (
                <motion.div
                  key="search-input"
                  initial={{ opacity: 0, width: 40 }}
                  animate={{ opacity: 1, width: '100%' }}
                  exit={{ opacity: 0, width: 40 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                  className="absolute right-0 flex items-center rounded-2xl bg-editorial-surface px-3 py-2 text-editorial-muted focus-within:ring-1 focus-within:ring-editorial-accent z-20 h-10 overflow-hidden shadow-sm"
                >
                  <Search className="mr-2 h-4 w-4 shrink-0" />
                  <input 
                    autoFocus
                    className="w-full bg-transparent text-sm text-editorial-ink outline-none placeholder:text-editorial-muted/70 min-w-0" 
                    type="text" 
                    placeholder="Search..." 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = e.currentTarget.value.trim();
                        if (val) {
                          useAppStore.getState().setSearchQuery(val);
                          setIsMobileSearchOpen(false);
                        }
                      } else if (e.key === 'Escape') {
                        setIsMobileSearchOpen(false);
                      }
                    }}
                  />
                  <button onClick={() => setIsMobileSearchOpen(false)} className="ml-2 shrink-0">
                    <X className="h-4 w-4 text-editorial-muted transition-colors hover:text-editorial-ink" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <TopicCarousel />
    </header>
  );
}
