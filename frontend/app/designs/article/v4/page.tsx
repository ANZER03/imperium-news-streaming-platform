'use client';
import { ArrowLeft, Bookmark, Share2, Heart, MessageCircle, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { mockArticle, mockComments, relTime } from '../../_mock';

export default function ArticleV4() {
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'article' | 'comments'>('article');
  const [comment, setComment] = useState('');
  const a = mockArticle;

  return (
    <div className="min-h-screen bg-editorial-bg text-editorial-ink font-sans">
      {/* Full-bleed hero */}
      <div className="relative h-[70vh] min-h-[480px] bg-editorial-ink overflow-hidden">
        <img src={a.imageUrl} alt={a.title} className="absolute inset-0 w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-editorial-ink to-transparent" />

        {/* Nav over hero */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4">
          <Link href="/designs" className="flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-1">
            <button onClick={() => setSaved(s => !s)} className="rounded-full p-2 hover:bg-white/10 transition-colors">
              <Bookmark className={`h-4 w-4 ${saved ? 'fill-editorial-accent text-editorial-accent' : 'text-white'}`} />
            </button>
            <button className="rounded-full p-2 hover:bg-white/10 transition-colors">
              <Share2 className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {/* Hero text */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-10 max-w-3xl mx-auto">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-editorial-accent">{a.topic}</span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-white leading-[1.1] mt-3 mb-4">{a.title}</h1>
          <div className="flex items-center gap-2 text-white/60 text-xs">
            <span>{a.author}</span><span>·</span>
            <span>{a.sourceName}</span><span>·</span>
            <span>{relTime(a.publishedAt)} ago</span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="sticky top-0 z-40 bg-editorial-bg border-b border-editorial-border">
        <div className="max-w-2xl mx-auto px-6 flex gap-8">
          {(['article', 'comments'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-3.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t ? 'border-editorial-accent text-editorial-ink' : 'border-transparent text-editorial-muted hover:text-editorial-ink'
              }`}>
              {t === 'comments' ? `Comments (${mockComments.length})` : t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {tab === 'article' ? (
          <>
            <p className="font-serif text-xl leading-relaxed text-editorial-muted italic mb-8">{a.excerpt}</p>
            <div className="space-y-5 text-[17px] leading-[1.8]">
              {a.content.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <a href={a.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-10 text-xs font-bold uppercase tracking-widest text-editorial-accent hover:underline">
              Read original →
            </a>
          </>
        ) : (
          <div className="space-y-6">
            {/* Input */}
            <div className="flex gap-3">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=me" className="w-9 h-9 rounded-full bg-editorial-surface shrink-0" alt="" />
              <div className="flex-1 border border-editorial-border rounded-2xl overflow-hidden focus-within:border-editorial-accent transition-colors">
                <textarea value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Share your perspective..." rows={3}
                  className="w-full px-4 pt-3 pb-2 text-sm bg-transparent outline-none resize-none placeholder:text-editorial-muted/60" />
                <div className="flex justify-end px-3 pb-3">
                  <button disabled={!comment.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-editorial-accent text-white text-xs font-bold disabled:opacity-40">
                    <Send className="h-3 w-3" /> Post
                  </button>
                </div>
              </div>
            </div>

            {mockComments.map(c => (
              <div key={c.id} className="flex gap-3 pb-6 border-b border-editorial-border last:border-0">
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
        )}
      </div>
    </div>
  );
}
