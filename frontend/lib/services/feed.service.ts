import { fetchApi } from '../api-client';
import { Article } from '../types';
import { normalizeImageUrl } from '../utils/image';

interface FeedResponse {
  data: BackendArticleCard[];
  nextCursor: number | null;
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

export const feedService = {
  getFeed: async (
    userId: string,
    cursor?: number,
    limit = 20
  ): Promise<{ data: Article[]; nextCursor: number | null }> => {
    const params = new URLSearchParams({ userId, limit: String(limit) });
    if (cursor !== undefined) params.set('cursor', String(cursor));

    const res = await fetchApi<FeedResponse>(`/api/v1/feed?${params}`);
    return { data: res.data.map(mapCard), nextCursor: res.nextCursor };
  },

  getByTopic: async (
    userId: string,
    topicId: string,
    cursor?: number,
    limit = 20
  ): Promise<{ data: Article[]; nextCursor: number | null }> => {
    const params = new URLSearchParams({ userId, topicId, limit: String(limit) });
    if (cursor !== undefined) params.set('cursor', String(cursor));

    const res = await fetchApi<FeedResponse>(`/api/v1/feed/topic?${params}`);
    return { data: res.data.map(mapCard), nextCursor: res.nextCursor };
  },

  getLatest: async (
    userId: string,
    cursor?: number,
    limit = 20
  ): Promise<{ data: Article[]; nextCursor: number | null }> => {
    const params = new URLSearchParams({ userId, limit: String(limit) });
    if (cursor !== undefined) params.set('cursor', String(cursor));

    const res = await fetchApi<FeedResponse>(`/api/v1/feed/latest?${params}`);
    return { data: res.data.map(mapCard), nextCursor: res.nextCursor };
  },
};
