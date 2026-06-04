import { fetchApi } from '../api-client';
import { Article } from '../types';
import { normalizeImageUrl } from '../utils/image';
import { articleCache } from '../utils/article-cache';

// Field names match the Java @JsonProperty annotations (snake_case in HTTP response)
interface BackendArticleDetail {
  id: string;
  title: string;
  bodyText: string; // no @JsonProperty — stays camelCase
  author: string;
  url: string;
  image_url: string;
  published_at: number;
  source_name: string;
  country_name: string;
  topic: string;
}

function mapDetail(detail: BackendArticleDetail): Article {
  return {
    id: detail.id,
    title: detail.title,
    excerpt: '',
    topic: detail.topic,
    imageUrl: normalizeImageUrl(detail.image_url),
    sourceName: detail.source_name,
    publishedAt: detail.published_at,
    content: detail.bodyText,
    author: detail.author,
    url: detail.url,
    countryName: detail.country_name,
  };
}

/**
 * Per-id in-flight de-dup table. Even though prefetch is gone, this still
 * helps when React Strict Mode mounts components twice in dev — both effects
 * run, but only one network call is fired.
 */
const inflight = new Map<string, Promise<Article>>();

export const articleService = {
  /**
   * Fetch article detail. Returns the cached version immediately if we have
   * already loaded the full body. Otherwise dedups concurrent calls per id.
   */
  getDetails: async (id: string, signal?: AbortSignal): Promise<Article> => {
    if (articleCache.hasFullDetail(id)) {
      return articleCache.get(id)!;
    }
    const pending = inflight.get(id);
    if (pending) return pending;

    const promise = (async () => {
      const detail = await fetchApi<BackendArticleDetail>(
        `/api/v1/articles/${id}`,
      );
      return articleCache.set(mapDetail(detail));
    })().finally(() => {
      inflight.delete(id);
    });
    inflight.set(id, promise);
    return promise;
  },
};
