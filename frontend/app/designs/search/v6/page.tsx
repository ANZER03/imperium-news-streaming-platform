'use client';

import React, { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, ArrowUpDown, AlertTriangle, ShieldCheck, Info } from 'lucide-react';
import { mockArticles, Article } from '../mockData';

type SortField = 'publishedAt' | 'threatLevel' | 'sentiment' | 'title';
type SortOrder = 'asc' | 'desc';

export default function SearchV6() {
  const [keyword, setKeyword] = useState('');
  const [sortField, setSortField] = useState<SortField>('publishedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Default to desc for new fields
    }
  };

  const threatWeight = { Critical: 3, Elevated: 2, Low: 1 };
  const sentimentWeight = { Positive: 1, Neutral: 2, Negative: 3 };

  const processedData = useMemo(() => {
    let data = mockArticles.filter(art => 
      keyword.trim() === '' || 
      art.title.toLowerCase().includes(keyword.toLowerCase()) ||
      art.sourceName.toLowerCase().includes(keyword.toLowerCase()) ||
      (art.entities || []).some(e => e.toLowerCase().includes(keyword.toLowerCase()))
    );

    data.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'threatLevel') {
        valA = threatWeight[a.threatLevel || 'Low'];
        valB = threatWeight[b.threatLevel || 'Low'];
      } else if (sortField === 'sentiment') {
        valA = sentimentWeight[a.sentiment || 'Neutral'];
        valB = sentimentWeight[b.sentiment || 'Neutral'];
      } else if (sortField === 'publishedAt') {
        valA = a.publishedAt.getTime();
        valB = b.publishedAt.getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [keyword, sortField, sortOrder]);

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] text-[#334155] font-sans p-4 md:p-8 flex justify-center items-start">
      
      <div className="w-full max-w-7xl bg-white border border-[#E2E8F0] shadow-sm rounded-lg flex flex-col h-[90vh] overflow-hidden">
        
        {/* Top Control Bar */}
        <div className="border-b border-[#E2E8F0] p-4 bg-white flex flex-col sm:flex-row gap-4 items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#0F172A] rounded flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#0F172A] tracking-tight uppercase">Global Intelligence Matrix</h1>
              <p className="text-xs text-[#64748B]">Structured event data ingestion & filtering</p>
            </div>
          </div>

          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Query matrix by keyword, source, or entity..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#F1F5F9] border border-transparent rounded-md text-sm focus:bg-white focus:border-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-[#F8FAFC] sticky top-0 z-10 shadow-sm border-b border-[#E2E8F0]">
              <tr>
                <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-wider w-16">Status</th>
                <th 
                  className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-wider cursor-pointer hover:bg-[#F1F5F9] transition-colors"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-1">Event Summary <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-wider">Entities / Vectors</th>
                <th 
                  className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-wider cursor-pointer hover:bg-[#F1F5F9] transition-colors w-32"
                  onClick={() => handleSort('threatLevel')}
                >
                  <div className="flex items-center gap-1">Threat <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th 
                  className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-wider cursor-pointer hover:bg-[#F1F5F9] transition-colors w-32"
                  onClick={() => handleSort('sentiment')}
                >
                  <div className="flex items-center gap-1">Sentiment <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th 
                  className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-wider cursor-pointer hover:bg-[#F1F5F9] transition-colors w-36"
                  onClick={() => handleSort('publishedAt')}
                >
                  <div className="flex items-center gap-1">Timestamp <ArrowUpDown className="w-3 h-3" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {processedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#94A3B8] text-sm">
                    No records found matching query parameters.
                  </td>
                </tr>
              ) : (
                processedData.map(art => (
                  <tr key={art.id} className="hover:bg-[#F8FAFC] transition-colors group cursor-pointer">
                    <td className="py-3 px-4 text-center">
                      {art.threatLevel === 'Critical' ? (
                        <AlertTriangle className="w-5 h-5 text-red-500 mx-auto" />
                      ) : art.threatLevel === 'Elevated' ? (
                        <Info className="w-5 h-5 text-amber-500 mx-auto" />
                      ) : (
                        <ShieldCheck className="w-5 h-5 text-emerald-500 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#0F172A] text-sm mb-0.5 line-clamp-1 group-hover:text-[#2563EB] transition-colors">{art.title}</div>
                      <div className="text-xs text-[#64748B] flex items-center gap-2">
                        <span className="font-medium text-[#475569]">{art.sourceName}</span>
                        <span>•</span>
                        <span className="truncate">{art.excerpt}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {art.entities?.map((ent, i) => (
                          <span key={i} className="inline-block px-1.5 py-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded text-[10px] font-medium text-[#475569] uppercase">
                            {ent}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                        art.threatLevel === 'Critical' ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10' :
                        art.threatLevel === 'Elevated' ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' :
                        'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                      }`}>
                        {art.threatLevel || 'Low'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 text-xs font-medium text-[#475569]">
                        <div className={`w-2 h-2 rounded-full ${
                          art.sentiment === 'Negative' ? 'bg-red-500' :
                          art.sentiment === 'Positive' ? 'bg-emerald-500' :
                          'bg-slate-400'
                        }`} />
                        {art.sentiment || 'Neutral'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-[#64748B]">
                      {art.publishedAt.toISOString().replace('T', ' ').substring(0, 16)} Z
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer Stats */}
        <div className="border-t border-[#E2E8F0] p-3 bg-[#F8FAFC] flex justify-between items-center text-xs text-[#64748B] shrink-0 font-medium">
          <div>Displaying {processedData.length} records</div>
          <div className="flex gap-4">
            <span>Critical Events: <span className="font-bold text-[#0F172A]">{processedData.filter(d => d.threatLevel === 'Critical').length}</span></span>
            <span>Total Entities: <span className="font-bold text-[#0F172A]">{new Set(processedData.flatMap(d => d.entities || [])).size}</span></span>
          </div>
        </div>

      </div>
    </div>
  );
}
