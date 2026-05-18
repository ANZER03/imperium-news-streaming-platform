'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Curated explore tiles. The `id` is the backend topic id used in `/topic/[id]`.
 * The `title` is the human-readable label rendered on the card.
 */
const EXPLORE_CATEGORIES: ReadonlyArray<{
  id: string;
  title: string;
  image: string;
}> = [
  {
    id: 'politics_government',
    title: 'World',
    image:
      'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'science_technology',
    title: 'Technology',
    image:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'science_technology',
    title: 'Science',
    image:
      'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'business_economy',
    title: 'Business',
    image:
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'entertainment_culture',
    title: 'Entertainment',
    image:
      'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=400',
  },
];

const EXPLORE_KEYWORDS: ReadonlyArray<string> = [
  'Politics',
  'Startups',
  'AI',
  'Economy',
  'Health',
  'Sports',
  'Elon Musk',
  'SpaceX',
  'Apple',
  'Google',
];

export function ExploreHeader() {
  const categoriesRef = useRef<HTMLDivElement>(null);
  const keywordsRef = useRef<HTMLDivElement>(null);

  const scrollCategories = (dir: 'left' | 'right') => {
    if (categoriesRef.current) {
      categoriesRef.current.scrollBy({
        left: dir === 'left' ? -300 : 300,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="flex flex-col border-b border-editorial-border bg-editorial-surface px-5 py-3 md:px-[20px] md:py-[10px] overflow-hidden relative min-h-[200px]">
      <h2 className="text-xl font-bold mb-3 tracking-wide text-editorial-ink font-serif">
        Explore Trending
      </h2>

      {/* Categories Carousel */}
      <div className="relative group mb-4">
        <div
          ref={categoriesRef}
          className="flex overflow-x-auto gap-4 no-scrollbar scroll-smooth snap-x pb-2"
        >
          {EXPLORE_CATEGORIES.map((cat) => (
            <Link
              key={`${cat.id}-${cat.title}`}
              href={`/topic/${cat.id}`}
              className="relative min-w-[200px] md:min-w-[240px] h-[120px] rounded-2xl overflow-hidden snap-start cursor-pointer group/card shrink-0 border border-editorial-border block"
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
            </Link>
          ))}
        </div>
        <button
          onClick={() => scrollCategories('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2 h-10 w-10 rounded-full bg-white/90 shadow-md border border-editorial-border text-editorial-ink flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur hover:bg-white"
          aria-label="Scroll categories left"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => scrollCategories('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 -mr-2 h-10 w-10 rounded-full bg-white/90 shadow-md border border-editorial-border text-editorial-ink flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur hover:bg-white"
          aria-label="Scroll categories right"
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
          {EXPLORE_KEYWORDS.map((keyword) => (
            <Link
              key={keyword}
              href={`/search?q=${encodeURIComponent(keyword)}`}
              className="px-5 py-2 rounded-full border border-editorial-border text-editorial-muted text-sm font-medium whitespace-nowrap snap-start hover:bg-editorial-ink hover:text-white transition-colors"
            >
              {keyword}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
