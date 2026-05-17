'use client';
import { X, Heart, Send, CornerDownRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { mockArticle, mockComments, relTime } from '../../_mock';

export default function CommentV5() {
  const [comment, setComment] = useState('');
  const [liked, setLiked] = useState<string[]>([]);
  const a = mockArticle;

  return (
    <div className="min-h-screen bg-editorial-surface font-sans flex items-end justify-center sm:items-center p-0 sm:p-6">
      <div className="fixed inset-0 bg-editorial-ink/25 backdrop-blur-sm" />

      <div className="relative z-10 w-full sm:max-w-md bg-editorial-bg sm:rounded-2xl shadow-2xl flex flex-col max-h-screen sm:max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-editorial-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-editorial-surface shrink-0">
              <img src={a.imageUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-xs font-bold text-editorial-ink line-clamp-1 max-w-[220px]">{a.title}</p>
              <p className="text-[10px] text-editorial-muted">{mockComments.length} responses</p>
            </div>
          </div>
          <Link href="/designs" className="rounded-full p-1.5 hover:bg-editorial-surface transition-colors">
            <X className="h-4 w-4 text-editorial-muted" />
          </Link>
        </div>

        {/* Comments */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 space-y-6">
          {mockComments.map((c, i) => (
            <div key={c.id} className="flex gap-3">
              {/* Number */}
              <div className="shrink-0 w-6 text-right">
                <span className="text-[10px] font-bold text-editorial-muted/50 font-serif">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <img src={c.avatar} className="w-6 h-6 rounded-full bg-editorial-surface" alt="" />
                  <span className="text-xs font-semibold text-editorial-ink">{c.author}</span>
                  <span className="text-xs text-editorial-muted ml-auto">{relTime(c.publishedAt)}</span>
                </div>
                {/* Quote-style comment */}
                <p className="font-serif text-sm leading-relaxed text-editorial-ink italic">&ldquo;{c.content}&rdquo;</p>
                <div className="flex items-center gap-4 mt-2">
                  <button
                    onClick={() => setLiked(l => l.includes(c.id) ? l.filter(x => x !== c.id) : [...l, c.id])}
                    className={`flex items-center gap-1 text-xs transition-colors ${liked.includes(c.id) ? 'text-editorial-accent' : 'text-editorial-muted hover:text-editorial-accent'}`}>
                    <Heart className={`h-3 w-3 ${liked.includes(c.id) ? 'fill-editorial-accent' : ''}`} />
                    {c.likes + (liked.includes(c.id) ? 1 : 0)}
                  </button>
                  <button className="flex items-center gap-1 text-xs text-editorial-muted hover:text-editorial-ink transition-colors">
                    <CornerDownRight className="h-3 w-3" /> Reply
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-editorial-border px-4 py-3">
          <div className="flex gap-2 items-end">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=me" className="w-7 h-7 rounded-full bg-editorial-surface shrink-0" alt="" />
            <div className="flex-1 bg-editorial-surface rounded-2xl px-3 py-2 focus-within:ring-1 focus-within:ring-editorial-accent transition-shadow">
              <textarea value={comment} onChange={e => setComment(e.target.value)}
                placeholder="Your response..." rows={2}
                className="w-full text-sm bg-transparent outline-none resize-none placeholder:text-editorial-muted/60 text-editorial-ink" />
            </div>
            <button disabled={!comment.trim()}
              className="shrink-0 w-8 h-8 rounded-full bg-editorial-accent flex items-center justify-center disabled:opacity-40 transition-opacity">
              <Send className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
