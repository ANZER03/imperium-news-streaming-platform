'use client';
import { ArrowLeft, Bookmark, Share2, Heart, MessageCircle, Send, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { mockArticle, mockComments, relTime } from '../../_mock';

export default function ArticleV5() {
  const [saved, setSaved] = useState(false);
  const [comment, setComment] = useState('');
  const a = mockArticle;

  return (
    <div className="min-h-screen bg-editorial-bg font-sans">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-editorial-border bg-editorial-bg/95 backdrop-blur px-4 py-3">
        <Link href="/designs" className="flex items-center gap-2 text-sm text-editorial-muted hover:text-editorial-ink transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-1">
          <button onClick={() => setSaved(s => !s)} className="rounded-full p-2 hover:bg-editorial-surface transition-colors">
            <Bookmark className={`h-4 w-4 ${saved ? 'fill-editorial-accent text-editorial-accent' : 'text-editorial-ink'}`} />
          </button>
          <button className="rounded-full p-2 hover:bg-editorial-surface transition-colors">
            <Share2 className="h-4 w-4 text-editorial-ink" />
          </button>
        </div>
      </header>

      <div className="max-w-xl mx-auto">
        {/* Article header block */}
        <div className="px-4 pt-8 pb-6 border-b border-editorial-border">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-editorial-accent bg-editorial-accent/8 px-2 py-0.5 rounded-sm">{a.topic}</span>
            <span className="text-xs text-editorial-muted">{relTime(a.publishedAt)} ago</span>
          </div>
          <h1 className="font-serif text-3xl font-bold leading-[1.15] text-editorial-ink mb-3">{a.title}</h1>
          <p className="text-sm text-editorial-muted leading-relaxed mb-4">{a.excerpt}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${a.author}`} className="w-7 h-7 rounded-full bg-editorial-surface" alt="" />
              <span className="text-xs font-medium text-editorial-ink">{a.author}</span>
              <span className="text-xs text-editorial-muted">· {a.sourceName}</span>
            </div>
            <a href={a.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-editorial-accent font-semibold hover:underline">
              Source <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Image */}
        <div className="aspect-video w-full bg-editorial-surface overflow-hidden">
          <img src={a.imageUrl} alt={a.title} className="w-full h-full object-cover" />
        </div>

        {/* Body */}
        <div className="px-4 py-8 space-y-5 text-[16px] leading-[1.8] text-editorial-ink border-b border-editorial-border">
          {a.content.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
        </div>

        {/* Action bar */}
        <div className="px-4 py-3 flex items-center gap-6 border-b border-editorial-border">
          <button className="flex items-center gap-1.5 text-sm text-editorial-muted hover:text-editorial-accent transition-colors">
            <Heart className="h-4 w-4" /> 128
          </button>
          <button className="flex items-center gap-1.5 text-sm text-editorial-muted hover:text-editorial-ink transition-colors">
            <MessageCircle className="h-4 w-4" /> {mockComments.length}
          </button>
          <button className="flex items-center gap-1.5 text-sm text-editorial-muted hover:text-editorial-ink transition-colors ml-auto">
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>

        {/* Inline comment thread */}
        <div className="px-4 py-6 space-y-6 pb-24">
          {/* Input */}
          <div className="flex gap-3 items-start">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=me" className="w-8 h-8 rounded-full bg-editorial-surface shrink-0" alt="" />
            <div className="flex-1 flex items-center gap-2 bg-editorial-surface rounded-full px-4 py-2 focus-within:ring-1 focus-within:ring-editorial-accent transition-shadow">
              <input value={comment} onChange={e => setComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-editorial-muted/60 text-editorial-ink" />
              <button disabled={!comment.trim()}
                className="shrink-0 text-editorial-accent disabled:opacity-30 transition-opacity">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          {mockComments.map(c => (
            <div key={c.id} className="flex gap-3">
              <img src={c.avatar} className="w-8 h-8 rounded-full bg-editorial-surface shrink-0" alt="" />
              <div className="flex-1">
                <div className="bg-editorial-surface rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-semibold text-editorial-ink">{c.author}</span>
                    <span className="text-xs text-editorial-muted">{relTime(c.publishedAt)}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-editorial-ink">{c.content}</p>
                </div>
                <div className="flex gap-4 mt-1.5 px-2">
                  <button className="flex items-center gap-1 text-xs text-editorial-muted hover:text-editorial-accent transition-colors">
                    <Heart className="h-3 w-3" /> {c.likes}
                  </button>
                  <button className="text-xs text-editorial-muted hover:text-editorial-ink transition-colors">Reply</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
