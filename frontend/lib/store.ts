import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { bookmarkService } from './services/bookmark.service';

interface AppState {
  userId: string | null;
  userToken: string | null;
  userName: string | null;
  userEmail: string | null;
  interests: string[];
  countryIds: number[];
  isOnboarded: boolean;
  savedArticles: string[];
  theme: 'light' | 'dark';
  isSearchOpen: boolean;

  loginUser: (userId: string, token: string, email: string, name: string) => void;
  completeOnboarding: (interests: string[], countryIds: number[], userId: string) => void;
  toggleSaved: (articleId: string) => void;
  resetOnboarding: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setSearchOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      userId: null,
      userToken: null,
      userName: null,
      userEmail: null,
      interests: [],
      countryIds: [],
      isOnboarded: false,
      savedArticles: [],
      theme: 'light',
      isSearchOpen: false,

      loginUser: (userId, token, email, name) =>
        set(() => ({
          userId,
          userToken: token,
          userEmail: email,
          userName: name,
        })),

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
          userToken: null,
          userName: null,
          userEmail: null,
        }),

      setTheme: (theme) => set({ theme }),
      setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
    }),
    {
      name: 'imperium-storage',
      partialize: (state) => ({
        userId: state.userId,
        userToken: state.userToken,
        userName: state.userName,
        userEmail: state.userEmail,
        interests: state.interests,
        countryIds: state.countryIds,
        isOnboarded: state.isOnboarded,
        savedArticles: state.savedArticles,
        theme: state.theme,
      }),
    },
  ),
);
