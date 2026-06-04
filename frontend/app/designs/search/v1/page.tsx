'use client';

import React, { useState } from 'react';
import { Search, Calendar, ArrowRight, X } from 'lucide-react';
import { mockArticles, mockRecentSearches, mockTrendingKeywords } from '../mockData';

export default function SearchV1() {
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
    if (timeFilter === '24h') {
      return diffMs <= 24 * 3600 * 1000;
    }
    if (timeFilter === '7d') {
      return diffMs <= 7 * 24 * 3600 * 1000;
    }
    if (timeFilter === '365d') {
      return diffMs <= 365 * 24 * 3600 * 1000;
    }
    if (timeFilter === 'range') {
      if (startDate) {
        const sDate = new Date(startDate);
        if (art.publishedAt < sDate) return false;
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        if (art.publishedAt > eDate) return false;
      }
    }
    return true;
  });

  return (
    <div className="w-full min-h-screen bg-[#FCFAF7] text-[#16131D] font-serif p-6 md:p-12">
      {/* Background Page Content (Simulated News Home) */}
      <div className="max-w-5xl mx-auto opacity-20 pointer-events-none transition-opacity duration-300">
        <header className="border-b-4 border-double border-[#16131D] py-6 text-center">
          <h1 className="text-5xl font-extrabold uppercase tracking-tight">THE IMPERIUM OBSERVER</h1>
          <p className="text-xs uppercase tracking-widest mt-2">Volume LXXXII · Thursday, June 4, 2026</p>
        </header>
        <main className="grid grid-cols-3 gap-8 py-8">
          <div className="col-span-2 border-r border-[#16131D]/20 pr-8">
            <h2 className="text-3xl font-bold leading-tight">Global Trade Protocols Enter New Stabilization Phase</h2>
            <p className="text-sm mt-3 leading-relaxed">Negotiators in Geneva announced a breakthrough agreement concerning international shipping routes, bringing an end to months of supply chain uncertainty.</p>
          </div>
          <div>
            <h3 className="text-xl font-bold">Editorial Notes</h3>
            <p className="text-xs mt-2 leading-relaxed">The stability of maritime routes remains the single most critical factor for global inflation rates...</p>
          </div>
        </main>
      </div>

      {/* BroadSheet Dialog Overlay */}
      <div className="fixed inset-0 bg-[#16131D]/45 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 z-40">
        <div className="bg-[#FCFAF7] border-4 border-[#16131D] w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-[8px_8px_0px_#16131D] flex flex-col p-6 md:p-10 relative">
          
          {/* Header */}
          <div className="flex justify-between items-baseline border-b border-[#16131D]/20 pb-4 mb-6">
            <div>
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E6A7A]">SEARCH ENGINE</span>
              <h2 className="text-3xl font-extrabold tracking-tight mt-1">Archival Inquiry</h2>
            </div>
            <button className="text-[#16131D] hover:opacity-75 transition-opacity" onClick={() => setKeyword('')}>
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Left side: Inputs & Filters */}
            <div className="md:col-span-2 space-y-6">
              
              {/* Keyword Search Input */}
              <div className="relative border-b-2 border-[#16131D] py-2 focus-within:border-[#6F3FF5] transition-colors">
                <input
                  type="text"
                  placeholder="Enter keyword or query..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full bg-transparent outline-none text-xl font-medium placeholder:text-[#16131D]/30 pr-10"
                />
                <Search className="absolute right-2 top-3 w-5 h-5 text-[#16131D]/60" />
              </div>

              {/* Time Filters */}
              <div>
                <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#6E6A7A] block mb-3">Temporal Filter</span>
                <div className="flex flex-wrap gap-2 text-xs font-sans font-bold">
                  {[
                    { key: 'all', label: 'All Time' },
                    { key: '24h', label: 'Past 24 Hours' },
                    { key: '7d', label: 'Past 7 Days' },
                    { key: '365d', label: 'Past Year' },
                    { key: 'range', label: 'Custom Range' },
                  ].map((btn) => (
                    <button
                      key={btn.key}
                      onClick={() => setTimeFilter(btn.key as any)}
                      className={`px-3 py-1.5 border border-[#16131D] transition-colors ${
                        timeFilter === btn.key 
                          ? 'bg-[#16131D] text-[#FCFAF7]' 
                          : 'hover:bg-[#16131D]/5'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Custom Range Date inputs */}
                {timeFilter === 'range' && (
                  <div className="mt-4 p-4 border border-[#16131D]/20 bg-[#16131D]/5 flex flex-wrap gap-4 items-center font-sans">
                    <div className="flex items-center gap-2">
                      <label className="text-xs uppercase tracking-wider text-[#6E6A7A]">From</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent border border-[#16131D] p-1.5 text-xs outline-none focus:ring-1 focus:ring-[#6F3FF5]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs uppercase tracking-wider text-[#6E6A7A]">To</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-transparent border border-[#16131D] p-1.5 text-xs outline-none focus:ring-1 focus:ring-[#6F3FF5]"
                      />
                    </div>
                    {(startDate || endDate) && (
                      <button
                        onClick={() => { setStartDate(''); setEndDate(''); }}
                        className="text-[10px] text-[#6F3FF5] uppercase tracking-wider font-bold underline"
                      >
                        Reset Dates
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Matching Results list */}
              <div className="space-y-4 pt-4">
                <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#6E6A7A] block border-b border-[#16131D]/10 pb-1">
                  Query Results ({filtered.length})
                </span>
                
                {filtered.length === 0 ? (
                  <div className="py-8 text-center text-[#6E6A7A] font-sans text-sm">
                    No records found match the criteria.
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                    {filtered.map(art => (
                      <div key={art.id} className="border-b border-[#16131D]/10 pb-4 last:border-0 group">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-sans font-bold text-[#6F3FF5] uppercase tracking-wider">{art.topic}</span>
                          <span className="text-xs font-sans text-[#6E6A7A]">
                            {art.publishedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <h4 className="text-base font-bold leading-tight mt-1 group-hover:underline cursor-pointer">
                          {art.title}
                        </h4>
                        <p className="text-xs text-[#6E6A7A] font-sans mt-1 line-clamp-2">{art.excerpt}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right side: Trends / Recents */}
            <div className="border-t md:border-t-0 md:border-l border-[#16131D]/20 pt-6 md:pt-0 md:pl-8 space-y-6">
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

              <div>
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#6E6A7A] block mb-3">Recent Inquiries</span>
                <div className="flex flex-wrap gap-1.5">
                  {mockRecentSearches.map((rec, i) => (
                    <button
                      key={i}
                      onClick={() => setKeyword(rec)}
                      className="px-2 py-1 bg-[#16131D]/5 hover:bg-[#16131D]/10 text-xs font-sans font-semibold rounded-none border border-[#16131D]/10 transition-colors"
                    >
                      {rec}
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
