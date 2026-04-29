import React from 'react';
import { Article } from '@/lib/types';
import Image from 'next/image';
import { Bookmark, MoreHorizontal } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { registerInteraction } from '@/lib/api';
import { useImpression } from '@/hooks/use-impression';

const TOPIC_COLORS: Record<string, string> = {
  Technology: 'bg-editorial-ink text-white',
  Business: 'bg-editorial-ink text-white',
  World: 'bg-editorial-ink text-white',
  Sports: 'bg-editorial-ink text-white',
  Science: 'bg-editorial-ink text-white',
  Politics: 'bg-editorial-ink text-white',
  Breaking: 'bg-editorial-accent text-white',
};

export function NewsCard({ article }: { article: Article }) {
  const { openArticle, toggleSaved, savedArticles, userId } = useAppStore();
  const isSaved = savedArticles.includes(article.id);
  const isBreaking = article.topic === 'Breaking';

  // Impression tracking
  const { elementRef } = useImpression(() => {
    if (userId) {
      console.log(`[Impression] Article viewed: ${article.title} (${article.id})`);
      registerInteraction('view', article.id, userId);
    }
  }, { threshold: 0.5, minVisibleTime: 1000 });

  const handleClick = () => {
    openArticle(article);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Non-blocking save
    if (userId) {
      registerInteraction('save', article.id, userId);
    }
    toggleSaved(article.id);
  };

  const hasImage = !!article.imageUrl;

  return (
    <article 
      ref={elementRef as any}
      className="p-6 md:p-8 cursor-pointer group hover:bg-editorial-bg transition-colors border-b border-editorial-border last:border-b-0"
      onClick={handleClick}
    >
      <div className={`grid gap-6 ${hasImage ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>
        
        <div className={`${hasImage ? 'md:col-span-2' : 'col-span-1'} space-y-3 order-2 md:order-1`}>
          <div className="flex items-center gap-3">
             <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 ${TOPIC_COLORS[article.topic] || 'bg-editorial-ink text-white'}`}>
                {article.topic}
             </span>
             <span className="text-xs text-editorial-muted">{article.publishedAt} &bull; {(article.reactions / 1000).toFixed(1)}K views</span>
          </div>
          
          <h3 className="text-2xl font-serif font-bold group-hover:text-editorial-accent transition-colors leading-tight text-editorial-ink line-clamp-3" dir="auto">
             {article.title}
          </h3>
          
          <p className="text-editorial-muted text-sm leading-relaxed line-clamp-2" dir="auto">
             {article.excerpt}
          </p>

          <div className="pt-2 flex items-center gap-2 text-editorial-muted">
            <button 
              onClick={handleSave} 
              className={`rounded-full p-2 transition hover:bg-black/5 ${isSaved ? 'text-editorial-accent bg-editorial-accent/10' : 'hover:text-editorial-ink'}`}
            >
              <Bookmark className="h-4 w-4" fill={isSaved ? "currentColor" : "none"} />
            </button>
            <button 
              className="rounded-full p-2 transition hover:bg-black/5 hover:text-editorial-ink"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {hasImage && (
          <div className="relative aspect-[4/3] w-full rounded-sm overflow-hidden bg-editorial-surface flex items-center justify-center order-1 md:order-2">
            <Image 
              src={article.imageUrl!} 
              alt={article.title} 
              fill 
              className="object-cover relative z-10" 
              referrerPolicy="no-referrer"
            />
            {/* Fallback skeleton if image fails/loads slow */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_2s_infinite]"></div>
          </div>
        )}
      </div>
    </article>
  );
}
