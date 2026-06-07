import Link from 'next/link';

const articleDesigns = [
  { v: 1, label: 'Editorial Broadsheet', desc: 'Serif title, byline, hero image, inline comments below' },
  { v: 2, label: 'Split Panel', desc: 'Sticky dark image left, scrollable content right, collapsible comments' },
  { v: 3, label: 'Newspaper + Sidebar', desc: 'Typographic focus, comments in sticky right sidebar' },
  { v: 4, label: 'Full-bleed Hero + Tabs', desc: 'Dark cinematic hero, tab-switched article / comments' },
  { v: 5, label: 'Feed-native', desc: 'Compact, no cards, bubble comments, action bar' },
];

const commentDesigns = [
  { v: 1, label: 'Bottom Sheet', desc: 'Mobile-first slide-up sheet with pinned input' },
  { v: 2, label: 'Centered Modal', desc: 'Article thumbnail header, bubble-style thread' },
  { v: 3, label: 'Right Drawer', desc: 'Side panel over blurred article, mini article card' },
  { v: 4, label: 'Accent Header', desc: 'Full-page, purple header, sticky input, divider list' },
  { v: 5, label: 'Numbered Quotes', desc: 'Serif italic quotes, numbered responses, minimal overlay' },
];

const authDesigns = [
  { v: 1, label: 'Classic Editorial', desc: 'Serif titles, underline fields, clean editorial print-media look' },
  { v: 2, label: 'Translucent Glassmorphism', desc: 'Glassmorphic card container with soft purple glow blobs' },
  { v: 3, label: 'Product Standard Tabs', desc: 'Sleek animated toggle tabs, standard rounded outline inputs' },
  { v: 4, label: 'Terminal Console', desc: 'Monospace font, command-line prefixes, prompt details' },
  { v: 5, label: 'Bold Brand Saturated', desc: 'Floating input labels, thick borders, heavy neobrutalist shadows' },
  { v: 6, label: 'Progressive Step-by-Step', desc: 'Split stages (Email first, then Password), sliding animations' },
  { v: 7, label: 'Social-First Splitted', desc: 'Prominent social provider buttons (Google, GitHub), custom divider' },
  { v: 8, label: 'Serif Narrative Form', desc: 'Inline fill-in-the-blank text sentence form style' },
  { v: 9, label: 'Neomorphic Softness', desc: 'Soft tactile controls, inset textboxes, outset active buttons' },
  { v: 10, label: 'Cinematic Dark Mode', desc: 'Full screen dark layout, neon-purple outline active glows' },
];

const exploreDesigns = [
  { v: 1, label: 'Editorial Stack', desc: 'Elegant serif fonts, thin borders, greyscale images that colorize on hover.' },
  { v: 2, label: 'Neo-Brutalism', desc: 'Thick borders, harsh shadows, bright accents, oversized bold text.' },
  { v: 3, label: 'Glassmorphic Floating', desc: 'Blurry background gradients, floating pill-shaped cards.' },
  { v: 4, label: 'Panoramic Ticker', desc: 'Wide-aspect ratio cards, scrolling marquee ticker for keywords.' },
  { v: 5, label: 'Minimalist Typographic', desc: 'No images, focusing purely on gorgeous oversized serif typography.' },
  { v: 6, label: 'Cinematic Dark Mode', desc: 'Fully dark, deep black vignettes, glowing accent borders.' },
  { v: 7, label: 'Retro Magazine', desc: 'Sepia background, dotted borders, classic newspaper layouts.' },
  { v: 8, label: 'Interactive Accordion', desc: 'Cards are thin slices that expand to full width on hover.' },
  { v: 9, label: 'Sleek Tech Lines', desc: 'Dark minimalist background, neon thin borders, tech-focused.' },
  { v: 10, label: 'Asymmetric Grid Carousel', desc: 'Alternating vertical alignments giving a dynamic masonry feel horizontally.' },
  { v: 11, label: 'X Clone (Faithful)', desc: 'Faithful recreation of the X dark mode trending layout with top-left text overlays and outline pills.' },
  { v: 12, label: 'X-Inspired Minimalist', desc: 'Cleaner interpretation with borderless wider cards and prominent typography.' },
  { v: 13, label: 'X-Inspired Glass', desc: 'Familiar horizontal structure but utilizes frosted glassmorphism for overlays.' },
  { v: 14, label: 'X-Inspired Edge', desc: 'Dark mode layout with sharp edges and dense information layout.' },
  { v: 15, label: 'X-Inspired Vibrant', desc: 'The classic X layout but heavily accented with brand colors for a pop of vibrancy.' },
];

const searchDesigns = [
  { v: 1, label: 'Editorial Colonnade', desc: 'Serif text, divided columns for trends, clear input underlines' },
  { v: 2, label: 'Category Grid Hub', desc: 'Card groups for topics, graphical custom date-slider filter' },
  { v: 3, label: 'Palantir Intelligence Node', desc: 'Dark theme, high data density, node-like metadata connections' },
  { v: 4, label: 'Bloomberg x Twitter Feed', desc: 'Real-time ticker stream, trending tags, sentiment charts' },
  { v: 5, label: 'Modular Bento Analytics', desc: 'SaaS grid layout, dynamic widgets updating with search input' },
  { v: 6, label: 'Global Threat Matrix', desc: 'Multi-column data table approach, structured analytical filters' },
  { v: 7, label: 'Editorial Azure', desc: 'Blue monochrome paper theme, sentiment sidebar under trends' },
  { v: 8, label: 'Editorial Crimson', desc: 'Cream & Red classic paper, true 3-column layout' },
  { v: 9, label: 'Editorial Forest', desc: 'Eco-green mint theme, wide horizontal sentiment bar above results' },
  { v: 10, label: 'Editorial Sepia', desc: 'Vintage brown layout with a massive graphic-style sentiment block' },
  { v: 11, label: 'Editorial Noir', desc: 'Dark mode newspaper, sentiment vertical bars in top infobox' },
  { v: 12, label: 'Option 1 (Left Thumbnail)', desc: 'Compact list cards with square images on the left, horizontal sentiment bars' },
  { v: 13, label: 'Option 2 (Top Image Grid)', desc: '2-column card grid with banner images on top, concentric radial sentiment rings' },
  { v: 14, label: 'Option 3 (Split Overlay)', desc: 'Grayscale image backdrops inside cards with minimal text overlay, summary boxes' },
  { v: 15, label: 'Option 4 (Magazine Hero)', desc: 'Large Hero card for first result followed by compact list items, custom matrix table' },
  { v: 16, label: 'Option 5 (Timeline Flow)', desc: 'Vertical timeline line with circular photo nodes, text-gauge readout' },
  { v: 17, label: 'Option 10 (Dense Strips)', desc: 'Minimal horizontal strips displaying hover-to-zoom images, vertical progress charts' },
  { v: 18, label: 'Option 7 (Asymmetric Deck)', desc: 'Offset card borders with thick shadow offsets, minimal donut charts' },
  { v: 19, label: 'Option 8 (Double Broadsheet)', desc: 'Double-border cards containing boxed images, segmented block grids' },
  { v: 20, label: 'Option 9 (Retro Offset Shadow)', desc: 'Retro bold outline offset shadows, larger square images, dot-matrix progress' },
  { v: 21, label: 'Option 10 (50/50 Split Card)', desc: 'Horizontal cards divided 50/50 between image and text, summary stats layout' },
];

export default function DesignsIndex() {
  return (
    <div className="min-h-screen bg-editorial-bg font-sans px-6 py-12 max-w-3xl mx-auto">
      <div className="mb-12">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-editorial-accent">Design Lab</span>
        <h1 className="font-serif text-4xl font-bold text-editorial-ink mt-2 mb-2">UI Explorations</h1>
        <p className="text-editorial-muted text-sm">Pick a design to review. None are wired to the main app.</p>
      </div>

      <section className="mb-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-editorial-muted mb-5 border-b border-editorial-border pb-3">
          Article Detail — 5 variants
        </h2>
        <div className="space-y-3">
          {articleDesigns.map(({ v, label, desc }) => (
            <Link key={v} href={`/designs/article/v${v}`}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-editorial-surface transition-colors group">
              <span className="text-2xl font-serif font-bold text-editorial-accent/30 group-hover:text-editorial-accent transition-colors w-8 shrink-0">
                {v}
              </span>
              <div>
                <p className="text-sm font-semibold text-editorial-ink group-hover:text-editorial-accent transition-colors">{label}</p>
                <p className="text-xs text-editorial-muted mt-0.5">{desc}</p>
              </div>
              <span className="ml-auto text-editorial-muted group-hover:text-editorial-accent transition-colors text-lg">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-editorial-muted mb-5 border-b border-editorial-border pb-3">
          Comment Dialog — 5 variants
        </h2>
        <div className="space-y-3">
          {commentDesigns.map(({ v, label, desc }) => (
            <Link key={v} href={`/designs/comment/v${v}`}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-editorial-surface transition-colors group">
              <span className="text-2xl font-serif font-bold text-editorial-accent/30 group-hover:text-editorial-accent transition-colors w-8 shrink-0">
                {v}
              </span>
              <div>
                <p className="text-sm font-semibold text-editorial-ink group-hover:text-editorial-accent transition-colors">{label}</p>
                <p className="text-xs text-editorial-muted mt-0.5">{desc}</p>
              </div>
              <span className="ml-auto text-editorial-muted group-hover:text-editorial-accent transition-colors text-lg">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-editorial-muted mb-5 border-b border-editorial-border pb-3">
          Auth (Signup / Signin) — 10 variants
        </h2>
        <div className="space-y-3">
          {authDesigns.map(({ v, label, desc }) => (
            <Link key={v} href={`/designs/auth/v${v}`}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-editorial-surface transition-colors group">
              <span className="text-2xl font-serif font-bold text-[#6F3FF5]/30 group-hover:text-[#6F3FF5] transition-colors w-8 shrink-0">
                {v}
              </span>
              <div>
                <p className="text-sm font-semibold text-editorial-ink group-hover:text-editorial-accent transition-colors">{label}</p>
                <p className="text-xs text-editorial-muted mt-0.5">{desc}</p>
              </div>
              <span className="ml-auto text-editorial-muted group-hover:text-editorial-accent transition-colors text-lg">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-editorial-muted mb-5 border-b border-editorial-border pb-3">
          Search Dialog — 10 variants
        </h2>
        <div className="space-y-3">
          {searchDesigns.map(({ v, label, desc }) => (
            <Link key={v} href={`/designs/search/v${v}`}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-editorial-surface transition-colors group">
              <span className="text-2xl font-serif font-bold text-[#6F3FF5]/30 group-hover:text-[#6F3FF5] transition-colors w-8 shrink-0">
                {v}
              </span>
              <div>
                <p className="text-sm font-semibold text-editorial-ink group-hover:text-editorial-accent transition-colors">{label}</p>
                <p className="text-xs text-editorial-muted mt-0.5">{desc}</p>
              </div>
              <span className="ml-auto text-editorial-muted group-hover:text-editorial-accent transition-colors text-lg">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-editorial-muted mb-5 border-b border-editorial-border pb-3">
          Explore Carousel — 15 variants
        </h2>
        <div className="space-y-3">
          {exploreDesigns.map(({ v, label, desc }) => (
            <Link key={v} href={`/designs/explore/v${v}`}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-editorial-surface transition-colors group">
              <span className="text-2xl font-serif font-bold text-[#6F3FF5]/30 group-hover:text-[#6F3FF5] transition-colors w-8 shrink-0">
                {v}
              </span>
              <div>
                <p className="text-sm font-semibold text-editorial-ink group-hover:text-editorial-accent transition-colors">{label}</p>
                <p className="text-xs text-editorial-muted mt-0.5">{desc}</p>
              </div>
              <span className="ml-auto text-editorial-muted group-hover:text-editorial-accent transition-colors text-lg">→</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
