/**
 * Normalize an image URL from the backend into a usable absolute URL.
 *
 * Handles three cases:
 *  1. Protocol-relative URLs (`//example.com/img.jpg`) → prefixed with `https:`
 *  2. Absolute-path URLs (`/imgs/photo.jpg`) → resolved against `sourceUrl`
 *     when available, otherwise dropped (returns undefined)
 *  3. Full absolute URLs → returned as-is
 *
 * @param url       The raw `image_url` from the backend.
 * @param sourceUrl The article's original source URL, used to resolve
 *                  path-only image URLs. Only available on ArticleDetail
 *                  (not on feed cards).
 */
export function normalizeImageUrl(
  url: string | undefined | null,
  sourceUrl?: string | null,
): string | undefined {
  if (!url) return undefined;

  // Drop data: URIs (e.g. inline placeholder SVGs) — not real images
  if (url.startsWith('data:')) return undefined;

  // Protocol-relative → https
  if (url.startsWith('//')) return `https:${url}`;

  // Absolute-path (starts with "/" but not "//") → resolve against source origin
  if (url.startsWith('/') && !url.startsWith('//')) {
    if (!sourceUrl) return undefined; // can't resolve without a source
    try {
      const origin = new URL(sourceUrl).origin; // e.g. "https://example.com"
      return `${origin}${url}`;
    } catch {
      return undefined; // sourceUrl was malformed
    }
  }

  return url; // already a full absolute URL
}
