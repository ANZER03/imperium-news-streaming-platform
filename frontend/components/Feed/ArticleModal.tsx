'use client';

import React, { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArticleContent } from './ArticleContent';

interface ArticleModalProps {
  articleId: string;
}

/**
 * Slide-up modal wrapper used by the intercepting route
 * `app/(main)/@modal/(...)article/[id]/page.tsx`.
 *
 * Per the parallel-routes best practice, closing always uses `router.back()`
 * so the intercepted history entry is removed cleanly. Escape key also closes.
 */
export function ArticleModal({ articleId }: ArticleModalProps) {
  const router = useRouter();

  const close = useCallback(() => {
    router.back();
  }, [router]);

  // Lock background scroll while the modal is mounted.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      className="fixed inset-0 z-[100] bg-editorial-bg overflow-y-auto"
    >
      <ArticleContent articleId={articleId} onClose={close} />
    </motion.div>
  );
}
