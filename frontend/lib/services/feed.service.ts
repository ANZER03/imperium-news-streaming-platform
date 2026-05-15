import { fetchApi } from '../api-client';
import { Article } from '../types';
import { normalizeImageUrl } from '../utils/image';

interface FeedV2Response {
  data: BackendArticleCard[];
  sessionId: string;
  sessionAnchor: number | null;
  nextScrollCursor: number | null;
  source: 'primary' | 'fallback' | 'mixed';
  hasMore: boolean;
  newSinceLastSession: number | null;
  warnings: string[] | null;
}

// Field names match the Java @JsonProperty annotations (snake_case in HTTP response)
interface BackendArticleCard {
  id: string;
  title: string;
  excerpt: string;
  image_url: string;
  source_name: string;
  published_at: number;
  root_topic_label: string;
}

export interface FeedPage {
  data: Article[];
  sessionId: string;
  hasMore: boolean;
  source: 'primary' | 'fallback' | 'mixed';
  newSinceLastSession: number;
  warnings: string[];
}

function mapCard(card: BackendArticleCard): Article {
  return {
    id: card.id,
    title: card.title,
    excerpt: card.excerpt,
    topic: card.root_topic_label,
    imageUrl: normalizeImageUrl(card.image_url),
    sourceName: card.source_name,
    publishedAt: card.published_at,
  };
}

function toPage(res: FeedV2Response): FeedPage {
  return {
    data: res.data.map(mapCard),
    sessionId: res.sessionId,
    hasMore: res.hasMore,
    source: res.source,
    newSinceLastSession: res.newSinceLastSession ?? 0,
    warnings: res.warnings ?? [],
  };
}

function buildParams(userId: string, sessionId: string | undefined, limit: number, extras?: Record<string, string>) {
  const params = new URLSearchParams({ userId, limit: String(limit) });
  if (sessionId) params.set('sessionId', sessionId);
  if (extras) for (const [k, v] of Object.entries(extras)) params.set(k, v);
  return params;
}

export const feedService = {
  getFeed: async (userId: string, sessionId?: string, limit = 40): Promise<FeedPage> => {
    const params = buildParams(userId, sessionId, limit);
    const res = await fetchApi<FeedV2Response>(`/api/v2/feed?${params}`);
    return toPage(res);
  },

  getByTopic: async (userId: string, topicId: string, sessionId?: string, limit = 40): Promise<FeedPage> => {
    const params = buildParams(userId, sessionId, limit, { topicId });
    const res = await fetchApi<FeedV2Response>(`/api/v2/feed/topic?${params}`);
    return toPage(res);
  },

  getLatest: async (userId: string, sessionId?: string, limit = 40): Promise<FeedPage> => {
    const params = buildParams(userId, sessionId, limit);
    const res = await fetchApi<FeedV2Response>(`/api/v2/feed/latest?${params}`);
    return toPage(res);
  },
};
