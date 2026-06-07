
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

export default function ExploreV15() {
  return (
    <div className="min-h-screen bg-black p-8 font-sans">
      <div className="max-w-2xl mx-auto border-l-4 border-editorial-accent pl-6 py-2">
        <h2 className="text-2xl text-white font-extrabold tracking-wide mb-6">Global Trending</h2>
        
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[140px] h-[180px] shrink-0 rounded-lg overflow-hidden cursor-pointer shadow-[0_0_15px_rgba(111,63,245,0.15)] hover:shadow-[0_0_25px_rgba(111,63,245,0.4)] transition-shadow">
              <Image src={cat.image} alt={cat.title} fill className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-editorial-accent/80 via-transparent to-black/50" />
              <h3 className="absolute bottom-3 left-3 font-bold text-white text-lg">{cat.title}</h3>
            </div>
          ))}
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="whitespace-nowrap text-sm font-semibold text-editorial-accent border border-editorial-accent/30 px-5 py-2 rounded-full hover:bg-editorial-accent hover:text-white cursor-pointer transition-colors shadow-[0_0_10px_rgba(111,63,245,0.1)]">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
