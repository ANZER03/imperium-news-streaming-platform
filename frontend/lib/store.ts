import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Article } from './types';
import { bookmarkService } from './services/bookmark.service';

interface AppState {
  userId: string | null;
  interests: string[];
  country: string | null;
  countryId: number | null;
  isOnboarded: boolean;
  selectedArticle: Article | null;
  savedArticles: string[];
  activeView: 'feed' | 'saved' | 'search' | 'explore';
  activeTopic: string;
  searchQuery: string;

  completeOnboarding: (interests: string[], country: string, countryId: number, userId: string) => void;
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
    (set, get) => ({
      userId: null,
      interests: [],
      country: null,
      countryId: null,
      isOnboarded: false,
      selectedArticle: null,
      savedArticles: [],
      activeView: 'feed',
      activeTopic: 'All',
      searchQuery: '',

      completeOnboarding: (interests, country, countryId, userId) => set(() => ({
        interests,
        country,
        countryId,
        isOnboarded: true,
        userId,
      })),

      openArticle: (article) => set({ selectedArticle: article }),

      closeArticle: () => set({ selectedArticle: null }),

      toggleSaved: (articleId) => {
        const { userId, savedArticles } = get();
        const isSaved = savedArticles.includes(articleId);

        // Optimistic update
        set({
          savedArticles: isSaved
            ? savedArticles.filter(id => id !== articleId)
            : [...savedArticles, articleId],
        });

        // Sync to backend (best-effort, revert on failure)
        if (userId) {
          const op = isSaved
            ? bookmarkService.remove(userId, articleId)
            : bookmarkService.add(userId, articleId);

          op.catch(() => {
            // Revert on failure
            set((state) => ({
              savedArticles: isSaved
                ? [...state.savedArticles, articleId]
                : state.savedArticles.filter(id => id !== articleId),
            }));
          });
        }
      },

      resetOnboarding: () => set({
        isOnboarded: false,
        interests: [],
        country: null,
        countryId: null,
        userId: null,
      }),

      setView: (view) => set({ activeView: view, activeTopic: 'All', selectedArticle: null, searchQuery: '' }),

      setTopic: (topic) => set({ activeTopic: topic, activeView: 'feed', selectedArticle: null, searchQuery: '' }),

      setSearchQuery: (query: string) => set({ searchQuery: query, activeView: 'search', selectedArticle: null }),

      setExploreTopic: (topic: string) => set({ activeTopic: topic, searchQuery: '', selectedArticle: null }),

      setExploreQuery: (query: string) => set({ searchQuery: query, activeTopic: 'All', selectedArticle: null }),
    }),
    {
      name: 'imperium-storage',
      partialize: (state) => ({
        userId: state.userId,
        interests: state.interests,
        country: state.country,
        countryId: state.countryId,
        isOnboarded: state.isOnboarded,
        savedArticles: state.savedArticles,
      }),
    }
  )
);
