'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { FeedList } from '@/components/Feed/FeedList';

export default function TopicPage() {
  const params = useParams<{ topicId: string }>();
  const topicId = params?.topicId;
  if (!topicId) return null;
  return <FeedList mode="topic" topicId={topicId} />;
}
