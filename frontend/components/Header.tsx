'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { topicService } from '@/lib/services';
import { Topic } from '@/lib/types';
import { useAppStore } from '@/lib/store';

interface HeaderProps {
  onMenuClick: () => void;
}

const SPECIAL_TOPICS: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'For You', href: '/' },
  { label: 'Latest', href: '/latest' },
];

export function TopicCarousel({ className = '' }: { className?: string }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const params = useParams<{ topicId?: string }>();
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

  const activeTopicId = params?.topicId;

  return (
    <div
      className={`relative border-b border-editorial-border px-4 md:px-8 bg-editorial-bg flex items-center group ${className}`}
    >
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
          {SPECIAL_TOPICS.map(({ label, href }) => {
            const isSelected = pathname === href;
            return (
              <Link
                key={label}
                href={href}
                className={`py-3.5 transition font-sans ${
                  isSelected
                    ? 'border-b-[3px] border-editorial-accent text-editorial-ink'
                    : 'hover:text-editorial-ink'
                }`}
              >
                {label}
              </Link>
            );
          })}

          {topics.map(({ topicId, displayName }) => {
            const isSelected = activeTopicId === topicId;
            return (
              <Link
                key={topicId}
                href={`/topic/${topicId}`}
                className={`py-3.5 transition font-sans ${
                  isSelected
                    ? 'border-b-[3px] border-editorial-accent text-editorial-ink'
                    : 'hover:text-editorial-ink'
                }`}
              >
                {displayName}
              </Link>
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
  const { setSearchOpen } = useAppStore();
  const visible = useScrollDirection();

  return (
    <header
      className={`sticky top-0 border-b border-editorial-border bg-editorial-bg z-40 flex flex-col transition-transform duration-300 lg:hidden ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="flex items-center justify-between gap-3 px-2 py-3 w-full">
        {/* LOGO — taps to toggle sidebar */}
        <button onClick={onMenuClick} className="flex items-center shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Imperium" className="h-9 w-auto object-contain" />
        </button>

        {/* SEARCH (Right) */}
        <div className="flex items-center gap-3 md:gap-6 flex-1 justify-end">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl text-editorial-muted hover:text-editorial-ink transition-colors z-10 bg-editorial-surface/50"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        </div>
      </div>

      <TopicCarousel />
    </header>
  );
}
