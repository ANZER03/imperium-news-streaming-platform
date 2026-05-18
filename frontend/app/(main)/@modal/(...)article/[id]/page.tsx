'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ArticleModal } from '@/components/Feed/ArticleModal';

/**
 * Intercepted modal version of /article/[id].
 *
 * The `(...)` matcher intercepts the route from the root of `app`, which is
 * required because `app/article/[id]` lives outside the `(main)` group.
 *
 * Hard refresh / direct visit bypasses this slot and renders the full-page
 * route at `app/article/[id]/page.tsx`.
 */
export default function InterceptedArticleModal() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  if (!id) return null;
  return <ArticleModal articleId={id} />;
}
