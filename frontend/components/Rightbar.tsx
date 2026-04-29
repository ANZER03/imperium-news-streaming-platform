import React from 'react';
import { TrendingUp, Send } from 'lucide-react';
import Image from 'next/image';

export function Rightbar() {
  return (
    <aside className="hidden border-l border-editorial-border bg-editorial-bg px-6 py-6 space-y-8 lg:block lg:sticky lg:top-[126px] h-[calc(100vh-126px)] overflow-y-auto no-scrollbar">
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
