
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

export default function ExploreV13() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8 font-sans">
      <div className="max-w-2xl mx-auto bg-[#121212] rounded-3xl p-6 border border-white/5 shadow-2xl">
        <h2 className="text-xl text-white font-semibold mb-6 flex items-center gap-3">
          <span className="w-1.5 h-6 bg-blue-500 rounded-full" /> Global Trending
        </h2>
        
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[160px] h-[200px] shrink-0 rounded-2xl overflow-hidden cursor-pointer shadow-lg">
              <Image src={cat.image} alt={cat.title} fill className="object-cover" />
              <div className="absolute bottom-0 w-full p-3 bg-black/40 backdrop-blur-md border-t border-white/10">
                <h3 className="font-semibold text-white text-sm text-center">{cat.title}</h3>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="whitespace-nowrap text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl hover:bg-blue-500/20 cursor-pointer transition-colors">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
