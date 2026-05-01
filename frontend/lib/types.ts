export interface Article {
  id: string;
  title: string;
  excerpt: string;
  topic: string;
  imageUrl?: string;
  publishedAt: string;
  content?: string;
  reactions: number;
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
