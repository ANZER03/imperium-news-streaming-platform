'use client';

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Search, Hash, Clock, BarChart2 } from 'lucide-react';
import { mockArticles, mockTrendingKeywords } from '../mockData';

export default function SearchV4() {
  const [keyword, setKeyword] = useState('');

  const filtered = mockArticles.filter(art => 
    keyword.trim() === '' || 
    art.title.toLowerCase().includes(keyword.toLowerCase()) ||
    art.excerpt.toLowerCase().includes(keyword.toLowerCase())
  );

  return (
    <div className="w-full min-h-screen bg-[#000000] text-[#E0E0E0] font-sans p-4 md:p-8 flex justify-center items-start">
      
      {/* Terminal Window */}
      <div className="w-full max-w-7xl flex flex-col h-[90vh] border border-[#333] rounded-sm overflow-hidden bg-[#0A0A0A]">
        
        {/* Ticker Tape Top Bar */}
        <div className="bg-[#111] border-b border-[#333] px-4 py-2 flex items-center overflow-hidden shrink-0">
          <div className="flex animate-pulse items-center gap-2 text-xs font-mono whitespace-nowrap text-[#4ADE80]">
            <span className="font-bold text-white pr-4">LIVE FEED //</span>
            {mockTrendingKeywords.map((k, i) => (
              <span key={i} className="flex items-center gap-1 mr-6">
                <Hash className="w-3 h-3" /> {k} 
                {i % 2 === 0 ? <TrendingUp className="w-3 h-3 text-[#4ADE80]" /> : <TrendingDown className="w-3 h-3 text-[#F87171]" />}
              </span>
            ))}
          </div>
        </div>

        {/* 3-Column Layout */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Column: Trending/Filters */}
          <div className="w-64 border-r border-[#333] p-4 bg-[#050505] hidden md:flex flex-col gap-6 overflow-y-auto no-scrollbar shrink-0">
            <div>
              <h3 className="text-xs font-bold text-[#888] uppercase tracking-widest mb-3 flex items-center gap-2">
                <BarChart2 className="w-4 h-4" /> Trending Topics
              </h3>
              <div className="space-y-2">
                {mockTrendingKeywords.map((k, i) => (
                  <button key={i} onClick={() => setKeyword(k)} className="w-full text-left px-2 py-1.5 hover:bg-[#222] rounded flex justify-between items-center group transition-colors">
                    <span className="text-sm font-medium text-[#CCC] group-hover:text-white">#{k.replace(' ', '')}</span>
                    <span className="text-[10px] text-[#555] group-hover:text-[#888]">{Math.floor(Math.random() * 100) + 10}k</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Middle Column: The Feed */}
          <div className="flex-1 flex flex-col bg-[#0A0A0A] border-r border-[#333]">
            {/* Search Input */}
            <div className="p-4 border-b border-[#333] sticky top-0 bg-[#0A0A0A]/95 backdrop-blur-sm z-10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#666]" />
                <input
                  type="text"
                  placeholder="Search live feed..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full bg-[#111] border border-[#444] rounded-full py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-[#4ADE80] transition-colors placeholder:text-[#555]"
                />
              </div>
            </div>

            {/* Feed Items */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {filtered.map(art => (
                <div key={art.id} className="p-4 border-b border-[#222] hover:bg-[#111] transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#222] overflow-hidden flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-[#888]">{art.sourceName.substring(0, 2).toUpperCase()}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{art.sourceName}</span>
                          <span className="text-xs text-[#666]">@{art.sourceName.toLowerCase().replace(' ', '')}</span>
                          <span className="text-xs text-[#666] flex items-center gap-1">
                            · <Clock className="w-3 h-3" /> {new Date(art.publishedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pl-10">
                    <h4 className="text-base font-medium text-[#E0E0E0] mb-1">{art.title}</h4>
                    <p className="text-sm text-[#999] mb-3 leading-relaxed">{art.excerpt}</p>
                    
                    {/* Tags & Sentiment Mini-Chart */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#222]">
                      <div className="flex gap-2">
                        {art.entities?.slice(0, 2).map((ent, i) => (
                          <span key={i} className="text-xs text-[#4299E1] hover:underline cursor-pointer">#{ent.replace(' ', '')}</span>
                        ))}
                      </div>
                      <div className={`text-xs font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                        art.sentiment === 'Positive' ? 'text-[#4ADE80] bg-[#4ADE80]/10' :
                        art.sentiment === 'Negative' ? 'text-[#F87171] bg-[#F87171]/10' :
                        'text-[#9CA3AF] bg-[#9CA3AF]/10'
                      }`}>
                        {art.sentiment === 'Positive' ? 'BUY / LONG' : art.sentiment === 'Negative' ? 'SELL / SHORT' : 'HOLD'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Market/Context Data (Static Mock) */}
          <div className="w-72 p-4 bg-[#050505] hidden lg:block shrink-0 overflow-y-auto no-scrollbar">
            <h3 className="text-xs font-bold text-[#888] uppercase tracking-widest mb-4">Sentiment Index</h3>
            
            <div className="space-y-4">
              {['Technology', 'Global Markets', 'Energy'].map((sector, i) => {
                const isUp = i !== 1;
                return (
                  <div key={i} className="bg-[#111] border border-[#222] p-3 rounded">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-[#CCC]">{sector}</span>
                      <span className={`text-xs font-mono ${isUp ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
                        {isUp ? '+2.4%' : '-1.1%'}
                      </span>
                    </div>
                    {/* Mock micro-chart */}
                    <div className="w-full h-8 flex items-end gap-1">
                      {[...Array(12)].map((_, j) => (
                        <div 
                          key={j} 
                          className={`flex-1 rounded-t-sm ${isUp ? 'bg-[#4ADE80]/40' : 'bg-[#F87171]/40'}`} 
                          style={{ height: `${Math.max(20, Math.random() * 100)}%` }} 
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
