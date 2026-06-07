
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

export default function ExploreV4() {
  return (
    <div className="min-h-screen bg-editorial-bg p-8 font-sans">
      <div className="max-w-full mx-auto">
        <div className="flex items-center justify-between px-8 mb-6">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-editorial-muted">Panorama</h2>
          <div className="flex gap-2">
            <button className="w-8 h-8 border border-editorial-border flex items-center justify-center rounded hover:bg-editorial-surface"><ChevronLeft size={16}/></button>
            <button className="w-8 h-8 border border-editorial-border flex items-center justify-center rounded hover:bg-editorial-surface"><ChevronRight size={16}/></button>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto no-scrollbar px-8 pb-8">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[400px] h-[200px] shrink-0 rounded-xl overflow-hidden cursor-pointer shadow-sm border border-editorial-border">
              <Image src={cat.image} alt={cat.title} fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent p-6 flex flex-col justify-end">
                <h3 className="font-serif text-3xl text-white font-medium">{cat.title}</h3>
                <div className="w-0 group-hover:w-12 h-0.5 bg-white mt-4 transition-all duration-500" />
              </div>
            </div>
          ))}
        </div>

        <div className="w-full overflow-hidden bg-editorial-ink text-editorial-bg py-3 mt-4 flex items-center">
          <div className="flex whitespace-nowrap animate-shimmer gap-8 items-center">
            {/* Repeat keywords a few times to create infinite effect illusion */}
            {[...EXPLORE_KEYWORDS, ...EXPLORE_KEYWORDS, ...EXPLORE_KEYWORDS].map((kw, i) => (
              <span key={i} className="text-sm font-bold uppercase tracking-widest flex items-center gap-4">
                {kw} <span className="w-1.5 h-1.5 bg-editorial-accent rounded-full inline-block"/>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
