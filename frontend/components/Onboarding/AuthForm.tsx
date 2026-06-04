'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Mail, Lock, User, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { authService } from '@/lib/services/auth.service';

export function AuthForm() {
  const router = useRouter();
  const { loginUser, completeOnboarding } = useAppStore();

  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Checks localStorage to see if this email has finished onboarding.
  // Critically, restores the backend-assigned userId (not the mock auth one) so
  // the feed API receives the correct userId the backend recognises.
  const handleOnboardRestore = (email: string): boolean => {
    try {
      const storedData = localStorage.getItem(`onboard_data_${email.toLowerCase()}`);
      if (storedData) {
        const { userId: backendUserId, interests, countryIds } = JSON.parse(storedData);
        if (
          backendUserId &&
          interests && Array.isArray(interests) &&
          countryIds && Array.isArray(countryIds)
        ) {
          // Restore state using the real backend userId so feed calls work.
          completeOnboarding(interests, countryIds, backendUserId);
          return true;
        }
      }
    } catch (err) {
      console.error('Failed to parse mock onboarding persistence data:', err);
    }
    return false;
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      if (isSignUp) {
        const res = await authService.signup(authName, authEmail, authPassword);
        loginUser(res.user.userId, res.token, res.user.email, res.user.name);
        // New signup always goes to /onboarding
        router.push('/onboarding');
      } else {
        const res = await authService.login(authEmail, authPassword);
        loginUser(res.user.userId, res.token, res.user.email, res.user.name);
        
        // Attempt to restore topics and countries from localStorage
        const restored = handleOnboardRestore(res.user.email);
        if (restored) {
          router.replace('/');
        } else {
          router.push('/onboarding');
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const res = await authService.loginWithGoogle();
      loginUser(res.user.userId, res.token, res.user.email, res.user.name);
      
      const restored = handleOnboardRestore(res.user.email);
      if (restored) {
        router.replace('/');
      } else {
        router.push('/onboarding');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Google Login failed.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-editorial-bg font-sans text-editorial-ink selection:bg-brand-100 overflow-x-hidden">
      <div className="flex flex-col lg:flex-row min-h-[100dvh] lg:h-screen w-full bg-editorial-bg lg:overflow-hidden">
        
        {/* Left Section (Dark Theme) - Fixed on desktop */}
        <div className="hidden lg:flex lg:w-1/2 h-full bg-dark-glow text-white relative flex-col overflow-hidden justify-between p-12 shrink-0">
          <img
            src="/earth.webp"
            alt="Globe Background"
            className="absolute top-0 left-0 w-full h-full object-cover opacity-30 z-0 pointer-events-none"
          />

          {/* Logo */}
          <div className="flex items-center gap-3 z-10">
            <img
              src="/logo.svg"
              alt="Imperium Logo"
              className="w-[175px] h-[50px] object-contain brightness-0 invert"
            />
          </div>

          {/* Left Column Bottom Content */}
          <div className="z-10 mt-auto max-w-sm">
            <span className="text-[10px] font-bold tracking-[0.2em] text-brand-500 uppercase">Real-Time News</span>
            <h2 className="text-3xl font-serif font-bold mt-2 mb-4">Imperium Intelligence</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Join our stream and customize your intelligence reports across countries and topics.
            </p>
          </div>
        </div>

        {/* Right Section (Light Theme) */}
        <div className="lg:w-1/2 w-full bg-dot-pattern flex flex-col justify-center px-10 py-16 lg:px-24 lg:h-full lg:overflow-y-auto relative shrink-0">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md mx-auto font-serif text-editorial-ink"
          >
            {/* Back Button */}
            <button
              onClick={() => router.push('/welcome')}
              disabled={isAuthLoading}
              className="flex items-center gap-2 text-xs font-sans font-bold text-editorial-muted hover:text-editorial-ink transition-colors mb-6 disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Welcome
            </button>

            <div className="mb-6 text-left border-b border-editorial-ink pb-4">
              <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-editorial-muted">
                Secure Authentication
              </span>
              <h2 className="text-3xl font-bold mt-2 tracking-tight">
                {isSignUp ? 'Establish Membership' : 'Access Your Profile'}
              </h2>
            </div>

            {/* Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isAuthLoading}
              className="w-full border border-editorial-ink/40 text-editorial-ink font-semibold py-3 px-6 rounded-none flex items-center justify-center gap-2.5 hover:bg-editorial-surface transition-all font-sans text-xs uppercase tracking-wider mb-5 active:scale-[0.99] disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-3 my-5 font-sans">
              <div className="h-px bg-editorial-border flex-1" />
              <span className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest shrink-0">
                or use credentials
              </span>
              <div className="h-px bg-editorial-border flex-1" />
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-6 font-sans">
              {isSignUp && (
                <div className="group relative">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-editorial-muted transition-colors group-focus-within:text-brand-500">
                    Full Name
                  </label>
                  <div className="mt-1 flex items-center border-b border-editorial-border group-focus-within:border-editorial-ink transition-colors pb-1">
                    <User className="w-4 h-4 text-editorial-muted/60 mr-3" />
                    <input
                      type="text"
                      required
                      placeholder="Arthur Dent"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
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
                    required
                    placeholder="name@domain.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
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
                    required
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm text-editorial-ink placeholder:text-editorial-muted/30 py-1"
                  />
                </div>
              </div>

              {authError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded text-rose-500 text-xs font-semibold leading-relaxed">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthLoading}
                className="w-full bg-editorial-ink text-white font-medium py-3 px-6 rounded-none flex items-center justify-between transition-all hover:bg-brand-600 hover:shadow-lg active:scale-[0.99] group mt-6 disabled:opacity-50"
              >
                <span className="font-serif tracking-wide">
                  {isAuthLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    isSignUp ? 'Subscribe Now' : 'Sign In'
                  )}
                </span>
                {!isAuthLoading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
              </button>
            </form>

            <div className="mt-8 text-center border-t border-editorial-border pt-4 font-sans text-xs">
              <span className="text-editorial-muted mr-1">
                {isSignUp ? 'Already a member?' : 'New reader?'}
              </span>
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAuthError(null);
                }}
                className="font-bold text-editorial-ink hover:text-brand-500 transition-colors underline underline-offset-4"
              >
                {isSignUp ? 'Access Profile' : 'Register Account'}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
