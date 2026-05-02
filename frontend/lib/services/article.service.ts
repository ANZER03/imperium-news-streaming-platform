import { fetchApi } from '../api-client';
import { Article } from '../types';
import { normalizeImageUrl } from '../utils/image';

// Field names match the Java @JsonProperty annotations (snake_case in HTTP response)
interface BackendArticleDetail {
  id: string;
  title: string;
  bodyText: string;   // no @JsonProperty — stays camelCase
  author: string;
  url: string;
  image_url: string;
  published_at: number;
  source_name: string;
  country_name: string;
  topic: string;
}

// Module-level batch state — no React dependency
const pendingViewed = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function sendBatch(userId: string, ids: string[]) {
  if (ids.length === 0) return;
  fetchApi('/api/v1/feed/views', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, articleIds: ids }),
  }).catch(() => {}); // best-effort — never block UI
}

function scheduleFlush(userId: string) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    const ids = [...pendingViewed];
    pendingViewed.clear();
    flushTimer = null;
    sendBatch(userId, ids);
  }, 10_000);
}

export const articleService = {
  getDetails: async (id: string, signal?: AbortSignal): Promise<Article> => {
    const detail = await fetchApi<BackendArticleDetail>(`/api/v1/articles/${id}`, { signal });
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
  },

  markViewed: (articleId: string, userId: string) => {
    pendingViewed.add(articleId);
    scheduleFlush(userId);
  },

  flushViewed: (userId: string) => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    const ids = [...pendingViewed];
    pendingViewed.clear();
    sendBatch(userId, ids);
  },
};
