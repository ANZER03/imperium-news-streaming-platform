'use client';

import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-editorial-bg flex flex-col items-center justify-center p-6 text-center font-sans">
      <h2 className="text-4xl font-serif font-bold text-editorial-ink mb-2">404 — Page Not Found</h2>
      <p className="text-sm text-editorial-muted mb-6">The requested resource could not be found.</p>
      <Link href="/" className="bg-[#6F3FF5] text-white text-xs font-bold py-2.5 px-6 rounded-xl hover:bg-brand-600 transition-colors">
        Return Home
      </Link>
    </div>
  );
}
