'use client';

import React, { useState } from 'react';
import { Search, X, PieChart } from 'lucide-react';
import { mockArticles, mockTrendingKeywords } from '../mockData';

export default function SearchV10() {
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
    <div className="w-full min-h-screen bg-[#FEFCE8] text-[#422006] font-serif p-6 md:p-12">
      <div className="fixed inset-0 bg-[#422006]/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 z-40">
        <div className="bg-[#FEFCE8] border-8 border-double border-[#422006] w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-[16px_16px_0px_#422006] flex flex-col p-6 md:p-10 relative">
          
          <div className="flex justify-between items-baseline border-b-4 border-double border-[#422006] pb-4 mb-6">
            <div>
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.3em] text-[#B45309]">THE DAILY ARCHIVE</span>
              <h2 className="text-4xl font-extrabold tracking-tight mt-1 text-[#422006] uppercase">Sepia Inquirer</h2>
            </div>
            <button className="text-[#422006] hover:opacity-70 transition-opacity" onClick={() => setKeyword('')}>
              <X className="w-8 h-8" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            
            {/* Left side: Inputs & Results */}
            <div className="space-y-8 flex flex-col">
              
              <div className="relative border-b-2 border-[#422006] py-2 focus-within:border-[#B45309] transition-colors">
                <input
                  type="text"
                  placeholder="Enter subject of inquiry..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full bg-transparent outline-none text-2xl font-medium placeholder:text-[#422006]/40 pr-10"
                />
                <Search className="absolute right-2 top-4 w-6 h-6 text-[#422006]/60" />
              </div>

              <div className="flex-1 space-y-4">
                <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#B45309] block border-b border-[#422006]/20 pb-1">
                  Discovered Articles ({filtered.length})
                </span>
                
                <div className="space-y-6 max-h-[350px] overflow-y-auto pr-4 no-scrollbar">
                  {filtered.map(art => (
                    <div key={art.id} className="border-b border-dashed border-[#422006]/30 pb-4 last:border-0 group">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs font-sans font-bold text-[#B45309] uppercase tracking-wider">{art.topic}</span>
                        <span className="text-xs font-sans italic text-[#422006]/70">
                          {art.publishedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <h4 className="text-xl font-bold leading-tight mt-1 text-[#422006] group-hover:text-[#B45309] cursor-pointer">
                        {art.title}
                      </h4>
                      <p className="text-sm text-[#422006]/80 font-serif mt-2 line-clamp-3 leading-relaxed">{art.excerpt}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right side: Large Graphic Sentiment */}
            <div className="border-t md:border-t-0 md:border-l-2 border-dashed border-[#422006]/40 pt-6 md:pt-0 md:pl-12 flex flex-col gap-10">
              
              {/* Massive Sentiment Block */}
              <div>
                <span className="font-sans text-xs font-black uppercase tracking-[0.2em] text-[#422006] block mb-6 flex items-center gap-2 border-b-2 border-[#422006] pb-2">
                  <PieChart className="w-5 h-5" /> Market Sentiment Analysis
                </span>
                <div className="space-y-6 font-sans">
                  {['Positive', 'Neutral', 'Negative'].map(s => {
                    const count = sentimentCounts[s] || 0;
                    const pct = totalResults === 0 ? 0 : Math.round((count / totalResults) * 100);
                    return (
                      <div key={s} className="bg-[#422006]/5 p-4 border border-[#422006]/10">
                        <div className="flex justify-between text-lg font-black uppercase mb-2">
                          <span className="text-[#422006] tracking-widest">{s}</span>
                          <span className="text-[#B45309]">{pct}%</span>
                        </div>
                        <div className="w-full bg-[#422006]/20 h-4 border border-[#422006]/30">
                          <div 
                            className={`h-full ${s === 'Positive' ? 'bg-[#4ADE80]' : s === 'Negative' ? 'bg-[#F87171]' : 'bg-[#94A3B8]'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="font-serif text-xs italic text-[#422006]/60 mt-4 text-center">
                  * Sentiment figures reflect current archival queries.
                </p>
              </div>

              <div>
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#B45309] block mb-4 border-b border-[#422006]/20 pb-1">Prominent Keywords</span>
                <div className="flex flex-wrap gap-3 font-serif italic">
                  {mockTrendingKeywords.map((kw, i) => (
                    <button
                      key={i}
                      onClick={() => setKeyword(kw)}
                      className="text-lg text-[#422006] hover:text-[#B45309] transition-colors"
                    >
                      {kw}{i < mockTrendingKeywords.length - 1 ? ',' : ''}
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
