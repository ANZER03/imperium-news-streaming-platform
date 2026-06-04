'use client';

import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AuthV6() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [step, setStep] = useState(1); // 1 = Email/Name, 2 = Password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1 && email.trim()) {
      setStep(2);
    }
  };

  const handlePrevStep = () => {
    setStep(1);
  };

  const handleReset = (signUpMode: boolean) => {
    setIsSignUp(signUpMode);
    setStep(1);
    setEmail('');
    setPassword('');
    setName('');
  };

  return (
    <div className="max-w-md w-full mx-auto bg-white dark:bg-zinc-900 border border-editorial-border dark:border-zinc-800 rounded-3xl p-8 md:p-10 shadow-xl overflow-hidden relative">
      
      {/* Progress Line */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-editorial-surface dark:bg-zinc-950">
        <div 
          className="h-full bg-brand-500 transition-all duration-300"
          style={{ width: `${(step / 2) * 100}%` }}
        />
      </div>

      {/* Back button on step 2 */}
      {step === 2 && (
        <button
          onClick={handlePrevStep}
          className="absolute top-6 left-6 p-1.5 rounded-full hover:bg-editorial-surface dark:hover:bg-zinc-800 text-editorial-muted hover:text-editorial-ink dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      )}

      {/* Header */}
      <div className="mt-4 mb-8 text-center">
        <span className="text-[10px] font-semibold text-brand-500 uppercase tracking-widest">
          Step {step} of 2
        </span>
        <h2 className="text-2xl font-extrabold text-editorial-ink dark:text-white tracking-tight mt-1">
          {step === 1 
            ? (isSignUp ? 'Introduce Yourself' : 'Access Feed') 
            : 'Secure Your Session'}
        </h2>
        <p className="text-xs text-editorial-muted mt-2">
          {step === 1 
            ? 'We customize your news feed based on your identity.' 
            : 'Enter your authorization passcode to proceed.'}
        </p>
      </div>

      {/* Form with Sliding Animation */}
      <form onSubmit={step === 1 ? handleNextStep : (e) => e.preventDefault()} className="min-h-[170px] flex flex-col justify-between">
        
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {isSignUp && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-editorial-ink dark:text-zinc-300">
                      Full Name
                    </label>
                    <div className="flex items-center border border-editorial-border dark:border-zinc-800 rounded-xl px-3 py-2 bg-editorial-surface dark:bg-zinc-950 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-all">
                      <User className="w-4.5 h-4.5 text-editorial-muted mr-2.5 shrink-0" />
                      <input
                        type="text"
                        required
                        placeholder="Arthur Dent"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-transparent outline-none text-sm text-editorial-ink dark:text-white placeholder:text-editorial-muted/50"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-editorial-ink dark:text-zinc-300">
                    Email Address
                  </label>
                  <div className="flex items-center border border-editorial-border dark:border-zinc-800 rounded-xl px-3 py-2 bg-editorial-surface dark:bg-zinc-950 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-all">
                    <Mail className="w-4.5 h-4.5 text-editorial-muted mr-2.5 shrink-0" />
                    <input
                      type="email"
                      required
                      placeholder="arthur@galaxy.org"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent outline-none text-sm text-editorial-ink dark:text-white placeholder:text-editorial-muted/50"
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-editorial-ink dark:text-zinc-300">
                      Passcode / Password
                    </label>
                    {!isSignUp && (
                      <a href="#" className="text-xs text-brand-500 hover:text-brand-600 transition-colors">
                        Forgot?
                      </a>
                    )}
                  </div>
                  <div className="flex items-center border border-editorial-border dark:border-zinc-800 rounded-xl px-3 py-2 bg-editorial-surface dark:bg-zinc-950 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-all">
                    <Lock className="w-4.5 h-4.5 text-editorial-muted mr-2.5 shrink-0" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent outline-none text-sm text-editorial-ink dark:text-white placeholder:text-editorial-muted/50"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="submit"
          className="w-full mt-6 bg-brand-500 hover:bg-brand-600 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <span>{step === 1 ? 'Continue' : (isSignUp ? 'Complete Registration' : 'Access Dashboard')}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Switch mode */}
      <div className="mt-8 text-center text-xs text-editorial-muted border-t border-editorial-border dark:border-zinc-800 pt-5">
        <span>{isSignUp ? 'Have credentials?' : 'Need global access?'}</span>{' '}
        <button
          onClick={() => handleReset(!isSignUp)}
          className="font-bold text-brand-500 hover:text-brand-600 underline underline-offset-4 transition-colors"
        >
          {isSignUp ? 'Login Profile' : 'Sign Up Free'}
        </button>
      </div>

    </div>
  );
}
