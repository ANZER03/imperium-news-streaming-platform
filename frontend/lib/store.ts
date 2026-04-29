import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Article } from './types';

interface AppState {
  userId: string | null;
  interests: string[];
  country: string | null;
  isOnboarded: boolean;
  selectedArticle: Article | null;
  savedArticles: string[];
  activeView: 'feed' | 'saved' | 'search' | 'explore';
  activeTopic: string;
  searchQuery: string;
  
  completeOnboarding: (interests: string[], country: string) => void;
  openArticle: (article: Article) => void;
  closeArticle: () => void;
  toggleSaved: (articleId: string) => void;
  resetOnboarding: () => void;
  setView: (view: 'feed' | 'saved' | 'search' | 'explore') => void;
  setTopic: (topic: string) => void;
  setSearchQuery: (query: string) => void;
  setExploreTopic: (topic: string) => void;
  setExploreQuery: (query: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      userId: null,
      interests: [],
      country: null,
      isOnboarded: false,
      selectedArticle: null,
      savedArticles: [],
      activeView: 'feed',
      activeTopic: 'All',
      searchQuery: '',

      completeOnboarding: (interests, country) => set((state) => ({ 
        interests, 
        country, 
        isOnboarded: true,
        userId: state.userId || uuidv4() 
      })),
      
      openArticle: (article) => set({ selectedArticle: article }),
      
      closeArticle: () => set({ selectedArticle: null }),

      toggleSaved: (articleId) => set((state) => {
        const isSaved = state.savedArticles.includes(articleId);
        return {
          savedArticles: isSaved 
            ? state.savedArticles.filter(id => id !== articleId)
            : [...state.savedArticles, articleId]
        };
      }),

      resetOnboarding: () => set({ 
        isOnboarded: false, 
        interests: [], 
        country: null,
        userId: null 
      }),

      setView: (view) => set({ activeView: view, activeTopic: 'All', selectedArticle: null, searchQuery: '' }),

      setTopic: (topic) => set({ activeTopic: topic, activeView: 'feed', selectedArticle: null, searchQuery: '' }),

      setSearchQuery: (query: string) => set({ searchQuery: query, activeView: 'search', selectedArticle: null }),

      setExploreTopic: (topic: string) => set({ activeTopic: topic, searchQuery: '', selectedArticle: null }),
      
      setExploreQuery: (query: string) => set({ searchQuery: query, activeTopic: 'All', selectedArticle: null })
    }),
    {
      name: 'imperium-storage',
      partialize: (state) => ({ 
        userId: state.userId,
        interests: state.interests,
        country: state.country,
        isOnboarded: state.isOnboarded,
        savedArticles: state.savedArticles // Persist everything except selectedArticle
      }),
    }
  )
);
