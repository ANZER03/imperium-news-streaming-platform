
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

export default function ExploreV6() {
  return (
    <div className="min-h-screen bg-black p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-px bg-editorial-accent" />
          <h2 className="text-xl text-white font-medium tracking-wide">Trending Topics</h2>
        </div>
        
        <div className="flex gap-6 overflow-x-auto no-scrollbar pb-8">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[280px] h-[400px] shrink-0 rounded-2xl overflow-hidden cursor-pointer bg-neutral-900 border border-neutral-800 hover:border-editorial-accent/50 transition-colors shadow-[0_0_0_0_rgba(111,63,245,0)] hover:shadow-[0_0_30px_0_rgba(111,63,245,0.2)]">
              <Image src={cat.image} alt={cat.title} fill className="object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6 w-full translate-y-4 group-hover:translate-y-0 transition-transform">
                <h3 className="font-sans text-2xl font-bold text-white mb-2">{cat.short}</h3>
                <p className="text-sm text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity delay-100">Explore the latest in {cat.short.toLowerCase()}.</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-4 overflow-x-auto no-scrollbar mt-6">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-sm text-neutral-300 bg-neutral-900 border border-neutral-800 px-5 py-2.5 rounded-lg hover:border-editorial-accent hover:text-white cursor-pointer transition-colors flex items-center gap-2">
              <Hash size={14} className="text-editorial-accent" />
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
