'use client';
import React, { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { ArrowLeft, Bookmark, Share2, MoreHorizontal } from 'lucide-react';
import Image from 'next/image';
import { registerInteraction } from '@/lib/api';
import { motion } from 'motion/react';

export function ArticleView() {
  const { selectedArticle, closeArticle, toggleSaved, savedArticles, userId } = useAppStore();
  
  // Track impression on mount
  useEffect(() => {
    if (selectedArticle && userId) {
      console.log(`[Full Article View] ${selectedArticle.title}`);
      registerInteraction('view', selectedArticle.id, userId);
    }
  }, [selectedArticle?.id, userId]);

  // Lock body scroll when article is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!selectedArticle) return null;
  
  const isSaved = savedArticles.includes(selectedArticle.id);

  const handleSave = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Fire and forget interaction
    if (userId) {
      registerInteraction('save', selectedArticle.id, userId);
    }
    
    // Update local state
    toggleSaved(selectedArticle.id);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="fixed inset-0 z-[100] bg-white overflow-y-auto"
    >
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
        <div className="mb-6 flex items-center gap-3">
          <span className="text-[10px] bg-editorial-ink px-2 py-0.5 text-white font-bold uppercase tracking-widest">
            {selectedArticle.topic}
          </span>
          <span className="text-xs text-editorial-muted">{selectedArticle.publishedAt}</span>
        </div>

        <h1 className="mb-8 text-4xl font-serif font-bold leading-[1.1] tracking-tight text-editorial-ink md:text-5xl" dir="auto">
          {selectedArticle.title}
        </h1>

        {selectedArticle.imageUrl && (
          <div className="relative mb-10 aspect-video w-full overflow-hidden rounded-sm bg-editorial-surface">
            <Image 
              src={selectedArticle.imageUrl} 
              alt={selectedArticle.title}
              fill
              className="object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        <div className="max-w-none text-editorial-ink pb-20">
          <p className="text-xl md:text-2xl font-serif leading-relaxed text-editorial-muted mb-8 italic" dir="auto">
            {selectedArticle.excerpt}
          </p>
          <div className="mt-8 text-base md:text-lg leading-relaxed space-y-6">
            {selectedArticle.content ? (
              <p dir="auto">{selectedArticle.content}</p>
            ) : (
              // If content isn't loaded or available
              <div className="flex animate-pulse flex-col gap-4 opacity-40">
                <div className="h-4 w-full rounded-sm bg-editorial-border"></div>
                <div className="h-4 w-5/6 rounded-sm bg-editorial-border"></div>
                <div className="h-4 w-4/6 rounded-sm bg-editorial-border"></div>
              </div>
            )}
            
            {/* Fake additional paragraphs to make it look like a full article */}
            <p dir="auto">
              The implications of these developments are widespread, extending beyond immediate reactions into long-term strategic adjustments. Stakeholders across various industries have already begun repositioning to account for the new paradigm.
            </p>
            <p dir="auto">
              &quot;We have never seen such a rapid alignment between disparate groups,&quot; noted one prominent observer. &quot;It signals a shift in underlying priorities that will likely dictate the next decade of progress in this sector.&quot;
            </p>
          </div>
        </div>
      </article>

      {/* Fixed Save Button for Mobile/Desktop accessibility */}
      <div className="fixed bottom-6 left-6 z-40 md:bottom-8 md:left-8">
        <button 
          onClick={handleSave}
          className={`flex items-center gap-2 rounded-full px-5 py-3 shadow-xl transition-all hover:scale-105 active:scale-95 ${
            isSaved 
              ? 'bg-editorial-accent text-white' 
              : 'bg-editorial-ink text-white hover:bg-neutral-800'
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
