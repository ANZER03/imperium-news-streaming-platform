'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArticleContent } from './ArticleContent';

interface ArticleFullPageProps {
  articleId: string;
}

/**
 * Full-page wrapper for /article/[id] (share / hard-load). Visually matches
 * the modal so direct visits look the same as the in-app dialog.
 *
 * Per the plan, the close button always navigates to '/' (no smart back).
 */
export function ArticleFullPage({ articleId }: ArticleFullPageProps) {
  const router = useRouter();

  // Match the modal's body-scroll lock so the floating action bar / hero feels
  // consistent across both presentations.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-editorial-bg overflow-y-auto">
      <ArticleContent
        articleId={articleId}
        onClose={() => router.push('/')}
      />
    </div>
  );
}
