'use client';

import React, { useState } from 'react';
import { Mail, Lock, User, Chrome, Github, ShieldAlert } from 'lucide-react';

export default function AuthV7() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="max-w-md w-full mx-auto font-sans">
      
      {/* Header */}
      <div className="mb-8 text-center lg:text-left">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
          {isSignUp ? 'Join Imperium Intelligence' : 'Authenticate Credentials'}
        </h2>
        <p className="text-xs text-editorial-muted mt-1.5">
          Select your verification provider or register details below.
        </p>
      </div>

      {/* Social Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button className="flex items-center justify-center gap-2 border border-editorial-border dark:border-zinc-800 hover:bg-editorial-surface dark:hover:bg-zinc-800 text-editorial-ink dark:text-white py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.01] active:scale-[0.99]">
          <Chrome className="w-4 h-4 text-red-500" />
          <span>Google</span>
        </button>
        <button className="flex items-center justify-center gap-2 border border-editorial-border dark:border-zinc-800 hover:bg-editorial-surface dark:hover:bg-zinc-800 text-editorial-ink dark:text-white py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.01] active:scale-[0.99]">
          <Github className="w-4 h-4 text-black dark:text-white" />
          <span>GitHub</span>
        </button>
      </div>

      {/* Separator */}
      <div className="flex items-center gap-3 my-6">
        <div className="h-px bg-editorial-border dark:bg-zinc-800 flex-1" />
        <span className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest shrink-0">
          or use credentials
        </span>
        <div className="h-px bg-editorial-border dark:bg-zinc-800 flex-1" />
      </div>

      {/* Inputs Form */}
      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        {isSignUp && (
          <div className="space-y-1">
            <div className="flex items-center border border-editorial-border dark:border-zinc-800 rounded-xl px-3 py-2 bg-white dark:bg-zinc-950 focus-within:border-brand-500 transition-all">
              <User className="w-4.5 h-4.5 text-editorial-muted mr-2.5 shrink-0" />
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent outline-none text-sm text-editorial-ink dark:text-white placeholder:text-editorial-muted/50"
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center border border-editorial-border dark:border-zinc-800 rounded-xl px-3 py-2 bg-white dark:bg-zinc-950 focus-within:border-brand-500 transition-all">
            <Mail className="w-4.5 h-4.5 text-editorial-muted mr-2.5 shrink-0" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent outline-none text-sm text-editorial-ink dark:text-white placeholder:text-editorial-muted/50"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center border border-editorial-border dark:border-zinc-800 rounded-xl px-3 py-2 bg-white dark:bg-zinc-950 focus-within:border-brand-500 transition-all">
            <Lock className="w-4.5 h-4.5 text-editorial-muted mr-2.5 shrink-0" />
            <input
              type="password"
              placeholder="Security Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent outline-none text-sm text-editorial-ink dark:text-white placeholder:text-editorial-muted/50"
            />
          </div>
        </div>

        {!isSignUp && (
          <div className="text-right">
            <a href="#" className="text-xs font-semibold text-editorial-muted hover:text-editorial-ink transition-colors">
              Forgot details?
            </a>
          </div>
        )}

        <button
          type="submit"
          className="w-full mt-6 bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-sm"
        >
          <ShieldAlert className="w-4 h-4" />
          <span>{isSignUp ? 'Authorize Account' : 'Confirm & Enter'}</span>
        </button>
      </form>

      {/* Switch mode */}
      <div className="mt-8 text-center text-xs text-editorial-muted">
        <span>{isSignUp ? 'Linked profile exists?' : 'No active account?'}</span>{' '}
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="font-bold text-brand-500 hover:text-brand-600 underline underline-offset-4 transition-colors"
        >
          {isSignUp ? 'Login credentials' : 'Register now'}
        </button>
      </div>

    </div>
  );
}
