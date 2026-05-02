'use client';
import React, { useState } from 'react';
import { Article } from '@/lib/types';
import Image from 'next/image';
import { Bookmark, MoreHorizontal } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { articleService } from '@/lib/services';
import { useImpression } from '@/hooks/use-impression';
import { relativeTime } from '@/lib/utils/time';
import { getTopicMeta } from '@/lib/utils/topic';

export function NewsCard({ article }: { article: Article }) {
  const { openArticle, toggleSaved, savedArticles, userId } = useAppStore();
  const isSaved = savedArticles.includes(article.id);
  const [imageLoaded, setImageLoaded] = useState(false);
  const topic = getTopicMeta(article.topic);

  const { elementRef } = useImpression(() => {
    if (userId) {
      articleService.markViewed(article.id, userId);
    }
  }, { threshold: 0.5, minVisibleTime: 1000 });

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSaved(article.id);
  };

  const hasImage = !!article.imageUrl;

  return (
    <article
      ref={elementRef as React.RefObject<HTMLElement>}
      className="p-6 md:p-8 cursor-pointer group hover:bg-editorial-bg transition-colors border-b border-editorial-border last:border-b-0"
      onClick={() => openArticle(article)}
    >
      <div className={`grid gap-6 ${hasImage ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>

        <div className={`${hasImage ? 'md:col-span-2' : 'col-span-1'} space-y-3 order-2 md:order-1`}>
          <div className="flex items-center gap-3">
            <span
              className="text-[10px] uppercase tracking-widest px-2 py-0.5"
              style={{ backgroundColor: topic.bg, color: topic.text }}
            >
              {topic.label || article.topic}
            </span>
            <span className="text-xs text-editorial-muted">
              {relativeTime(article.publishedAt)}
              {article.sourceName && <> &bull; {article.sourceName}</>}
            </span>
          </div>

          <h3 className="text-2xl font-serif font-bold group-hover:text-editorial-accent transition-colors leading-tight text-editorial-ink line-clamp-3" dir="auto">
            {article.title}
          </h3>

          <p className="text-editorial-muted text-sm leading-relaxed line-clamp-2" dir="auto">
            {article.excerpt?.replace(/\.+$/, '')}...
          </p>

          <div className="pt-2 flex items-center gap-2 text-editorial-muted">
            <button
              onClick={handleSave}
              className={`rounded-full p-2 transition hover:bg-black/5 ${isSaved ? 'text-editorial-accent bg-editorial-accent/10' : 'hover:text-editorial-ink'}`}
            >
              <Bookmark className="h-4 w-4" fill={isSaved ? 'currentColor' : 'none'} />
            </button>
            <button
              className="rounded-full p-2 transition hover:bg-black/5 hover:text-editorial-ink"
              onClick={e => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {hasImage && (
          <div className="relative aspect-[4/3] w-full rounded-sm overflow-hidden bg-editorial-surface order-1 md:order-2">
            {/* Shimmer skeleton shown until image loads */}
            {!imageLoaded && (
              <div className="absolute inset-0 z-10 bg-gradient-to-r from-editorial-surface via-white/60 to-editorial-surface animate-[shimmer_2s_infinite]" />
            )}
            <Image
              src={article.imageUrl!}
              alt={article.title}
              fill
              className={`object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              referrerPolicy="no-referrer"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
              unoptimized
            />
          </div>
        )}
      </div>
    </article>
  );
}
