
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

export default function ExploreV10() {
  return (
    <div className="min-h-screen bg-editorial-bg p-8 font-sans">
      <div className="max-w-full mx-auto px-4">
        <div className="flex items-center gap-6 mb-12">
          <h2 className="text-4xl font-serif text-editorial-ink">Explore</h2>
          <div className="flex-1 h-px bg-editorial-border" />
          <p className="text-sm text-editorial-muted max-w-xs text-right">Discover the latest stories across our curated sections.</p>
        </div>
        
        <div className="flex gap-6 overflow-x-auto no-scrollbar pb-12 pt-12 items-center">
          {EXPLORE_CATEGORIES.map((cat, i) => (
            <div key={cat.id} className={`group relative min-w-[260px] w-[260px] shrink-0 cursor-pointer transition-transform duration-500 ${i % 2 === 0 ? '-translate-y-8' : 'translate-y-8'}`}>
              <div className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden shadow-lg group-hover:shadow-2xl transition-all duration-500">
                <Image src={cat.image} alt={cat.title} fill className="object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
              </div>
              <div className="mt-6 text-center">
                <h3 className="font-serif text-2xl text-editorial-ink mb-1">{cat.title}</h3>
                <span className="text-xs font-bold uppercase tracking-widest text-editorial-accent">Section 0{i+1}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-16 max-w-3xl mx-auto">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-sm text-editorial-ink bg-editorial-surface px-6 py-3 rounded-full hover:bg-editorial-ink hover:text-white cursor-pointer transition-colors font-medium">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
