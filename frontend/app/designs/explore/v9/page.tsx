
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

export default function ExploreV9() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] p-8 font-mono">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-[#6F3FF5] text-sm mb-6 flex items-center gap-4">
          <span className="w-2 h-2 bg-[#6F3FF5] rounded-full animate-pulse" />
          SYSTEM_EXPLORE_MODULE
        </h2>
        
        <div className="flex gap-6 overflow-x-auto no-scrollbar pb-8">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[280px] h-[320px] shrink-0 cursor-pointer bg-[#111] border border-[#222] hover:border-[#6F3FF5] transition-colors p-4 flex flex-col">
              <div className="relative w-full flex-1 overflow-hidden opacity-50 group-hover:opacity-100 transition-opacity filter grayscale group-hover:grayscale-0">
                <Image src={cat.image} alt={cat.title} fill className="object-cover" />
                <div className="absolute inset-0 bg-[#6F3FF5]/10 group-hover:bg-transparent transition-colors" />
              </div>
              <div className="pt-4 mt-4 border-t border-[#222] group-hover:border-[#6F3FF5]/50 transition-colors flex justify-between items-center">
                <h3 className="text-white text-lg tracking-wider uppercase">{cat.short}</h3>
                <span className="text-neutral-500 text-xs">[{cat.id}]</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-xs text-neutral-400 bg-[#111] border border-[#222] px-4 py-3 hover:text-[#6F3FF5] hover:border-[#6F3FF5]/50 cursor-pointer transition-colors text-center uppercase tracking-widest">
              {'>'} {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
