import type { Article } from '@/lib/types';

/**
 * Module-level in-memory cache of `Article` shapes keyed by id.
 *
 * Both feed-listing renders and full-detail fetches write here, so when the
 * user clicks a card the modal can render the title/image/source/topic
 * immediately using the partial card data while the full body loads.
 *
 * After detail fetch completes the entry is upgraded with `content`,
 * `author`, and `url`. Future opens of the same article are then instant.
 */
const cache = new Map<string, Article>();

export const articleCache = {
  /** Insert/merge a partial or full Article. Existing fields win only if the
   * new payload doesn't contain them. */
  set(article: Article): Article {
    const existing = cache.get(article.id);
    const merged: Article = { ...existing, ...article };
    cache.set(article.id, merged);
    return merged;
  },

  /** Synchronous read — used by ArticleContent to seed initial state. */
  get(id: string): Article | undefined {
    return cache.get(id);
  },

  /** Whether we already have the full article body cached. */
  hasFullDetail(id: string): boolean {
    const entry = cache.get(id);
    return Boolean(entry?.content);
  },

  clear(id?: string) {
    if (id === undefined) cache.clear();
    else cache.delete(id);
  },
};
