
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Hash, ArrowRight } from 'lucide-react';

const EXPLORE_CATEGORIES = [
  { id: 'politics', title: 'World Politics', short: 'World', image: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=400' },
  { id: 'tech', title: 'Technology', short: 'Tech', image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=400' },
  { id: 'science', title: 'Science', short: 'Science', image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=400' },
  { id: 'business', title: 'Markets & Economy', short: 'Business', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=400' },
  { id: 'culture', title: 'Culture & Arts', short: 'Culture', image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=400' },
];

const EXPLORE_KEYWORDS = ['Elections', 'AI', 'Startups', 'Climate', 'Space', 'Health', 'Markets', 'Sports'];

export default function ExploreV5() {
  return (
    <div className="min-h-screen bg-[#111111] p-8 font-sans text-white">
      <div className="max-w-6xl mx-auto py-12">
        <h2 className="text-sm font-light text-neutral-400 mb-16 tracking-widest uppercase border-b border-neutral-800 pb-4">Index / Explore</h2>
        
        <div className="flex gap-16 overflow-x-auto no-scrollbar pb-12 px-4">
          {EXPLORE_CATEGORIES.map((cat, i) => (
            <div key={cat.id} className="group relative min-w-[240px] shrink-0 cursor-pointer flex flex-col">
              <span className="text-[140px] font-serif leading-none text-neutral-800 group-hover:text-white transition-colors duration-500">
                {cat.short.charAt(0)}
              </span>
              <div className="mt-8">
                <span className="text-xs text-neutral-500 block mb-2">0{i + 1}</span>
                <h3 className="font-sans text-xl text-neutral-300 group-hover:text-white group-hover:translate-x-2 transition-all">{cat.title}</h3>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-neutral-800 flex flex-wrap gap-8">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-base text-neutral-500 hover:text-white cursor-pointer transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-px after:bg-white hover:after:w-full after:transition-all">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
