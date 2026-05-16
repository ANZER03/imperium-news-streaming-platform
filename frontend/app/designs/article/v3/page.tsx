'use client';
import { ArrowLeft, Bookmark, Share2, Heart, MessageCircle, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { mockArticle, mockComments, relTime } from '../../_mock';

export default function ArticleV3() {
  const [saved, setSaved] = useState(false);
  const [comment, setComment] = useState('');
  const a = mockArticle;

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-editorial-ink font-sans">
      <header className="sticky top-0 z-40 bg-[#FAFAF8]/95 backdrop-blur border-b border-editorial-border px-6 py-3 flex items-center justify-between">
        <Link href="/designs" className="flex items-center gap-2 text-sm text-editorial-muted hover:text-editorial-ink transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-1">
          <button onClick={() => setSaved(s => !s)} className="rounded-full p-2 hover:bg-editorial-surface transition-colors">
            <Bookmark className={`h-4 w-4 ${saved ? 'fill-editorial-accent text-editorial-accent' : 'text-editorial-ink'}`} />
          </button>
          <button className="rounded-full p-2 hover:bg-editorial-surface transition-colors">
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12 lg:grid lg:grid-cols-[1fr_300px] lg:gap-16">
        <article>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-editorial-accent">{a.topic}</span>
            <span className="text-editorial-border">·</span>
            <span className="text-xs text-editorial-muted">{a.sourceName}</span>
          </div>

          <h1 className="font-serif text-4xl md:text-[52px] font-bold leading-[1.08] tracking-tight mb-6">{a.title}</h1>
          <p className="font-serif text-xl leading-relaxed text-editorial-muted italic mb-6">{a.excerpt}</p>

          <div className="flex items-center gap-3 text-xs text-editorial-muted mb-10 pb-8 border-b border-editorial-border">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${a.author}`} className="w-7 h-7 rounded-full bg-editorial-surface" alt="" />
            <span>By <strong className="text-editorial-ink font-semibold">{a.author}</strong></span>
            <span>·</span><span>{relTime(a.publishedAt)} ago</span>
          </div>

          <div className="aspect-video w-full overflow-hidden mb-2 bg-editorial-surface">
            <img src={a.imageUrl} alt={a.title} className="w-full h-full object-cover" />
          </div>
          <p className="text-xs text-editorial-muted mb-8">Markets reacted swiftly. Photo: Reuters</p>

          <div className="space-y-5 text-[17px] leading-[1.85] max-w-[65ch]">
            {a.content.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
          </div>

          <a href={a.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-10 text-xs font-bold uppercase tracking-widest text-editorial-accent hover:underline">
            Read original →
          </a>
        </article>

        {/* Sticky sidebar comments */}
        <aside className="mt-12 lg:mt-0">
          <div className="lg:sticky lg:top-[57px] space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest border-b border-editorial-border pb-3">
              Discussion <span className="text-editorial-muted font-normal">({mockComments.length})</span>
            </h3>

            <div className="bg-editorial-surface rounded-xl p-3 focus-within:ring-1 focus-within:ring-editorial-accent transition-shadow">
              <textarea value={comment} onChange={e => setComment(e.target.value)}
                placeholder="Your perspective..." rows={3}
                className="w-full text-sm bg-transparent outline-none resize-none placeholder:text-editorial-muted/60" />
              <div className="flex justify-end mt-2">
                <button disabled={!comment.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-editorial-accent text-white text-xs font-bold disabled:opacity-40">
                  <Send className="h-3 w-3" /> Post
                </button>
              </div>
            </div>

            <div className="space-y-5">
              {mockComments.map(c => (
                <div key={c.id} className="pb-5 border-b border-editorial-border last:border-0">
                  <div className="flex items-center gap-2 mb-2">
                    <img src={c.avatar} className="w-7 h-7 rounded-full bg-editorial-surface" alt="" />
                    <span className="text-xs font-semibold">{c.author}</span>
                    <span className="text-xs text-editorial-muted ml-auto">{relTime(c.publishedAt)}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{c.content}</p>
                  <div className="flex gap-3 mt-2">
                    <button className="flex items-center gap-1 text-xs text-editorial-muted hover:text-editorial-accent transition-colors">
                      <Heart className="h-3 w-3" /> {c.likes}
                    </button>
                    <button className="flex items-center gap-1 text-xs text-editorial-muted hover:text-editorial-ink transition-colors">
                      <MessageCircle className="h-3 w-3" /> {c.replies}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
