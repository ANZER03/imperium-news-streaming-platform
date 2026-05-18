'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowUp,
  Bookmark,
  Heart,
  MessageCircle,
  Share2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAppStore } from '@/lib/store';
import { articleService } from '@/lib/services';
import { Article } from '@/lib/types';
import { relativeTime } from '@/lib/utils/time';
import { getTopicMeta } from '@/lib/utils/topic';
import { articleCache } from '@/lib/utils/article-cache';

interface LocalComment {
  id: string;
  author: string;
  avatar: string;
  content: string;
  publishedAt: number;
  likes: number;
  liked: boolean;
}

interface ArticleContentProps {
  articleId: string;
  /** Called by the back arrow / close affordances. Wrappers decide what this means. */
  onClose: () => void;
}

/**
 * Presentational article body + comments modal. Used by both the
 * intercepting modal route and the full-page /article/[id] route.
 *
 * Visual layout matches the legacy ArticleView dialog so the UX is identical
 * whether opened in-app (modal) or hard-loaded (full page).
 */
export function ArticleContent({ articleId, onClose }: ArticleContentProps) {
  const { toggleSaved, savedArticles, userId } = useAppStore();
  // Seed detail and loading state from the in-memory cache so the modal can
  // paint title/image/source/topic immediately on first render. If we already
  // have the full body cached, we skip the network call entirely.
  const [detail, setDetail] = useState<Article | null>(
    () => articleCache.get(articleId) ?? null,
  );
  const [bodyLoading, setBodyLoading] = useState(
    () => !articleCache.hasFullDetail(articleId),
  );
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<LocalComment[]>([]);

  // Ref to the underlying <img> element so we can detect when it's already
  // loaded from the browser's cache. `next/image` forwards refs to the
  // rendered <img>.
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const cached = articleCache.get(articleId);
    setDetail(cached ?? null);
    setShowComments(false);
    setComments([]);

    // Already have the full body — no fetch needed.
    if (articleCache.hasFullDetail(articleId)) {
      setBodyLoading(false);
      return;
    }

    setBodyLoading(true);
    const controller = new AbortController();
    articleService
      .getDetails(articleId, controller.signal)
      .then((d) => {
        if (!controller.signal.aborted) setDetail(d);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') console.error(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBodyLoading(false);
      });

    return () => controller.abort();
  }, [articleId]);

  // Synchronously detect cached images. `<img>.complete` is true the moment
  // the browser has the bitmap (including memory cache). We must do this in
  // useLayoutEffect — running after paint would briefly show the empty
  // placeholder even when the image is already available.
  useLayoutEffect(() => {
    if (!detail?.imageUrl) {
      setImageLoaded(false);
      return;
    }
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setImageLoaded(true);
    } else {
      setImageLoaded(false);
    }
  }, [detail?.imageUrl]);

  const isSaved = savedArticles.includes(articleId);
  const topic = getTopicMeta(detail?.topic);

  const handleSave = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    toggleSaved(articleId);
  };

  const handleShare = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/article/${articleId}`;
    const shareData = { title: detail?.title ?? 'Imperium News', url };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  const handlePostComment = () => {
    if (!comment.trim()) return;
    setComments((prev) => [
      {
        id: Date.now().toString(),
        author: 'You',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId ?? 'me'}`,
        content: comment.trim(),
        publishedAt: Date.now() / 1000,
        likes: 0,
        liked: false,
      },
      ...prev,
    ]);
    setComment('');
  };

  const toggleLike = (id: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, liked: !c.liked, likes: c.liked ? c.likes - 1 : c.likes + 1 }
          : c,
      ),
    );
  };

  return (
    <>
      {/* Sticky header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-editorial-border bg-editorial-bg/95 backdrop-blur px-4 py-3 md:px-8">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-editorial-muted hover:text-editorial-ink transition-colors rounded-full p-1"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline font-medium uppercase tracking-widest text-xs">
            Back
          </span>
        </button>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-editorial-accent">
          {topic.label || detail?.topic || ''}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            className="rounded-full p-2 hover:bg-editorial-surface transition-colors"
            aria-label={isSaved ? 'Unsave article' : 'Save article'}
          >
            <Bookmark
              className={`h-4 w-4 ${
                isSaved ? 'fill-editorial-accent text-editorial-accent' : 'text-editorial-ink'
              }`}
            />
          </button>
          <button
            onClick={handleShare}
            className="rounded-full p-2 hover:bg-editorial-surface transition-colors"
            aria-label="Share article"
          >
            <Share2 className="h-4 w-4 text-editorial-ink" />
          </button>
        </div>
      </header>

      <article className="max-w-2xl mx-auto px-6 py-10 md:py-14" dir="auto">
        {detail ? (
          <>
            {/* Topic + source */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-bold uppercase tracking-widest text-editorial-accent border border-editorial-accent px-2 py-0.5">
                {topic.label || detail.topic}
              </span>
              <span className="text-xs text-editorial-muted">
                {detail.sourceName} · {relativeTime(detail.publishedAt)} ago
              </span>
            </div>

            {/* Title */}
            <h1
              className="font-serif text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight text-editorial-ink mb-6"
              dir="auto"
            >
              {detail.title}
            </h1>

            {/* Author byline */}
            {detail.author && (
              <div className="flex items-center gap-3 mb-8 pb-8 border-b border-editorial-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${detail.author}`}
                  className="w-9 h-9 rounded-full bg-editorial-surface"
                  alt=""
                />
                <div>
                  <p className="text-sm font-semibold text-editorial-ink">
                    {detail.author}
                  </p>
                  <p className="text-xs text-editorial-muted">{detail.sourceName}</p>
                </div>
              </div>
            )}

            {/* Hero image */}
            {detail.imageUrl && (
              <div className="relative aspect-video w-full overflow-hidden rounded-sm mb-10 bg-editorial-surface">
                {!imageLoaded && (
                  <div className="absolute inset-0 z-10 bg-gradient-to-r from-editorial-surface via-white/60 to-editorial-surface animate-[shimmer_2s_infinite]" />
                )}
                <Image
                  ref={imgRef}
                  src={detail.imageUrl}
                  alt={detail.title}
                  fill
                  className={`object-cover transition-opacity duration-300 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  referrerPolicy="no-referrer"
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageLoaded(true)}
                  unoptimized
                />
              </div>
            )}

            {/* Body */}
            <div className="space-y-5 text-[17px] leading-[1.8] text-editorial-ink">
              {bodyLoading ? (
                <div className="flex flex-col gap-4 animate-pulse">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-4 rounded-sm bg-editorial-border/60 ${
                        i % 3 === 2 ? 'w-4/5' : 'w-full'
                      }`}
                    />
                  ))}
                </div>
              ) : detail.content ? (
                detail.content
                  .split('\n')
                  .filter(Boolean)
                  .map((p, i) => (
                    <p key={i} dir="auto">
                      {p}
                    </p>
                  ))
              ) : (
                <p className="text-editorial-muted italic">
                  Full article content is not available.
                </p>
              )}
            </div>

            {detail.url && (
              <a
                href={detail.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-10 text-xs font-bold uppercase tracking-widest text-editorial-accent hover:underline"
              >
                Read original →
              </a>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-6 animate-pulse">
            <div className="h-3 w-24 rounded-sm bg-editorial-border/60" />
            <div className="h-12 w-full rounded-sm bg-editorial-border/60" />
            <div className="h-12 w-3/4 rounded-sm bg-editorial-border/60" />
            <div className="aspect-video w-full rounded-sm bg-editorial-border/40 mt-4" />
            <div className="h-4 w-full rounded-sm bg-editorial-border/60" />
            <div className="h-4 w-5/6 rounded-sm bg-editorial-border/60" />
            <div className="h-4 w-full rounded-sm bg-editorial-border/60" />
          </div>
        )}
      </article>

      {/* Floating actions */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3 items-end">
        <button
          onClick={() => setShowComments(true)}
          className="flex items-center gap-2 rounded-full px-4 py-2.5 bg-editorial-surface border border-editorial-border shadow-lg text-editorial-ink hover:bg-editorial-border transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-xs font-semibold">Comments</span>
        </button>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 rounded-full px-5 py-3 shadow-xl transition-all hover:scale-105 active:scale-95 ${
            isSaved ? 'bg-editorial-accent text-white' : 'bg-editorial-ink text-white'
          }`}
        >
          <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-white' : ''}`} />
          <span className="text-xs font-bold uppercase tracking-widest">
            {isSaved ? 'Saved' : 'Save'}
          </span>
        </button>
      </div>

      {/* Comment modal */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-editorial-ink/30 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowComments(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="w-full max-w-lg bg-editorial-bg rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Article context strip */}
              <div className="flex items-start gap-3 p-4 border-b border-editorial-border shrink-0">
                {detail?.imageUrl && (
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-editorial-surface shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={detail.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-editorial-accent">
                    {topic.label || detail?.topic || ''}
                  </span>
                  <p className="text-sm font-semibold text-editorial-ink leading-tight line-clamp-2 mt-0.5">
                    {detail?.title ?? 'Loading…'}
                  </p>
                  {detail && (
                    <p className="text-xs text-editorial-muted mt-0.5">
                      {detail.sourceName} · {relativeTime(detail.publishedAt)} ago
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowComments(false)}
                  className="rounded-full p-1.5 hover:bg-editorial-surface transition-colors shrink-0"
                  aria-label="Close comments"
                >
                  <X className="h-4 w-4 text-editorial-muted" />
                </button>
              </div>

              {/* Count */}
              <div className="px-4 py-2.5 border-b border-editorial-border shrink-0">
                <span className="text-xs font-bold uppercase tracking-widest text-editorial-muted">
                  {comments.length} comment{comments.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-5">
                {comments.length === 0 ? (
                  <p className="text-sm text-editorial-muted text-center py-8 font-serif italic">
                    Be the first to share your perspective.
                  </p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="flex gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.avatar}
                        className="w-8 h-8 rounded-full bg-editorial-surface shrink-0"
                        alt=""
                      />
                      <div className="flex-1">
                        <div className="bg-editorial-surface rounded-2xl rounded-tl-sm px-3 py-2.5">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-xs font-semibold text-editorial-ink">
                              {c.author}
                            </span>
                            <span className="text-xs text-editorial-muted">
                              {relativeTime(c.publishedAt)}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed text-editorial-ink">
                            {c.content}
                          </p>
                        </div>
                        <div className="flex gap-3 mt-1.5 px-1">
                          <button
                            onClick={() => toggleLike(c.id)}
                            className={`flex items-center gap-1 text-xs transition-colors ${
                              c.liked
                                ? 'text-editorial-accent'
                                : 'text-editorial-muted hover:text-editorial-accent'
                            }`}
                          >
                            <Heart
                              className={`h-3 w-3 ${
                                c.liked ? 'fill-editorial-accent' : ''
                              }`}
                            />
                            {c.likes}
                          </button>
                          <button className="text-xs text-editorial-muted hover:text-editorial-ink transition-colors">
                            Reply
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-editorial-border p-3 flex gap-2 items-end">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userId ?? 'me'}`}
                  className="w-8 h-8 rounded-full bg-editorial-surface shrink-0"
                  alt=""
                />
                <div className="flex-1 bg-editorial-surface rounded-2xl px-3 py-2 focus-within:ring-1 focus-within:ring-editorial-accent transition-shadow">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handlePostComment();
                      }
                    }}
                    placeholder="Write a comment..."
                    rows={2}
                    className="w-full text-sm bg-transparent outline-none resize-none placeholder:text-editorial-muted/60 text-editorial-ink"
                  />
                </div>
                <button
                  onClick={handlePostComment}
                  disabled={!comment.trim()}
                  className="shrink-0 w-9 h-9 rounded-full bg-editorial-accent flex items-center justify-center disabled:opacity-40 transition-opacity"
                  aria-label="Post comment"
                >
                  <ArrowUp className="h-4 w-4 text-white" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
