'use client';

import React, { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, Shield } from 'lucide-react';

export default function AuthV10() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="max-w-md w-full mx-auto text-zinc-100 relative">
      
      {/* Decorative dark background glow */}
      <div className="absolute -top-32 -left-32 w-64 h-64 bg-brand-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-purple-600/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Main card */}
      <div className="relative z-10 bg-zinc-950/80 border border-zinc-800/80 backdrop-blur-md rounded-3xl p-8 md:p-10 shadow-2xl shadow-black/80">
        
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex p-2.5 bg-zinc-900 border border-zinc-800 rounded-2xl text-brand-500 mb-3 shadow-[0_0_15px_rgba(111,63,245,0.15)]">
            <Shield className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {isSignUp ? 'Establish Membership' : 'Access System'}
          </h2>
          <p className="text-xs text-zinc-500 mt-2">
            {isSignUp 
              ? 'Join the secure global real-time intelligence feed.' 
              : 'Enter secure credentials to resume monitoring.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
          {isSignUp && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 ml-1">
                Full Name
              </label>
              <div className="flex items-center bg-zinc-900/60 border border-zinc-800 focus-within:border-brand-500 focus-within:shadow-[0_0_10px_rgba(111,63,245,0.2)] rounded-xl px-3.5 py-2.5 transition-all">
                <User className="w-4.5 h-4.5 text-zinc-500 mr-3 shrink-0" />
                <input
                  type="text"
                  placeholder="Arthur Dent"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm text-white placeholder:text-zinc-700 font-medium"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400 ml-1">
              Email Address
            </label>
            <div className="flex items-center bg-zinc-900/60 border border-zinc-800 focus-within:border-brand-500 focus-within:shadow-[0_0_10px_rgba(111,63,245,0.2)] rounded-xl px-3.5 py-2.5 transition-all">
              <Mail className="w-4.5 h-4.5 text-zinc-500 mr-3 shrink-0" />
              <input
                type="email"
                placeholder="arthur@galaxy.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent outline-none text-sm text-white placeholder:text-zinc-700 font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-semibold text-zinc-400">
                Security Password
              </label>
              {!isSignUp && (
                <a href="#" className="text-xs text-brand-500 hover:text-brand-400 transition-colors font-medium">
                  Recover
                </a>
              )}
            </div>
            <div className="flex items-center bg-zinc-900/60 border border-zinc-800 focus-within:border-brand-500 focus-within:shadow-[0_0_10px_rgba(111,63,245,0.2)] rounded-xl px-3.5 py-2.5 transition-all relative">
              <Lock className="w-4.5 h-4.5 text-zinc-500 mr-3 shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent outline-none text-sm text-white placeholder:text-zinc-700 font-medium pr-8"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-400 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-6 bg-brand-500 hover:bg-brand-650 text-white font-bold py-3 rounded-xl transition-all shadow-[0_4px_20px_rgba(111,63,245,0.2)] hover:shadow-[0_4px_25px_rgba(111,63,245,0.35)] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span>{isSignUp ? 'Initialize Profile' : 'Authenticate Session'}</span>
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-zinc-500 border-t border-zinc-900 pt-5">
          <span>{isSignUp ? 'Have credentials?' : 'Need system access?'}</span>{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="font-bold text-brand-500 hover:text-brand-400 underline underline-offset-4 transition-colors"
          >
            {isSignUp ? 'Login' : 'Request Profile'}
          </button>
        </div>

      </div>
    </div>
  );
}
