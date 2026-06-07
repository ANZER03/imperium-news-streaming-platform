const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'app', 'designs', 'explore');

const commonData = `
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Hash, ArrowRight, ArrowLeft } from 'lucide-react';

const EXPLORE_CATEGORIES = [
  { id: 'news', title: 'News', short: 'News', image: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=400' },
  { id: 'religion', title: 'Religion', short: 'Religion', image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=400' },
  { id: 'beauty', title: 'Beauty', short: 'Beauty', image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=400' },
  { id: 'sports', title: 'Sports', short: 'Sports', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=400' },
];

const EXPLORE_KEYWORDS = ['Eternal Sunshine Tour', 'Ariana Grande', 'Positions', 'Rain On Me', 'Sweetener'];
`;

const designs = [
  {
    v: 11,
    name: 'X Clone (Faithful)',
    desc: 'Faithful recreation of the X dark mode trending layout with top-left text overlays and outline pills.',
    code: `
export default function ExploreV11() {
  return (
    <div className="min-h-screen bg-black p-8 font-sans">
      <div className="max-w-2xl mx-auto border border-neutral-800 pb-8 rounded-xl overflow-hidden">
        <div className="p-4 flex items-center gap-6">
          <ArrowLeft size={20} className="text-white cursor-pointer" />
          <h2 className="text-xl text-white font-bold tracking-wide">Global Trending</h2>
        </div>
        
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-4">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[130px] h-[160px] shrink-0 rounded-xl overflow-hidden cursor-pointer border border-neutral-800 hover:opacity-90 transition-opacity">
              <Image src={cat.image} alt={cat.title} fill className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/60" />
              <h3 className="absolute top-3 left-3 font-bold text-white text-[15px]">{cat.title}</h3>
            </div>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="whitespace-nowrap text-[13px] font-bold text-white border border-neutral-600 px-4 py-1.5 rounded-full hover:bg-neutral-800 cursor-pointer transition-colors">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
`
  },
  {
    v: 12,
    name: 'X-Inspired Minimalist',
    desc: 'Cleaner interpretation with borderless wider cards and prominent typography.',
    code: `
export default function ExploreV12() {
  return (
    <div className="min-h-screen bg-[#000000] p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl text-white font-bold tracking-tight">Global Trending</h2>
        </div>
        
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-6">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[200px] h-[140px] shrink-0 rounded-2xl overflow-hidden cursor-pointer">
              <Image src={cat.image} alt={cat.title} fill className="object-cover opacity-80 group-hover:scale-105 group-hover:opacity-100 transition-all duration-500" />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
              <h3 className="absolute bottom-4 left-4 font-black text-white text-xl tracking-tight">{cat.title}</h3>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2.5">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-sm font-semibold text-neutral-300 bg-neutral-900 hover:bg-neutral-800 px-5 py-2 rounded-full cursor-pointer transition-colors border border-transparent hover:border-neutral-700">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
`
  },
  {
    v: 13,
    name: 'X-Inspired Glass',
    desc: 'Familiar horizontal structure but utilizes frosted glassmorphism for overlays.',
    code: `
export default function ExploreV13() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8 font-sans">
      <div className="max-w-2xl mx-auto bg-[#121212] rounded-3xl p-6 border border-white/5 shadow-2xl">
        <h2 className="text-xl text-white font-semibold mb-6 flex items-center gap-3">
          <span className="w-1.5 h-6 bg-blue-500 rounded-full" /> Global Trending
        </h2>
        
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[160px] h-[200px] shrink-0 rounded-2xl overflow-hidden cursor-pointer shadow-lg">
              <Image src={cat.image} alt={cat.title} fill className="object-cover" />
              <div className="absolute bottom-0 w-full p-3 bg-black/40 backdrop-blur-md border-t border-white/10">
                <h3 className="font-semibold text-white text-sm text-center">{cat.title}</h3>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="whitespace-nowrap text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl hover:bg-blue-500/20 cursor-pointer transition-colors">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
`
  },
  {
    v: 14,
    name: 'X-Inspired Edge',
    desc: 'Dark mode layout with sharp edges and dense information layout.',
    code: `
export default function ExploreV14() {
  return (
    <div className="min-h-screen bg-[#050505] p-8 font-mono">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-lg text-white font-bold uppercase tracking-widest mb-6 border-b border-neutral-800 pb-2">/ Global Trending</h2>
        
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-8">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[150px] h-[150px] shrink-0 cursor-pointer overflow-hidden border border-neutral-800 hover:border-neutral-500 transition-colors bg-neutral-900">
              <Image src={cat.image} alt={cat.title} fill className="object-cover opacity-50 group-hover:opacity-80 transition-opacity filter grayscale group-hover:grayscale-0" />
              <div className="absolute top-0 left-0 bg-black/80 px-2 py-1">
                <h3 className="font-bold text-white text-xs uppercase">{cat.title}</h3>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-xs font-bold text-neutral-400 border-l-2 border-neutral-700 bg-neutral-900 px-3 py-1.5 hover:text-white hover:border-white cursor-pointer transition-all">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
`
  },
  {
    v: 15,
    name: 'X-Inspired Vibrant',
    desc: 'The classic X layout but heavily accented with brand colors for a pop of vibrancy.',
    code: `
export default function ExploreV15() {
  return (
    <div className="min-h-screen bg-black p-8 font-sans">
      <div className="max-w-2xl mx-auto border-l-4 border-editorial-accent pl-6 py-2">
        <h2 className="text-2xl text-white font-extrabold tracking-wide mb-6">Global Trending</h2>
        
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[140px] h-[180px] shrink-0 rounded-lg overflow-hidden cursor-pointer shadow-[0_0_15px_rgba(111,63,245,0.15)] hover:shadow-[0_0_25px_rgba(111,63,245,0.4)] transition-shadow">
              <Image src={cat.image} alt={cat.title} fill className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-editorial-accent/80 via-transparent to-black/50" />
              <h3 className="absolute bottom-3 left-3 font-bold text-white text-lg">{cat.title}</h3>
            </div>
          ))}
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="whitespace-nowrap text-sm font-semibold text-editorial-accent border border-editorial-accent/30 px-5 py-2 rounded-full hover:bg-editorial-accent hover:text-white cursor-pointer transition-colors shadow-[0_0_10px_rgba(111,63,245,0.1)]">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
`
  }
];

designs.forEach(d => {
  const dir = path.join(baseDir, 'v' + d.v);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'page.tsx'), commonData + d.code);
});

console.log('Created 5 X-inspired designs!');
