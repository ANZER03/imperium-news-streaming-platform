'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Bell, Bookmark, User } from 'lucide-react';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { useAppStore } from '@/lib/store';

interface NavLink {
  id: string;
  icon: React.ElementType;
  href: string;
}
interface NavButton {
  id: string;
  icon: React.ElementType;
}
type NavItem = (NavLink & { kind: 'link' }) | (NavButton & { kind: 'button' });

const ITEMS: ReadonlyArray<NavItem> = [
  { kind: 'link',   id: 'feed',    icon: Home,     href: '/' },
  { kind: 'button', id: 'explore', icon: Search },
  { kind: 'button', id: 'notif',   icon: Bell },
  { kind: 'link',   id: 'saved',   icon: Bookmark, href: '/saved' },
  { kind: 'button', id: 'profile', icon: User },
];

function isActiveRoute(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function shouldFillIcon(id: string) {
  return id === 'feed' || id === 'notif' || id === 'saved' || id === 'profile';
}

export function MobileNav() {
  const pathname = usePathname();
  const visible = useScrollDirection();
  const { setSearchOpen } = useAppStore();

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-20 border-t border-editorial-border bg-editorial-bg/95 backdrop-blur md:hidden transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="mx-auto flex max-w-md items-center justify-between px-6 py-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            item.kind === 'link' ? isActiveRoute(pathname ?? '', item.href) : false;
          const className = `flex items-center justify-center rounded-full p-2.5 transition-colors ${
            active
              ? 'text-editorial-accent bg-editorial-accent/10'
              : 'text-editorial-muted hover:text-editorial-ink'
          }`;

          return item.kind === 'link' ? (
            <Link key={item.id} href={item.href} className={className}>
              <Icon
                className="h-[22px] w-[22px]"
                strokeWidth={active ? 2.75 : 2}
                fill={active && shouldFillIcon(item.id) ? 'currentColor' : 'none'}
              />
            </Link>
          ) : (
            <button 
              key={item.id} 
              className={className} 
              type="button"
              onClick={() => {
                if (item.id === 'explore') setSearchOpen(true);
              }}
            >
              <Icon
                className="h-[22px] w-[22px]"
                strokeWidth={active ? 2.75 : 2}
                fill={active && shouldFillIcon(item.id) ? 'currentColor' : 'none'}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
