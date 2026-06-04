'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';

const DESIGNS = [
  { v: 'v1', name: 'v1: Classic Editorial' },
  { v: 'v2', name: 'v2: Translucent Glass' },
  { v: 'v3', name: 'v3: Product Standard Tabs' },
  { v: 'v4', name: 'v4: Terminal Console' },
  { v: 'v5', name: 'v5: Bold Brand Saturated' },
  { v: 'v6', name: 'v6: Progressive Step-by-Step' },
  { v: 'v7', name: 'v7: Social-First Splitted' },
  { v: 'v8', name: 'v8: Serif Narrative Form' },
  { v: 'v9', name: 'v9: Neomorphic Softness' },
  { v: 'v10', name: 'v10: Cinematic Dark Mode' },
];

export default function AuthDesignsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Find current version from pathname (e.g. /designs/auth/v1 -> v1)
  const currentV = pathname.split('/').pop() || 'v1';
  const currentIndex = DESIGNS.findIndex(d => d.v === currentV);
  const currentDesign = DESIGNS[currentIndex] || DESIGNS[0];

  const handlePrev = () => {
    const prevIndex = (currentIndex - 1 + DESIGNS.length) % DESIGNS.length;
    router.push(`/designs/auth/${DESIGNS[prevIndex].v}`);
  };

  const handleNext = () => {
    const nextIndex = (currentIndex + 1) % DESIGNS.length;
    router.push(`/designs/auth/${DESIGNS[nextIndex].v}`);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`/designs/auth/${e.target.value}`);
  };

  // Determine if the current design itself uses a custom right-panel background.
  // V10 uses dark mode for the right panel.
  const isV10 = currentV === 'v10';

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-white font-sans text-editorial-ink selection:bg-brand-100 overflow-x-hidden relative flex flex-col">
      {/* Main Split Layout */}
      <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen w-full overflow-hidden">
        
        {/* Left Section (Dark Theme) - Matching Onboarding welcome page */}
        <div className="hidden lg:flex lg:w-1/2 h-full bg-dark-glow text-white relative flex-col overflow-hidden justify-between p-12 shrink-0">
          {/* Background Earth image */}
          <img
            src="/earth.webp"
            alt="Globe Background"
            className="absolute top-0 left-0 w-full h-full object-cover opacity-30 z-0 pointer-events-none"
          />

          {/* Logo */}
          <div className="flex items-center gap-3 z-10">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <img
                src="/logo.svg"
                alt="Imperium Logo"
                className="w-[175px] h-[50px] object-contain brightness-0 invert"
              />
            </Link>
          </div>

          {/* Bottom context block in the Left panel */}
          <div className="z-10 mt-auto max-w-sm">
            <span className="text-[10px] font-bold tracking-[0.2em] text-brand-500 uppercase">Design Lab Showcase</span>
            <h2 className="text-3xl font-serif font-bold mt-2 mb-4">Auth Concept {currentV.toUpperCase()}</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Exploring dynamic authentication layouts that integrate with the Imperium news experience.
            </p>
          </div>
        </div>

        {/* Right Section (Varying themes per design, default to Light bg-dot-pattern) */}
        <div className={`lg:w-1/2 w-full flex flex-col justify-center px-6 py-12 md:px-16 lg:px-20 min-h-screen lg:min-h-0 lg:h-full lg:overflow-y-auto relative shrink-0 transition-colors duration-500 ${
          isV10 ? 'bg-editorial-ink text-white' : 'bg-dot-pattern text-editorial-ink'
        }`}>
          {children}
        </div>
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
