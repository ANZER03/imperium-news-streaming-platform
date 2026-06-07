'use client';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { feedService, bookmarkService } from '@/lib/services';
import type { FeedPage } from '@/lib/services/feed.service';
import { Article } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { NewsCard } from './NewsCard';
import { SkeletonCard } from './SkeletonCard';
import { ExploreHeader } from './ExploreHeader';
import { TopicCarousel } from '@/components/Header';
import { motion } from 'motion/react';
import { Loader2, Bookmark, RefreshCw } from 'lucide-react';

export type FeedListMode =
  | 'foryou'
  | 'latest'
  | 'topic'
  | 'saved'
  | 'explore'
  | 'search';

interface FeedListProps {
  mode: FeedListMode;
  /** Required when mode === 'topic'. Raw backend topic id (e.g. 'business_economy'). */
  topicId?: string;
  /** Search/Explore query string. */
  query?: string;
}

const SCROLLABLE_MODES: ReadonlySet<FeedListMode> = new Set([
  'foryou',
  'latest',
  'topic',
  'explore',
  'search',
]);

const REFRESHABLE_MODES: ReadonlySet<FeedListMode> = new Set([
  'foryou',
  'latest',
  'topic',
]);

/**
 * URL-driven feed renderer. The hosting page chooses what to show via the
 * `mode` prop — no Zustand reads for navigation state.
 *
 * - `foryou`   → personalized feed
 * - `latest`   → latest feed
 * - `topic`    → per-topic feed (uses raw backend `topicId`)
 * - `saved`    → user's bookmarks
 * - `explore`  → renders `ExploreHeader` + the For-You feed underneath
 * - `search`   → For-You feed filtered in-memory by `query`
 */
export function FeedList({ mode, topicId, query }: FeedListProps) {
  const { userId } = useAppStore();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);
  const activeKey = useRef('');

  const fetchFeed = useCallback(
    async (sid?: string): Promise<FeedPage | null> => {
      if (!userId) return null;
      try {
        switch (mode) {
          case 'latest':
            return await feedService.getLatest(userId, sid);
          case 'topic':
            if (!topicId) return null;
            return await feedService.getByTopic(userId, topicId, sid);
          case 'foryou':
          case 'explore':
          case 'search':
            // Explore + Search reuse the personalized feed and filter client-side.
            return await feedService.getFeed(userId, sid);
          default:
            return null;
        }
      } catch (err) {
        console.error('Feed fetch failed', err);
        return null;
      }
    },
    [userId, mode, topicId],
  );

  // Initial / reset load (fires when mode/topic changes)
  useEffect(() => {
    const key = `${mode}:${topicId ?? ''}`;
    activeKey.current = key;

    try {
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch {
      // noop
    }

    if (mode === 'saved') {
      if (!userId) return;
      setLoading(true);
      setArticles([]);
      setSessionId(undefined);
      setHasMore(false);
      bookmarkService
        .getAll(userId)
        .then((data) => {
          if (activeKey.current !== key) return;
          setArticles(data);
        })
        .catch((err) => console.error('Bookmarks fetch failed', err))
        .finally(() => {
          if (activeKey.current === key) setLoading(false);
        });
      return;
    }

    setLoading(true);
    setArticles([]);
    setSessionId(undefined);
    setHasMore(true);

    fetchFeed(undefined)
      .then((res) => {
        if (!res || activeKey.current !== key) return;
        setArticles(res.data);
        setSessionId(res.sessionId);
        setHasMore(res.hasMore);
      })
      .finally(() => {
        if (activeKey.current === key) setLoading(false);
      });
  }, [userId, mode, topicId, fetchFeed]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !sessionId) return;
    if (!SCROLLABLE_MODES.has(mode)) return;
    setLoadingMore(true);
    const res = await fetchFeed(sessionId);
    if (res) {
      setArticles((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const fresh = res.data.filter((a) => !existingIds.has(a.id));
        return [...prev, ...fresh];
      });
      setSessionId(res.sessionId);
      setHasMore(res.hasMore);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, sessionId, mode, fetchFeed]);

  const handleRefresh = useCallback(() => {
    if (!userId || !REFRESHABLE_MODES.has(mode)) return;
    setLoading(true);
    setArticles([]);
    setSessionId(undefined);
    setHasMore(true);
    fetchFeed(undefined)
      .then((res) => {
        if (!res) return;
        setArticles(res.data);
        setSessionId(res.sessionId);
        setHasMore(res.hasMore);
      })
      .finally(() => setLoading(false));
  }, [userId, mode, fetchFeed]);

  // Infinite scroll sentinel
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && !loadingMore && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMore, loadMore]);

  // Search / explore — filter in-memory from current articles
  const displayedArticles = (() => {
    if ((mode === 'search' || mode === 'explore') && query) {
      const q = query.toLowerCase();
      return articles.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.excerpt.toLowerCase().includes(q) ||
          a.topic.toLowerCase().includes(q),
      );
    }
    return articles;
  })();

  const renderEmpty = () => {
    let title = 'No articles found';
    let desc = `We couldn't find any articles here. Try refreshing or exploring other topics.`;

    if (mode === 'saved') {
      title = 'No saved articles';
      desc = 'Articles you save will appear here for later reading.';
    } else if (mode === 'search') {
      title = 'No results found';
      desc = `We couldn't find any articles matching "${query}".`;
    } else if (mode === 'explore' && query) {
      title = 'No results found';
      desc = `We couldn't find any articles matching "${query}".`;
    }

    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <div className="h-16 w-16 bg-editorial-surface flex items-center justify-center rounded-2xl text-editorial-muted">
          <Bookmark className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-serif font-bold text-editorial-ink">{title}</h3>
          <p className="text-sm text-editorial-muted max-w-xs mx-auto">{desc}</p>
        </div>
        {(mode === 'saved' || mode === 'search') && (
          <Link
            href="/"
            className="px-6 py-2 bg-editorial-ink text-white text-xs font-bold uppercase tracking-widest rounded-full"
          >
            Go to feed
          </Link>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col">
          <div className="flex justify-center items-center py-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="h-8 w-8 text-editorial-accent" />
            </motion.div>
          </div>
          <div className="divide-y divide-slate-200/80 pointer-events-none opacity-50">
            <SkeletonCard />
            <SkeletonCard hasImage={false} />
            <SkeletonCard />
          </div>
        </div>
      );
    }

    if (displayedArticles.length === 0) return renderEmpty();

    return (
      <div className="divide-y divide-slate-200/80">
        {mode === 'explore' && query && (
          <div className="px-6 py-6 md:px-8 bg-editorial-surface/30 border-b border-editorial-border">
            <h3 className="text-lg font-medium text-editorial-ink">
              Showing articles for{' '}
              <span className="text-editorial-accent">&ldquo;{query}&rdquo;</span>
            </h3>
          </div>
        )}
        {displayedArticles.map((article) => (
          <NewsCard key={article.id} article={article} />
        ))}

        {/* Infinite scroll sentinel */}
        <div
          ref={observerTarget}
          className="p-10 flex flex-col items-center justify-center bg-editorial-surface/30"
        >
          {loadingMore ? (
            <div className="flex flex-col items-center gap-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="h-8 w-8 text-editorial-accent" />
              </motion.div>
              <p className="text-xs font-serif italic text-editorial-muted">
                Curating more stories for you...
              </p>
            </div>
          ) : hasMore ? (
            <div className="h-10 w-full" />
          ) : (
            <p className="text-xs text-editorial-muted font-serif italic">
              You&apos;re all caught up.
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      {mode !== 'explore' && <TopicCarousel className="hidden lg:flex sticky top-0 z-30" />}
      {mode === 'explore' && <ExploreHeader />}
      {mode === 'search' && (
        <div className="px-6 py-8 md:px-8 border-b border-editorial-border bg-editorial-surface/30">
          <h2 className="text-3xl font-serif font-bold text-editorial-ink">
            Search results for{' '}
            <span className="text-editorial-accent">&ldquo;{query}&rdquo;</span>
          </h2>
          <p className="text-sm text-editorial-muted mt-2">
            Found {displayedArticles.length}{' '}
            {displayedArticles.length === 1 ? 'article' : 'articles'}
          </p>
        </div>
      )}
      {REFRESHABLE_MODES.has(mode) && !loading && (
        <div className="flex justify-end px-6 pt-4 pb-0 md:px-8">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 text-xs text-editorial-muted hover:text-editorial-ink transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      )}
      {renderContent()}
    </div>
  );
}
