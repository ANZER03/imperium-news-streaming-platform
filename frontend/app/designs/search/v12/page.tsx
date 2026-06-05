'use client';

import React, { useState } from 'react';
import { Search, ArrowRight, X, BarChart } from 'lucide-react';
import { mockArticles, mockRecentSearches, mockTrendingKeywords } from '../mockData';

export default function SearchV12() {
  const [keyword, setKeyword] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | '24h' | '7d'>('all');

  const filtered = mockArticles.filter(art => {
    const matchKeyword = keyword.trim() === '' || 
      art.title.toLowerCase().includes(keyword.toLowerCase()) || 
      art.excerpt.toLowerCase().includes(keyword.toLowerCase()) ||
      art.topic.toLowerCase().includes(keyword.toLowerCase());

    if (!matchKeyword) return false;

    const diffMs = Date.now() - art.publishedAt.getTime();
    if (timeFilter === '24h') return diffMs <= 24 * 3600 * 1000;
    if (timeFilter === '7d') return diffMs <= 7 * 24 * 3600 * 1000;
    return true;
  });

  const totalResults = filtered.length;
  const sentimentCounts = filtered.reduce((acc, art) => {
    const s = art.sentiment || 'Neutral';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="w-full min-h-screen bg-[#FCFAF7] text-[#16131D] font-serif p-6 md:p-12 flex items-center justify-center">
      
      {/* BroadSheet Dialog Overlay */}
      <div className="bg-[#FCFAF7] border-4 border-[#16131D] w-full max-w-6xl max-h-[85vh] overflow-y-auto shadow-[8px_8px_0px_#16131D] flex flex-col p-6 md:p-10 relative">
        
        {/* Header */}
        <div className="flex justify-between items-baseline border-b border-[#16131D]/20 pb-4 mb-6">
          <div>
            <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E6A7A]">OP.01 / LEFT THUMBNAIL</span>
            <h2 className="text-3xl font-extrabold tracking-tight mt-1">Archival Search</h2>
          </div>
          <button className="text-[#16131D] hover:opacity-75 transition-opacity" onClick={() => setKeyword('')}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Left Column: Filters */}
          <div className="space-y-6 md:border-r border-[#16131D]/20 pr-6">
            
            <div className="relative border-b-2 border-[#16131D] py-2 focus-within:border-[#6F3FF5] transition-colors">
              <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#6E6A7A] block mb-1">Keywords</span>
              <input
                type="text"
                placeholder="Search..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full bg-transparent outline-none text-base placeholder:text-[#16131D]/30 pr-8"
              />
              <Search className="absolute right-0 bottom-2 w-4 h-4 text-[#16131D]/60" />
            </div>

            <div>
              <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#6E6A7A] block mb-3">Temporal Filter</span>
              <div className="flex flex-col gap-2 text-xs font-sans font-bold">
                {[
                  { key: 'all', label: 'All Time' },
                  { key: '24h', label: 'Past 24 Hours' },
                  { key: '7d', label: 'Past 7 Days' },
                ].map((btn) => (
                  <button
                    key={btn.key}
                    onClick={() => setTimeFilter(btn.key as any)}
                    className={`text-left px-2 py-1.5 border border-[#16131D] transition-colors ${
                      timeFilter === btn.key 
                        ? 'bg-[#16131D] text-[#FCFAF7]' 
                        : 'hover:bg-[#16131D]/5'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Middle Column: Results List (Span 2) */}
          <div className="md:col-span-2 space-y-4">
            <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#6E6A7A] block border-b border-[#16131D]/10 pb-1">
              Query Results ({filtered.length})
            </span>
            
            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 no-scrollbar">
              {filtered.map(art => (
                <div key={art.id} className="border-b border-[#16131D]/10 pb-4 last:border-0 group flex gap-4">
                  {art.imageUrl && (
                    <div className="w-20 h-20 bg-[#16131D]/5 border border-[#16131D]/20 overflow-hidden shrink-0">
                      <img 
                        src={art.imageUrl} 
                        alt={art.title} 
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-sans font-bold text-[#6F3FF5] uppercase tracking-wider">{art.topic}</span>
                      <span className="text-[10px] font-sans text-[#6E6A7A]">
                        {art.publishedAt.toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-base font-bold leading-tight mt-1 group-hover:underline cursor-pointer">
                      {art.title}
                    </h4>
                    <p className="text-xs text-[#6E6A7A] font-sans mt-1 line-clamp-2">{art.excerpt}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Sentiment & Trends */}
          <div className="md:border-l border-[#16131D]/20 md:pl-6 space-y-8">
            
            <div className="bg-[#16131D]/5 border border-[#16131D]/10 p-4">
              <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#16131D] block mb-3 flex items-center gap-1.5 border-b border-[#16131D]/20 pb-1">
                <BarChart className="w-3.5 h-3.5" /> Sentiment Analysis
              </span>
              <div className="space-y-3 font-sans">
                {['Positive', 'Neutral', 'Negative'].map(s => {
                  const count = sentimentCounts[s] || 0;
                  const pct = totalResults === 0 ? 0 : Math.round((count / totalResults) * 100);
                  return (
                    <div key={s}>
                      <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                        <span className="text-[#16131D]">{s}</span>
                        <span className="text-[#6F3FF5]">{pct}%</span>
                      </div>
                      <div className="w-full bg-[#16131D]/10 h-1.5 border border-[#16131D]/20">
                        <div 
                          className="h-full bg-[#6F3FF5]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#6E6A7A] block mb-3">Trending Searches</span>
              <div className="space-y-2">
                {mockTrendingKeywords.map((kw, i) => (
                  <button
                    key={i}
                    onClick={() => setKeyword(kw)}
                    className="flex items-center justify-between w-full text-left text-sm font-bold border-b border-[#16131D]/10 py-1 hover:text-[#6F3FF5] transition-colors group"
                  >
                    <span>{kw}</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
