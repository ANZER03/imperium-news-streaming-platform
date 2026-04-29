import { useEffect, useRef, useState } from 'react';

interface ImpressionOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  minVisibleTime?: number;
}

/**
 * Hook to track when an element becomes visible on the screen.
 * Useful for tracking analytics impressions.
 */
export function useImpression(
  onImpression: () => void,
  options: ImpressionOptions = {}
) {
  const {
    threshold = 0.5,
    rootMargin = '0px',
    triggerOnce = true,
    minVisibleTime = 500,
  } = options;

  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          
          if (!hasTriggeredRef.current || !triggerOnce) {
            // Start timer for minimum visible time
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
              if (hasTriggeredRef.current && triggerOnce) return;
              
              onImpression();
              hasTriggeredRef.current = true;
            }, minVisibleTime);
          }
        } else {
          setIsVisible(false);
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        }
      },
      { threshold, rootMargin }
    );

    const currentElement = elementRef.current;
    if (currentElement) {
      observer.observe(currentElement);
    }

    return () => {
      if (currentElement) {
        observer.unobserve(currentElement);
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [onImpression, threshold, rootMargin, triggerOnce, minVisibleTime]);

  return { elementRef, isVisible };
}
