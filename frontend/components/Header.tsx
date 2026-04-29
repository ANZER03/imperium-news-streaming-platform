'use client';

import React, { useRef } from 'react';
import { Search, Menu, ChevronLeft, ChevronRight, Bookmark, X } from 'lucide-react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { AnimatePresence, motion } from 'motion/react';

interface HeaderProps {
  onMenuClick: () => void;
}

const TOPICS = [
  'For You', 'Latest', 'Trending', 'World', 'Business', 'Tech', 'Science', 'Sports', 'Entertainment', 'Health'
];

export function Header({ onMenuClick }: HeaderProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { activeTopic, activeView, setTopic, setView, interests } = useAppStore();

  const [isMobileSearchOpen, setIsMobileSearchOpen] = React.useState(false);

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
    <header className="sticky top-0 border-b border-editorial-border bg-editorial-bg z-40 flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-8 w-full">
        {/* LOGO */}
        <div className="flex items-center shrink-0">
          <button onClick={() => setView('feed')} className="flex items-center">
            {/* Desktop Logo (Text + Symbol) */}
            <div className="hidden md:block relative h-8 md:h-10">
              <img 
                src="/imperium_logo.svg" 
                alt="Imperium"
                className="h-full w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden flex items-center gap-3">
                <div className="grid h-10 w-10 grid-cols-3 gap-[3px] rounded-2xl bg-[#f4f7ff] p-[5px]">
                  <span className="rounded-full bg-rose-500"></span>
                  <span className="rounded-full bg-orange-400"></span>
                  <span className="rounded-full bg-[#6F3FF5]"></span>
                  <span className="rounded-full bg-emerald-400"></span>
                  <span className="rounded-full bg-[#3A0A78]"></span>
                  <span className="rounded-full bg-rose-400"></span>
                  <span className="rounded-full bg-orange-300"></span>
                  <span className="rounded-full bg-emerald-500"></span>
                  <span className="rounded-full bg-[#4c3dde]"></span>
                </div>
                <span className="text-[2rem] font-bold tracking-tight text-editorial-ink font-sans">imperium</span>
              </div>
            </div>

            {/* Mobile Logo (Symbol Only) */}
            <div className="md:hidden relative h-10 w-10">
              <img 
                src="/logo.svg" 
                alt="Imperium"
                className="h-full w-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden grid h-full w-full grid-cols-3 gap-[2px] rounded-xl bg-[#f4f7ff] p-[4px]">
                <span className="rounded-full bg-rose-500"></span>
                <span className="rounded-full bg-orange-400"></span>
                <span className="rounded-full bg-[#6F3FF5]"></span>
                <span className="rounded-full bg-emerald-400"></span>
                <span className="rounded-full bg-[#3A0A78]"></span>
                <span className="rounded-full bg-rose-400"></span>
                <span className="rounded-full bg-orange-300"></span>
                <span className="rounded-full bg-emerald-500"></span>
                <span className="rounded-full bg-[#4c3dde]"></span>
              </div>
            </div>
          </button>
        </div>

        {/* SEARCH (Right) */}
        <div className="flex items-center gap-3 md:gap-6 flex-1 justify-end">
          {/* Mobile Search Input With Animation */}
          <div className="md:hidden flex flex-1 justify-end relative h-10 w-full max-w-[200px]">
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

          {/* Desktop Search Input */}
          <div className="hidden md:flex items-center rounded-2xl bg-editorial-surface px-4 py-2.5 text-editorial-muted focus-within:ring-1 focus-within:ring-editorial-accent transition-shadow flex-1 max-w-xs">
            <Search className="mr-3 h-5 w-5 shrink-0" />
            <input 
              className="w-full bg-transparent text-sm text-editorial-ink outline-none placeholder:text-editorial-muted/70" 
              type="text" 
              placeholder="Search news, topics, people..." 
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = e.currentTarget.value.trim();
                  if (val) useAppStore.getState().setSearchQuery(val);
                }
              }}
            />
          </div>
        </div>
      </div>

      <div className="relative border-t border-editorial-border px-4 md:px-8 bg-editorial-bg flex items-center group">
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
            {TOPICS.map((topic) => {
              const isSelected = activeView === 'feed' && (
                (topic === 'For You' && activeTopic === 'All') || 
                (activeTopic === topic)
              );
              return (
                <button 
                  key={topic}
                  onClick={() => {
                    if (topic === 'For You') setTopic('All');
                    else setTopic(topic);
                  }}
                  className={`py-3.5 transition font-sans ${
                    isSelected 
                      ? 'border-b-[3px] border-editorial-accent text-editorial-ink' 
                      : 'hover:text-editorial-ink'
                  }`}
                >
                  {topic}
                </button>
              );
            })}
            
            {/* Interests from onboarding */}
            {interests.map(interest => (
              <button 
                key={interest}
                onClick={() => setTopic(interest)}
                className={`py-3.5 transition font-sans ${
                  activeView === 'feed' && activeTopic === interest
                    ? 'border-b-[3px] border-editorial-accent text-editorial-ink' 
                    : 'hover:text-editorial-ink'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
        </nav>

        <button 
          onClick={scrollRight}
          className="absolute right-0 z-10 hidden h-full items-center justify-center bg-gradient-to-l from-editorial-bg via-editorial-bg to-transparent px-2 md:px-4 text-editorial-muted hover:text-editorial-ink group-hover:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
