'use client';
import { ArrowLeft, Bookmark, Share2, Heart, MessageCircle, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { mockArticle, mockComments, relTime } from '../../_mock';

export default function ArticleV1() {
  const [saved, setSaved] = useState(false);
  const [comment, setComment] = useState('');
  const a = mockArticle;

  return (
    <div className="min-h-screen bg-editorial-bg text-editorial-ink font-sans">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-editorial-border bg-editorial-bg/95 backdrop-blur px-6 py-3">
        <Link href="/designs" className="flex items-center gap-2 text-sm text-editorial-muted hover:text-editorial-ink transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-editorial-accent">{a.topic}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setSaved(s => !s)} className="rounded-full p-2 hover:bg-editorial-surface transition-colors">
            <Bookmark className={`h-4 w-4 ${saved ? 'fill-editorial-accent text-editorial-accent' : 'text-editorial-ink'}`} />
          </button>
          <button className="rounded-full p-2 hover:bg-editorial-surface transition-colors">
            <Share2 className="h-4 w-4 text-editorial-ink" />
          </button>
        </div>
      </header>

      <article className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs font-bold uppercase tracking-widest text-editorial-accent border border-editorial-accent px-2 py-0.5">{a.topic}</span>
          <span className="text-xs text-editorial-muted">{a.sourceName} · {relTime(a.publishedAt)} ago</span>
        </div>

        <h1 className="font-serif text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight mb-6">{a.title}</h1>

        <div className="flex items-center gap-3 mb-8 pb-8 border-b border-editorial-border">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${a.author}`} className="w-9 h-9 rounded-full bg-editorial-surface" alt="" />
          <div>
            <p className="text-sm font-semibold">{a.author}</p>
            <p className="text-xs text-editorial-muted">{a.sourceName}</p>
          </div>
        </div>

        <p className="font-serif text-xl leading-relaxed text-editorial-muted italic mb-8">{a.excerpt}</p>

        <div className="aspect-video w-full overflow-hidden rounded-sm mb-10 bg-editorial-surface">
          <img src={a.imageUrl} alt={a.title} className="w-full h-full object-cover" />
        </div>

        <div className="space-y-5 text-[17px] leading-[1.8]">
          {a.content.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <a href={a.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-10 text-xs font-bold uppercase tracking-widest text-editorial-accent hover:underline">
          Read original →
        </a>
      </article>

      <section className="max-w-2xl mx-auto px-6 pb-20">
        <div className="border-t border-editorial-border pt-10">
          <h2 className="font-serif text-2xl font-bold mb-8">
            Discussion <span className="text-editorial-muted font-sans text-base font-normal">({mockComments.length})</span>
          </h2>

          <div className="flex gap-3 mb-10">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=me" className="w-9 h-9 rounded-full bg-editorial-surface shrink-0 mt-1" alt="" />
            <div className="flex-1 border border-editorial-border rounded-2xl overflow-hidden focus-within:border-editorial-accent transition-colors">
              <textarea value={comment} onChange={e => setComment(e.target.value)}
                placeholder="Share your perspective..." rows={3}
                className="w-full px-4 pt-3 pb-2 text-sm bg-transparent outline-none resize-none placeholder:text-editorial-muted/60" />
              <div className="flex justify-end px-3 pb-3">
                <button disabled={!comment.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-editorial-accent text-white text-xs font-bold uppercase tracking-widest disabled:opacity-40">
                  <Send className="h-3 w-3" /> Post
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {mockComments.map(c => (
              <div key={c.id} className="flex gap-3">
                <img src={c.avatar} className="w-9 h-9 rounded-full bg-editorial-surface shrink-0" alt="" />
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-semibold">{c.author}</span>
                    <span className="text-xs text-editorial-muted">{relTime(c.publishedAt)} ago</span>
                  </div>
                  <p className="text-sm leading-relaxed">{c.content}</p>
                  <div className="flex gap-4 mt-2">
                    <button className="flex items-center gap-1 text-xs text-editorial-muted hover:text-editorial-accent transition-colors">
                      <Heart className="h-3.5 w-3.5" /> {c.likes}
                    </button>
                    <button className="flex items-center gap-1 text-xs text-editorial-muted hover:text-editorial-ink transition-colors">
                      <MessageCircle className="h-3.5 w-3.5" /> {c.replies} replies
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
