'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import Image, { ImageProps } from 'next/image';

interface ArticleImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  /** Extra class names on the wrapping container (aspect-ratio div). */
  containerClassName?: string;
}

/**
 * Wrapper around `next/image` that:
 *  - Shows a shimmer skeleton while loading
 *  - Hides the entire image container if the URL fails to load
 *  - Detects browser-cached images synchronously (no flash)
 */
export function ArticleImage({
  containerClassName = 'w-full relative aspect-video rounded-xl overflow-hidden my-2 border border-editorial-border bg-editorial-surface',
  className,
  ...rest
}: ArticleImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Detect images that are already in the browser cache so we don't
  // briefly flash the shimmer placeholder.
  useLayoutEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
    setErrored(false);
  }, [rest.src]);

  if (errored) return null;

  return (
    <div className={containerClassName}>
      {!loaded && (
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-editorial-surface via-white/60 to-editorial-surface animate-[shimmer_2s_infinite]" />
      )}
      <Image
        ref={imgRef}
        className={`object-cover transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }${className ? ` ${className}` : ''}`}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        unoptimized
        {...rest}
      />
    </div>
  );
}
