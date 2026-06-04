'use client';

import React, { useState } from 'react';
import { Search, Compass, BookOpen, Film, Flame, ShieldAlert, Cpu, CalendarDays } from 'lucide-react';
import { mockArticles, mockCategories } from '../mockData';

// Map icons to categories
const CATEGORY_ICONS: Record<string, any> = {
  'Technology': Cpu,
  'Business & Economy': Flame,
  'Environment': Compass,
  'Science & Space': ShieldAlert, // fallback
  'Sports': Film, // fallback
  'Arts & Culture': BookOpen,
};

export default function SearchV3() {
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sliderIndex, setSliderIndex] = useState(4); // 0: 24h, 1: 7d, 2: 30d, 3: 365d, 4: All

  const timeOptions = [
    { label: 'Past 24h', days: 1 },
    { label: 'Past Week', days: 7 },
    { label: 'Past Month', days: 30 },
    { label: 'Past Year', days: 365 },
    { label: 'All History', days: 9999 },
  ];

  const currentOption = timeOptions[sliderIndex];

  const filtered = mockArticles.filter(art => {
    // Keyword match
    const matchKeyword = keyword.trim() === '' || 
      art.title.toLowerCase().includes(keyword.toLowerCase()) || 
      art.excerpt.toLowerCase().includes(keyword.toLowerCase());

    if (!matchKeyword) return false;

    // Category match
    if (selectedCategory && art.topic !== selectedCategory) return false;

    // Time match
    const diffDays = (Date.now() - art.publishedAt.getTime()) / (24 * 3600 * 1000);
    if (diffDays > currentOption.days) return false;

    return true;
  });

  return (
    <div className="w-full min-h-screen bg-white text-editorial-ink p-6 md:p-12 relative flex items-center justify-center">
      <div className="absolute inset-0 bg-editorial-surface/80 backdrop-blur-md z-0" />

      {/* Main Dialog */}
      <div className="relative z-10 w-full max-w-4xl bg-white border border-editorial-border rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[85vh] max-h-[800px]">
        
        {/* Left Side: Controls & Browsing */}
        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-editorial-border overflow-y-auto no-scrollbar">
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-editorial-accent">EXPLORE PORTAL</span>
              <h2 className="text-2xl font-serif font-bold text-editorial-ink mt-1">Topic & Time Navigator</h2>
            </div>

            {/* Keyword Search Input */}
            <div className="relative bg-editorial-surface rounded-2xl p-1 border border-editorial-border focus-within:border-editorial-accent transition-colors flex items-center">
              <Search className="w-5 h-5 text-editorial-muted ml-3 shrink-0" />
              <input
                type="text"
                placeholder="Type query to filter..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full bg-transparent border-0 outline-none text-sm p-2 text-editorial-ink placeholder:text-editorial-muted/50"
              />
            </div>

            {/* Category Grid */}
            <div>
              <div className="flex justify-between items-baseline mb-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-editorial-muted">Filter by Category</span>
                {selectedCategory && (
                  <button 
                    onClick={() => setSelectedCategory(null)}
                    className="text-[10px] font-semibold text-editorial-accent hover:underline"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {mockCategories.map(cat => {
                  const Icon = CATEGORY_ICONS[cat] || Compass;
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(isSelected ? null : cat)}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between h-20 transition-all ${
                        isSelected
                          ? 'bg-[#6F3FF5] text-white border-transparent shadow-lg shadow-brand-500/25 scale-[1.02]'
                          : 'bg-editorial-surface/50 border-editorial-border hover:bg-editorial-surface text-editorial-ink hover:border-editorial-accent'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-editorial-accent'}`} />
                      <span className="text-xs font-semibold leading-tight">{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Graphical Time Slider */}
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-editorial-muted block mb-3 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-editorial-accent" />
                Time Boundary: <strong className="text-editorial-ink font-semibold">{currentOption.label}</strong>
              </span>
              <div className="relative py-4 px-1">
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={sliderIndex}
                  onChange={(e) => setSliderIndex(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-editorial-border rounded-lg appearance-none cursor-pointer accent-[#6F3FF5]"
                />
                <div className="flex justify-between text-[10px] text-editorial-muted font-bold mt-2 font-mono">
                  <span>24H</span>
                  <span>1W</span>
                  <span>1M</span>
                  <span>1Y</span>
                  <span>ALL</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-editorial-muted mt-6 pt-4 border-t border-editorial-border flex justify-between">
            <span>Select category card + slide time scale</span>
            <span>Imperium Search Hub</span>
          </div>
        </div>

        {/* Right Side: Dynamic Results Display */}
        <div className="w-full md:w-1/2 p-6 md:p-8 bg-editorial-surface/30 overflow-y-auto no-scrollbar flex flex-col">
          <div className="border-b border-editorial-border pb-3 mb-4 flex justify-between items-baseline shrink-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-editorial-muted">Matching Articles ({filtered.length})</span>
          </div>

          {filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <Compass className="w-10 h-10 text-editorial-muted/30 mb-2" />
              <p className="text-sm font-semibold text-editorial-ink">No Matches Found</p>
              <p className="text-xs text-editorial-muted mt-1 max-w-[200px]">Adjust category or drag the time slider to expand range.</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto pr-1 no-scrollbar">
              {filtered.map(art => (
                <div
                  key={art.id}
                  className="bg-white border border-editorial-border p-3.5 rounded-2xl hover:border-editorial-accent hover:shadow-md transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#6F3FF5] bg-brand-50 dark:bg-brand-900/10 px-2 py-0.5 rounded-md">
                      {art.topic}
                    </span>
                    <span className="text-[10px] text-editorial-muted">
                      {art.publishedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-editorial-ink mt-2 leading-snug group-hover:text-editorial-accent transition-colors line-clamp-2">
                    {art.title}
                  </h4>
                  <p className="text-[11px] text-editorial-muted mt-1 line-clamp-2 leading-relaxed">
                    {art.excerpt}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
