'use client';
import { X, Heart, MessageCircle, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { mockArticle, mockComments, relTime } from '../../_mock';

export default function CommentV1() {
  const [comment, setComment] = useState('');
  const a = mockArticle;

  return (
    <div className="min-h-screen bg-editorial-ink/20 font-sans flex flex-col justify-end">
      {/* Dim backdrop */}
      <div className="fixed inset-0 bg-editorial-ink/40 backdrop-blur-sm" />

      {/* Bottom sheet */}
      <div className="relative z-10 bg-editorial-bg rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-editorial-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-editorial-border shrink-0">
          <div>
            <h2 className="text-sm font-bold text-editorial-ink">Comments</h2>
            <p className="text-xs text-editorial-muted truncate max-w-[260px]">{a.title}</p>
          </div>
          <Link href="/designs" className="rounded-full p-1.5 hover:bg-editorial-surface transition-colors">
            <X className="h-4 w-4 text-editorial-muted" />
          </Link>
        </div>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 space-y-6">
          {mockComments.map(c => (
            <div key={c.id} className="flex gap-3">
              <img src={c.avatar} className="w-8 h-8 rounded-full bg-editorial-surface shrink-0" alt="" />
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-semibold text-editorial-ink">{c.author}</span>
                  <span className="text-xs text-editorial-muted">{relTime(c.publishedAt)}</span>
                </div>
                <p className="text-sm leading-relaxed text-editorial-ink">{c.content}</p>
                <div className="flex gap-4 mt-2">
                  <button className="flex items-center gap-1 text-xs text-editorial-muted hover:text-editorial-accent transition-colors">
                    <Heart className="h-3 w-3" /> {c.likes}
                  </button>
                  <button className="flex items-center gap-1 text-xs text-editorial-muted hover:text-editorial-ink transition-colors">
                    <MessageCircle className="h-3 w-3" /> {c.replies} replies
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input pinned at bottom */}
        <div className="shrink-0 border-t border-editorial-border px-4 py-3 flex gap-3 items-center">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=me" className="w-8 h-8 rounded-full bg-editorial-surface shrink-0" alt="" />
          <div className="flex-1 flex items-center gap-2 bg-editorial-surface rounded-full px-4 py-2 focus-within:ring-1 focus-within:ring-editorial-accent transition-shadow">
            <input value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Add a comment..."
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
