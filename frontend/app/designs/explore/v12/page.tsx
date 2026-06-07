
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

export default function ExploreV12() {
  return (
    <div className="min-h-screen bg-[#000000] p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl text-white font-bold tracking-tight">Global Trending</h2>
        </div>
        
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-6">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[200px] h-[140px] shrink-0 rounded-2xl overflow-hidden cursor-pointer">
              <Image src={cat.image} alt={cat.title} fill className="object-cover opacity-80 group-hover:scale-105 group-hover:opacity-100 transition-all duration-500" />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
              <h3 className="absolute bottom-4 left-4 font-black text-white text-xl tracking-tight">{cat.title}</h3>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2.5">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-sm font-semibold text-neutral-300 bg-neutral-900 hover:bg-neutral-800 px-5 py-2 rounded-full cursor-pointer transition-colors border border-transparent hover:border-neutral-700">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
