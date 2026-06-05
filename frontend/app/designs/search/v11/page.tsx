'use client';

import React, { useState } from 'react';
import { Search, X, Activity, BarChart2 } from 'lucide-react';
import { mockArticles, mockTrendingKeywords } from '../mockData';

export default function SearchV11() {
  const [keyword, setKeyword] = useState('');

  const filtered = mockArticles.filter(art => {
    const matchKeyword = keyword.trim() === '' || 
      art.title.toLowerCase().includes(keyword.toLowerCase()) || 
      art.excerpt.toLowerCase().includes(keyword.toLowerCase());
    return matchKeyword;
  });

  const totalResults = filtered.length;
  const sentimentCounts = filtered.reduce((acc, art) => {
    const s = art.sentiment || 'Neutral';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="w-full min-h-screen bg-[#0A0A0A] text-[#E5E5E5] font-serif p-6 md:p-12">
      <div className="fixed inset-0 bg-[#000000]/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8 z-40">
        <div className="bg-[#111111] border border-[#333333] w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col p-6 md:p-10 relative">
          
          <div className="flex justify-between items-center border-b border-[#333333] pb-6 mb-6">
            <h2 className="text-3xl font-light tracking-widest text-[#E5E5E5] uppercase flex items-center gap-4">
              <Search className="w-6 h-6 text-[#737373]" />
              Noir Index
            </h2>
            <button className="text-[#737373] hover:text-[#E5E5E5] transition-colors" onClick={() => setKeyword('')}>
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Top Section: Search Input & Sentiment Infobox */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            
            {/* Input & Trends */}
            <div className="md:col-span-2 space-y-6">
              <div className="relative border-b border-[#525252] py-2 focus-within:border-[#E5E5E5] transition-colors">
                <input
                  type="text"
                  placeholder="Enter archival query..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full bg-transparent outline-none text-2xl font-light placeholder:text-[#525252] pr-10"
                />
              </div>

              <div>
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#737373] block mb-3">Trending Indices</span>
                <div className="flex flex-wrap gap-2 font-sans">
                  {mockTrendingKeywords.map((kw, i) => (
                    <button
                      key={i}
                      onClick={() => setKeyword(kw)}
                      className="text-xs uppercase font-medium text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#262626] px-3 py-1.5 rounded-sm border border-[#333333] transition-colors"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sentiment Infobox */}
            <div className="bg-[#171717] border border-[#262626] p-5 flex flex-col justify-between">
              <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#737373] flex items-center gap-2 mb-4">
                <BarChart2 className="w-4 h-4" /> Market Sentiment
              </span>
              <div className="flex h-24 gap-4 items-end font-sans">
                {['Positive', 'Neutral', 'Negative'].map(s => {
                  const count = sentimentCounts[s] || 0;
                  const pct = totalResults === 0 ? 0 : Math.round((count / totalResults) * 100);
                  return (
                    <div key={s} className="flex-1 flex flex-col justify-end gap-2 group">
                      <div className="text-center">
                        <span className="text-xs font-bold block">{pct}%</span>
                      </div>
                      <div className="w-full bg-[#262626] h-full flex items-end">
                        <div 
                          className={`w-full transition-all duration-500 ${s === 'Positive' ? 'bg-[#E5E5E5]' : s === 'Negative' ? 'bg-[#525252]' : 'bg-[#737373]'}`}
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <div className="text-center mt-1">
                        <span className="text-[9px] uppercase font-bold text-[#737373] group-hover:text-[#E5E5E5] transition-colors">{s.substring(0,3)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Results List */}
          <div>
            <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#737373] block border-b border-[#333333] pb-2 mb-4 flex justify-between items-center">
              <span>Archival Records</span>
              <span>{filtered.length} matches</span>
            </span>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 max-h-[400px] overflow-y-auto pr-4 no-scrollbar">
              {filtered.map(art => (
                <div key={art.id} className="border-b border-[#262626] pb-4 last:border-0 group">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-[10px] font-sans font-bold text-[#A3A3A3] uppercase tracking-wider">{art.topic}</span>
                    <span className="text-[10px] font-sans text-[#525252]">
                      {art.publishedAt.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                    </span>
                  </div>
                  <h4 className="text-lg font-medium leading-tight text-[#E5E5E5] group-hover:underline cursor-pointer decoration-1 underline-offset-4">
                    {art.title}
                  </h4>
                  <p className="text-sm text-[#737373] font-serif mt-2 line-clamp-2">{art.excerpt}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
