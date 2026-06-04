'use client';

import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';

export default function AuthV1() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="max-w-md w-full mx-auto font-serif text-editorial-ink">
      <div className="mb-10 text-left border-b border-editorial-ink pb-6">
        <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-editorial-muted">
          Edition Vol. I
        </span>
        <h2 className="text-3xl font-bold mt-2 tracking-tight">
          {isSignUp ? 'Establish Membership' : 'Access Your Profile'}
        </h2>
        <p className="text-sm font-sans text-editorial-muted mt-2 leading-relaxed">
          {isSignUp 
            ? 'Join our global intelligence network for personalized real-time reports.' 
            : 'Enter your credentials to continue reading.'}
        </p>
      </div>

      {/* Google Login Button */}
      <button
        type="button"
        className="w-full border border-editorial-ink/40 text-editorial-ink font-semibold py-3 px-6 rounded-none flex items-center justify-center gap-2.5 hover:bg-editorial-surface transition-all font-sans text-xs uppercase tracking-wider mb-6 active:scale-[0.99]"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span>Continue with Google</span>
      </button>

      <div className="flex items-center gap-3 my-6 font-sans">
        <div className="h-px bg-editorial-border flex-1" />
        <span className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest shrink-0">
          or use credentials
        </span>
        <div className="h-px bg-editorial-border flex-1" />
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-8 font-sans">
        {isSignUp && (
          <div className="group relative">
            <label className="text-[10px] font-bold uppercase tracking-widest text-editorial-muted transition-colors group-focus-within:text-brand-500">
              Full Name
            </label>
            <div className="mt-1 flex items-center border-b border-editorial-border group-focus-within:border-editorial-ink transition-colors pb-1">
              <User className="w-4 h-4 text-editorial-muted/60 mr-3" />
              <input
                type="text"
                placeholder="Arthur Dent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent outline-none text-sm text-editorial-ink placeholder:text-editorial-muted/30 py-1 font-serif"
              />
            </div>
          </div>
        )}

        <div className="group relative">
          <label className="text-[10px] font-bold uppercase tracking-widest text-editorial-muted transition-colors group-focus-within:text-brand-500">
            Email Address
          </label>
          <div className="mt-1 flex items-center border-b border-editorial-border group-focus-within:border-editorial-ink transition-colors pb-1">
            <Mail className="w-4 h-4 text-editorial-muted/60 mr-3" />
            <input
              type="email"
              placeholder="name@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent outline-none text-sm text-editorial-ink placeholder:text-editorial-muted/30 py-1 font-serif"
            />
          </div>
        </div>

        <div className="group relative">
          <div className="flex justify-between items-baseline">
            <label className="text-[10px] font-bold uppercase tracking-widest text-editorial-muted transition-colors group-focus-within:text-brand-500">
              Secret Password
            </label>
            {!isSignUp && (
              <a href="#" className="text-[10px] text-editorial-muted hover:text-editorial-ink transition-colors underline underline-offset-4">
                Forgot password?
              </a>
            )}
          </div>
          <div className="mt-1 flex items-center border-b border-editorial-border group-focus-within:border-editorial-ink transition-colors pb-1">
            <Lock className="w-4 h-4 text-editorial-muted/60 mr-3" />
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent outline-none text-sm text-editorial-ink placeholder:text-editorial-muted/30 py-1"
            />
          </div>
        </div>

        {isSignUp && (
          <div className="flex items-start">
            <input
              id="terms"
              type="checkbox"
              className="mt-1 mr-3 border-editorial-border rounded text-editorial-accent focus:ring-editorial-accent cursor-pointer"
            />
            <label htmlFor="terms" className="text-xs text-editorial-muted leading-relaxed">
              I agree to the <a href="#" className="underline hover:text-editorial-ink">Terms of Service</a> and acknowledge the <a href="#" className="underline hover:text-editorial-ink">Privacy Protocol</a>.
            </label>
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-editorial-ink text-white font-medium py-3 px-6 rounded-none flex items-center justify-between transition-all hover:bg-brand-600 hover:shadow-lg active:scale-[0.99] group mt-8"
        >
          <span className="font-serif tracking-wide">{isSignUp ? 'Subscribe Now' : 'Sign In'}</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>
      </form>

      <div className="mt-12 text-center border-t border-editorial-border pt-6 font-sans text-xs">
        <span className="text-editorial-muted mr-1">
          {isSignUp ? 'Already a member?' : 'New reader?'}
        </span>
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="font-bold text-editorial-ink hover:text-brand-500 transition-colors underline underline-offset-4"
        >
          {isSignUp ? 'Access Profile' : 'Register Account'}
        </button>
      </div>
    </div>
  );
}
