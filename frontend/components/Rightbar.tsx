'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export function Rightbar() {
  const { setSearchOpen } = useAppStore();

  return (
    <aside className="w-full max-w-[380px] border-l border-editorial-border bg-editorial-bg pl-12 pr-6 pt-8 pb-6 space-y-8 sticky top-0 h-screen overflow-y-auto no-scrollbar">
      <button 
        onClick={() => setSearchOpen(true)}
        className="relative mb-6 group w-full text-left"
      >
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-editorial-muted group-hover:text-editorial-accent transition-colors">
          <Search className="h-5 w-5 shrink-0" />
        </div>
        <div className="w-full bg-editorial-surface border border-editorial-border text-editorial-muted rounded-2xl py-2.5 pl-10 pr-4 text-sm hover:border-editorial-accent transition-colors">
          Search news, topics, people...
        </div>
      </button>

      <div className="space-y-6">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-editorial-accent">
          Trending Perspectives
        </h4>

        <div className="space-y-4">
          {[
            {
              id: '01.',
              title: 'Apple unveils iOS 18 with AI powered features',
              category: 'Artificial General Intelligence',
            },
            {
              id: '02.',
              title: 'Global markets rally as inflation eases',
              category: 'The Silent Retirement Crisis',
            },
            {
              id: '03.',
              title: 'Climate summit reaches new milestone agreement',
              category: 'Olympic City Redux',
            },
            {
              id: '04.',
              title: 'Champions League semi-finals set',
              category: 'Global Sporting Landscape',
            },
          ].map((trend) => (
            <div key={trend.id} className="group cursor-pointer">
              <span className="text-xs font-serif italic text-editorial-muted">
                {trend.id} {trend.category}
              </span>
              <p className="text-sm font-semibold text-editorial-ink group-hover:underline leading-tight mt-1">
                {trend.title}
              </p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
