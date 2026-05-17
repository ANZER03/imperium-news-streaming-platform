'use client';
import { ArrowLeft, Bookmark, Share2, Heart, MessageCircle, Send, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { mockArticle, mockComments, relTime } from '../../_mock';

export default function ArticleV2() {
  const [saved, setSaved] = useState(false);
  const [comment, setComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const a = mockArticle;

  return (
    <div className="min-h-screen bg-editorial-bg text-editorial-ink font-sans">
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-editorial-bg/95 backdrop-blur border-b border-editorial-border px-6 py-3">
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

      <div className="pt-[49px] lg:flex lg:h-screen lg:overflow-hidden">
        {/* Left sticky image panel */}
        <div className="lg:w-[45%] lg:sticky lg:top-[49px] lg:h-[calc(100vh-49px)] relative overflow-hidden bg-editorial-ink">
          <img src={a.imageUrl} alt={a.title} className="absolute inset-0 w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-editorial-ink via-editorial-ink/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-editorial-accent">{a.topic}</span>
            <h1 className="font-serif text-3xl font-bold text-white leading-[1.15] mt-3 mb-4">{a.title}</h1>
            <div className="flex items-center gap-2 text-white/60 text-xs">
              <span>{a.author}</span><span>·</span>
              <span>{a.sourceName}</span><span>·</span>
              <span>{relTime(a.publishedAt)} ago</span>
            </div>
          </div>
        </div>

        {/* Right scrollable content */}
        <div className="lg:w-[55%] lg:overflow-y-auto lg:h-[calc(100vh-49px)] no-scrollbar">
          <div className="px-8 py-10 max-w-xl">
            <p className="font-serif text-lg leading-relaxed text-editorial-muted italic mb-8">{a.excerpt}</p>

            <div className="space-y-5 text-[16px] leading-[1.85]">
              {a.content.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
            </div>

            <a href={a.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-8 text-xs font-bold uppercase tracking-widest text-editorial-accent hover:underline">
              Read original →
            </a>

            <div className="mt-12 border-t border-editorial-border pt-8">
              <button onClick={() => setShowComments(s => !s)}
                className="flex items-center gap-2 text-sm font-semibold hover:text-editorial-accent transition-colors">
                <MessageCircle className="h-4 w-4" />
                {mockComments.length} comments
                <ChevronDown className={`h-4 w-4 transition-transform ${showComments ? 'rotate-180' : ''}`} />
              </button>

              {showComments && (
                <div className="mt-6 space-y-6">
                  <div className="flex gap-3">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=me" className="w-8 h-8 rounded-full bg-editorial-surface shrink-0" alt="" />
                    <div className="flex-1 bg-editorial-surface rounded-xl px-4 py-3 focus-within:ring-1 focus-within:ring-editorial-accent transition-shadow">
                      <textarea value={comment} onChange={e => setComment(e.target.value)}
                        placeholder="Add to the discussion..." rows={2}
                        className="w-full text-sm bg-transparent outline-none resize-none placeholder:text-editorial-muted/60" />
                      <div className="flex justify-end mt-2">
                        <button disabled={!comment.trim()}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-editorial-accent text-white text-xs font-bold disabled:opacity-40">
                          <Send className="h-3 w-3" /> Post
                        </button>
                      </div>
                    </div>
                  </div>

                  {mockComments.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <img src={c.avatar} className="w-8 h-8 rounded-full bg-editorial-surface shrink-0" alt="" />
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-semibold">{c.author}</span>
                          <span className="text-xs text-editorial-muted">{relTime(c.publishedAt)} ago</span>
                        </div>
                        <p className="text-sm leading-relaxed">{c.content}</p>
                        <div className="flex gap-4 mt-2">
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
