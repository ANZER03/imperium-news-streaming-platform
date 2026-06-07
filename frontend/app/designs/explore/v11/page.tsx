
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

export default function ExploreV11() {
  return (
    <div className="min-h-screen bg-black p-8 font-sans">
      <div className="max-w-2xl mx-auto border border-neutral-800 pb-8 rounded-xl overflow-hidden">
        <div className="p-4 flex items-center gap-6">
          <ArrowLeft size={20} className="text-white cursor-pointer" />
          <h2 className="text-xl text-white font-bold tracking-wide">Global Trending</h2>
        </div>
        
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-4">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[130px] h-[160px] shrink-0 rounded-xl overflow-hidden cursor-pointer border border-neutral-800 hover:opacity-90 transition-opacity">
              <Image src={cat.image} alt={cat.title} fill className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/60" />
              <h3 className="absolute top-3 left-3 font-bold text-white text-[15px]">{cat.title}</h3>
            </div>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="whitespace-nowrap text-[13px] font-bold text-white border border-neutral-600 px-4 py-1.5 rounded-full hover:bg-neutral-800 cursor-pointer transition-colors">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
