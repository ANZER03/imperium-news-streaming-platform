# Exported Components: Sidebar and Social Cards (X-Style)

This document contains the React TypeScript code for the Sidebar and the primary Social News Card styles (X1 and X2) developed for the application.

## 1. Sidebar Component
The sidebar is designed with an X-inspired layout, featuring navigation links with large icons and a bottom profile section.

### Code (`components/Sidebar.tsx`)
```tsx
import React from 'react';
import { Home, Search, Bell, Bookmark, User, Settings, MoreHorizontal } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { activeView, setView } = useAppStore();

  const handleNav = (view: any) => {
    setView(view);
    onClose();
  };

  return (
    <>
      <div 
        className={`fixed inset-0 z-30 bg-editorial-ink/30 backdrop-blur-[2px] lg:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
      />
      <aside className={`fixed inset-y-0 left-0 z-40 w-[275px] overflow-y-auto no-scrollbar bg-white transition-transform duration-300 lg:sticky lg:top-[126px] lg:h-[calc(100vh-126px)] lg:block lg:w-[275px] lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col justify-between`}>
        <div className="flex flex-col h-full lg:items-end pr-4 py-4">
          
          {/* Navigation Links */}
          <nav className="flex flex-col gap-2 mt-4">
            <button 
              onClick={() => handleNav('feed')}
              className={`flex items-center gap-5 p-3 rounded-full hover:bg-slate-100 transition w-fit pr-6 ${
                activeView === 'feed' ? 'font-bold text-black' : 'font-medium text-slate-800'
              }`}
            >
              <Home className="w-[26px] h-[26px]" strokeWidth={activeView === 'feed' ? 2.5 : 2} />
              <span className="text-xl">Home</span>
            </button>

            <button 
              onClick={() => handleNav('explore')}
              className={`flex items-center gap-5 p-3 rounded-full hover:bg-slate-100 transition w-fit pr-6 ${
                activeView === 'explore' ? 'font-bold text-black' : 'font-medium text-slate-800'
              }`}
            >
              <Search className="w-[26px] h-[26px]" strokeWidth={activeView === 'explore' ? 2.5 : 2} />
              <span className="text-xl">Explore</span>
            </button>

            <button 
              onClick={() => handleNav('notifications')}
              className={`flex items-center gap-5 p-3 rounded-full hover:bg-slate-100 transition w-fit pr-6 ${
                activeView === 'notifications' as any ? 'font-bold text-black' : 'font-medium text-slate-800'
              }`}
            >
              <Bell className="w-[26px] h-[26px]" strokeWidth={activeView === 'notifications' as any ? 2.5 : 2} />
              <span className="text-xl">Notifications</span>
            </button>

            <button 
              onClick={() => handleNav('saved')}
              className={`flex items-center gap-5 p-3 rounded-full hover:bg-slate-100 transition w-fit pr-6 ${
                activeView === 'saved' ? 'font-bold text-black' : 'font-medium text-slate-800'
              }`}
            >
              <Bookmark className="w-[26px] h-[26px]" strokeWidth={activeView === 'saved' ? 2.5 : 2} />
              <span className="text-xl">Saved</span>
            </button>

            <button 
              onClick={() => handleNav('profile')}
              className={`flex items-center gap-5 p-3 rounded-full hover:bg-slate-100 transition w-fit pr-6 ${
                activeView === 'profile' as any ? 'font-bold text-black' : 'font-medium text-slate-800'
              }`}
            >
              <User className="w-[26px] h-[26px]" strokeWidth={activeView === 'profile' as any ? 2.5 : 2} />
              <span className="text-xl">Profile</span>
            </button>

            <button 
              onClick={() => handleNav('settings')}
              className={`flex items-center gap-5 p-3 rounded-full hover:bg-slate-100 transition w-fit pr-6 ${
                activeView === 'settings' ? 'font-bold text-black' : 'font-medium text-slate-800'
              }`}
            >
              <Settings className="w-[26px] h-[26px]" strokeWidth={activeView === 'settings' ? 2.5 : 2} />
              <span className="text-xl">Settings</span>
            </button>
            
          </nav>

          {/* Bottom Avatar Section */}
          <div className="mt-auto pb-4">
            <button className="flex justify-between items-center w-full p-3 rounded-full hover:bg-slate-100 transition gap-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <img 
                  src="https://api.dicebear.com/7.x/avataaars/svg?seed=rezna" 
                  alt="Avatar" 
                  className="w-10 h-10 rounded-full bg-slate-200 shrink-0"
                />
                <div className="flex flex-col items-start truncate">
                  <span className="text-[15px] font-bold text-black leading-tight truncate">REZNA</span>
                  <span className="text-[15px] text-slate-500 truncate">@anoir03</span>
                </div>
              </div>
              <MoreHorizontal className="w-5 h-5 text-slate-500 shrink-0 hidden lg:block" />
            </button>
          </div>

        </div>
      </aside>
    </>
  );
}
```

---

## 2. Social News Cards (X1 & X2)
These cards are modeled after social media feeds (X/Twitter).

### Code (`app/ui-social/components/SocialCards.tsx`)
```tsx
import React from 'react';
import Image from 'next/image';
import { Heart, MessageCircle, Share, Bookmark, MoreHorizontal, Repeat2 } from 'lucide-react';
import { Article } from '@/lib/types';

interface P { article: Article; onClick?: () => void; isSaved?: boolean; onSave?: (e: React.MouseEvent) => void; }
const num = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n;

const XBtn = ({ icon: Icon, v, onClick, active }: any) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-1.5 group transition-colors ${active ? 'text-blue-500' : 'hover:text-blue-500'}`}
  >
    <div className={`p-1.5 rounded-full ${active ? 'bg-blue-500/10' : 'group-hover:bg-blue-500/10'}`}>
      <Icon className="w-[18px] h-[18px]" fill={active ? "currentColor" : "none"} />
    </div>
    {v && <span className="text-[13px]">{v}</span>}
  </button>
);

const XActs = ({ r, isSaved, onSave }: any) => {
  const handleAction = (e: React.MouseEvent) => { e.stopPropagation(); };
  return (
    <div className="flex justify-between text-editorial-muted pt-2 w-full max-w-sm">
      <XBtn icon={MessageCircle} v="42" onClick={handleAction} />
      <XBtn icon={Repeat2} v="12" onClick={handleAction} />
      <XBtn icon={Heart} v={num(r || 124)} onClick={handleAction} />
      <XBtn icon={Bookmark} v="" onClick={onSave} active={isSaved} />
      <XBtn icon={Share} v="" onClick={handleAction} />
    </div>
  );
};

const Img = ({ src }: { src?: string }) => src ? (
  <div className="w-full relative aspect-video rounded-xl overflow-hidden my-2 border border-slate-200">
    <Image src={src} alt="" fill className="object-cover" referrerPolicy="no-referrer" />
  </div>
) : null;

// X1: Standard (Full-width content)
export const SocialCard1 = ({ article, onClick, isSaved, onSave }: P) => (
  <div onClick={onClick} className="p-4 bg-white border-b border-slate-200 cursor-pointer flex flex-col">
    <div className="flex justify-between mb-2">
      <div className="text-sm font-bold text-slate-900">{article.author} <span className="text-slate-500 font-normal">· {article.publishedAt}</span></div>
      <MoreHorizontal className="w-5 h-5 text-slate-500"/>
    </div>
    <h2 className="text-xl font-bold font-tight text-slate-900 leading-tight mb-1">{article.title}</h2>
    <p className="text-[15px] text-slate-600 line-clamp-2">{article.excerpt}</p>
    <Img src={article.imageUrl} />
    <XActs r={article.reactions} isSaved={isSaved} onSave={onSave} />
  </div>
);

// X2: Compact (Image on the right)
export const SocialCard2 = ({ article, onClick, isSaved, onSave }: P) => (
  <div onClick={onClick} className="p-4 bg-white border-b border-slate-200 cursor-pointer flex flex-col">
    <div className="text-xs font-bold uppercase tracking-widest text-slate-900 mb-2">{article.author} · {article.publishedAt}</div>
    <div className="flex gap-4">
      <div className="flex-1">
        <h2 className="text-lg font-bold text-slate-900 mb-1">{article.title}</h2>
        <p className="text-sm text-slate-600 line-clamp-2">{article.excerpt}</p>
      </div>
      {article.imageUrl && <div className="w-24 h-24 shrink-0 relative rounded-lg overflow-hidden"><Image src={article.imageUrl} alt="" fill className="object-cover" /></div>}
    </div>
    <XActs r={article.reactions} isSaved={isSaved} onSave={onSave} />
  </div>
);
```
