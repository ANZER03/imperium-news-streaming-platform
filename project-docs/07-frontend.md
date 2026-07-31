# 07 - Frontend User Interface & Design System

## 1. Next.js 15 & React 19 Architecture

The frontend user application is built using **Next.js 15** and **React 19**, styled with **Tailwind CSS v4** and animated with **Motion** (Framer Motion). Next.js provides server-side rendering (SSR), static site generation, and optimized client-side hydration.

### Core Architecture Characteristics
*   **App Router System:** Leverages Next.js file-system-based routing with support for nested layouts, error boundaries, and loading states.
*   **RSC vs. Client Components:** The app establishes clear boundaries between Server Components (fetching initial metadata and configuration) and Client Components (managing interactive feeds, overlays, state stores, and animations).
*   **Asset Optimization:** Uses `next/image` and custom web fonts (Outfit, Inter, Playfair Display) to prevent Cumulative Layout Shifts (CLS) and optimize resource delivery.

---

## 2. Visual Theme & Typography System

The user interface implements an elegant, premium **Editorial Paper Aesthetic** to reduce cognitive load and put the focus entirely on reading.

### Design System Color Tokens

| Token (CSS variable) | Visual Role | Light Theme | Dark Theme |
|---|---|---|---|
| `bg-editorial-bg` | Page Background | `#FFFFFF` (Pure Paper) | `#000000` (Deep Pitch Black) |
| `bg-editorial-surface` | Card & Overlay Background | `#F7F5FB` (Lilac Tinted Neutral) | `#17181c` (Dark Slate Neutral) |
| `text-editorial-ink` | Primary Copy / Headings | `#16131D` (Slate Dark Ink) | `#E7E9EA` (Soft Off-White) |
| `text-editorial-muted` | Muted Subtext / Meta | `#6E6A7A` (Medium Lilac Gray) | `#72767a` (Slate Medium Gray) |
| `border-editorial-border` | Borders & Dividers | `#E9E6F2` (Soft Border Gray) | `#242628` (Charcoal Border) |
| `color-editorial-accent` | Primary Call-to-Action | `#6F3FF5` (Deep Violet) | `#1C9CF0` (Soft Blue Accent) |

### Typography Guidelines
*   **Serif Headings (`font-serif`):** **Playfair Display** is applied to article headlines, editorial titles, and section headers to evoke a classic newspaper feel.
*   **Sans-Serif Copy (`font-sans`):** **Inter** and **Outfit** are used for article excerpts, metadata labels, navigation, and settings menus to ensure legibility on high-density mobile displays.
*   **Rhythm & Line Height:** Paragraph text is restricted to a line height of `1.6` and a maximum width of `60ch` to maximize reading comfort.

---

## 3. UI Component Layout & Flow

The page layout is responsive and adapts dynamically across viewport sizes:

```
┌─────────────────────────────────────────────────────────────┐
│                       Desktop View                          │
│ ┌───────────────┬───────────────────────────┬─────────────┐ │
│ │ Navigation    │       Central Feed        │ Sidebar     │ │
│ │ (Sidebar)     │      (max-w-[600px])      │ (Rightbar)  │ │
│ │               │                           │             │ │
│ │ Feed          │   Explore Category Tabs   │ Followed    │ │
│ │ Explore       │   [All] [Politics] [...]  │ Topics      │ │
│ │ Search        │   ┌───────────────────┐   │             │ │
│ │ Bookmarks     │   │ News Card (excrpt)│   │ Saved       │ │
│ │ Settings      │   └───────────────────┘   │ Items       │ │
│ └───────────────┴───────────────────────────┴─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Core UI Components
1.  **Sidebar (Desktop Navigation):** Fixed left-hand navigation containing navigation links, profile selection, and the search trigger.
2.  **MobileNav (Mobile Layout):** Sticky bottom navigation bar optimized for touch targets, replacing the sidebar on screens under 768px wide.
3.  **FeedList & NewsCard:** Handles rendering of infinite scroll feeds.
    *   **Features:** Displays publication meta (source domain, country flag, time elapsed), serif title, deterministic 30-word body excerpt, and optional media thumbnail.
    *   **Transitions:** Smooth scale-up and background transition hover states utilizing spring micro-animations.
4.  **ExploreHeader:** Houses the controls for target country selections, timeline filters, and category navigation.
5.  **SearchDialog:** An overlay dialog providing keyword search with multi-field matching (title, excerpt, content domain).

---

## 4. State Management (Zustand Stores)

The application handles client-side state using **Zustand**, a lightweight, fast, and hook-based state management library.

### Zustand Stores
*   **Preferences Store:** Stores user-configured preferences such as followed topics, excluded countries, and visual typography settings (font sizing, theme selection).
*   **Session Store:** Manages the user session ID (`sessionId`), active cursors (`olderCursor`, `newestCursor`), and tracks if the user has completed the onboarding flow.
*   **Bookmarks Store:** Caches bookmarked article IDs locally to allow instant UI updates when saving or unsaving articles.

---

## 5. API Client & Hydration Integration

The frontend client communicates with the backend serving API via a centralized fetch wrapper.

### Integration Properties (`api-client.ts` / `feed.service.ts`)
*   **Next.js Rewrite Routing:** By default, frontend requests target absolute paths (e.g. `/api/v3/feed`). Next.js rewrites this traffic to the Kong API Gateway or Spring Boot backend. This prevents CORS configuration issues in development and staging environments.
*   **V3 Feed Integration:** Integrates with the V3 timestamp-window scanner. It tracks the returned `sessionId` and coordinates pagination:
    *   On initial load, the client passes `userId` without a `sessionId`.
    *   The backend returns the feed page along with a `sessionId`.
    *   Subsequent scroll requests pass the `sessionId` to trigger Phase B (buffer drain) and Phase C (interval-skips) sequential loading.
*   **Offline / Network Resiliency:** The client wraps calls in custom error boundaries (`ApiError`) and catches network drops, displaying placeholders (skeletons) and enabling retry triggers.
