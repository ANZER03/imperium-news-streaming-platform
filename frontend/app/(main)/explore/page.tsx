'use client';

import React, { Suspense } from 'react';
import { FeedList } from '@/components/Feed/FeedList';
import { useSearchParams } from 'next/navigation';

function ExploreFeed() {
  const searchParams = useSearchParams();
  const country = searchParams.get('country') || undefined;
  const topicId = searchParams.get('topic') || undefined;
  const keyword = searchParams.get('keyword') || undefined;
  
  return <FeedList mode="explore" topicId={topicId} country={country} keyword={keyword} />;
}

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExploreFeed />
    </Suspense>
  );
}
