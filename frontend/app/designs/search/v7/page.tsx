'use client';

import React, { useState } from 'react';
import { Search, ArrowRight, X, PieChart } from 'lucide-react';
import { mockArticles, mockRecentSearches, mockTrendingKeywords } from '../mockData';

export default function SearchV7() {
  const [keyword, setKeyword] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | '24h' | '7d' | '365d' | 'range'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filtered = mockArticles.filter(art => {
    const matchKeyword = keyword.trim() === '' || 
      art.title.toLowerCase().includes(keyword.toLowerCase()) || 
      art.excerpt.toLowerCase().includes(keyword.toLowerCase()) || 
      art.topic.toLowerCase().includes(keyword.toLowerCase());

    if (!matchKeyword) return false;

    const diffMs = Date.now() - art.publishedAt.getTime();
    if (timeFilter === '24h') return diffMs <= 24 * 3600 * 1000;
    if (timeFilter === '7d') return diffMs <= 7 * 24 * 3600 * 1000;
    if (timeFilter === '365d') return diffMs <= 365 * 24 * 3600 * 1000;
    if (timeFilter === 'range') {
      if (startDate && art.publishedAt < new Date(startDate)) return false;
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        if (art.publishedAt > eDate) return false;
      }
    }
    return true;
  });

  const totalResults = filtered.length;
  const sentimentCounts = filtered.reduce((acc, art) => {
    const s = art.sentiment || 'Neutral';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] text-[#0F172A] font-serif p-6 md:p-12">
      {/* Background Page Content */}
      <div className="max-w-5xl mx-auto opacity-20 pointer-events-none transition-opacity duration-300">
        <header className="border-b-4 border-double border-[#0F172A] py-6 text-center">
          <h1 className="text-5xl font-extrabold uppercase tracking-tight text-[#1E3A8A]">THE AZURE OBSERVER</h1>
          <p className="text-xs uppercase tracking-widest mt-2 font-sans">Volume I · Analytics Edition</p>
        </header>
      </div>

      {/* Dialog Overlay */}
      <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 z-40">
        <div className="bg-white border-4 border-[#0F172A] w-full max-w-5xl max-h-[85vh] overflow-y-auto shadow-[8px_8px_0px_#1E3A8A] flex flex-col p-6 md:p-10 relative">
          
          {/* Header */}
          <div className="flex justify-between items-baseline border-b border-[#0F172A]/20 pb-4 mb-6">
            <div>
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-[#3B82F6]">INQUIRY SYSTEM</span>
              <h2 className="text-3xl font-extrabold tracking-tight mt-1 text-[#0F172A]">Archival Search</h2>
            </div>
            <button className="text-[#0F172A] hover:text-[#3B82F6] transition-colors" onClick={() => setKeyword('')}>
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            
            {/* Left side: Inputs & Results (Span 3) */}
            <div className="md:col-span-3 space-y-6">
              
              <div className="relative border-b-2 border-[#0F172A] py-2 focus-within:border-[#3B82F6] transition-colors">
                <input
                  type="text"
                  placeholder="Enter keyword or query..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full bg-transparent outline-none text-xl font-medium placeholder:text-[#0F172A]/30 pr-10"
                />
                <Search className="absolute right-2 top-3 w-5 h-5 text-[#0F172A]/60" />
              </div>

              <div>
                <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#64748B] block mb-3">Temporal Filter</span>
                <div className="flex flex-wrap gap-2 text-xs font-sans font-bold">
                  {[
                    { key: 'all', label: 'All Time' },
                    { key: '24h', label: 'Past 24 Hours' },
                    { key: '7d', label: 'Past 7 Days' },
                    { key: '365d', label: 'Past Year' },
                  ].map((btn) => (
                    <button
                      key={btn.key}
                      onClick={() => setTimeFilter(btn.key as any)}
                      className={`px-3 py-1.5 border border-[#0F172A] transition-colors ${
                        timeFilter === btn.key ? 'bg-[#0F172A] text-white' : 'hover:bg-[#0F172A]/5 text-[#0F172A]'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#64748B] block border-b border-[#0F172A]/10 pb-1">
                  Query Results ({filtered.length})
                </span>
                
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                  {filtered.map(art => (
                    <div key={art.id} className="border-b border-[#0F172A]/10 pb-4 last:border-0 group">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-sans font-bold text-[#3B82F6] uppercase tracking-wider">{art.topic}</span>
                        <span className="text-xs font-sans text-[#64748B]">
                          {art.publishedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <h4 className="text-base font-bold leading-tight mt-1 group-hover:text-[#1E3A8A] cursor-pointer">
                        {art.title}
                      </h4>
                      <p className="text-xs text-[#475569] font-sans mt-1 line-clamp-2">{art.excerpt}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right side: Sentiment & Trends (Span 1) */}
            <div className="border-t md:border-t-0 md:border-l border-[#0F172A]/20 pt-6 md:pt-0 md:pl-6 space-y-8">
              
              {/* Sentiment Analysis Widget */}
              <div>
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#1E3A8A] block mb-4 flex items-center gap-1.5 border-b border-[#0F172A] pb-1">
                  <PieChart className="w-3.5 h-3.5" /> Sentiment
                </span>
                <div className="space-y-3 font-sans">
                  {['Positive', 'Neutral', 'Negative'].map(s => {
                    const count = sentimentCounts[s] || 0;
                    const pct = totalResults === 0 ? 0 : Math.round((count / totalResults) * 100);
                    return (
                      <div key={s}>
                        <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                          <span className="text-[#0F172A]">{s}</span>
                          <span className="text-[#64748B]">{pct}%</span>
                        </div>
                        <div className="w-full bg-[#0F172A]/10 h-1.5 border border-[#0F172A]/20">
                          <div 
                            className={`h-full ${s === 'Positive' ? 'bg-[#3B82F6]' : s === 'Negative' ? 'bg-[#1E3A8A]' : 'bg-[#94A3B8]'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#64748B] block mb-3 border-b border-[#0F172A]/10 pb-1">Trends</span>
                <div className="space-y-2">
                  {mockTrendingKeywords.map((kw, i) => (
                    <button
                      key={i}
                      onClick={() => setKeyword(kw)}
                      className="flex items-center justify-between w-full text-left text-sm font-bold py-1 hover:text-[#3B82F6] transition-colors group"
                    >
                      <span>{kw}</span>
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
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
