'use client';

import React, { useState } from 'react';
import { Search, PieChart, TrendingUp, Activity, FileText } from 'lucide-react';
import { mockArticles } from '../mockData';

export default function SearchV5() {
  const [keyword, setKeyword] = useState('');

  const filtered = mockArticles.filter(art => 
    keyword.trim() === '' || 
    art.title.toLowerCase().includes(keyword.toLowerCase()) ||
    art.topic.toLowerCase().includes(keyword.toLowerCase())
  );

  // Analytics aggregations
  const totalResults = filtered.length;
  
  const sentimentCounts = filtered.reduce((acc, art) => {
    const s = art.sentiment || 'Neutral';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topSources = Object.entries(filtered.reduce((acc, art) => {
    acc[art.sourceName] = (acc[art.sourceName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="w-full min-h-screen bg-neutral-100 text-neutral-900 font-sans p-4 md:p-8 flex justify-center items-center">
      
      <div className="w-full max-w-5xl space-y-6">
        
        {/* Main Search Bar */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
            <Search className="w-6 h-6 text-indigo-500" />
          </div>
          <input
            type="text"
            placeholder="Explore topics, entities, or trends..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="flex-1 bg-transparent text-xl outline-none placeholder:text-neutral-400 font-medium"
          />
          <div className="text-sm text-neutral-400 font-medium px-4 border-l border-neutral-200">
            {totalResults} results
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column: Analytics Widgets */}
          <div className="space-y-6 flex flex-col">
            
            {/* Widget 1: Sentiment Overview */}
            <div className="bg-white rounded-2xl shadow-sm p-6 flex-1">
              <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <PieChart className="w-4 h-4" /> Sentiment Analysis
              </h3>
              <div className="space-y-3">
                {['Positive', 'Neutral', 'Negative'].map(s => {
                  const count = sentimentCounts[s] || 0;
                  const pct = totalResults === 0 ? 0 : Math.round((count / totalResults) * 100);
                  return (
                    <div key={s}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-neutral-700">{s}</span>
                        <span className="text-neutral-500">{pct}%</span>
                      </div>
                      <div className="w-full bg-neutral-100 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            s === 'Positive' ? 'bg-emerald-500' :
                            s === 'Negative' ? 'bg-rose-500' :
                            'bg-amber-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Widget 2: Top Sources */}
            <div className="bg-white rounded-2xl shadow-sm p-6 flex-1">
              <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Top Data Sources
              </h3>
              <div className="space-y-4">
                {topSources.length === 0 ? (
                  <p className="text-sm text-neutral-400">No active sources.</p>
                ) : (
                  topSources.map(([source, count], i) => (
                    <div key={source} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                        #{i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-800 truncate">{source}</p>
                      </div>
                      <span className="text-xs font-bold text-neutral-500 bg-neutral-100 px-2 py-1 rounded">
                        {count} hits
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Results Feed (Takes up 2 columns) */}
          <div className="md:col-span-2 bg-white rounded-2xl shadow-sm flex flex-col h-[600px] overflow-hidden">
            <div className="p-6 border-b border-neutral-100 bg-white/80 backdrop-blur shrink-0 flex justify-between items-center">
              <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4" /> Matched Documents
              </h3>
              <button className="text-sm text-indigo-600 font-medium hover:text-indigo-700 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" /> Sort by Relevance
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="h-full flex items-center justify-center text-neutral-400">
                  No matching documents found.
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(art => (
                    <div key={art.id} className="group p-4 hover:bg-neutral-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-neutral-100">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase tracking-wider">
                          {art.topic}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {art.publishedAt.toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-neutral-900 mb-2 group-hover:text-indigo-700 transition-colors">
                        {art.title}
                      </h4>
                      <p className="text-sm text-neutral-600 line-clamp-2">
                        {art.excerpt}
                      </p>
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
