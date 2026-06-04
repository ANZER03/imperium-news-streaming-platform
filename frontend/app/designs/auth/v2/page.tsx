'use client';

import React, { useState } from 'react';
import { Mail, Lock, User, Sparkles, LogIn } from 'lucide-react';

export default function AuthV2() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="max-w-md w-full mx-auto relative z-10 transition-all duration-300">
      {/* Decorative colored glow blobs in background */}
      <div className="absolute -top-16 -left-16 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-brand-600/10 rounded-full blur-2xl pointer-events-none" />

      {/* Glass card */}
      <div className="backdrop-blur-lg bg-white/60 dark:bg-zinc-950/40 border border-white/50 dark:border-zinc-800/50 rounded-3xl p-8 md:p-10 shadow-2xl shadow-purple-500/5">
        
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex p-3 bg-brand-500/10 text-brand-500 rounded-2xl mb-4 animate-pulse">
            <Sparkles className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            {isSignUp ? 'Create Premium Account' : 'Welcome Back'}
          </h2>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2">
            {isSignUp 
              ? 'Access real-time global news streams instantly.' 
              : 'Enter your credentials to resume your experience.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
          {isSignUp && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400 ml-1">
                Full Name
              </label>
              <div className="flex items-center bg-white/50 dark:bg-zinc-900/50 border border-gray-200/50 dark:border-zinc-800/50 rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:border-brand-500 transition-all backdrop-blur-sm">
                <User className="w-4.5 h-4.5 text-gray-400 dark:text-zinc-500 mr-3 shrink-0" />
                <input
                  type="text"
                  placeholder="Arthur Dent"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-600"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400 ml-1">
              Email Address
            </label>
            <div className="flex items-center bg-white/50 dark:bg-zinc-900/50 border border-gray-200/50 dark:border-zinc-800/50 rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:border-brand-500 transition-all backdrop-blur-sm">
              <Mail className="w-4.5 h-4.5 text-gray-400 dark:text-zinc-500 mr-3 shrink-0" />
              <input
                type="email"
                placeholder="arthur@galaxy.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400">
                Password
              </label>
              {!isSignUp && (
                <a href="#" className="text-xs text-brand-500 hover:text-brand-600 transition-colors">
                  Forgot?
                </a>
              )}
            </div>
            <div className="flex items-center bg-white/50 dark:bg-zinc-900/50 border border-gray-200/50 dark:border-zinc-800/50 rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:border-brand-500 transition-all backdrop-blur-sm">
              <Lock className="w-4.5 h-4.5 text-gray-400 dark:text-zinc-500 mr-3 shrink-0" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-600"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-6 bg-brand-500 hover:bg-brand-600 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-purple-500/20 active:scale-[0.98]"
          >
            <span>{isSignUp ? 'Generate Account' : 'Authenticate'}</span>
            <LogIn className="w-4 h-4" />
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-500 dark:text-zinc-400 border-t border-gray-100 dark:border-zinc-800/50 pt-5">
          <span>{isSignUp ? 'Already have an identity?' : 'Need a login?'}</span>{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="font-bold text-brand-500 hover:text-brand-600 underline underline-offset-4 transition-colors"
          >
            {isSignUp ? 'Sign In' : 'Create One'}
          </button>
        </div>

      </div>
    </div>
  );
}
