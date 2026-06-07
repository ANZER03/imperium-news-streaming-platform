
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

export default function ExploreV3() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-editorial-surface to-editorial-bg p-8 font-sans relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-editorial-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="max-w-6xl mx-auto relative z-10">
        <h2 className="text-2xl font-semibold text-editorial-ink mb-10 pl-4 border-l-4 border-editorial-accent">Discover Topics</h2>
        
        <div className="flex gap-8 overflow-x-auto no-scrollbar pb-12 pt-4 px-4">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[200px] h-[280px] shrink-0 rounded-full bg-white/60 backdrop-blur-md border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.05)] hover:shadow-[0_16px_48px_rgba(111,63,245,0.15)] hover:-translate-y-2 transition-all cursor-pointer p-2 flex flex-col items-center">
              <div className="relative w-full aspect-square rounded-full overflow-hidden shadow-inner mb-6">
                <Image src={cat.image} alt={cat.title} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <h3 className="font-medium text-center text-editorial-ink px-4">{cat.short}</h3>
              <div className="mt-auto mb-4 w-8 h-8 rounded-full bg-editorial-surface flex items-center justify-center text-editorial-accent opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight size={16} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-3 mt-4">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-sm font-medium text-editorial-muted bg-white/50 backdrop-blur border border-white/60 px-5 py-2 rounded-2xl hover:bg-white hover:text-editorial-accent cursor-pointer shadow-sm transition-all">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
