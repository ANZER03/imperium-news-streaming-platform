'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ChevronDown, Globe } from 'lucide-react';
import { topicService } from '@/lib/services/topic.service';
import { countryService } from '@/lib/services/country.service';
import { Topic, Country } from '@/lib/types';

// Fallback image source for flags that work across all browsers & OS
const FlagImage = ({ code, alt }: { code: string; alt: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
    width="18"
    height="13"
    alt={alt}
    className="inline-block object-cover rounded-[2px] shadow-sm"
    style={{ width: '18px', height: '13px' }}
  />
);

// A few fake images to cycle through for topics
const FAKE_IMAGES = [
  'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&q=80&w=400',
];

const EXPLORE_KEYWORDS: ReadonlyArray<string> = [
  'Eternal Sunshine Tour',
  'Ariana Grande',
  'Positions',
  'Rain On Me',
  'Sweetener'
];

export function ExploreHeader() {
  const categoriesRef = useRef<HTMLDivElement>(null);
  const keywordsRef = useRef<HTMLDivElement>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<number | 'global'>('global');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      topicService.getAll(),
      countryService.getAll()
    ]).then(([tData, cData]) => {
      setTopics(tData);
      setCountries(cData);
    }).catch(() => {});
  }, []);

  const scrollCategories = (dir: 'left' | 'right') => {
    if (categoriesRef.current) {
      categoriesRef.current.scrollBy({
        left: dir === 'left' ? -300 : 300,
        behavior: 'smooth',
      });
    }
  };

  if (topics.length === 0) return null; // hide while loading

  return (
    <div className="flex flex-col border-b border-editorial-border bg-editorial-surface px-5 py-5 md:px-[20px] md:py-[16px] overflow-hidden relative min-h-[160px]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold tracking-tight text-editorial-ink font-sans">
          Global Trending
        </h2>

        {/* Country Selector */}
        <div className="relative">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 bg-editorial-bg hover:bg-editorial-border border border-editorial-border transition-colors rounded-full px-2.5 py-1.5 text-sm font-medium text-editorial-ink"
            aria-label="Select Country"
          >
            {selectedCountry === 'global' ? (
              <Globe className="w-4 h-4 text-[#1d9bf0]" />
            ) : (
              <FlagImage 
                code={countries.find(c => c.countryId === selectedCountry)?.abbreviation || ''} 
                alt="Selected Country Flag" 
              />
            )}
            <ChevronDown className="w-4 h-4 text-editorial-muted" />
          </button>
          
          {isDropdownOpen && (
            <>
              {/* Invisible backdrop to close dropdown on click outside */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsDropdownOpen(false)} 
              />
              <div className="absolute right-0 mt-2 w-48 bg-editorial-bg border border-editorial-border rounded-xl shadow-lg overflow-y-auto max-h-64 z-50">
                <button
                  onClick={() => {
                    setSelectedCountry('global');
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-editorial-surface transition-colors ${selectedCountry === 'global' ? 'bg-editorial-surface font-semibold' : ''}`}
                >
                  <Globe className="w-4 h-4 text-[#1d9bf0]" />
                  <span className="text-editorial-ink">Global</span>
                </button>
                {countries.map(c => (
                  <button
                    key={c.countryId}
                    onClick={() => {
                      setSelectedCountry(c.countryId);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-editorial-surface transition-colors ${selectedCountry === c.countryId ? 'bg-editorial-surface font-semibold' : ''}`}
                  >
                    <FlagImage code={c.abbreviation} alt={c.countryName} />
                    <span className="text-editorial-ink">{c.countryName}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Categories Carousel */}
      <div className="relative group mb-4">
        <div
          ref={categoriesRef}
          className="flex overflow-x-auto gap-3 no-scrollbar scroll-smooth snap-x pb-2"
        >
          {topics.map((topic, i) => {
            const image = FAKE_IMAGES[i % FAKE_IMAGES.length];
            return (
              <Link
                key={topic.topicId}
                href={`/topic/${topic.topicId}`}
                className="relative min-w-[200px] h-[140px] shrink-0 rounded-2xl overflow-hidden snap-start cursor-pointer group/card block"
              >
                <Image
                  src={image}
                  alt={topic.displayName}
                  fill
                  sizes="(max-width: 768px) 200px, 200px"
                  className="object-cover opacity-80 group-hover/card:scale-105 group-hover/card:opacity-100 transition-all duration-500"
                  referrerPolicy="no-referrer"
                />
                {/* Dark overlay for readability */}
                <div className="absolute inset-0 bg-black/40 group-hover/card:bg-black/20 transition-colors" />
                {/* Title */}
                <h3 className="absolute bottom-4 left-4 font-black text-white text-xl tracking-tight drop-shadow-md">
                  {topic.displayName}
                </h3>
              </Link>
            );
          })}
        </div>
        <button
          onClick={() => scrollCategories('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2 h-10 w-10 rounded-full bg-editorial-bg shadow-md border border-editorial-border text-editorial-ink flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur hover:bg-editorial-surface"
          aria-label="Scroll categories left"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => scrollCategories('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 -mr-2 h-10 w-10 rounded-full bg-editorial-bg shadow-md border border-editorial-border text-editorial-ink flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur hover:bg-editorial-surface"
          aria-label="Scroll categories right"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Keywords Carousel */}
      <div className="relative group">
        <div
          ref={keywordsRef}
          className="flex overflow-x-auto gap-2 no-scrollbar scroll-smooth snap-x pb-1"
        >
          {EXPLORE_KEYWORDS.map((keyword) => (
            <Link
              key={keyword}
              href={`/search?q=${encodeURIComponent(keyword)}`}
              className="text-sm font-semibold text-editorial-ink bg-transparent hover:bg-editorial-surface px-4 py-1.5 rounded-full cursor-pointer transition-colors border border-editorial-border whitespace-nowrap snap-start"
            >
              {keyword}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
