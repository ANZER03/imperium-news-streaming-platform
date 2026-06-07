const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'app', 'designs', 'explore');

if (!fs.existsSync(baseDir)) {
  fs.mkdirSync(baseDir, { recursive: true });
}

const commonData = `
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Hash, ArrowRight } from 'lucide-react';

const EXPLORE_CATEGORIES = [
  { id: 'politics', title: 'World Politics', short: 'World', image: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=400' },
  { id: 'tech', title: 'Technology', short: 'Tech', image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=400' },
  { id: 'science', title: 'Science', short: 'Science', image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=400' },
  { id: 'business', title: 'Markets & Economy', short: 'Business', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=400' },
  { id: 'culture', title: 'Culture & Arts', short: 'Culture', image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=400' },
];

const EXPLORE_KEYWORDS = ['Elections', 'AI', 'Startups', 'Climate', 'Space', 'Health', 'Markets', 'Sports'];
`;

const designs = [
  {
    v: 1,
    name: 'Editorial Stack',
    desc: 'Elegant serif fonts, thin borders, greyscale images that colorize on hover.',
    code: `
export default function ExploreV1() {
  return (
    <div className="min-h-screen bg-editorial-bg p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-serif italic text-editorial-ink mb-8 border-b border-editorial-border pb-4">The Explore Section</h2>
        
        {/* Categories */}
        <div className="flex gap-6 overflow-x-auto no-scrollbar pb-8">
          {EXPLORE_CATEGORIES.map((cat, i) => (
            <div key={cat.id} className="group relative min-w-[280px] h-[360px] shrink-0 border-l border-editorial-border pl-6 flex flex-col justify-between cursor-pointer">
              <span className="text-xs text-editorial-muted font-bold tracking-widest uppercase">0{i + 1}</span>
              <div className="relative w-full h-[240px] overflow-hidden rounded-sm">
                <Image src={cat.image} alt={cat.title} fill className="object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
              </div>
              <h3 className="font-serif text-2xl text-editorial-ink mt-4 group-hover:text-editorial-accent transition-colors">{cat.title}</h3>
            </div>
          ))}
        </div>

        {/* Keywords */}
        <div className="flex flex-wrap gap-4 pt-6 border-t border-editorial-border">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-sm font-serif italic text-editorial-muted hover:text-editorial-ink cursor-pointer px-4 py-1 border border-transparent hover:border-editorial-border rounded-full transition-all">
              # {kw}
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
    v: 2,
    name: 'Neo-Brutalism',
    desc: 'Thick borders, harsh shadows, bright accents, oversized bold text.',
    code: `
export default function ExploreV2() {
  return (
    <div className="min-h-screen bg-[#FFFDF9] p-8 font-sans">
      <div className="max-w-5xl mx-auto border-4 border-black p-8 bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-end justify-between mb-8 border-b-4 border-black pb-4">
          <h2 className="text-5xl font-black uppercase tracking-tighter text-black">Explore</h2>
          <span className="text-xl font-bold bg-[#6F3FF5] text-white px-4 py-1 border-2 border-black">TRENDING NOW</span>
        </div>
        
        <div className="flex gap-6 overflow-x-auto no-scrollbar pb-8 snap-x">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[260px] h-[320px] shrink-0 border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 transition-all cursor-pointer snap-center overflow-hidden flex flex-col">
              <div className="relative w-full h-[60%] border-b-4 border-black">
                <Image src={cat.image} alt={cat.title} fill className="object-cover" />
              </div>
              <div className="p-4 flex-1 flex items-center bg-[#E6EDFF] group-hover:bg-[#6F3FF5] transition-colors">
                <h3 className="font-black text-2xl text-black group-hover:text-white uppercase leading-none">{cat.title}</h3>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar mt-4">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="whitespace-nowrap text-lg font-bold text-black border-2 border-black px-4 py-2 bg-yellow-300 hover:bg-yellow-400 cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
              {kw.toUpperCase()}
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
    v: 3,
    name: 'Glassmorphic Floating',
    desc: 'Blurry background gradients, floating pill-shaped cards.',
    code: `
export default function ExploreV3() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-editorial-surface to-editorial-bg p-8 font-sans relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-editorial-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="max-w-6xl mx-auto relative z-10">
        <h2 className="text-2xl font-semibold text-editorial-ink mb-10 pl-4 border-l-4 border-editorial-accent">Discover Topics</h2>
        
        <div className="flex gap-8 overflow-x-auto no-scrollbar pb-12 pt-4 px-4">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[200px] h-[280px] shrink-0 rounded-full bg-white/60 backdrop-blur-md border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.05)] hover:shadow-[0_16px_48px_rgba(111,63,245,0.15)] hover:-translate-y-2 transition-all cursor-pointer p-2 flex flex-col items-center">
              <div className="relative w-full aspect-square rounded-full overflow-hidden shadow-inner mb-6">
                <Image src={cat.image} alt={cat.title} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <h3 className="font-medium text-center text-editorial-ink px-4">{cat.short}</h3>
              <div className="mt-auto mb-4 w-8 h-8 rounded-full bg-editorial-surface flex items-center justify-center text-editorial-accent opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight size={16} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-3 mt-4">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-sm font-medium text-editorial-muted bg-white/50 backdrop-blur border border-white/60 px-5 py-2 rounded-2xl hover:bg-white hover:text-editorial-accent cursor-pointer shadow-sm transition-all">
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
    v: 4,
    name: 'Panoramic Ticker',
    desc: 'Wide-aspect ratio cards, scrolling marquee ticker for keywords.',
    code: `
export default function ExploreV4() {
  return (
    <div className="min-h-screen bg-editorial-bg p-8 font-sans">
      <div className="max-w-full mx-auto">
        <div className="flex items-center justify-between px-8 mb-6">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-editorial-muted">Panorama</h2>
          <div className="flex gap-2">
            <button className="w-8 h-8 border border-editorial-border flex items-center justify-center rounded hover:bg-editorial-surface"><ChevronLeft size={16}/></button>
            <button className="w-8 h-8 border border-editorial-border flex items-center justify-center rounded hover:bg-editorial-surface"><ChevronRight size={16}/></button>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto no-scrollbar px-8 pb-8">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[400px] h-[200px] shrink-0 rounded-xl overflow-hidden cursor-pointer shadow-sm border border-editorial-border">
              <Image src={cat.image} alt={cat.title} fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent p-6 flex flex-col justify-end">
                <h3 className="font-serif text-3xl text-white font-medium">{cat.title}</h3>
                <div className="w-0 group-hover:w-12 h-0.5 bg-white mt-4 transition-all duration-500" />
              </div>
            </div>
          ))}
        </div>

        <div className="w-full overflow-hidden bg-editorial-ink text-editorial-bg py-3 mt-4 flex items-center">
          <div className="flex whitespace-nowrap animate-shimmer gap-8 items-center">
            {/* Repeat keywords a few times to create infinite effect illusion */}
            {[...EXPLORE_KEYWORDS, ...EXPLORE_KEYWORDS, ...EXPLORE_KEYWORDS].map((kw, i) => (
              <span key={i} className="text-sm font-bold uppercase tracking-widest flex items-center gap-4">
                {kw} <span className="w-1.5 h-1.5 bg-editorial-accent rounded-full inline-block"/>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
`
  },
  {
    v: 5,
    name: 'Minimalist Typographic',
    desc: 'No images, focusing purely on gorgeous oversized serif typography.',
    code: `
export default function ExploreV5() {
  return (
    <div className="min-h-screen bg-[#111111] p-8 font-sans text-white">
      <div className="max-w-6xl mx-auto py-12">
        <h2 className="text-sm font-light text-neutral-400 mb-16 tracking-widest uppercase border-b border-neutral-800 pb-4">Index / Explore</h2>
        
        <div className="flex gap-16 overflow-x-auto no-scrollbar pb-12 px-4">
          {EXPLORE_CATEGORIES.map((cat, i) => (
            <div key={cat.id} className="group relative min-w-[240px] shrink-0 cursor-pointer flex flex-col">
              <span className="text-[140px] font-serif leading-none text-neutral-800 group-hover:text-white transition-colors duration-500">
                {cat.short.charAt(0)}
              </span>
              <div className="mt-8">
                <span className="text-xs text-neutral-500 block mb-2">0{i + 1}</span>
                <h3 className="font-sans text-xl text-neutral-300 group-hover:text-white group-hover:translate-x-2 transition-all">{cat.title}</h3>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-neutral-800 flex flex-wrap gap-8">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-base text-neutral-500 hover:text-white cursor-pointer transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-px after:bg-white hover:after:w-full after:transition-all">
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
    v: 6,
    name: 'Cinematic Dark Mode',
    desc: 'Fully dark, deep black vignettes, glowing accent borders.',
    code: `
export default function ExploreV6() {
  return (
    <div className="min-h-screen bg-black p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-px bg-editorial-accent" />
          <h2 className="text-xl text-white font-medium tracking-wide">Trending Topics</h2>
        </div>
        
        <div className="flex gap-6 overflow-x-auto no-scrollbar pb-8">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[280px] h-[400px] shrink-0 rounded-2xl overflow-hidden cursor-pointer bg-neutral-900 border border-neutral-800 hover:border-editorial-accent/50 transition-colors shadow-[0_0_0_0_rgba(111,63,245,0)] hover:shadow-[0_0_30px_0_rgba(111,63,245,0.2)]">
              <Image src={cat.image} alt={cat.title} fill className="object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6 w-full translate-y-4 group-hover:translate-y-0 transition-transform">
                <h3 className="font-sans text-2xl font-bold text-white mb-2">{cat.short}</h3>
                <p className="text-sm text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity delay-100">Explore the latest in {cat.short.toLowerCase()}.</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-4 overflow-x-auto no-scrollbar mt-6">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-sm text-neutral-300 bg-neutral-900 border border-neutral-800 px-5 py-2.5 rounded-lg hover:border-editorial-accent hover:text-white cursor-pointer transition-colors flex items-center gap-2">
              <Hash size={14} className="text-editorial-accent" />
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
    v: 7,
    name: 'Retro Magazine',
    desc: 'Sepia background, dotted borders, classic newspaper layouts.',
    code: `
export default function ExploreV7() {
  return (
    <div className="min-h-screen bg-[#F4F0EA] p-8 font-serif text-[#2C2825]">
      <div className="max-w-5xl mx-auto border-t-2 border-b-2 border-[#2C2825] py-8">
        <h2 className="text-center text-4xl uppercase tracking-[0.3em] border-b border-dashed border-[#2C2825] pb-6 mb-8">
          The Explore Section
        </h2>
        
        <div className="flex gap-8 overflow-x-auto no-scrollbar pb-8">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[220px] shrink-0 cursor-pointer flex flex-col items-center text-center">
              <div className="relative w-full aspect-[3/4] border border-[#2C2825] p-2 bg-white shadow-[4px_4px_0_0_#2C2825] group-hover:-translate-y-2 group-hover:shadow-[6px_6px_0_0_#2C2825] transition-all">
                <div className="relative w-full h-full overflow-hidden filter sepia-[0.5] contrast-125 group-hover:sepia-0 transition-all duration-500">
                  <Image src={cat.image} alt={cat.title} fill className="object-cover" />
                </div>
              </div>
              <h3 className="text-xl font-bold uppercase mt-6 tracking-widest">{cat.short}</h3>
              <div className="w-12 h-0.5 bg-[#2C2825] mt-3" />
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-dashed border-[#2C2825] flex justify-center flex-wrap gap-x-8 gap-y-4">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-sm font-bold uppercase tracking-widest hover:text-[#6F3FF5] cursor-pointer transition-colors">
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
    v: 8,
    name: 'Interactive Accordion',
    desc: 'Cards are thin slices that expand to full width on hover.',
    code: `
export default function ExploreV8() {
  return (
    <div className="min-h-screen bg-editorial-bg p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-editorial-ink mb-8">Focus Areas</h2>
        
        <div className="flex h-[400px] w-full gap-2 overflow-hidden">
          {EXPLORE_CATEGORIES.map((cat, i) => (
            <div key={cat.id} className="group relative flex-1 hover:flex-[3] transition-all duration-700 ease-in-out cursor-pointer rounded-2xl overflow-hidden bg-editorial-surface border border-editorial-border">
              <Image src={cat.image} alt={cat.title} fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              
              {/* Collapsed view */}
              <div className="absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition-opacity duration-300 bg-black/40">
                <h3 className="text-white font-bold tracking-widest uppercase origin-center -rotate-90 whitespace-nowrap">{cat.short}</h3>
              </div>

              {/* Expanded view */}
              <div className="absolute bottom-0 left-0 p-8 w-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100 flex justify-between items-end">
                <div>
                  <span className="text-editorial-accent font-bold mb-2 block">0{i+1}</span>
                  <h3 className="font-serif text-4xl text-white mb-2">{cat.title}</h3>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                  <ArrowRight size={20} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-4 mt-8">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="px-4 py-2 bg-editorial-surface rounded-lg text-sm font-medium text-editorial-muted hover:text-editorial-ink hover:bg-editorial-border cursor-pointer transition-colors">
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
    v: 9,
    name: 'Sleek Tech Lines',
    desc: 'Dark minimalist background, neon thin borders, tech-focused.',
    code: `
export default function ExploreV9() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] p-8 font-mono">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-[#6F3FF5] text-sm mb-6 flex items-center gap-4">
          <span className="w-2 h-2 bg-[#6F3FF5] rounded-full animate-pulse" />
          SYSTEM_EXPLORE_MODULE
        </h2>
        
        <div className="flex gap-6 overflow-x-auto no-scrollbar pb-8">
          {EXPLORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="group relative min-w-[280px] h-[320px] shrink-0 cursor-pointer bg-[#111] border border-[#222] hover:border-[#6F3FF5] transition-colors p-4 flex flex-col">
              <div className="relative w-full flex-1 overflow-hidden opacity-50 group-hover:opacity-100 transition-opacity filter grayscale group-hover:grayscale-0">
                <Image src={cat.image} alt={cat.title} fill className="object-cover" />
                <div className="absolute inset-0 bg-[#6F3FF5]/10 group-hover:bg-transparent transition-colors" />
              </div>
              <div className="pt-4 mt-4 border-t border-[#222] group-hover:border-[#6F3FF5]/50 transition-colors flex justify-between items-center">
                <h3 className="text-white text-lg tracking-wider uppercase">{cat.short}</h3>
                <span className="text-neutral-500 text-xs">[{cat.id}]</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-xs text-neutral-400 bg-[#111] border border-[#222] px-4 py-3 hover:text-[#6F3FF5] hover:border-[#6F3FF5]/50 cursor-pointer transition-colors text-center uppercase tracking-widest">
              > {kw}
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
    v: 10,
    name: 'Asymmetric Grid Carousel',
    desc: 'Alternating vertical alignments giving a dynamic masonry feel horizontally.',
    code: `
export default function ExploreV10() {
  return (
    <div className="min-h-screen bg-editorial-bg p-8 font-sans">
      <div className="max-w-full mx-auto px-4">
        <div className="flex items-center gap-6 mb-12">
          <h2 className="text-4xl font-serif text-editorial-ink">Explore</h2>
          <div className="flex-1 h-px bg-editorial-border" />
          <p className="text-sm text-editorial-muted max-w-xs text-right">Discover the latest stories across our curated sections.</p>
        </div>
        
        <div className="flex gap-6 overflow-x-auto no-scrollbar pb-12 pt-12 items-center">
          {EXPLORE_CATEGORIES.map((cat, i) => (
            <div key={cat.id} className={\`group relative min-w-[260px] w-[260px] shrink-0 cursor-pointer transition-transform duration-500 \${i % 2 === 0 ? '-translate-y-8' : 'translate-y-8'}\`}>
              <div className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden shadow-lg group-hover:shadow-2xl transition-all duration-500">
                <Image src={cat.image} alt={cat.title} fill className="object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
              </div>
              <div className="mt-6 text-center">
                <h3 className="font-serif text-2xl text-editorial-ink mb-1">{cat.title}</h3>
                <span className="text-xs font-bold uppercase tracking-widest text-editorial-accent">Section 0{i+1}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-16 max-w-3xl mx-auto">
          {EXPLORE_KEYWORDS.map(kw => (
            <span key={kw} className="text-sm text-editorial-ink bg-editorial-surface px-6 py-3 rounded-full hover:bg-editorial-ink hover:text-white cursor-pointer transition-colors font-medium">
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
  const dir = path.join(baseDir, "v" + d.v);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'page.tsx'), commonData + d.code);
});

console.log('Created 10 designs!');
