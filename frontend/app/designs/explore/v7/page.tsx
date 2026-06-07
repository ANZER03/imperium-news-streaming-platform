
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

export default function ExploreV7() {
  return (
    <div className="min-h-screen bg-[#F4F0EA] p-8 font-serif text-[#2C2825]">
      <div className="max-w-5xl mx-auto border-t-2 border-b-2 border-[#2C2825] py-8">
        <h2 className="text-center text-4xl uppercase tracking-[0.3em] border-b border-dashed border-[#2C2825] pb-6 mb-8">
          The Explore Section
        </h2>
        
        <div className="flex gap-8 overflow-x-auto no-scrollbar pb-8">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[220px] shrink-0 cursor-pointer flex flex-col items-center text-center">
              <div className="relative w-full aspect-[3/4] border border-[#2C2825] p-2 bg-white shadow-[4px_4px_0_0_#2C2825] group-hover:-translate-y-2 group-hover:shadow-[6px_6px_0_0_#2C2825] transition-all">
                <div className="relative w-full h-full overflow-hidden filter sepia-[0.5] contrast-125 group-hover:sepia-0 transition-all duration-500">
                  <Image src={cat.image} alt={cat.title} fill className="object-cover" />
                </div>
              </div>
              <h3 className="text-xl font-bold uppercase mt-6 tracking-widest">{cat.short}</h3>
              <div className="w-12 h-0.5 bg-[#2C2825] mt-3" />
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-dashed border-[#2C2825] flex justify-center flex-wrap gap-x-8 gap-y-4">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-sm font-bold uppercase tracking-widest hover:text-[#6F3FF5] cursor-pointer transition-colors">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
