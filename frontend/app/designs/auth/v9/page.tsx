'use client';

import React, { useState } from 'react';
import { Mail, Lock, User, KeyRound } from 'lucide-react';

export default function AuthV9() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="max-w-md w-full mx-auto font-sans">
      
      {/* Container Card */}
      <div className="bg-editorial-surface dark:bg-zinc-900 border border-editorial-border/30 dark:border-zinc-800/30 rounded-3xl p-8 shadow-xl">
        
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex p-3 rounded-full bg-editorial-surface dark:bg-zinc-900 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.15),_inset_-1px_-1px_3px_rgba(255,255,255,0.1)] text-brand-500 mb-3">
            <KeyRound className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
            {isSignUp ? 'Tactile Registration' : 'Tactile Credentials'}
          </h2>
          <p className="text-xs text-editorial-muted mt-1">
            Soft physical controls for secure authentication.
          </p>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
          {isSignUp && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-editorial-muted ml-1">
                Full Name
              </label>
              <div className="flex items-center rounded-2xl px-4 py-3 bg-editorial-surface dark:bg-zinc-950 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.06),_inset_-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.4)]">
                <User className="w-4 h-4 text-editorial-muted mr-3 shrink-0" />
                <input
                  type="text"
                  placeholder="Arthur Dent"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm text-editorial-ink dark:text-white placeholder:text-editorial-muted/40 font-medium"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-editorial-muted ml-1">
              Email Address
            </label>
            <div className="flex items-center rounded-2xl px-4 py-3 bg-editorial-surface dark:bg-zinc-950 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.06),_inset_-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.4)]">
              <Mail className="w-4 h-4 text-editorial-muted mr-3 shrink-0" />
              <input
                type="email"
                placeholder="arthur@galaxy.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent outline-none text-sm text-editorial-ink dark:text-white placeholder:text-editorial-muted/40 font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-semibold text-editorial-muted">
                Password
              </label>
              {!isSignUp && (
                <a href="#" className="text-xs text-brand-500 hover:text-brand-650 transition-colors font-medium">
                  Forgot passcode?
                </a>
              )}
            </div>
            <div className="flex items-center rounded-2xl px-4 py-3 bg-editorial-surface dark:bg-zinc-950 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.06),_inset_-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.4)]">
              <Lock className="w-4 h-4 text-editorial-muted mr-3 shrink-0" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent outline-none text-sm text-editorial-ink dark:text-white placeholder:text-editorial-muted/40 font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-6 bg-editorial-surface dark:bg-zinc-900 border border-editorial-border/20 dark:border-zinc-800/25 hover:border-brand-500/20 text-brand-500 font-bold py-3.5 rounded-2xl shadow-[4px_4px_8px_rgba(0,0,0,0.06),_-4px_-4px_8px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.3)] hover:shadow-[2px_2px_4px_rgba(0,0,0,0.06),_-2px_-2px_4px_rgba(255,255,255,0.9)] active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),_inset_-2px_-2px_4px_rgba(255,255,255,0.8)] transition-all duration-200 active:scale-[0.99] flex items-center justify-center text-sm"
          >
            <span>{isSignUp ? 'Press to Register' : 'Press to Sign In'}</span>
          </button>
        </form>
      </div>

      {/* Switch mode */}
      <div className="mt-8 text-center text-xs text-editorial-muted">
        <span>{isSignUp ? 'Ready to log in?' : 'No active account?'}</span>{' '}
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="font-bold text-brand-500 hover:text-brand-600 underline underline-offset-4 transition-colors"
        >
          {isSignUp ? 'Access Profile' : 'Register Here'}
        </button>
      </div>

    </div>
  );
}
