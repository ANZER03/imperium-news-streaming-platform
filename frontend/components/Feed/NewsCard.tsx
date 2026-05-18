'use client';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, MessageCircle, Share, Bookmark, MoreHorizontal } from 'lucide-react';
import { Article } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { relativeTime } from '@/lib/utils/time';
import { articleCache } from '@/lib/utils/article-cache';

interface ActionBtnProps {
  icon: React.ElementType;
  count?: string | number;
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
}

function ActionBtn({ icon: Icon, count, onClick, active }: ActionBtnProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 group transition-colors ${
        active ? 'text-editorial-accent' : 'text-editorial-muted hover:text-editorial-accent'
      }`}
    >
      <div
        className={`p-1.5 rounded-full transition-colors ${
          active ? 'bg-editorial-accent/10' : 'group-hover:bg-editorial-accent/10'
        }`}
      >
        <Icon className="w-[18px] h-[18px]" fill={active ? 'currentColor' : 'none'} />
      </div>
      {count !== undefined && <span className="text-[13px]">{count}</span>}
    </button>
  );
}

export function NewsCard({ article }: { article: Article }) {
  const { toggleSaved, savedArticles } = useAppStore();
  const isSaved = savedArticles.includes(article.id);
  const [liked, setLiked] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Seed the in-memory cache with whatever we know from the listing payload
  // so the modal/full-page view can render title/image/source/topic
  // immediately when the user clicks. This does NOT fire any network call.
  useEffect(() => {
    articleCache.set(article);
  }, [article]);

  // Stop the inner action buttons from triggering the surrounding <Link>.
  const stop = (fn: (e: React.MouseEvent) => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn(e);
  };

  const handleSave = stop(() => toggleSaved(article.id));
  const handleLike = stop(() => setLiked((v) => !v));
  const handleShare = stop(async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/article/${article.id}`;
    const shareData = { title: article.title, url };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
    }
  });
  const handleNoOp = stop(() => {});

  const displayName = article.author || article.sourceName || 'Unknown';

  return (
    <Link
      href={`/article/${article.id}`}
      // No prefetch — detail is fetched on click by ArticleContent.
      prefetch={false}
      className="block p-4 bg-editorial-bg border-b border-editorial-border cursor-pointer flex flex-col hover:bg-editorial-surface transition-colors"
    >
      {/* Header row */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-[15px] font-bold text-editorial-ink leading-tight">
            {displayName}
          </span>
          {article.sourceName && article.author && article.sourceName !== article.author && (
            <span className="text-[13px] text-editorial-muted">· {article.sourceName}</span>
          )}
          <span className="text-[13px] text-editorial-muted">
            · {relativeTime(article.publishedAt)}
          </span>
        </div>
        <MoreHorizontal
          className="w-5 h-5 text-editorial-muted shrink-0 ml-2"
          onClick={handleNoOp}
        />
      </div>

      {/* Title */}
      <h2
        className="text-xl font-serif font-bold text-editorial-ink leading-tight mb-1"
        dir="auto"
      >
        {article.title}
      </h2>

      {/* Excerpt */}
      {article.excerpt && (
        <p className="text-[15px] text-editorial-muted line-clamp-2 mb-2" dir="auto">
          {article.excerpt.replace(/\.+$/, '')}
        </p>
      )}

      {/* Image */}
      {article.imageUrl && (
        <div className="w-full relative aspect-video rounded-xl overflow-hidden my-2 border border-editorial-border bg-editorial-surface">
          {!imageLoaded && (
            <div className="absolute inset-0 z-10 bg-gradient-to-r from-editorial-surface via-white/60 to-editorial-surface animate-[shimmer_2s_infinite]" />
          )}
          <Image
            src={article.imageUrl}
            alt={article.title}
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

      {/* Action bar */}
      <div className="flex gap-6 pt-2">
        <ActionBtn icon={MessageCircle} onClick={handleNoOp} />
        <ActionBtn icon={Heart} onClick={handleLike} active={liked} />
        <ActionBtn icon={Bookmark} onClick={handleSave} active={isSaved} />
        <ActionBtn icon={Share} onClick={handleShare} />
      </div>
    </Link>
  );
}
