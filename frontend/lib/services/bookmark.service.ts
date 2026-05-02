import { fetchApi } from '../api-client';
import { Article } from '../types';
import { normalizeImageUrl } from '../utils/image';

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

export const bookmarkService = {
  getAll: async (userId: string): Promise<Article[]> => {
    const data = await fetchApi<BackendArticleCard[]>(`/api/v1/users/${userId}/bookmarks`);
    return data.map(mapCard);
  },

  add: async (userId: string, articleId: string): Promise<void> => {
    await fetchApi(`/api/v1/users/${userId}/bookmarks/${articleId}`, { method: 'POST' });
  },

  remove: async (userId: string, articleId: string): Promise<void> => {
    await fetchApi(`/api/v1/users/${userId}/bookmarks/${articleId}`, { method: 'DELETE' });
  },
};
