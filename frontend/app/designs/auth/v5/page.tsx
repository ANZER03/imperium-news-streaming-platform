'use client';

import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function AuthV5() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const isEmailActive = email.length > 0 || focusedField === 'email';
  const isPasswordActive = password.length > 0 || focusedField === 'password';
  const isNameActive = name.length > 0 || focusedField === 'name';

  return (
    <div className="max-w-md w-full mx-auto">
      
      {/* Title block with visual pop */}
      <div className="mb-5 text-center lg:text-left">
        <h2 className="text-3xl font-extrabold text-editorial-ink tracking-tight leading-none mb-2">
          Get <span className="text-brand-500 underline decoration-wavy decoration-2 underline-offset-4">imperium</span>.
        </h2>
        <p className="text-xs text-editorial-muted font-medium">
          {isSignUp ? 'Real-time intelligence feed is ready for you.' : 'Your global news dashboard is one click away.'}
        </p>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        
        {/* Full Name Input (with custom floating label) */}
        {isSignUp && (
          <div className="relative border-2 border-editorial-ink rounded-xl bg-white p-2 transition-all shadow-[3px_3px_0px_0px_#16131D] focus-within:shadow-[4px_4px_0px_0px_#6F3FF5]">
            <label className={`absolute left-9 transition-all pointer-events-none text-editorial-muted font-bold ${
              isNameActive ? '-top-2 bg-white px-1.5 text-[9px] text-brand-500' : 'top-2.5 text-xs'
            }`}>
              Full Name
            </label>
            <div className="flex items-center mt-1 px-1">
              <User className="w-4 h-4 text-editorial-ink mr-2 shrink-0" />
              <input
                type="text"
                value={name}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent outline-none text-xs text-editorial-ink font-bold pt-0.5"
              />
            </div>
          </div>
        )}

        {/* Email Input */}
        <div className="relative border-2 border-editorial-ink rounded-xl bg-white p-2 transition-all shadow-[3px_3px_0px_0px_#16131D] focus-within:shadow-[4px_4px_0px_0px_#6F3FF5]">
          <label className={`absolute left-9 transition-all pointer-events-none text-editorial-muted font-bold ${
            isEmailActive ? '-top-2 bg-white px-1.5 text-[9px] text-brand-500' : 'top-2.5 text-xs'
          }`}>
            Email Address
          </label>
          <div className="flex items-center mt-1 px-1">
            <Mail className="w-4 h-4 text-editorial-ink mr-2 shrink-0" />
            <input
              type="email"
              value={email}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent outline-none text-xs text-editorial-ink font-bold pt-0.5"
            />
          </div>
        </div>

        {/* Password Input */}
        <div className="relative border-2 border-editorial-ink rounded-xl bg-white p-2 transition-all shadow-[3px_3px_0px_0px_#16131D] focus-within:shadow-[4px_4px_0px_0px_#6F3FF5]">
          <label className={`absolute left-9 transition-all pointer-events-none text-editorial-muted font-bold ${
            isPasswordActive ? '-top-2 bg-white px-1.5 text-[9px] text-brand-500' : 'top-2.5 text-xs'
          }`}>
            Secret Password
          </label>
          <div className="flex items-center mt-1 px-1">
            <Lock className="w-4 h-4 text-editorial-ink mr-2 shrink-0" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent outline-none text-xs text-editorial-ink font-bold pt-0.5 pr-8"
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-editorial-muted hover:text-editorial-ink transition-colors"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {!isSignUp && (
          <div className="text-right">
            <a href="#" className="text-[11px] font-bold text-brand-500 hover:text-brand-600 transition-colors hover:underline underline-offset-2">
              Forgot security key?
            </a>
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-brand-500 hover:bg-brand-600 text-white font-extrabold py-2.5 rounded-xl border-2 border-editorial-ink flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_#16131D] hover:shadow-[4px_4px_0px_0px_#16131D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#16131D] transition-all group"
        >
          <span className="text-xs uppercase tracking-wider">{isSignUp ? 'Generate Membership' : 'Sign In Now'}</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>
      </form>

      {/* Toggle mode */}
      <div className="mt-5 text-center text-xs font-semibold text-editorial-muted">
        <span>{isSignUp ? 'Already member?' : 'New subscriber?'}</span>{' '}
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-editorial-ink hover:text-brand-500 transition-colors underline underline-offset-4 decoration-2"
        >
          {isSignUp ? 'Enter Profile' : 'Register Here'}
        </button>
      </div>

    </div>
  );
}
