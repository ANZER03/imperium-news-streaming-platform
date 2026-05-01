import { mockArticles } from '../data/mock-articles';
import { Article } from '../types';

export const feedService = {
  getFeed: async (interests: string[], limit: number = 10): Promise<Article[]> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    return mockArticles.slice(0, limit);
  },
  
  getTrending: async (): Promise<Article[]> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return mockArticles.slice(0, 4);
  },
};
