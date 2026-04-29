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
