import { mockArticles } from '../data/mock-articles';
import { Article } from '../types';

export const articleService = {
  getDetails: async (id: string): Promise<Article | undefined> => {
    await new Promise(resolve => setTimeout(resolve, 800));
    return mockArticles.find(a => a.id === id);
  },

  registerInteraction: async (type: 'view' | 'save' | 'like', articleId: string, userId: string) => {
    // Fire and forget - simple async service with console.log tracking
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        console.log(`[Interaction Service] Tracked '${type.toUpperCase()}' action on article ${articleId} by user ${userId}`);
        resolve();
      }, 100);
    });
  },
};
