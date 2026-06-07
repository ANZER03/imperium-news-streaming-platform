
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Hash, ArrowRight, ArrowLeft } from 'lucide-react';

const EXPLORE_CATEGORIES = [
  { id: 'news', title: 'News', short: 'News', image: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=400' },
  { id: 'religion', title: 'Religion', short: 'Religion', image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=400' },
  { id: 'beauty', title: 'Beauty', short: 'Beauty', image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=400' },
  { id: 'sports', title: 'Sports', short: 'Sports', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=400' },
];

const EXPLORE_KEYWORDS = ['Eternal Sunshine Tour', 'Ariana Grande', 'Positions', 'Rain On Me', 'Sweetener'];

export default function ExploreV14() {
  return (
    <div className="min-h-screen bg-[#050505] p-8 font-mono">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-lg text-white font-bold uppercase tracking-widest mb-6 border-b border-neutral-800 pb-2">/ Global Trending</h2>
        
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-8">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[150px] h-[150px] shrink-0 cursor-pointer overflow-hidden border border-neutral-800 hover:border-neutral-500 transition-colors bg-neutral-900">
              <Image src={cat.image} alt={cat.title} fill className="object-cover opacity-50 group-hover:opacity-80 transition-opacity filter grayscale group-hover:grayscale-0" />
              <div className="absolute top-0 left-0 bg-black/80 px-2 py-1">
                <h3 className="font-bold text-white text-xs uppercase">{cat.title}</h3>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-xs font-bold text-neutral-400 border-l-2 border-neutral-700 bg-neutral-900 px-3 py-1.5 hover:text-white hover:border-white cursor-pointer transition-all">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
