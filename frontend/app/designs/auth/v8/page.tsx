'use client';

import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export default function AuthV8() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="max-w-xl w-full mx-auto font-serif text-editorial-ink leading-relaxed">
      
      {/* Header */}
      <div className="mb-12">
        <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-editorial-accent">
          Interactive Narrative
        </span>
        <h2 className="text-3xl font-extrabold mt-1 tracking-tight">
          {isSignUp ? 'Create Membership Statement' : 'State Your Identity'}
        </h2>
      </div>

      {/* Narrative sentence form */}
      <form onSubmit={(e) => e.preventDefault()} className="text-xl md:text-2xl font-serif text-gray-800 dark:text-zinc-200 space-y-6">
        <div>
          <span>I would like to </span>
          <button 
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-brand-500 font-bold border-b-2 border-brand-500 hover:text-brand-600 transition-colors mx-1 inline-block pb-0.5 focus:outline-none cursor-pointer"
          >
            {isSignUp ? 'register an account' : 'log in'}
          </button>
          <span> to the Imperium stream.</span>
        </div>

        {isSignUp && (
          <div className="flex flex-wrap items-baseline gap-y-2">
            <span>My full name is </span>
            <input
              type="text"
              placeholder="Arthur Dent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mx-2 bg-transparent border-b-2 border-editorial-border dark:border-zinc-800 hover:border-editorial-ink focus:border-brand-500 outline-none text-editorial-ink dark:text-white font-bold placeholder:text-editorial-muted/30 px-1 py-0.5 min-w-[200px] text-lg md:text-xl font-sans"
            />
            <span>.</span>
          </div>
        )}

        <div className="flex flex-wrap items-baseline gap-y-2">
          <span>You can reach me at </span>
          <input
            type="email"
            placeholder="name@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mx-2 bg-transparent border-b-2 border-editorial-border dark:border-zinc-800 hover:border-editorial-ink focus:border-brand-500 outline-none text-editorial-ink dark:text-white font-bold placeholder:text-editorial-muted/30 px-1 py-0.5 min-w-[240px] text-lg md:text-xl font-sans"
          />
          <span>.</span>
        </div>

        <div className="flex flex-wrap items-baseline gap-y-2">
          <span>I will secure my account with passcode </span>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mx-2 bg-transparent border-b-2 border-editorial-border dark:border-zinc-800 hover:border-editorial-ink focus:border-brand-500 outline-none text-editorial-ink dark:text-white font-bold placeholder:text-editorial-muted/30 px-1 py-0.5 min-w-[150px] text-lg md:text-xl font-sans"
          />
          <span>.</span>
        </div>

        <div className="pt-8">
          <button
            type="submit"
            className="inline-flex items-center gap-3 bg-editorial-ink text-white font-semibold px-8 py-3.5 rounded-full hover:bg-brand-600 transition-all shadow-md hover:shadow-lg hover:shadow-purple-500/10 active:scale-[0.98] group"
          >
            <span className="text-sm font-sans tracking-wide">
              {isSignUp ? 'Submit Statement' : 'Verify & Proceed'}
            </span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </form>

    </div>
  );
}
