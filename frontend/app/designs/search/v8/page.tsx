'use client';

import React, { useState } from 'react';
import { Search, ArrowRight, X, BarChart } from 'lucide-react';
import { mockArticles, mockTrendingKeywords } from '../mockData';

export default function SearchV8() {
  const [keyword, setKeyword] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | '24h' | '7d'>('all');

  const filtered = mockArticles.filter(art => {
    const matchKeyword = keyword.trim() === '' || 
      art.title.toLowerCase().includes(keyword.toLowerCase()) || 
      art.excerpt.toLowerCase().includes(keyword.toLowerCase());

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
    <div className="w-full min-h-screen bg-[#FEF3C7] text-[#451A03] font-serif p-6 md:p-12">
      <div className="fixed inset-0 bg-[#451A03]/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 z-40">
        <div className="bg-[#FFFBEB] border-[6px] border-[#7F1D1D] w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-[12px_12px_0px_#451A03] flex flex-col p-6 md:p-10 relative">
          
          <div className="flex justify-between items-baseline border-b-2 border-[#7F1D1D] pb-4 mb-6">
            <div>
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.3em] text-[#B91C1C]">SEARCH PROTOCOL</span>
              <h2 className="text-4xl font-extrabold tracking-tight mt-1 text-[#451A03]">The Crimson Ledger</h2>
            </div>
            <button className="text-[#7F1D1D] hover:bg-[#7F1D1D] hover:text-[#FFFBEB] border-2 border-transparent hover:border-[#7F1D1D] transition-colors p-1" onClick={() => setKeyword('')}>
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            
            {/* Left Column: Filters */}
            <div className="space-y-8 border-r border-[#451A03]/20 pr-6">
              
              <div className="relative border-b-2 border-[#451A03] py-2">
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#7F1D1D] block mb-2">Query</span>
                <input
                  type="text"
                  placeholder="Keywords..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full bg-transparent outline-none text-xl font-medium placeholder:text-[#451A03]/30 pr-8"
                />
                <Search className="absolute right-0 bottom-3 w-5 h-5 text-[#451A03]/60" />
              </div>

              <div>
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#7F1D1D] block mb-3">Timeframe</span>
                <div className="flex flex-col gap-2 text-xs font-sans font-bold">
                  {[
                    { key: 'all', label: 'All Archives' },
                    { key: '24h', label: 'Last 24 Hours' },
                    { key: '7d', label: 'Last 7 Days' },
                  ].map((btn) => (
                    <button
                      key={btn.key}
                      onClick={() => setTimeFilter(btn.key as any)}
                      className={`text-left px-3 py-2 border-l-4 transition-colors ${
                        timeFilter === btn.key ? 'border-[#7F1D1D] bg-[#7F1D1D]/10 text-[#7F1D1D]' : 'border-transparent hover:bg-[#451A03]/5 text-[#451A03]'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Middle Column: Results (Span 2) */}
            <div className="md:col-span-2 space-y-4 pr-4">
              <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#7F1D1D] block border-b-2 border-[#451A03]/10 pb-1">
                Articles Found ({filtered.length})
              </span>
              
              <div className="space-y-6 max-h-[400px] overflow-y-auto pr-4 no-scrollbar">
                {filtered.map(art => (
                  <div key={art.id} className="border-b border-[#451A03]/10 pb-4 last:border-0 group">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[10px] font-sans font-bold text-[#B91C1C] uppercase tracking-widest bg-[#7F1D1D]/10 px-1.5 py-0.5">{art.topic}</span>
                      <span className="text-[10px] font-sans font-bold text-[#451A03]/60 uppercase tracking-widest">
                        {art.publishedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <h4 className="text-xl font-bold leading-tight mt-2 text-[#451A03] group-hover:text-[#7F1D1D] cursor-pointer decoration-2 underline-offset-4 group-hover:underline">
                      {art.title}
                    </h4>
                    <p className="text-sm text-[#451A03]/80 font-sans mt-2 line-clamp-3 leading-relaxed">{art.excerpt}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Sentiment & Trends */}
            <div className="border-t md:border-t-0 md:border-l border-[#451A03]/20 pt-6 md:pt-0 md:pl-6 space-y-8">
              
              <div className="bg-[#7F1D1D]/5 p-4 border border-[#7F1D1D]/20">
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#7F1D1D] block mb-4 flex items-center gap-1.5 border-b border-[#7F1D1D]/20 pb-2">
                  <BarChart className="w-3.5 h-3.5" /> Sentiment Index
                </span>
                <div className="space-y-4 font-sans">
                  {['Positive', 'Neutral', 'Negative'].map(s => {
                    const count = sentimentCounts[s] || 0;
                    const pct = totalResults === 0 ? 0 : Math.round((count / totalResults) * 100);
                    return (
                      <div key={s}>
                        <div className="flex justify-between text-[10px] font-bold uppercase mb-1.5">
                          <span className="text-[#451A03]">{s}</span>
                          <span className="text-[#7F1D1D]">{pct}%</span>
                        </div>
                        <div className="w-full bg-[#451A03]/10 h-2 border border-[#451A03]/20">
                          <div 
                            className={`h-full ${s === 'Positive' ? 'bg-[#15803D]' : s === 'Negative' ? 'bg-[#B91C1C]' : 'bg-[#78716C]'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#7F1D1D] block mb-3 border-b border-[#451A03]/10 pb-1">Hot Topics</span>
                <div className="flex flex-wrap gap-2 font-sans">
                  {mockTrendingKeywords.map((kw, i) => (
                    <button
                      key={i}
                      onClick={() => setKeyword(kw)}
                      className="text-[10px] uppercase font-bold px-2 py-1 border border-[#451A03]/20 hover:border-[#7F1D1D] hover:text-[#7F1D1D] transition-colors"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
