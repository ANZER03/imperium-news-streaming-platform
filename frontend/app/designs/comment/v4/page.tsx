'use client';
import { ArrowLeft, Heart, Send, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { mockArticle, mockComments, relTime } from '../../_mock';

export default function CommentV4() {
  const [comment, setComment] = useState('');
  const [liked, setLiked] = useState<string[]>([]);
  const a = mockArticle;

  return (
    <div className="min-h-screen bg-editorial-bg font-sans">
      {/* Accent header */}
      <header className="bg-editorial-accent px-5 pt-10 pb-6">
        <Link href="/designs" className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition-colors w-fit">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-white font-bold text-xl mb-1">Discussion</h1>
        <p className="text-white/60 text-xs line-clamp-1">{a.title}</p>
        <div className="flex items-center gap-3 mt-4">
          <span className="text-white/80 text-xs font-medium">{mockComments.length} comments</span>
          <span className="text-white/40">·</span>
          <span className="text-white/80 text-xs">{a.sourceName}</span>
        </div>
      </header>

      {/* Comment input pinned below header */}
      <div className="sticky top-0 z-30 bg-editorial-bg border-b border-editorial-border px-4 py-3 flex gap-3 items-center">
        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=me" className="w-8 h-8 rounded-full bg-editorial-surface shrink-0" alt="" />
        <div className="flex-1 flex items-center gap-2 bg-editorial-surface rounded-full px-4 py-2 focus-within:ring-1 focus-within:ring-editorial-accent transition-shadow">
          <input value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Join the discussion..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-editorial-muted/60 text-editorial-ink" />
          <button disabled={!comment.trim()} className="shrink-0 text-editorial-accent disabled:opacity-30 transition-opacity">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Comments */}
      <div className="max-w-xl mx-auto px-4 py-6 space-y-0 divide-y divide-editorial-border">
        {mockComments.map(c => (
          <div key={c.id} className="py-5">
            <div className="flex gap-3">
              <img src={c.avatar} className="w-9 h-9 rounded-full bg-editorial-surface shrink-0" alt="" />
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-editorial-ink">{c.author}</span>
                  <span className="text-xs text-editorial-muted">{relTime(c.publishedAt)} ago</span>
                </div>
                <p className="text-sm leading-relaxed text-editorial-ink mb-3">{c.content}</p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setLiked(l => l.includes(c.id) ? l.filter(x => x !== c.id) : [...l, c.id])}
                    className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${liked.includes(c.id) ? 'text-editorial-accent' : 'text-editorial-muted hover:text-editorial-accent'}`}>
                    <ThumbsUp className={`h-3.5 w-3.5 ${liked.includes(c.id) ? 'fill-editorial-accent' : ''}`} />
                    {c.likes + (liked.includes(c.id) ? 1 : 0)} Helpful
                  </button>
                  <button className="text-xs text-editorial-muted hover:text-editorial-ink transition-colors font-medium">Reply</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
