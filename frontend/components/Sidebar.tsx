import React from 'react';
import { Home, Search, Bell, Bookmark, User, Settings, MoreHorizontal } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import Image from 'next/image';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { activeView, setView, userId } = useAppStore();

  const handleNav = (view: 'feed' | 'saved' | 'explore') => {
    setView(view);
    onClose();
  };

  const navItems = [
    { id: 'feed',    icon: Home,     label: 'Home',          action: () => handleNav('feed') },
    { id: 'explore', icon: Search,   label: 'Explore',       action: () => handleNav('explore') },
    { id: 'notif',   icon: Bell,     label: 'Notifications', action: () => {} },
    { id: 'saved',   icon: Bookmark, label: 'Saved',         action: () => handleNav('saved') },
    { id: 'profile', icon: User,     label: 'Profile',       action: () => {} },
    { id: 'settings',icon: Settings, label: 'Settings',      action: () => {} },
  ];

  const handle = userId ? `@${userId.slice(0, 8)}` : '@you';

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-50 bg-editorial-ink/30 backdrop-blur-[2px] lg:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-[60] w-[275px] overflow-y-auto no-scrollbar bg-editorial-bg border-r border-editorial-border transition-transform duration-300
          lg:static lg:sticky lg:top-0 lg:h-screen lg:w-full lg:translate-x-0 lg:border-r-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col`}
      >
        <div className="flex flex-col h-full py-4 pl-6">
          <div className="flex flex-col h-full items-start">
            <button onClick={() => handleNav('feed')} className="hidden lg:flex items-center p-3 mb-4 w-fit">
              <Image
                src="/imperium_logo.svg"
                alt="Imperium"
                width={132}
                height={40}
                className="h-10 w-auto object-contain"
              />
            </button>

            <nav className="flex flex-col gap-1 mt-4 lg:mt-0 w-full">
              {navItems.map(({ id, icon: Icon, label, action }) => {
                const active = activeView === id;
                return (
                  <button
                    key={id}
                    onClick={action}
                    className={`flex items-center gap-5 p-3 rounded-full hover:bg-editorial-surface transition-colors w-fit pr-6 ${
                      active ? 'font-bold text-editorial-ink' : 'font-medium text-editorial-muted hover:text-editorial-ink'
                    }`}
                  >
                    <Icon className="w-[26px] h-[26px] shrink-0" strokeWidth={active ? 2.5 : 2} />
                    <span className="text-xl">{label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Profile at bottom */}
            <div className="mt-auto w-full">
              <button className="flex items-center gap-3 p-3 rounded-full hover:bg-editorial-surface transition-colors w-full lg:w-[220px]">
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userId ?? 'imperium'}`}
                  alt="Profile"
                  className="w-10 h-10 rounded-full bg-editorial-surface shrink-0"
                />
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-[15px] font-bold text-editorial-ink leading-tight truncate w-full text-left">Imperium</span>
                  <span className="text-[14px] text-editorial-muted truncate w-full text-left">{handle}</span>
                </div>
                <MoreHorizontal className="w-5 h-5 text-editorial-muted shrink-0 ml-auto hidden lg:block" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
