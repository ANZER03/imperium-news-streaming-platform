'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Search, Bell, Bookmark, User, Settings, MoreHorizontal, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '@/lib/store';
import { authService } from '@/lib/services/auth.service';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavLink {
  id: string;
  icon: React.ElementType;
  label: string;
  href: string;
}

interface NavButton {
  id: string;
  icon: React.ElementType;
  label: string;
  /** No-op for now (Notifications / Profile / Settings). */
  onClick?: () => void;
}

type NavItem = (NavLink & { kind: 'link' }) | (NavButton & { kind: 'button' });

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { kind: 'link', id: 'feed',     icon: Home,     label: 'Home',          href: '/' },
  { kind: 'link', id: 'explore',  icon: Search,   label: 'Explore',       href: '/explore' },
  { kind: 'button', id: 'notif',  icon: Bell,     label: 'Notifications' },
  { kind: 'link', id: 'saved',    icon: Bookmark, label: 'Saved',         href: '/saved' },
  { kind: 'button', id: 'profile',icon: User,     label: 'Profile' },
  { kind: 'button', id: 'settings',icon: Settings,label: 'Settings' },
];

function shouldFillIcon(id: string) {
  return id === 'feed' || id === 'notif' || id === 'saved' || id === 'profile';
}

function isActiveRoute(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { userId, resetOnboarding, theme, setTheme } = useAppStore();
  const handle = userId ? `@${userId.slice(0, 8)}` : '@you';

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  const handleLogout = async () => {
    await authService.logout();
    resetOnboarding();
    router.push('/welcome');
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-50 bg-editorial-ink/30 backdrop-blur-[2px] lg:hidden transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
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
            <Link
              href="/"
              onClick={onClose}
              className="hidden lg:flex items-center p-3 mb-4 w-fit"
            >
              <Image
                src="/imperium_logo.svg"
                alt="Imperium"
                width={132}
                height={40}
                className="h-10 w-auto object-contain"
              />
            </Link>

            <nav className="flex flex-col gap-1 mt-4 lg:mt-0 w-full">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active =
                  item.kind === 'link' ? isActiveRoute(pathname ?? '', item.href) : false;
                const baseClass = `flex items-center gap-5 p-3 rounded-full hover:bg-editorial-surface transition-colors w-fit pr-6 ${
                  active
                    ? 'font-bold text-editorial-ink'
                    : 'font-medium text-editorial-muted hover:text-editorial-ink'
                }`;

                return item.kind === 'link' ? (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={onClose}
                    className={baseClass}
                  >
                    <Icon
                      className="w-[26px] h-[26px] shrink-0"
                      strokeWidth={active ? 2.75 : 2}
                      fill={active && shouldFillIcon(item.id) ? 'currentColor' : 'none'}
                    />
                    <span className="text-xl">{item.label}</span>
                  </Link>
                ) : (
                  <button
                    key={item.id}
                    onClick={item.onClick}
                    className={baseClass}
                    type="button"
                  >
                    <Icon
                      className="w-[26px] h-[26px] shrink-0"
                      strokeWidth={active ? 2.75 : 2}
                      fill={active && shouldFillIcon(item.id) ? 'currentColor' : 'none'}
                    />
                    <span className="text-xl">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Profile at bottom with dropdown */}
            <div className="mt-auto w-full relative" ref={dropdownRef}>
              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-0 mb-3 w-full lg:w-[220px] bg-editorial-bg border border-editorial-border rounded-2xl shadow-xl z-50 p-2"
                  >
                    <button
                      onClick={toggleTheme}
                      className="w-full text-left px-4 py-3 text-sm font-semibold text-editorial-ink hover:bg-editorial-surface rounded-xl transition-colors flex items-center gap-2.5 group"
                      type="button"
                    >
                      {theme === 'dark' ? (
                        <>
                          <Sun className="w-4 h-4 shrink-0 text-editorial-accent" />
                          <span>Light Mode</span>
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4 shrink-0 text-editorial-accent" />
                          <span>Dark Mode</span>
                        </>
                      )}
                    </button>

                    <div className="h-px bg-editorial-border my-1" />

                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors flex items-center justify-between group"
                    >
                      <span>Log out {handle}</span>
                      <span className="text-rose-450 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => setShowDropdown(prev => !prev)}
                className="flex items-center gap-3 p-3 rounded-full hover:bg-editorial-surface transition-colors w-full lg:w-[220px]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userId ?? 'imperium'}`}
                  alt="Profile"
                  className="w-10 h-10 rounded-full bg-editorial-surface shrink-0"
                />
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-[15px] font-bold text-editorial-ink leading-tight truncate w-full text-left">
                    Imperium
                  </span>
                  <span className="text-[14px] text-editorial-muted truncate w-full text-left">
                    {handle}
                  </span>
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
