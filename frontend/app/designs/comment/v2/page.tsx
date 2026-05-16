'use client';
import { X, Heart, MessageCircle, Send, ArrowUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { mockArticle, mockComments, relTime } from '../../_mock';

export default function CommentV2() {
  const [comment, setComment] = useState('');
  const [liked, setLiked] = useState<string[]>([]);
  const a = mockArticle;

  return (
    <div className="min-h-screen bg-editorial-surface font-sans flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-editorial-ink/30 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-editorial-bg rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Article context strip */}
        <div className="flex items-start gap-3 p-4 border-b border-editorial-border shrink-0">
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-editorial-surface shrink-0">
            <img src={a.imageUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-editorial-accent">{a.topic}</span>
            <p className="text-sm font-semibold text-editorial-ink leading-tight line-clamp-2 mt-0.5">{a.title}</p>
            <p className="text-xs text-editorial-muted mt-0.5">{a.sourceName} · {relTime(a.publishedAt)} ago</p>
          </div>
          <Link href="/designs" className="rounded-full p-1.5 hover:bg-editorial-surface transition-colors shrink-0">
            <X className="h-4 w-4 text-editorial-muted" />
          </Link>
        </div>

        {/* Count */}
        <div className="px-4 py-2.5 border-b border-editorial-border shrink-0">
          <span className="text-xs font-bold uppercase tracking-widest text-editorial-muted">{mockComments.length} comments</span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-5">
          {mockComments.map(c => (
            <div key={c.id} className="flex gap-3">
              <img src={c.avatar} className="w-8 h-8 rounded-full bg-editorial-surface shrink-0" alt="" />
              <div className="flex-1">
                <div className="bg-editorial-surface rounded-2xl rounded-tl-sm px-3 py-2.5">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-semibold text-editorial-ink">{c.author}</span>
                    <span className="text-xs text-editorial-muted">{relTime(c.publishedAt)}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-editorial-ink">{c.content}</p>
                </div>
                <div className="flex gap-3 mt-1.5 px-1">
                  <button onClick={() => setLiked(l => l.includes(c.id) ? l.filter(x => x !== c.id) : [...l, c.id])}
                    className={`flex items-center gap-1 text-xs transition-colors ${liked.includes(c.id) ? 'text-editorial-accent' : 'text-editorial-muted hover:text-editorial-accent'}`}>
                    <Heart className={`h-3 w-3 ${liked.includes(c.id) ? 'fill-editorial-accent' : ''}`} />
                    {c.likes + (liked.includes(c.id) ? 1 : 0)}
                  </button>
                  <button className="text-xs text-editorial-muted hover:text-editorial-ink transition-colors">Reply</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-editorial-border p-3 flex gap-2 items-end">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=me" className="w-8 h-8 rounded-full bg-editorial-surface shrink-0" alt="" />
          <div className="flex-1 bg-editorial-surface rounded-2xl px-3 py-2 focus-within:ring-1 focus-within:ring-editorial-accent transition-shadow">
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Write a comment..." rows={2}
              className="w-full text-sm bg-transparent outline-none resize-none placeholder:text-editorial-muted/60 text-editorial-ink" />
          </div>
          <button disabled={!comment.trim()}
            className="shrink-0 w-9 h-9 rounded-full bg-editorial-accent flex items-center justify-center disabled:opacity-40 transition-opacity">
            <ArrowUp className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
