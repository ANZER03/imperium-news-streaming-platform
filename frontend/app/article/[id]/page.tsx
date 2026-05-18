'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ArticleFullPage } from '@/components/Feed/ArticleFullPage';

/**
 * /article/[id] — direct/share-friendly article page. Outside the (main)
 * route group so it renders without the sidebar/header shell.
 */
export default function ArticlePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  if (!id) return null;
  return <ArticleFullPage articleId={id} />;
}
