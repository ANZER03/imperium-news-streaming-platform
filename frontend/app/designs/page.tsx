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

      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-editorial-muted mb-5 border-b border-editorial-border pb-3">
          Auth (Signup / Signin) — 10 variants
        </h2>
        <div className="space-y-3">
          {authDesigns.map(({ v, label, desc }) => (
            <Link key={v} href={`/designs/auth/v${v}`}
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
    </div>
  );
}
