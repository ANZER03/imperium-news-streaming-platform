
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

export default function ExploreV1() {
  return (
    <div className="min-h-screen bg-editorial-bg p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-serif italic text-editorial-ink mb-8 border-b border-editorial-border pb-4">The Explore Section</h2>
        
        {/* Categories */}
        <div className="flex gap-6 overflow-x-auto no-scrollbar pb-8">
          {EXPLORE_CATEGORIES.map((cat, i) => (
            <div key={cat.id} className="group relative min-w-[280px] h-[360px] shrink-0 border-l border-editorial-border pl-6 flex flex-col justify-between cursor-pointer">
              <span className="text-xs text-editorial-muted font-bold tracking-widest uppercase">0{i + 1}</span>
              <div className="relative w-full h-[240px] overflow-hidden rounded-sm">
                <Image src={cat.image} alt={cat.title} fill className="object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
              </div>
              <h3 className="font-serif text-2xl text-editorial-ink mt-4 group-hover:text-editorial-accent transition-colors">{cat.title}</h3>
            </div>
          ))}
        </div>

        {/* Keywords */}
        <div className="flex flex-wrap gap-4 pt-6 border-t border-editorial-border">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-sm font-serif italic text-editorial-muted hover:text-editorial-ink cursor-pointer px-4 py-1 border border-transparent hover:border-editorial-border rounded-full transition-all">
              # {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
