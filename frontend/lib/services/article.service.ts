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

};
