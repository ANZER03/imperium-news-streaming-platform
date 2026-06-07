# Design

## Visual Theme
We employ a split-register layout system:
- Light Theme: Editorial paper aesthetic, clean white background with subtle lilac-grey surfaces. Accent is an elegant deep violet.
- Dark Theme: Low-contrast black/dark grey surfaces, soft blue accent. Tinted neutrals ensure accessibility without being overstimulating.

## Color Palette
### Light Mode
- `bg-editorial-bg`: `#FFFFFF`
- `text-editorial-ink`: `#16131D` (soft dark slate)
- `text-editorial-muted`: `#6E6A7A` (lilac gray)
- `bg-editorial-surface`: `#F7F5FB`
- `border-editorial-border`: `#E9E6F2`
- `color-editorial-accent`: `#6F3FF5` (deep violet)

### Dark Mode
- `bg-editorial-bg`: `#000000`
- `text-editorial-ink`: `#e7e9ea` (soft white)
- `text-editorial-muted`: `#72767a` (medium slate)
- `bg-editorial-surface`: `#17181c`
- `border-editorial-border`: `#242628`
- `color-editorial-accent`: `#1c9cf0` (soft blue)

## Typography
- Font Family: Inter and Outfit mixed for sans-serif components, Playfair Display for editorial serif headings.
- Sizes:
  - Heading 1: `32px` (2rem), font-serif or font-sans font-bold
  - Heading 2: `24px` (1.5rem), font-semibold
  - Body: `15px` or `16px`, line-height 1.6
  - Muted/Caption: `14px`, text-editorial-muted

## Components
- Cards: Smooth, soft border (`border-editorial-border`), hover state transitions background to `editorial-surface` or scales up slightly.
- Buttons: Rounded-xl or rounded-full, transition background color. Accent buttons use `editorial-accent` background with white text.

## Layout & Rhythm
- Spacing: Consistent rhythm (e.g., 4px, 8px, 12px, 16px, 24px, 32px, 48px).
- Navigation: Left sidebar (desktop) with large text, mobile nav on bottom, center feed constrained to `max-w-[600px]`.
