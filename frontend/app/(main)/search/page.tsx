'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { FeedList } from '@/components/Feed/FeedList';

function SearchPageInner() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';
  return <FeedList mode="search" query={query} />;
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="h-8 w-8 text-editorial-accent" />
          </motion.div>
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
