import React, { useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';

const EXPLORE_CATEGORIES = [
  {
    id: 'news',
    title: 'World',
    image: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'technology',
    title: 'Technology',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'religion',
    title: 'Science',
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'business',
    title: 'Business',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'entertainment',
    title: 'Entertainment',
    image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=400',
  }
];

const EXPLORE_KEYWORDS = [
  'Politics', 'Startups', 'AI', 'Economy', 'Health', 'Sports', 'Elon Musk', 'SpaceX', 'Apple', 'Google'
];

export function ExploreHeader() {
  const categoriesRef = useRef<HTMLDivElement>(null);
  const keywordsRef = useRef<HTMLDivElement>(null);
  const { setExploreTopic, setExploreQuery } = useAppStore();

  const scrollCategories = (dir: 'left' | 'right') => {
    if (categoriesRef.current) {
      categoriesRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
    }
  };

  const scrollKeywords = (dir: 'left' | 'right') => {
    if (keywordsRef.current) {
      keywordsRef.current.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col border-b border-editorial-border bg-editorial-surface px-5 py-3 md:px-[20px] md:py-[10px] overflow-hidden relative min-h-[200px]">
      <h2 className="text-xl font-bold mb-3 tracking-wide text-editorial-ink font-serif">Explore Trending</h2>
      
      {/* Categories Carousel */}
      <div className="relative group mb-4">
        <div 
          ref={categoriesRef}
          className="flex overflow-x-auto gap-4 no-scrollbar scroll-smooth snap-x pb-2"
        >
          {EXPLORE_CATEGORIES.map((cat) => (
            <div 
              key={cat.id}
              onClick={() => setExploreTopic(cat.title)}
              className="relative min-w-[200px] md:min-w-[240px] h-[120px] rounded-2xl overflow-hidden snap-start cursor-pointer group/card shrink-0 border border-editorial-border"
            >
              <Image 
                src={cat.image} 
                alt={cat.title}
                fill
                sizes="(max-width: 768px) 200px, 240px"
                className="object-cover transition-transform duration-500 group-hover/card:scale-110"
                referrerPolicy="no-referrer"
              />
              {/* Dark overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              {/* Title */}
              <h3 className="absolute bottom-4 left-4 font-bold text-white text-lg tracking-wide shadow-black drop-shadow-md">
                {cat.title}
              </h3>
            </div>
          ))}
        </div>
        <button 
          onClick={() => scrollCategories('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2 h-10 w-10 rounded-full bg-white/90 shadow-md border border-editorial-border text-editorial-ink flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur hover:bg-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button 
          onClick={() => scrollCategories('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 -mr-2 h-10 w-10 rounded-full bg-white/90 shadow-md border border-editorial-border text-editorial-ink flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur hover:bg-white"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Keywords Carousel */}
      <div className="relative group">
        <div 
          ref={keywordsRef}
          className="flex overflow-x-auto gap-3 no-scrollbar scroll-smooth snap-x"
        >
          {EXPLORE_KEYWORDS.map((keyword, i) => (
            <button 
              key={i}
              onClick={() => setExploreQuery(keyword)}
              className="px-5 py-2 rounded-full border border-editorial-border text-editorial-muted text-sm font-medium whitespace-nowrap snap-start hover:bg-editorial-ink hover:text-white transition-colors"
            >
              {keyword}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
