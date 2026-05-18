import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { bookmarkService } from './services/bookmark.service';

interface AppState {
  userId: string | null;
  interests: string[];
  countryIds: number[];
  isOnboarded: boolean;
  savedArticles: string[];

  completeOnboarding: (interests: string[], countryIds: number[], userId: string) => void;
  toggleSaved: (articleId: string) => void;
  resetOnboarding: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      userId: null,
      interests: [],
      countryIds: [],
      isOnboarded: false,
      savedArticles: [],

      completeOnboarding: (interests, countryIds, userId) =>
        set(() => ({
          interests,
          countryIds,
          isOnboarded: true,
          userId,
        })),

      toggleSaved: (articleId) => {
        const { userId, savedArticles } = get();
        const isSaved = savedArticles.includes(articleId);

        // Optimistic update
        set({
          savedArticles: isSaved
            ? savedArticles.filter((id) => id !== articleId)
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
                : state.savedArticles.filter((id) => id !== articleId),
            }));
          });
        }
      },

      resetOnboarding: () =>
        set({
          isOnboarded: false,
          interests: [],
          countryIds: [],
          userId: null,
        }),
    }),
    {
      name: 'imperium-storage',
      partialize: (state) => ({
        userId: state.userId,
        interests: state.interests,
        countryIds: state.countryIds,
        isOnboarded: state.isOnboarded,
        savedArticles: state.savedArticles,
      }),
    },
  ),
);
