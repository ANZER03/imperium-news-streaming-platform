'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';

const DESIGNS = [
  { v: 'v1', name: 'v1: Editorial Colonnade' },
  { v: 'v2', name: 'v2: Category Grid Hub' },
  { v: 'v3', name: 'v3: Palantir Intelligence Node' },
  { v: 'v4', name: 'v4: Bloomberg x Twitter Feed' },
  { v: 'v5', name: 'v5: Modular Bento Analytics' },
  { v: 'v6', name: 'v6: Global Threat Matrix' },
  { v: 'v7', name: 'v7: Editorial Azure' },
  { v: 'v8', name: 'v8: Editorial Crimson' },
  { v: 'v9', name: 'v9: Editorial Forest' },
  { v: 'v10', name: 'v10: Editorial Sepia' },
  { v: 'v11', name: 'v11: Editorial Noir' },
  { v: 'v12', name: 'v12: Option 1 (Left Thumbnail)' },
  { v: 'v13', name: 'v13: Option 2 (Top Image Grid)' },
  { v: 'v14', name: 'v14: Option 3 (Split Overlay)' },
  { v: 'v15', name: 'v15: Option 4 (Magazine Hero)' },
  { v: 'v16', name: 'v16: Option 5 (Timeline Flow)' },
  { v: 'v17', name: 'v17: Option 6 (Dense Strips)' },
  { v: 'v18', name: 'v18: Option 7 (Asymmetric Deck)' },
  { v: 'v19', name: 'v19: Option 8 (Double Broadsheet)' },
  { v: 'v20', name: 'v20: Option 9 (Retro Offset Shadow)' },
  { v: 'v21', name: 'v21: Option 10 (50/50 Split Card)' },
];

export default function SearchDesignsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Find current version from pathname (e.g. /designs/search/v1 -> v1)
  const currentV = pathname.split('/').pop() || 'v1';
  const currentIndex = DESIGNS.findIndex(d => d.v === currentV);
  const currentDesign = DESIGNS[currentIndex] || DESIGNS[0];

  const handlePrev = () => {
    const prevIndex = (currentIndex - 1 + DESIGNS.length) % DESIGNS.length;
    router.push(`/designs/search/${DESIGNS[prevIndex].v}`);
  };

  const handleNext = () => {
    const nextIndex = (currentIndex + 1) % DESIGNS.length;
    router.push(`/designs/search/${DESIGNS[nextIndex].v}`);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`/designs/search/${e.target.value}`);
  };

  return (
    <div className="min-h-screen bg-editorial-bg font-sans text-editorial-ink selection:bg-brand-100 overflow-x-hidden relative flex flex-col">
      {/* Search Preview Workspace */}
      <div className="flex-1 w-full relative">
        {children}
      </div>

      {/* Floating Control Panel */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-editorial-border dark:border-zinc-800 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 text-xs md:text-sm transition-all hover:shadow-2xl">
        <Link 
          href="/designs" 
          className="text-editorial-muted dark:text-zinc-400 hover:text-brand-500 dark:hover:text-brand-500 font-semibold flex items-center gap-1 transition-colors"
          title="Back to Design Lab"
        >
          <Home className="w-4 h-4" />
          <span className="hidden md:inline">Lab</span>
        </Link>
        
        <div className="w-px h-4 bg-editorial-border dark:bg-zinc-800" />
        
        <button 
          onClick={handlePrev}
          className="p-1 rounded-lg hover:bg-editorial-surface dark:hover:bg-zinc-800 transition-colors text-editorial-ink dark:text-white"
          title="Previous Concept"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <select 
          value={currentV} 
          onChange={handleSelectChange}
          className="bg-transparent border-0 font-semibold text-editorial-ink dark:text-white focus:ring-0 cursor-pointer outline-none max-w-[150px] md:max-w-none"
        >
          {DESIGNS.map(d => (
            <option key={d.v} value={d.v} className="bg-white dark:bg-zinc-900 text-editorial-ink dark:text-white">
              {d.name}
            </option>
          ))}
        </select>

        <button 
          onClick={handleNext}
          className="p-1 rounded-lg hover:bg-editorial-surface dark:hover:bg-zinc-800 transition-colors text-editorial-ink dark:text-white"
          title="Next Concept"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
