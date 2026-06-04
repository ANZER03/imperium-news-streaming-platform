'use client';

import React, { useState } from 'react';
import { Terminal, Shield, ArrowRight } from 'lucide-react';

export default function AuthV4() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="max-w-md w-full mx-auto font-mono bg-zinc-950 text-emerald-500 border border-emerald-900 rounded-lg p-6 shadow-2xl relative overflow-hidden">
      
      {/* Scanline Effect overlay */}
      <div className="absolute inset-0 bg-scanlines opacity-[0.03] pointer-events-none" />

      {/* Terminal Header */}
      <div className="flex items-center justify-between border-b border-emerald-900 pb-3 mb-6">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 animate-pulse" />
          <span className="text-xs font-bold text-emerald-400">IMPERIUM_SECURE_AUTH_v1.0.4</span>
        </div>
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-600/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600/60" />
        </div>
      </div>

      {/* Terminal Content */}
      <div className="space-y-4">
        <div className="text-xs text-emerald-600">
          <p>LAST LOGIN: {new Date().toUTCString().slice(0, 16)}</p>
          <p>ENCRYPTION: AES-256-GCM ACTIVE</p>
          <p className="mt-1">Initializing user verification sequence...</p>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
          {isSignUp && (
            <div className="space-y-1.5">
              <div className="flex items-center text-xs text-emerald-400 gap-1">
                <span>guest@imperium:~$</span>
                <span className="text-[10px] text-emerald-600">--enter-name</span>
              </div>
              <div className="flex items-center bg-zinc-900 border border-emerald-900/60 rounded px-3 py-2 focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-400/20 transition-all">
                <span className="text-emerald-700 mr-2">$</span>
                <input
                  type="text"
                  placeholder="Arthur_Dent"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm text-emerald-300 placeholder:text-emerald-950 font-mono"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center text-xs text-emerald-400 gap-1">
              <span>guest@imperium:~$</span>
              <span className="text-[10px] text-emerald-600">--enter-email</span>
            </div>
            <div className="flex items-center bg-zinc-900 border border-emerald-900/60 rounded px-3 py-2 focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-400/20 transition-all">
              <span className="text-emerald-700 mr-2">$</span>
              <input
                type="email"
                placeholder="arthur@guide.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent outline-none text-sm text-emerald-300 placeholder:text-emerald-950 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-xs text-emerald-400 gap-1">
                <span>guest@imperium:~$</span>
                <span className="text-[10px] text-emerald-600">--enter-password</span>
              </div>
              {!isSignUp && (
                <a href="#" className="text-[10px] text-emerald-600 hover:text-emerald-400 transition-colors hover:underline">
                  [RECOVER_PWD]
                </a>
              )}
            </div>
            <div className="flex items-center bg-zinc-900 border border-emerald-900/60 rounded px-3 py-2 focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-400/20 transition-all">
              <span className="text-emerald-700 mr-2">$</span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent outline-none text-sm text-emerald-300 placeholder:text-emerald-950 font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-6 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 hover:border-emerald-400 text-emerald-400 font-bold py-2.5 rounded transition-all active:scale-[0.99] flex items-center justify-center gap-2 text-sm shadow-md hover:shadow-emerald-500/10"
          >
            <Shield className="w-4 h-4" />
            <span>EXECUTE {isSignUp ? 'CREATE_ACCOUNT' : 'START_SESSION'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Switch mode */}
      <div className="mt-8 text-center text-xs text-emerald-750 border-t border-emerald-950 pt-4 flex justify-between items-center">
        <span>{isSignUp ? 'EXISTING_USER=true' : 'NEW_USER=true'}</span>
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-emerald-400 hover:text-emerald-300 transition-colors font-bold underline"
        >
          {isSignUp ? 'EXEC login' : 'EXEC signup'}
        </button>
      </div>

    </div>
  );
}
