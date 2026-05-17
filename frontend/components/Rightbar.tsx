'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export function Rightbar() {
  return (
    <aside className="w-full max-w-[380px] border-l border-editorial-border bg-editorial-bg pl-12 pr-6 pt-8 pb-6 space-y-8 sticky top-0 h-screen overflow-y-auto no-scrollbar">
      <div className="flex items-center rounded-2xl bg-editorial-surface px-4 py-2.5 text-editorial-muted focus-within:ring-1 focus-within:ring-editorial-accent transition-shadow">
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

      <div className="space-y-6">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-editorial-accent">Trending Perspectives</h4>

        <div className="space-y-4">
          {[
            { id: '01.', title: 'Apple unveils iOS 18 with AI powered features', category: 'Artificial General Intelligence' },
            { id: '02.', title: 'Global markets rally as inflation eases', category: 'The Silent Retirement Crisis' },
            { id: '03.', title: 'Climate summit reaches new milestone agreement', category: 'Olympic City Redux' },
            { id: '04.', title: 'Champions League semi-finals set', category: 'Global Sporting Landscape' },
          ].map(trend => (
            <div key={trend.id} className="group cursor-pointer">
              <span className="text-xs font-serif italic text-editorial-muted">{trend.id} {trend.category}</span>
              <p className="text-sm font-semibold text-editorial-ink group-hover:underline leading-tight mt-1">{trend.title}</p>
            </div>
          ))}
        </div>
      </div>

    </aside>
  );
}
