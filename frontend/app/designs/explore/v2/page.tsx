
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

export default function ExploreV2() {
  return (
    <div className="min-h-screen bg-[#FFFDF9] p-8 font-sans">
      <div className="max-w-5xl mx-auto border-4 border-black p-8 bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-end justify-between mb-8 border-b-4 border-black pb-4">
          <h2 className="text-5xl font-black uppercase tracking-tighter text-black">Explore</h2>
          <span className="text-xl font-bold bg-[#6F3FF5] text-white px-4 py-1 border-2 border-black">TRENDING NOW</span>
        </div>
        
        <div className="flex gap-6 overflow-x-auto no-scrollbar pb-8 snap-x">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[260px] h-[320px] shrink-0 border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 transition-all cursor-pointer snap-center overflow-hidden flex flex-col">
              <div className="relative w-full h-[60%] border-b-4 border-black">
                <Image src={cat.image} alt={cat.title} fill className="object-cover" />
              </div>
              <div className="p-4 flex-1 flex items-center bg-[#E6EDFF] group-hover:bg-[#6F3FF5] transition-colors">
                <h3 className="font-black text-2xl text-black group-hover:text-white uppercase leading-none">{cat.title}</h3>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar mt-4">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="whitespace-nowrap text-lg font-bold text-black border-2 border-black px-4 py-2 bg-yellow-300 hover:bg-yellow-400 cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
              {kw.toUpperCase()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
