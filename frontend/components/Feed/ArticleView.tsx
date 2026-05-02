'use client';
import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { ArrowLeft, Bookmark, Share2, MoreHorizontal } from 'lucide-react';
import Image from 'next/image';
import { articleService } from '@/lib/services';
import { Article } from '@/lib/types';
import { relativeTime } from '@/lib/utils/time';
import { getTopicMeta } from '@/lib/utils/topic';
import { motion } from 'motion/react';

export function ArticleView() {
  const { selectedArticle, closeArticle, toggleSaved, savedArticles } = useAppStore();
  const [detail, setDetail] = useState<Article | null>(null);
  const [bodyLoading, setBodyLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Fetch full article body whenever a new article is opened
  useEffect(() => {
    if (!selectedArticle) return;
    setDetail(null);
    setBodyLoading(true);
    setImageLoaded(false);

    const controller = new AbortController();

    articleService.getDetails(selectedArticle.id, controller.signal)
      .then(d => { if (!controller.signal.aborted) setDetail(d); })
      .catch(err => { if (err?.name !== 'AbortError') console.error(err); })
      .finally(() => { if (!controller.signal.aborted) setBodyLoading(false); });

    return () => controller.abort();
  }, [selectedArticle?.id]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!selectedArticle) return null;

  const article = detail ?? selectedArticle;
  const isSaved = savedArticles.includes(selectedArticle.id);
  const imageUrl = article.imageUrl;
  const topic = getTopicMeta(selectedArticle.topic);

  const handleSave = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    toggleSaved(selectedArticle.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      className="fixed inset-0 z-[100] bg-white overflow-y-auto"
    >
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-editorial-border bg-white/95 px-4 py-3 backdrop-blur md:px-8">
        <button
          onClick={closeArticle}
          className="flex items-center gap-2 rounded-full p-2 hover:bg-black/5 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-editorial-ink" />
          <span className="font-medium text-sm uppercase tracking-widest text-editorial-ink hidden sm:inline">Back to feed</span>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} className="rounded-full p-2 hover:bg-black/5 transition-colors">
            <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-editorial-accent text-editorial-accent' : 'text-editorial-ink'}`} />
          </button>
          <button className="rounded-full p-2 hover:bg-black/5 transition-colors">
            <Share2 className="h-4 w-4 text-editorial-ink" />
          </button>
          <button className="rounded-full p-2 hover:bg-black/5 transition-colors">
            <MoreHorizontal className="h-4 w-4 text-editorial-ink" />
          </button>
        </div>
      </div>

      <article className="px-6 py-10 md:px-12 md:py-16 max-w-3xl mx-auto" dir="auto">
        {/* Meta */}
        <div className="mb-6 flex items-center gap-3">
          <span
            className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-widest"
            style={{ backgroundColor: topic.bg, color: topic.text }}
          >
            {topic.label || selectedArticle.topic}
          </span>
          <span className="text-xs text-editorial-muted">
            {relativeTime(selectedArticle.publishedAt)}
            {selectedArticle.sourceName && <> &bull; {selectedArticle.sourceName}</>}
          </span>
        </div>

        {/* Title — available immediately from card data */}
        <h1 className="mb-8 text-4xl font-serif font-bold leading-[1.1] tracking-tight text-editorial-ink md:text-5xl" dir="auto">
          {selectedArticle.title}
        </h1>

        {/* Author (from detail) */}
        {detail?.author && (
          <p className="text-sm text-editorial-muted mb-6">By {detail.author}</p>
        )}

        {/* Hero image with skeleton */}
        {imageUrl && (
          <div className="relative mb-10 aspect-video w-full overflow-hidden rounded-sm bg-editorial-surface">
            {!imageLoaded && (
              <div className="absolute inset-0 z-10 bg-gradient-to-r from-editorial-surface via-white/60 to-editorial-surface animate-[shimmer_2s_infinite]" />
            )}
            <Image
              src={imageUrl}
              alt={selectedArticle.title}
              fill
              className={`object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              referrerPolicy="no-referrer"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
              unoptimized
            />
          </div>
        )}

        {/* Body */}
        <div className="max-w-none text-editorial-ink pb-20">
          {/* Excerpt — always available from card */}
          <p className="text-xl md:text-2xl font-serif leading-relaxed text-editorial-muted mb-8 italic" dir="auto">
            {selectedArticle.excerpt}
          </p>

          <div className="mt-8 text-base md:text-lg leading-relaxed space-y-6">
            {bodyLoading ? (
              // Body skeleton — shown while fetching full article
              <div className="flex flex-col gap-4 animate-pulse">
                <div className="h-4 w-full rounded-sm bg-editorial-border/60" />
                <div className="h-4 w-11/12 rounded-sm bg-editorial-border/60" />
                <div className="h-4 w-4/5 rounded-sm bg-editorial-border/60" />
                <div className="h-4 w-full rounded-sm bg-editorial-border/60" />
                <div className="h-4 w-3/4 rounded-sm bg-editorial-border/60" />
                <div className="h-4 w-full rounded-sm bg-editorial-border/60" />
                <div className="h-4 w-5/6 rounded-sm bg-editorial-border/60" />
                <div className="h-4 w-2/3 rounded-sm bg-editorial-border/60" />
              </div>
            ) : detail?.content ? (
              detail.content.split('\n').filter(Boolean).map((para, i) => (
                <p key={i} dir="auto">{para}</p>
              ))
            ) : (
              <p className="text-editorial-muted italic">Full article content is not available.</p>
            )}
          </div>

          {/* Source link */}
          {detail?.url && (
            <a
              href={detail.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 mt-8 text-xs font-semibold uppercase tracking-widest text-editorial-accent hover:underline"
            >
              Read original article →
            </a>
          )}
        </div>
      </article>

      {/* Floating save button */}
      <div className="fixed bottom-6 left-6 z-40 md:bottom-8 md:left-8">
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 rounded-full px-5 py-3 shadow-xl transition-all hover:scale-105 active:scale-95 ${
            isSaved ? 'bg-editorial-accent text-white' : 'bg-editorial-ink text-white hover:bg-neutral-800'
          }`}
        >
          <Bookmark className={`h-5 w-5 ${isSaved ? 'fill-white' : ''}`} />
          <span className="text-xs font-bold uppercase tracking-widest">
            {isSaved ? 'Saved' : 'Save Article'}
          </span>
        </button>
      </div>
    </motion.div>
  );
}
