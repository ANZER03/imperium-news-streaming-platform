import React from 'react';
import { Home, Bookmark, X, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import { useAppStore } from '@/lib/store';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { interests, activeView, activeTopic, setView, setTopic } = useAppStore();
  const displayTopics = interests.length > 0 ? interests : ['Technology', 'Business', 'World News', 'Science', 'Startups'];

  return (
    <>
      <div 
        className={`fixed inset-0 z-30 bg-editorial-ink/30 backdrop-blur-[2px] lg:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
      />
      <aside className={`fixed inset-y-0 left-0 z-40 w-[290px] overflow-y-auto no-scrollbar border-r border-editorial-border bg-editorial-bg transition-transform duration-300 lg:sticky lg:top-[126px] lg:h-[calc(100vh-126px)] lg:block lg:w-auto lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 lg:hidden">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-muted">Navigation</span>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-editorial-border text-editorial-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-10 px-6 pb-6 pt-6 flex flex-col">
          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-muted">Navigation</p>
            <ul className="space-y-3">
              <li 
                onClick={() => {
                  setView('feed');
                  onClose();
                }}
                className={`flex items-center gap-3 text-sm font-medium cursor-pointer transition-all ${
                  activeView === 'feed' 
                    ? 'text-editorial-ink border-l-2 border-editorial-accent pl-3 -ml-[18px]' 
                    : 'text-editorial-muted opacity-80 pl-[14px] hover:text-editorial-ink'
                }`}
              >
                <Home className="h-4 w-4" /> Feed
              </li>
              <li 
                onClick={() => {
                  setView('explore');
                  onClose();
                }}
                className={`flex items-center gap-3 text-sm font-medium cursor-pointer transition-all ${
                  activeView === 'explore' 
                    ? 'text-editorial-ink border-l-2 border-editorial-accent pl-3 -ml-[18px]' 
                    : 'text-editorial-muted opacity-80 pl-[14px] hover:text-editorial-ink'
                }`}
              >
                <TrendingUp className="h-4 w-4" /> Explore
              </li>
              <li 
                onClick={() => {
                  setView('saved');
                  onClose();
                }}
                className={`flex items-center gap-3 text-sm font-medium cursor-pointer transition-all ${
                  activeView === 'saved' 
                    ? 'text-editorial-ink border-l-2 border-editorial-accent pl-3 -ml-[18px]' 
                    : 'text-editorial-muted opacity-80 pl-[14px] hover:text-editorial-ink'
                }`}
              >
                <Bookmark className="h-4 w-4" /> Saved
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-muted">Your Topics</p>
              <button className="text-[10px] uppercase tracking-widest text-editorial-muted/70 hover:text-editorial-ink transition">Edit</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {displayTopics.slice(0, 8).map(topic => (
                <button 
                  key={topic} 
                  onClick={() => {
                    setTopic(topic);
                    onClose();
                  }}
                  className={`px-2 py-1 text-[11px] rounded-sm transition-all ${
                    activeView === 'feed' && activeTopic === topic
                      ? 'bg-editorial-accent text-white font-bold'
                      : 'bg-editorial-border/50 text-editorial-ink hover:bg-editorial-border'
                  }`}
                >
                  #{topic.replace(/\s+/g, '')}
                </button>
              ))}
            </div>
          </div>

        </div>
      </aside>
    </>
  );
}
