export interface Article {
  id: string;
  title: string;
  excerpt: string;
  topic: string;        // rootTopicLabel from backend
  imageUrl?: string;
  publishedAt: number;  // epoch-seconds
  sourceName: string;
  // Populated only after fetching full article detail
  content?: string;
  author?: string;
  url?: string;
  countryName?: string;
}

export interface Country {
  countryId: number;
  countryName: string;
  abbreviation: string;
}

export interface Topic {
  topicId: string;
  displayName: string;
}

export interface TrendKeyword {
  term: string;
  termType: string | null;
  articleIds: string[] | null;
  currentCount: number;
  previousCount: number;
  velocity: number;
  score: number;
  updatedAt: string | null;
}
