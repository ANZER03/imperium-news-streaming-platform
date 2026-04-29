import React from 'react';
import { Home, TrendingUp, Bookmark, User, PlaySquare } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export function MobileNav() {
  const { activeView, setView } = useAppStore();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-editorial-border bg-editorial-bg/95 px-4 pb-5 pt-3 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-end justify-between">
        <button 
          onClick={() => setView('feed')}
          className={`flex flex-col items-center justify-center transition-colors ${activeView === 'feed' ? 'text-editorial-accent' : 'text-editorial-muted hover:text-editorial-ink'}`}
        >
          <span className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${activeView === 'feed' ? 'bg-[#f1ebff]' : ''}`}>
            <Home className="h-6 w-6" />
          </span>
        </button>
        <button 
          onClick={() => setView('explore')}
          className={`flex flex-col items-center justify-center transition-colors ${activeView === 'explore' ? 'text-editorial-accent' : 'text-editorial-muted hover:text-editorial-ink'}`}
        >
          <span className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${activeView === 'explore' ? 'bg-[#f1ebff]' : ''}`}>
            <TrendingUp className={`h-6 w-6 ${activeView === 'explore' ? 'fill-none' : ''}`} />
          </span>
        </button>
        <button className="flex flex-col items-center justify-center text-editorial-muted hover:text-editorial-ink">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full">
            <PlaySquare className="h-6 w-6" />
          </span>
        </button>
        <button 
          onClick={() => setView('saved')}
          className={`flex flex-col items-center justify-center transition-colors ${activeView === 'saved' ? 'text-editorial-accent' : 'text-editorial-muted hover:text-editorial-ink'}`}
        >
          <span className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${activeView === 'saved' ? 'bg-[#f1ebff]' : ''}`}>
             <Bookmark className={`h-6 w-6 ${activeView === 'saved' ? 'fill-editorial-accent' : ''}`} />
          </span>
        </button>
        <button className="flex flex-col items-center justify-center text-editorial-muted hover:text-editorial-ink">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full">
             <User className="h-6 w-6" />
          </span>
        </button>
      </div>
    </nav>
  );
}
