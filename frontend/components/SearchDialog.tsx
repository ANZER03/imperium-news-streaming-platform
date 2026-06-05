'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { searchService, SearchArticle } from '@/lib/services/search.service';
import { Search, ArrowRight, X, BarChart, Loader2 } from 'lucide-react';
import { ArticleImage } from './Feed/ArticleImage';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';

const TRENDING_KEYWORDS = ['Technology', 'Economy', 'Election', 'AI', 'Global Markets'];

const PAGE_SIZE = 20;

// Deterministic mock for sentiment since it's not yet in the backend schema
function getSentiment(title: string) {
  const hash = title.length % 3;
  return hash === 0 ? 'Positive' : hash === 1 ? 'Neutral' : 'Negative';
}

type TimeFilterKey = 'all' | '24h' | '7d' | '30d' | '6m' | '1y' | '3y';

/** Convert a time filter key to an ISO `from` date string. */
function timeFilterToFrom(key: TimeFilterKey): string | undefined {
  if (key === 'all') return undefined;
  const now = Date.now();
  const DAY_MS = 24 * 3600 * 1000;
  const offsets: Record<string, number> = {
    '24h': DAY_MS,
    '7d': 7 * DAY_MS,
    '30d': 30 * DAY_MS,
    '6m': 180 * DAY_MS,
    '1y': 365 * DAY_MS,
    '3y': 3 * 365 * DAY_MS,
  };
  const ms = offsets[key];
  if (!ms) return undefined;
  return new Date(now - ms).toISOString();
}

export function SearchDialog() {
  const { isSearchOpen, setSearchOpen } = useAppStore();
  const [keyword, setKeyword] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilterKey>('all');

  const [articles, setArticles] = useState<SearchArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);

  const router = useRouter();
  const observerTarget = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch helper ──
  const fetchArticles = useCallback(
    async (query: string, filter: TimeFilterKey, page: number) => {
      const from = timeFilterToFrom(filter);
      return searchService.search({
        q: query || undefined,
        from,
        page,
        limit: PAGE_SIZE,
      });
    },
    [],
  );

  // ── Initial load (latest news) when dialog opens ──
  useEffect(() => {
    if (!isSearchOpen) return;
    setLoading(true);
    setArticles([]);
    setIsSearchMode(false);
    setKeyword('');
    setTimeFilter('all');
    fetchArticles('', 'all', 0)
      .then((res) => {
        setArticles(res.data);
        setNextPage(res.nextPage);
        setHasMore(res.hasMore);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isSearchOpen, fetchArticles]);

  // ── Search when keyword or time filter changes (debounced) ──
  useEffect(() => {
    // Skip the initial mount load — handled by the effect above
    if (!isSearchOpen) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      const hasQuery = keyword.trim().length > 0;
      setIsSearchMode(hasQuery);
      setLoading(true);
      setArticles([]);

      fetchArticles(keyword.trim(), timeFilter, 0)
        .then((res) => {
          setArticles(res.data);
          setNextPage(res.nextPage);
          setHasMore(res.hasMore);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 350);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, timeFilter]);

  // ── Load more (pagination) ──
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || nextPage === null) return;
    setLoadingMore(true);
    try {
      const res = await fetchArticles(keyword.trim(), timeFilter, nextPage);
      setArticles((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const fresh = res.data.filter((a) => !existingIds.has(a.id));
        return [...prev, ...fresh];
      });
      setNextPage(res.nextPage);
      setHasMore(res.hasMore);
    } catch {
      // swallow
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, nextPage, keyword, timeFilter, fetchArticles]);

  // ── Infinite scroll observer ──
  useEffect(() => {
    const target = observerTarget.current;
    const container = scrollContainerRef.current;
    if (!target || !container) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && !loadingMore && hasMore) {
          loadMore();
        }
      },
      { root: container, threshold: 0.1 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMore, loadMore]);

  // ── Close on Escape ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false);
    };
    if (isSearchOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, setSearchOpen]);

  // ── Lock body scroll ──
  useEffect(() => {
    if (isSearchOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSearchOpen]);

  // ── Sentiment counts ──
  const totalResults = articles.length;
  const sentimentCounts = articles.reduce(
    (acc, art) => {
      const s = getSentiment(art.title);
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const handleArticleClick = (id: string) => {
    router.push(`/article/${id}`);
  };

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col md:items-center md:justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-editorial-ink/60 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
          />

          {/* Dialog Box */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className="relative bg-editorial-bg md:border border-editorial-border w-full h-full md:h-[85vh] md:max-w-6xl overflow-y-auto md:overflow-hidden shadow-2xl flex flex-col p-4 md:p-10 rounded-none md:rounded-2xl"
          >
            {/* Header */}
            <div className="flex justify-between items-baseline border-b border-editorial-border pb-4 mb-6 shrink-0 mt-4 md:mt-0">
              <div>
                <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-editorial-accent">
                  Search &amp; Explore
                </span>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1 font-serif text-editorial-ink">
                  {isSearchMode ? 'Search Results' : 'Latest News'}
                </h2>
              </div>
              <button
                className="text-editorial-muted hover:text-editorial-ink transition-colors p-2 bg-editorial-surface rounded-full"
                onClick={() => setSearchOpen(false)}
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8 flex-1 overflow-visible md:overflow-hidden min-h-0">
              {/* Left Column: Filters */}
              <div className="space-y-6 md:border-r border-editorial-border md:pr-6 shrink-0 md:overflow-y-auto no-scrollbar pb-10 md:pb-0">
                <div className="relative border-b-2 border-editorial-border py-2 focus-within:border-editorial-accent transition-colors">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-editorial-muted block mb-1">
                    Keywords
                  </span>
                  <input
                    type="text"
                    placeholder="Search news, topics..."
                    value={keyword}
                    autoFocus
                    onChange={(e) => setKeyword(e.target.value)}
                    className="w-full bg-transparent outline-none text-base text-editorial-ink placeholder:text-editorial-muted/50 pr-8"
                  />
                  <Search className="absolute right-0 bottom-3 w-4 h-4 text-editorial-muted" />
                </div>

                <div>
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-editorial-muted block mb-3">
                    Date
                  </span>
                  <div className="flex flex-col gap-2 text-xs font-sans font-bold">
                    {([
                      { key: 'all', label: 'All Time' },
                      { key: '24h', label: 'Past 24 hours' },
                      { key: '7d', label: 'Past week' },
                      { key: '30d', label: 'Past 30 days' },
                      { key: '6m', label: 'Past 6 months' },
                      { key: '1y', label: 'Past year' },
                      { key: '3y', label: 'Past 3 years' },
                    ] as { key: TimeFilterKey; label: string }[]).map((btn) => (
                      <button
                        key={btn.key}
                        onClick={() => setTimeFilter(btn.key)}
                        className={`text-left px-3 py-2 border rounded-lg transition-colors ${
                          timeFilter === btn.key
                            ? 'bg-editorial-ink text-white border-editorial-ink'
                            : 'bg-editorial-surface border-transparent text-editorial-ink hover:border-editorial-border'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Middle Column: Results List (Span 2) */}
              <div className="md:col-span-2 flex flex-col min-h-0">
                <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-editorial-muted block border-b border-editorial-border pb-1 mb-4 shrink-0">
                  {isSearchMode ? 'Query Results' : 'Latest'}{' '}
                  {!loading && `(${articles.length}${hasMore ? '+' : ''})`}
                </span>

                <div
                  ref={scrollContainerRef}
                  className="flex-1 min-h-0 overflow-visible md:overflow-y-auto pr-2 no-scrollbar pb-10 md:pb-0"
                >
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                      >
                        <Loader2 className="w-8 h-8 text-editorial-accent" />
                      </motion.div>
                    </div>
                  ) : articles.length > 0 ? (
                    <div className="space-y-4">
                      {articles.map((art) => (
                        <div
                          key={art.id}
                          className="border-b border-editorial-border pb-4 last:border-0 group flex gap-4 cursor-pointer"
                          onClick={() => handleArticleClick(art.id)}
                        >
                          {art.imageUrl ? (
                            <div className="w-20 h-20 bg-editorial-surface border border-editorial-border rounded-xl overflow-hidden shrink-0">
                              <ArticleImage
                                src={art.imageUrl}
                                alt={art.title}
                                fill
                                sizes="(max-width: 768px) 80px, 80px"
                                containerClassName="w-full h-full relative"
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            </div>
                          ) : (
                            <div className="w-20 h-20 bg-editorial-surface border border-editorial-border rounded-xl shrink-0 flex items-center justify-center">
                              <span className="text-2xl opacity-20">📰</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline">
                              <span className="text-[10px] font-sans font-bold text-editorial-accent uppercase tracking-wider truncate mr-2">
                                {art.topic || art.sourceName}
                              </span>
                              <span className="text-[10px] font-sans text-editorial-muted shrink-0">
                                {(() => {
                                  const displayTimestamp = art.crawledAt ?? art.publishedAt;
                                  const dateObj = new Date(displayTimestamp > 1e10 ? displayTimestamp : displayTimestamp * 1000);
                                  const dd = String(dateObj.getDate()).padStart(2, '0');
                                  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                                  const yyyy = dateObj.getFullYear();
                                  return `${dd}/${mm}/${yyyy}`;
                                })()}
                              </span>
                            </div>
                            <h4 className="text-base font-bold leading-tight mt-1 group-hover:underline font-serif text-editorial-ink line-clamp-2">
                              {art.title}
                            </h4>
                            <p className="text-xs text-editorial-muted font-sans mt-1 line-clamp-2">
                              {art.excerpt}
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Infinite scroll sentinel */}
                      <div
                        ref={observerTarget}
                        className="py-6 flex justify-center"
                      >
                        {loadingMore ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: 'linear',
                            }}
                          >
                            <Loader2 className="w-6 h-6 text-editorial-accent" />
                          </motion.div>
                        ) : hasMore ? (
                          <div className="h-6 w-full" />
                        ) : (
                          <p className="text-xs text-editorial-muted font-serif italic">
                            No more articles.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-editorial-muted font-sans text-sm">
                      No matching articles found.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Sentiment & Trends */}
              <div className="md:border-l border-editorial-border md:pl-6 space-y-8 shrink-0 md:overflow-y-auto no-scrollbar pb-10 md:pb-0">
                <div className="bg-editorial-surface border border-editorial-border p-4 rounded-xl">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-editorial-ink block mb-3 flex items-center gap-1.5 border-b border-editorial-border pb-2">
                    <BarChart className="w-3.5 h-3.5" /> Sentiment Analysis
                  </span>
                  <div className="space-y-3 font-sans">
                    {['Positive', 'Neutral', 'Negative'].map((s) => {
                      const count = sentimentCounts[s] || 0;
                      const pct =
                        totalResults === 0
                          ? 0
                          : Math.round((count / totalResults) * 100);
                      return (
                        <div key={s}>
                          <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                            <span className="text-editorial-ink">{s}</span>
                            <span className="text-editorial-accent">
                              {pct}%
                            </span>
                          </div>
                          <div className="w-full bg-editorial-border h-1.5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.5, ease: 'easeOut' }}
                              className="h-full bg-editorial-accent"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-editorial-muted block mb-3">
                    Trending Searches
                  </span>
                  <div className="space-y-2">
                    {TRENDING_KEYWORDS.map((kw, i) => (
                      <button
                        key={i}
                        onClick={() => setKeyword(kw)}
                        className="flex items-center justify-between w-full text-left text-sm font-bold font-sans text-editorial-ink border-b border-editorial-border py-2 hover:text-editorial-accent transition-colors group"
                      >
                        <span>{kw}</span>
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
