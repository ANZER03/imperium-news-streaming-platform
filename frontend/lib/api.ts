import { Article } from './types';

// Mock data
const mockArticles: Article[] = [
  {
    id: '1',
    title: 'SpaceX launches next-gen rocket in historic mission',
    excerpt: 'The Starship successfully completed its maiden voyage, marking a new era in space exploration.',
    topic: 'Breaking',
    imageUrl: 'https://picsum.photos/seed/rocketstory/960/620',
    publishedAt: '2h ago',
    reactions: 12400,
    content: 'The Starship successfully completed its maiden voyage today, marking a new era in space exploration. The launch happened at the main port and everything went according to plan, leaving engineers and spectators in awe. Future missions to Mars are already in the planning phase based on this success.'
  },
  {
    id: '2',
    title: 'Global markets rally as inflation eases and investors expect rate cuts later this year',
    excerpt: 'Stocks soared following positive reports from central banking authorities.',
    topic: 'Business',
    publishedAt: '1h ago',
    reactions: 8700,
    content: 'Global markets experienced a huge surge today following reports that inflation is beginning to ease across major economies. This positive trend has led investors to believe that central banks might cut interest rates later this year, stimulating further economic growth.'
  },
  {
    id: '3',
    title: 'Apple unveils iOS 18 with AI-powered features',
    excerpt: 'New update brings personalized AI, enhanced privacy, and more customization.',
    topic: 'Technology',
    imageUrl: 'https://picsum.photos/seed/iphonenews/960/620',
    publishedAt: '1h ago',
    reactions: 8700,
    content: 'At their annual developer conference, Apple unveiled iOS 18, putting AI at the forefront of the mobile experience. The new update includes features like intelligent grouping of notifications, generative writing assistants, and enhanced privacy controls.'
  },
  {
    id: '4',
    title: 'Climate summit agrees on historic climate fund',
    excerpt: 'Nations commit $100B to support vulnerable countries.',
    topic: 'World',
    publishedAt: '3h ago',
    reactions: 8300,
    content: 'After weeks of intense negotiations, world leaders have agreed to establish a $100 billion climate fund aimed at supporting developing countries currently facing severe climate-related challenges.'
  },
  {
    id: '5',
    title: 'Real Madrid advances to Champions League final',
    excerpt: 'A dramatic night at the Bernabeu seals their spot in the final.',
    topic: 'Sports',
    imageUrl: 'https://picsum.photos/seed/footballnews/960/620',
    publishedAt: '4h ago',
    reactions: 4200,
    content: 'In what was described as a dramatic night at the Santiago Bernabeu, Real Madrid secured their place in the Champions League final with a stunning comeback victory in the final minutes of the match.'
  },
  {
    id: '6',
    title: 'NASA discovers new exoplanet that could support life',
    excerpt: 'The planet, Kepler-452b, is located in the habitable zone of its star.',
    topic: 'Science',
    publishedAt: '5h ago',
    reactions: 3100,
  },
  {
    id: '7',
    title: 'New education policy aims to modernize schools',
    excerpt: 'The policy focuses on digital learning and skill development.',
    topic: 'Politics',
    publishedAt: '6h ago',
    reactions: 2600,
  }
];

export const fetchFeed = async (interests: string[], limit: number = 10): Promise<Article[]> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  return mockArticles.slice(0, limit);
};

export const fetchTrending = async (): Promise<Article[]> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return mockArticles.slice(0, 4);
};

export const fetchArticleDetails = async (id: string): Promise<Article | undefined> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  return mockArticles.find(a => a.id === id);
};

export const registerInteraction = async (type: 'view' | 'save' | 'like', articleId: string, userId: string) => {
  // Fire and forget - simple async service with console.log tracking
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      console.log(`[Interaction Service] Tracked '${type.toUpperCase()}' action on article ${articleId} by user ${userId}`);
      resolve();
    }, 100);
  });
};
