import React from 'react';

export function SkeletonCard({ hasImage = true }: { hasImage?: boolean }) {
  return (
    <article className="p-6 md:p-8 animate-[pulse_2s_infinite] border-b border-editorial-border last:border-b-0">
      <div className={`grid gap-6 ${hasImage ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>
        
        <div className={`${hasImage ? 'md:col-span-2' : 'col-span-1'} space-y-4 order-2 md:order-1`}>
          <div className="flex items-center gap-3">
             <div className="h-4 w-16 bg-editorial-surface/80 rounded-sm"></div>
             <div className="h-3 w-20 bg-editorial-surface/80 rounded-sm"></div>
          </div>
          
          <div className="space-y-2">
            <div className="h-8 w-full bg-editorial-border rounded-sm"></div>
            <div className="h-8 w-4/5 bg-editorial-border rounded-sm"></div>
          </div>
          
          <div className="space-y-2 pt-2">
            <div className="h-4 w-full bg-editorial-surface rounded-sm"></div>
            <div className="h-4 w-11/12 bg-editorial-surface rounded-sm"></div>
          </div>

          <div className="pt-4 flex gap-2">
             <div className="h-8 w-8 rounded-full bg-editorial-surface"></div>
             <div className="h-8 w-8 rounded-full bg-editorial-surface"></div>
          </div>
        </div>

        {hasImage && (
          <div className="relative aspect-[4/3] w-full rounded-sm overflow-hidden bg-editorial-surface flex items-center justify-center order-1 md:order-2">
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_2s_infinite]"></div>
          </div>
        )}
      </div>
    </article>
  );
}
