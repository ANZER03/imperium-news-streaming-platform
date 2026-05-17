'use client';
import React from 'react';
import { Home, Search, Bell, Bookmark, User } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useScrollDirection } from '@/hooks/use-scroll-direction';

export function MobileNav() {
  const { activeView, setView } = useAppStore();
  const visible = useScrollDirection();

  const items = [
    { id: 'feed',    icon: Home,     action: () => setView('feed') },
    { id: 'explore', icon: Search,   action: () => setView('explore') },
    { id: 'notif',   icon: Bell,     action: () => {} },
    { id: 'saved',   icon: Bookmark, action: () => setView('saved') },
    { id: 'profile', icon: User,     action: () => {} },
  ];

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-20 border-t border-editorial-border bg-editorial-bg/95 backdrop-blur md:hidden transition-transform duration-300 ${visible ? 'translate-y-0' : 'translate-y-full'}`}
    >
      <div className="mx-auto flex max-w-md items-center justify-between px-6 py-2">
        {items.map(({ id, icon: Icon, action }) => {
          const active = activeView === id;
          return (
            <button
              key={id}
              onClick={action}
              className={`flex items-center justify-center rounded-full p-2.5 transition-colors ${
                active ? 'text-editorial-accent bg-editorial-accent/10' : 'text-editorial-muted hover:text-editorial-ink'
              }`}
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.5 : 2} fill={active && id === 'saved' ? 'currentColor' : 'none'} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
