'use client';

import React, { useState } from 'react';
import { Search, X, Activity } from 'lucide-react';
import { mockArticles, mockTrendingKeywords } from '../mockData';

export default function SearchV9() {
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
    <div className="w-full min-h-screen bg-[#F0FDF4] text-[#14532D] font-serif p-6 md:p-12">
      <div className="fixed inset-0 bg-[#064E3B]/50 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 z-40">
        <div className="bg-[#F0FDF4] border-l-8 border-[#14532D] w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col p-6 md:p-10 relative">
          
          <div className="flex justify-between items-center border-b border-[#14532D]/20 pb-4 mb-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#14532D] italic">The Sylvian Post — Inquiry</h2>
            <button className="text-[#14532D] hover:bg-[#14532D] hover:text-[#F0FDF4] rounded-full p-2 transition-colors" onClick={() => setKeyword('')}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            
            {/* Left side: Inputs & Filters */}
            <div className="space-y-8">
              
              <div className="relative border-b-2 border-[#14532D] py-2 focus-within:border-[#16A34A] transition-colors">
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full bg-transparent outline-none text-xl font-medium placeholder:text-[#14532D]/40 pr-10"
                />
                <Search className="absolute right-2 top-3 w-5 h-5 text-[#14532D]/60" />
              </div>

              <div>
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#16A34A] block mb-3">Time Range</span>
                <div className="flex gap-2 text-xs font-sans font-bold flex-wrap">
                  {[
                    { key: 'all', label: 'All Time' },
                    { key: '24h', label: '24 Hours' },
                    { key: '7d', label: '7 Days' },
                  ].map((btn) => (
                    <button
                      key={btn.key}
                      onClick={() => setTimeFilter(btn.key as any)}
                      className={`px-4 py-2 rounded-full border border-[#14532D] transition-colors ${
                        timeFilter === btn.key ? 'bg-[#14532D] text-[#F0FDF4]' : 'hover:bg-[#14532D]/5 text-[#14532D]'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#16A34A] block mb-3">Trending Now</span>
                <div className="flex flex-wrap gap-2 font-sans">
                  {mockTrendingKeywords.map((kw, i) => (
                    <button
                      key={i}
                      onClick={() => setKeyword(kw)}
                      className="text-xs uppercase font-bold text-[#14532D] underline decoration-[#14532D]/30 hover:decoration-[#14532D] hover:text-[#16A34A] transition-colors"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Right side: Results & Horizontal Sentiment (Span 2) */}
            <div className="md:col-span-2 flex flex-col h-full">
              
              {/* Horizontal Sentiment Bar */}
              <div className="mb-6 bg-[#14532D]/5 p-4 rounded-lg border border-[#14532D]/10">
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#16A34A] flex items-center gap-1.5 mb-2">
                  <Activity className="w-3.5 h-3.5" /> Aggregate Sentiment
                </span>
                <div className="flex gap-4 font-sans text-xs font-bold uppercase items-center">
                  {['Positive', 'Neutral', 'Negative'].map(s => {
                    const count = sentimentCounts[s] || 0;
                    const pct = totalResults === 0 ? 0 : Math.round((count / totalResults) * 100);
                    return (
                      <div key={s} className="flex-1 flex flex-col gap-1">
                        <div className="flex justify-between">
                          <span className="text-[#14532D]">{s}</span>
                          <span className="text-[#16A34A]">{pct}%</span>
                        </div>
                        <div className="w-full bg-[#14532D]/10 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${s === 'Positive' ? 'bg-[#22C55E]' : s === 'Negative' ? 'bg-[#DC2626]' : 'bg-[#94A3B8]'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Results List */}
              <div className="flex-1 space-y-4">
                <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#14532D]/60 block border-b border-[#14532D]/10 pb-1">
                  Query Results ({filtered.length})
                </span>
                
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                  {filtered.map(art => (
                    <div key={art.id} className="border-b border-[#14532D]/10 pb-4 last:border-0 group">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs font-sans font-bold text-[#16A34A] uppercase tracking-wider">{art.topic}</span>
                        <span className="text-xs font-sans text-[#14532D]/60">
                          {art.publishedAt.toLocaleDateString('en-US')}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold leading-tight mt-1 text-[#14532D] group-hover:text-[#16A34A] cursor-pointer">
                        {art.title}
                      </h4>
                      <p className="text-sm text-[#14532D]/80 font-sans mt-1 line-clamp-2">{art.excerpt}</p>
                    </div>
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
