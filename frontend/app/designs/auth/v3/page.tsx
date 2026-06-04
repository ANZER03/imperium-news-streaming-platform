'use client';

import React, { useState } from 'react';
import { Mail, Lock, User, CheckCircle2 } from 'lucide-react';

export default function AuthV3() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="max-w-md w-full mx-auto bg-white dark:bg-zinc-900 border border-editorial-border dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
      
      {/* Sliding Tab Header */}
      <div className="flex bg-editorial-surface dark:bg-zinc-950 p-1">
        <button
          onClick={() => setActiveTab('signin')}
          className={`flex-1 text-center py-3 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'signin'
              ? 'bg-white dark:bg-zinc-900 text-editorial-ink dark:text-white shadow-sm'
              : 'text-editorial-muted hover:text-editorial-ink dark:hover:text-white'
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => setActiveTab('signup')}
          className={`flex-1 text-center py-3 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'signup'
              ? 'bg-white dark:bg-zinc-900 text-editorial-ink dark:text-white shadow-sm'
              : 'text-editorial-muted hover:text-editorial-ink dark:hover:text-white'
          }`}
        >
          Register
        </button>
      </div>

      <div className="p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {activeTab === 'signin' ? 'Sign in to Imperium' : 'Create your account'}
          </h2>
          <p className="text-xs text-editorial-muted mt-1">
            {activeTab === 'signin' 
              ? 'Get personalized feeds, bookmarks and notifications.' 
              : 'Join the stream and customize your news intake.'}
          </p>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          {activeTab === 'signup' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-editorial-ink dark:text-zinc-300">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-editorial-muted/80" />
                <input
                  type="text"
                  placeholder="Arthur Dent"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border border-editorial-border dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-editorial-ink dark:text-white"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-editorial-ink dark:text-zinc-300">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-editorial-muted/80" />
              <input
                type="email"
                placeholder="arthur@guide.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-editorial-border dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-editorial-ink dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-editorial-ink dark:text-zinc-300">
                Password
              </label>
              {activeTab === 'signin' && (
                <a href="#" className="text-xs text-brand-500 hover:text-brand-600 transition-colors">
                  Forgot?
                </a>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-editorial-muted/80" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-editorial-border dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-editorial-ink dark:text-white"
              />
            </div>
          </div>

          {activeTab === 'signup' && (
            <div className="flex items-start gap-2.5 pt-1">
              <input 
                type="checkbox" 
                id="agree-v3" 
                className="mt-0.5 rounded border-editorial-border text-brand-500 focus:ring-brand-500 cursor-pointer"
              />
              <label htmlFor="agree-v3" className="text-xs text-editorial-muted leading-snug">
                I agree to the Terms of Service & Privacy Policy.
              </label>
            </div>
          )}

          <button
            type="submit"
            className="w-full mt-4 bg-brand-500 hover:bg-brand-600 text-white font-semibold py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <span>{activeTab === 'signin' ? 'Sign In' : 'Create Account'}</span>
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
}
