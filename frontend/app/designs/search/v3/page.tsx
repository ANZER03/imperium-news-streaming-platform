'use client';

import React, { useState } from 'react';
import { Search, Database, ShieldAlert, Activity, GitCommit, Crosshair, Filter, Calendar as CalIcon } from 'lucide-react';
import { mockArticles } from '../mockData';

export default function SearchV3() {
  const [keyword, setKeyword] = useState('');
  const [threatFilter, setThreatFilter] = useState<string>('All');
  
  const filtered = mockArticles.filter(art => {
    const matchKeyword = keyword.trim() === '' || 
      art.title.toLowerCase().includes(keyword.toLowerCase()) || 
      art.excerpt.toLowerCase().includes(keyword.toLowerCase()) ||
      (art.entities || []).some(e => e.toLowerCase().includes(keyword.toLowerCase()));

    if (!matchKeyword) return false;

    if (threatFilter !== 'All' && art.threatLevel !== threatFilter) return false;

    return true;
  });

  return (
    <div className="w-full min-h-screen bg-[#0A0A0A] text-[#A1A1AA] font-mono p-4 md:p-8 flex items-center justify-center">
      
      {/* HUD Container */}
      <div className="w-full max-w-6xl bg-[#0F0F12] border border-[#27272A] rounded-lg shadow-2xl flex flex-col h-[90vh] overflow-hidden">
        
        {/* Top Header */}
        <div className="bg-[#18181B] px-4 py-3 border-b border-[#27272A] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-[#38BDF8]" />
            <span className="text-xs font-bold text-[#E4E4E7] tracking-widest uppercase">Global Entity Node // Search</span>
          </div>
          <div className="text-[10px] uppercase font-bold text-[#52525B] flex gap-4">
            <span>SYS.STATUS: ONLINE</span>
            <span className="text-[#38BDF8]">SEC: LEVEL-5</span>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Panel: Query & Filters */}
          <div className="w-64 border-r border-[#27272A] p-4 bg-[#121214] flex flex-col gap-6 shrink-0 overflow-y-auto no-scrollbar">
            
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-[#71717A] tracking-wider font-bold block mb-1">Query String</label>
              <div className="bg-[#18181B] border border-[#3F3F46] rounded focus-within:border-[#38BDF8] flex items-center px-2 py-1.5 transition-colors">
                <Search className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                <input
                  type="text"
                  placeholder="Enter keywords..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full bg-transparent border-0 outline-none text-xs px-2 text-[#E4E4E7] placeholder:text-[#52525B]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase text-[#71717A] tracking-wider font-bold block flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Threat Level
              </label>
              <div className="flex flex-col gap-1.5">
                {['All', 'Critical', 'Elevated', 'Low'].map(level => (
                  <button
                    key={level}
                    onClick={() => setThreatFilter(level)}
                    className={`text-left text-xs px-2.5 py-1.5 rounded transition-all border ${
                      threatFilter === level 
                        ? 'bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/50'
                        : 'bg-[#18181B] text-[#A1A1AA] border-[#27272A] hover:border-[#52525B]'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase text-[#71717A] tracking-wider font-bold block flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> Data Sources
              </label>
              <div className="bg-[#18181B] p-2 rounded border border-[#27272A] space-y-1.5">
                {['OSINT News', 'Dark Web Scrapes', 'Financial Feeds'].map((src, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-[#A1A1AA]">
                    <input type="checkbox" defaultChecked className="accent-[#38BDF8] bg-transparent border-[#3F3F46] rounded-sm" />
                    {src}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Panel: Data Grid */}
          <div className="flex-1 bg-[#0A0A0A] flex flex-col overflow-hidden">
            
            {/* Grid Header */}
            <div className="border-b border-[#27272A] px-6 py-3 bg-[#121214] flex justify-between items-center shrink-0">
              <span className="text-xs text-[#E4E4E7] font-bold">
                Matches Found: <span className="text-[#38BDF8]">{filtered.length}</span>
              </span>
              <button className="text-[10px] flex items-center gap-1 text-[#A1A1AA] hover:text-[#E4E4E7] border border-[#27272A] bg-[#18181B] px-2 py-1 rounded">
                <Filter className="w-3 h-3" /> Export Dataset
              </button>
            </div>

            {/* Grid Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-6">
              {filtered.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[#52525B] gap-2 border border-dashed border-[#27272A] rounded">
                  <Crosshair className="w-8 h-8 opacity-50" />
                  <p className="text-xs uppercase tracking-widest">No target data acquired.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filtered.map(art => (
                    <div key={art.id} className="bg-[#121214] border border-[#27272A] hover:border-[#38BDF8]/50 rounded-md p-4 transition-colors flex gap-4">
                      
                      {/* Left: Metadata summary */}
                      <div className="w-32 shrink-0 border-r border-[#27272A] pr-4 space-y-3">
                        <div>
                          <span className="block text-[8px] uppercase text-[#71717A]">Threat</span>
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm inline-block mt-0.5 ${
                            art.threatLevel === 'Critical' ? 'bg-red-500/20 text-red-400' :
                            art.threatLevel === 'Elevated' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {art.threatLevel || 'Low'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[8px] uppercase text-[#71717A]">Sentiment</span>
                          <span className={`text-[10px] uppercase mt-0.5 inline-block ${
                            art.sentiment === 'Negative' ? 'text-red-400' :
                            art.sentiment === 'Positive' ? 'text-green-400' :
                            'text-gray-400'
                          }`}>
                            {art.sentiment || 'Neutral'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[8px] uppercase text-[#71717A]">Date</span>
                          <span className="text-[10px] text-[#A1A1AA]">{art.publishedAt.toISOString().split('T')[0]}</span>
                        </div>
                      </div>

                      {/* Right: Content & Entities */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-[#E4E4E7] mb-1 line-clamp-1">{art.title}</h4>
                          <p className="text-xs text-[#A1A1AA] line-clamp-2 leading-relaxed">{art.excerpt}</p>
                        </div>
                        
                        {/* Entity Nodes */}
                        <div className="mt-3 pt-3 border-t border-[#27272A] flex flex-wrap gap-2">
                          <span className="flex items-center gap-1 text-[8px] text-[#71717A] uppercase mr-2">
                            <GitCommit className="w-3 h-3" /> Extracted Entities:
                          </span>
                          {art.entities?.map((ent, i) => (
                            <span key={i} className="text-[9px] bg-[#27272A] text-[#D4D4D8] px-2 py-0.5 rounded-sm border border-[#3F3F46]">
                              {ent}
                            </span>
                          ))}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
