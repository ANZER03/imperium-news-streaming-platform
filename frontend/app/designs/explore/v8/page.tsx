
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

export default function ExploreV8() {
  return (
    <div className="min-h-screen bg-editorial-bg p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-editorial-ink mb-8">Focus Areas</h2>
        
        <div className="flex h-[400px] w-full gap-2 overflow-hidden">
          {EXPLORE_CATEGORIES.map((cat, i) => (
            <div key={cat.id} className="group relative flex-1 hover:flex-[3] transition-all duration-700 ease-in-out cursor-pointer rounded-2xl overflow-hidden bg-editorial-surface border border-editorial-border">
              <Image src={cat.image} alt={cat.title} fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              
              {/* Collapsed view */}
              <div className="absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition-opacity duration-300 bg-black/40">
                <h3 className="text-white font-bold tracking-widest uppercase origin-center -rotate-90 whitespace-nowrap">{cat.short}</h3>
              </div>

              {/* Expanded view */}
              <div className="absolute bottom-0 left-0 p-8 w-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100 flex justify-between items-end">
                <div>
                  <span className="text-editorial-accent font-bold mb-2 block">0{i+1}</span>
                  <h3 className="font-serif text-4xl text-white mb-2">{cat.title}</h3>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                  <ArrowRight size={20} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-4 mt-8">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="px-4 py-2 bg-editorial-surface rounded-lg text-sm font-medium text-editorial-muted hover:text-editorial-ink hover:bg-editorial-border cursor-pointer transition-colors">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
