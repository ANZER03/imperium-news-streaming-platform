'use client';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { fetchFeed } from '@/lib/api';
import { Article } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { NewsCard } from './NewsCard';
import { SkeletonCard } from './SkeletonCard';
import { ExploreHeader } from './ExploreHeader';
import { motion } from 'motion/react';
import { Loader2, Bookmark } from 'lucide-react';

export function FeedList() {
  const { interests, activeView, activeTopic, savedArticles, setView, searchQuery } = useAppStore();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerTarget = useRef(null);

  useEffect(() => {
    let mounted = true;
    
    // Reset scroll when switching topics or views
    try {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
    } catch(e) {}
    
    const initFetch = async () => {
      setLoading(true);
      try {
        const data = await fetchFeed(activeTopic === 'All' ? interests : [activeTopic]);
        
        let fetchedArticles = data;
        
        // Topic filtering (local fallback since it is a mock)
        if (activeTopic !== 'All' && activeTopic !== 'For You') {
            fetchedArticles = data.filter(a => a.topic.toLowerCase() === activeTopic.toLowerCase());
            if (fetchedArticles.length === 0) fetchedArticles = data;
        }

        if (mounted) {
          setArticles(fetchedArticles);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch feed", err);
        if (mounted) setLoading(false);
      }
    };

    initFetch();

    return () => {
      mounted = false;
    };
  }, [interests, activeView, activeTopic]); // Removed savedArticles

  const displayedArticles = useMemo(() => {
    let filtered = articles;
    if (activeView === 'saved') {
      filtered = filtered.filter(a => savedArticles.includes(a.id));
    }
    if ((activeView === 'search' || activeView === 'explore') && searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.title.toLowerCase().includes(q) || 
        a.excerpt.toLowerCase().includes(q) ||
        a.topic.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [articles, activeView, savedArticles, searchQuery]);

  const loadMoreArticles = useCallback(async () => {
    if (loadingMore || activeView === 'saved' || activeView === 'search' || (activeView === 'explore' && searchQuery)) return;
    setLoadingMore(true);
    
    // Artificial delay for effect as requested
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      const moreData = await fetchFeed(interests);
      // Append more mock data with new IDs to avoid key collisions
      const newArticles = moreData.map(article => ({
        ...article,
        id: `${article.id}-${Date.now()}-${Math.random()}`
      }));
      setArticles(prev => [...prev, ...newArticles]);
    } catch (err) {
      console.error("Failed to load more articles", err);
    } finally {
      setLoadingMore(false);
    }
  }, [interests, loadingMore, activeView, searchQuery]);

  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !loading && !loadingMore && displayedArticles.length > 0) {
          loadMoreArticles();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [loading, loadingMore, displayedArticles.length, loadMoreArticles]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col">
          <div className="flex justify-center items-center py-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
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

    if (displayedArticles.length === 0) {
      let emptyTitle = 'No articles found';
      let emptyDesc = `We couldn't find any articles under "${activeTopic}". Try exploring other topics.`;
      
      if (activeView === 'saved') {
        emptyTitle = 'No saved articles';
        emptyDesc = 'Articles you save will appear here for later reading.';
      } else if (activeView === 'search') {
        emptyTitle = 'No results found';
        emptyDesc = `We couldn't find any articles matching "${searchQuery}". Please try another search term.`;
      } else if (activeView === 'explore' && searchQuery) {
        emptyTitle = 'No results found';
        emptyDesc = `We couldn't find any articles matching "${searchQuery}". Please try another keyword.`;
      }

      return (
        <div className="flex flex-col">
          {activeView === 'search' && (
            <div className="px-6 py-8 md:px-8 border-b border-editorial-border bg-editorial-surface/30">
              <h2 className="text-3xl font-serif font-bold text-editorial-ink">
                Search results for <span className="text-editorial-accent">"{searchQuery}"</span>
              </h2>
              <p className="text-sm text-editorial-muted mt-2">
                Found 0 articles
              </p>
            </div>
          )}
          <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
            <div className="h-16 w-16 bg-editorial-surface flex items-center justify-center rounded-2xl text-editorial-muted">
              <Bookmark className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-serif font-bold text-editorial-ink">
                {emptyTitle}
              </h3>
              <p className="text-sm text-editorial-muted max-w-xs mx-auto">
                {emptyDesc}
              </p>
            </div>
            {(activeView === 'saved' || activeView === 'search') && (
              <button 
                onClick={() => setView('feed')}
                className="px-6 py-2 bg-editorial-ink text-white text-xs font-bold uppercase tracking-widest rounded-full"
              >
                Go to feed
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-200/80">
        {activeView === 'explore' && searchQuery && (
           <div className="px-6 py-6 md:px-8 bg-editorial-surface/30 border-b border-editorial-border">
             <h3 className="text-lg font-medium text-editorial-ink">
               Showing trending articles for <span className="text-editorial-accent">"{searchQuery}"</span>
             </h3>
           </div>
        )}
        {displayedArticles.map((article, i) => (
          <NewsCard key={article.id} article={article} />
        ))}
        
        {/* Infinite Scroll Sentinel & Loader */}
        <div ref={observerTarget} className="p-10 flex flex-col items-center justify-center bg-editorial-surface/30">
          {loadingMore ? (
            <div className="flex flex-col items-center gap-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-8 w-8 text-editorial-accent" />
              </motion.div>
              <p className="text-xs font-serif italic text-editorial-muted">Curating more stories for you...</p>
            </div>
          ) : (
            <div className="h-10 w-1 w-full" /> 
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      {activeView === 'explore' && <ExploreHeader />}
      {activeView === 'search' && (
        <div className="px-6 py-8 md:px-8 border-b border-editorial-border bg-editorial-surface/30">
          <h2 className="text-3xl font-serif font-bold text-editorial-ink">
            Search results for <span className="text-editorial-accent">"{searchQuery}"</span>
          </h2>
          <p className="text-sm text-editorial-muted mt-2">
            Found {displayedArticles.length} {displayedArticles.length === 1 ? 'article' : 'articles'}
          </p>
        </div>
      )}
      {renderContent()}
    </div>
  );
}
