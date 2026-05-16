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

      <section>
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
    </div>
  );
}
