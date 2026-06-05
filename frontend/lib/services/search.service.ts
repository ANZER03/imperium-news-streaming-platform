import { fetchApi } from '../api-client';
import { normalizeImageUrl } from '../utils/image';

// ── Wire types matching the backend PageResult<ArticleSearchHitDto> ──

interface BackendSearchHit {
  id: string;
  score: number | null;
  title: string;
  excerpt: string;
  url: string;
  image_url: string | null;
  source_name: string;
  source_domain: string;
  country_id: number | null;
  country_name: string | null;
  language_code: string | null;
  rubric_id: number | null;
  rubric_title: string | null;
  classification_status: string | null;
  published_at: number;
  crawled_at: number | null;
  processed_at: number | null;
  is_video: boolean | null;
}

interface BackendSearchResponse {
  data: BackendSearchHit[];
  nextCursor: number | null;
  hasMore: boolean;
  source: string;
}

// ── Public types ──

export interface SearchArticle {
  id: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  sourceName: string;
  publishedAt: number;
  crawledAt?: number | null;
  topic: string; // rubric_title or fallback
  countryName?: string;
  url?: string;
}

export interface SearchPage {
  data: SearchArticle[];
  nextPage: number | null;
  hasMore: boolean;
}

export interface SearchParams {
  q?: string;
  from?: string;   // ISO 8601 date-time
  to?: string;     // ISO 8601 date-time
  page?: number;
  limit?: number;
}

function mapHit(hit: BackendSearchHit): SearchArticle {
  return {
    id: hit.id,
    title: hit.title,
    excerpt: hit.excerpt,
    imageUrl: normalizeImageUrl(hit.image_url, hit.url),
    sourceName: hit.source_name,
    publishedAt: hit.published_at,
    crawledAt: hit.crawled_at,
    topic: hit.rubric_title ?? '',
    countryName: hit.country_name ?? undefined,
    url: hit.url,
  };
}

export const searchService = {
  search: async (params: SearchParams): Promise<SearchPage> => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    qs.set('page', String(params.page ?? 0));
    qs.set('limit', String(params.limit ?? 20));

    const res = await fetchApi<BackendSearchResponse>(
      `/api/v1/search/articles?${qs}`,
    );

    return {
      data: res.data.map(mapHit),
      nextPage: res.hasMore ? (params.page ?? 0) + 1 : null,
      hasMore: res.hasMore,
    };
  },
};
