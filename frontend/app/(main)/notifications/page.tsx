'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  AlertCircle, 
  TrendingUp, 
  Bookmark, 
  Trash2, 
  Check, 
  CheckCheck, 
  Activity,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';

interface NotificationItem {
  id: string;
  type: 'trend' | 'system' | 'recommendation' | 'bookmark';
  title: string;
  description: string;
  time: string;
  read: boolean;
  link?: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    type: 'trend',
    title: 'Trend Breakout',
    description: 'Artificial Intelligence and LLM articles are surging in volume (230% increase) in the United States.',
    time: '12 minutes ago',
    read: false,
    link: '/explore?keyword=AI',
  },
  {
    id: 'n2',
    type: 'system',
    title: 'Pipeline Ingestion Resolved',
    description: 'Kafka stream latency has stabilized. Processing pipeline lag is back below 200ms.',
    time: '1 hour ago',
    read: false,
  },
  {
    id: 'n3',
    type: 'recommendation',
    title: 'New for You',
    description: '5 new high-authority articles published matching your interest in "Technology".',
    time: '3 hours ago',
    read: false,
    link: '/',
  },
  {
    id: 'n4',
    type: 'bookmark',
    title: 'Article Saved Offline',
    description: '"Global Markets Rally as Central Banks Signal Pause" has been successfully cached.',
    time: '1 day ago',
    read: true,
  },
  {
    id: 'n5',
    type: 'system',
    title: 'Welcome to Imperium News',
    description: 'Your real-time news intelligence stream is live. Customize your source filters and speed inside Settings.',
    time: '2 days ago',
    read: true,
    link: '/settings',
  },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'system' | 'trends'>('all');

  const handleMarkRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const handleDelete = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeFilter === 'unread') return !n.read;
    if (activeFilter === 'system') return n.type === 'system';
    if (activeFilter === 'trends') return n.type === 'trend';
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'trend':
        return <TrendingUp className="w-5 h-5 text-amber-500" />;
      case 'system':
        return <AlertCircle className="w-5 h-5 text-indigo-500 dark:text-sky-400" />;
      case 'recommendation':
        return <Sparkles className="w-5 h-5 text-violet-500 dark:text-blue-400" />;
      case 'bookmark':
        return <Bookmark className="w-5 h-5 text-emerald-500" />;
    }
  };

  // Modern SVG background indicator (Kafka stream mock metrics)
  const streamData = [12, 19, 15, 8, 22, 30, 25, 40, 35, 45, 55, 60, 48, 50, 72, 85, 90, 75, 65, 80, 95];

  return (
    <div className="py-6 px-4 md:px-6 min-h-screen">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight text-editorial-ink flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <span className="text-xs font-semibold bg-editorial-accent text-white px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </h1>
          <p className="text-editorial-muted text-sm mt-1">
            Real-time feed events and pipeline status alerts.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-sm font-semibold text-editorial-accent hover:opacity-80 transition-opacity"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {/* Stream Activity Visualizer Panel (Creative Detail) */}
      <div className="bg-editorial-surface border border-editorial-border rounded-2xl p-4 mb-6 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3 z-10 relative">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-editorial-accent animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-editorial-ink">Ingestion Pipeline Pulse</span>
          </div>
          <span className="text-xs text-editorial-muted font-mono">1,242 events/sec</span>
        </div>
        
        {/* SVG Sparkline visualization */}
        <div className="h-12 w-full flex items-end gap-[3px] z-10 relative">
          {streamData.map((val, i) => (
            <div 
              key={i} 
              className="flex-1 rounded-t bg-editorial-accent/20 hover:bg-editorial-accent transition-colors"
              style={{ height: `${val}%` }}
              title={`Load: ${val}%`}
            />
          ))}
        </div>
        
        <div className="absolute inset-0 bg-dot-pattern opacity-40 pointer-events-none" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
        {(['all', 'unread', 'system', 'trends'] as const).map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border capitalize transition-all ${
              activeFilter === filter
                ? 'bg-editorial-accent text-white border-editorial-accent shadow-sm'
                : 'bg-editorial-bg text-editorial-muted border-editorial-border hover:bg-editorial-surface hover:text-editorial-ink'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map(notification => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={`p-4 rounded-2xl border transition-all relative flex gap-4 ${
                  notification.read
                    ? 'bg-editorial-bg border-editorial-border/60 opacity-75'
                    : 'bg-editorial-surface border-editorial-accent/30 shadow-sm'
                }`}
              >
                {/* Unread badge */}
                {!notification.read && (
                  <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-editorial-accent" />
                )}

                {/* Left icon wrapper */}
                <div className="w-10 h-10 rounded-xl bg-editorial-bg border border-editorial-border flex items-center justify-center shrink-0">
                  {getIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <h3 className="font-semibold text-[15px] text-editorial-ink leading-snug flex items-center gap-2">
                    {notification.title}
                  </h3>
                  <p className="text-sm text-editorial-muted mt-1 leading-relaxed">
                    {notification.description}
                  </p>
                  
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs text-editorial-muted/80 font-mono">
                      {notification.time}
                    </span>

                    {notification.link && (
                      <Link 
                        href={notification.link}
                        className="text-xs font-semibold text-editorial-accent hover:underline"
                      >
                        View Details →
                      </Link>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 justify-between shrink-0">
                  {!notification.read && (
                    <button
                      onClick={() => handleMarkRead(notification.id)}
                      className="p-1.5 rounded-lg hover:bg-editorial-accent/10 text-editorial-accent transition-colors"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notification.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-editorial-muted hover:text-rose-600 transition-colors"
                    title="Dismiss"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 border border-dashed border-editorial-border rounded-2xl bg-editorial-surface/40"
            >
              <div className="w-12 h-12 rounded-full bg-editorial-surface flex items-center justify-center mx-auto mb-3">
                <Bell className="w-6 h-6 text-editorial-muted" />
              </div>
              <h3 className="font-semibold text-editorial-ink">All caught up!</h3>
              <p className="text-sm text-editorial-muted mt-1">
                No new notifications matching your filter.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
