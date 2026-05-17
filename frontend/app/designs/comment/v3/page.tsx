'use client';
import { X, Heart, MessageCircle, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { mockArticle, mockComments, relTime } from '../../_mock';

export default function CommentV3() {
  const [comment, setComment] = useState('');
  const a = mockArticle;

  return (
    <div className="min-h-screen font-sans flex">
      {/* Blurred article behind */}
      <div className="flex-1 relative overflow-hidden">
        <div className="fixed inset-0 bg-editorial-ink/20 backdrop-blur-[2px]" />
        <div className="relative z-0 p-10 max-w-2xl">
          <span className="text-[10px] font-bold uppercase tracking-widest text-editorial-accent">{a.topic}</span>
          <h1 className="font-serif text-4xl font-bold text-editorial-ink mt-2 mb-4 leading-tight">{a.title}</h1>
          <p className="text-editorial-muted leading-relaxed">{a.excerpt}</p>
        </div>
      </div>

      {/* Right drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-20 w-full max-w-[400px] bg-editorial-bg border-l border-editorial-border flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-editorial-border shrink-0">
          <div>
            <h2 className="text-sm font-bold text-editorial-ink">Discussion</h2>
            <p className="text-xs text-editorial-muted">{mockComments.length} comments</p>
          </div>
          <Link href="/designs" className="rounded-full p-1.5 hover:bg-editorial-surface transition-colors">
            <X className="h-4 w-4 text-editorial-muted" />
          </Link>
        </div>

        {/* Article mini-card */}
        <div className="mx-4 my-3 p-3 bg-editorial-surface rounded-xl flex gap-3 shrink-0">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-editorial-border shrink-0">
            <img src={a.imageUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <p className="text-xs font-medium text-editorial-ink leading-snug line-clamp-3">{a.title}</p>
        </div>

        {/* Comments */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-2 space-y-5">
          {mockComments.map(c => (
            <div key={c.id} className="flex gap-3">
              <img src={c.avatar} className="w-8 h-8 rounded-full bg-editorial-surface shrink-0" alt="" />
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-semibold text-editorial-ink">{c.author}</span>
                  <span className="text-xs text-editorial-muted">{relTime(c.publishedAt)}</span>
                </div>
                <p className="text-sm leading-relaxed text-editorial-ink">{c.content}</p>
                <div className="flex gap-3 mt-1.5">
                  <button className="flex items-center gap-1 text-xs text-editorial-muted hover:text-editorial-accent transition-colors">
                    <Heart className="h-3 w-3" /> {c.likes}
                  </button>
                  <button className="flex items-center gap-1 text-xs text-editorial-muted hover:text-editorial-ink transition-colors">
                    <MessageCircle className="h-3 w-3" /> {c.replies}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-editorial-border px-4 py-3 flex gap-2 items-center">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=me" className="w-8 h-8 rounded-full bg-editorial-surface shrink-0" alt="" />
          <div className="flex-1 flex items-center gap-2 bg-editorial-surface rounded-full px-4 py-2 focus-within:ring-1 focus-within:ring-editorial-accent transition-shadow">
            <input value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Your thoughts..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-editorial-muted/60 text-editorial-ink" />
            <button disabled={!comment.trim()} className="shrink-0 text-editorial-accent disabled:opacity-30 transition-opacity">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
