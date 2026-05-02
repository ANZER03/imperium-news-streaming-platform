'use client';
import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { ChevronRight, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { countryService, topicService, userService } from '@/lib/services';
import { Country, Topic } from '@/lib/types';

export function Onboarding() {
  const { completeOnboarding } = useAppStore();
  const [view, setView] = useState<'welcome' | 'onboarding'>('welcome');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<number | ''>('');
  
  const [countries, setCountries] = useState<Country[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [countriesData, topicsData] = await Promise.all([
          countryService.getAll(),
          topicService.getAll()
        ]);
        setCountries(countriesData);
        setTopics(topicsData);
      } catch (err) {
        console.error('Failed to load onboarding data:', err);
        setError('Failed to connect to the server. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const toggleTopic = (topicId: string) => {
    setSelectedTopics(prev =>
      prev.includes(topicId)
        ? prev.filter(t => t !== topicId)
        : [...prev, topicId]
    );
  };

  const handleComplete = async () => {
    if (selectedTopics.length >= 3 && selectedCountryId !== '') {
      try {
        setIsRegistering(true);
        setError(null);
        
        const { userId } = await userService.onboard(selectedCountryId as number, selectedTopics);
        
        const countryName = countries.find(c => c.countryId === selectedCountryId)?.countryName || '';
        const topicNames = selectedTopics.map(id => topics.find(t => t.topicId === id)?.displayName || id);

        completeOnboarding(topicNames, countryName, selectedCountryId as number, userId);
      } catch (err) {
        console.error('Registration failed:', err);
        setError('Failed to create your profile. Please try again.');
      } finally {
        setIsRegistering(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-4" />
        <p className="text-editorial-muted font-medium">Preparing your experience...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white font-sans text-editorial-ink selection:bg-brand-100 overflow-x-hidden">
      <AnimatePresence mode="wait">
        {view === 'welcome' ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col lg:flex-row min-h-[100dvh] w-full bg-white"
          >
            {/* Left Section (Dark Theme) - Hidden on mobile */}
            <div className="hidden lg:flex lg:w-1/2 min-h-screen bg-dark-glow text-white relative flex-col overflow-hidden justify-between p-8">
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
            </div>

            {/* Right Section (Light Theme) */}
            <div className="lg:w-1/2 w-full bg-dot-pattern flex flex-col justify-center px-10 py-16 lg:px-24">
              {/* Decorative Dash */}
              <div className="w-10 h-1 bg-brand-500 mb-8 rounded-full"></div>

              <h1 className="text-5xl font-bold text-gray-900 mb-4 leading-tight">
                Welcome to <br />
                Imperium <span className="text-brand-500">news</span>
              </h1>

              <p className="text-gray-500 text-lg mb-10 max-w-md leading-relaxed">
                Your world. Your news. Real-time updates, meaningful
                conversations, and stories that matter to you.
              </p>

              {/* Features List */}
              <ul className="space-y-6 mb-12">
                <li className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shrink-0 shadow-lg shadow-purple-200">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Real-time updates</h4>
                    <p className="text-sm text-gray-500">Breaking news as it happens</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shrink-0 shadow-lg shadow-purple-200">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Personalized feed</h4>
                    <p className="text-sm text-gray-500">Stories tailored to your interests</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shrink-0 shadow-lg shadow-purple-200">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Join the conversation</h4>
                    <p className="text-sm text-gray-500">Share, react, and connect</p>
                  </div>
                </li>
              </ul>

              {/* Call to Action Buttons */}
              <div className="flex flex-col gap-4 max-w-sm">
                <button
                  onClick={() => setView('onboarding')}
                  className="w-full bg-brand-500 hover:bg-brand-600 text-white font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-purple-200 group"
                >
                  Get Started
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>

              <p className="text-xs text-gray-400 mt-6 max-w-sm text-center">
                No account required to explore
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col items-center justify-center p-6 md:p-12 lg:p-16 min-h-[100dvh]"
          >
            <div className="max-w-[500px] w-full">
              <button
                onClick={() => setView('welcome')}
                disabled={isRegistering}
                className="flex items-center gap-2 text-sm font-semibold text-editorial-muted hover:text-editorial-ink transition-colors mb-8 disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Welcome
              </button>

              <div className="mb-6">
                <h2 className="text-2xl lg:text-3xl font-bold text-editorial-ink mb-2">What interests you?</h2>
                <p className="text-editorial-muted text-sm capitalize">Pick at least 3 topics to personalize your feed.</p>
              </div>

              <div className="flex flex-wrap gap-2.5 mb-10">
                {topics.map((topic) => {
                  const isSelected = selectedTopics.includes(topic.topicId);
                  return (
                    <button
                      key={topic.topicId}
                      onClick={() => toggleTopic(topic.topicId)}
                      disabled={isRegistering}
                      className={`h-10 px-5 rounded-full text-sm font-semibold flex items-center gap-2 transition-all ${isSelected
                        ? 'bg-brand-500 text-white'
                        : 'bg-editorial-surface text-editorial-muted hover:bg-editorial-border/50'
                        } ${isRegistering ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isSelected && <Check className="w-4 h-4" />}
                      {topic.displayName}
                    </button>
                  );
                })}
              </div>

              <div className="h-px bg-editorial-border mb-10" />

              <div className="mb-6">
                <h2 className="text-2xl lg:text-3xl font-bold text-editorial-ink mb-2">Where are you based?</h2>
                <p className="text-editorial-muted text-sm">We'll show you local and regional news.</p>
              </div>

              <div className="relative mb-10">
                <select
                  value={selectedCountryId}
                  onChange={(e) => setSelectedCountryId(Number(e.target.value))}
                  disabled={isRegistering}
                  className={`w-full h-14 bg-editorial-surface border border-editorial-border rounded-xl px-4 text-sm font-medium appearance-none outline-none focus:border-brand-500 transition-colors ${selectedCountryId !== '' ? 'text-editorial-ink' : 'text-editorial-muted'
                    } ${isRegistering ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <option value="" disabled>Select your country…</option>
                  {countries.map(c => (
                    <option key={c.countryId} value={c.countryId}>{c.countryName}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-editorial-muted/50">
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm font-medium">
                  {error}
                </div>
              )}

              <button
                onClick={handleComplete}
                disabled={selectedTopics.length < 3 || selectedCountryId === '' || isRegistering}
                className={`w-full h-14 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 ${selectedTopics.length >= 3 && selectedCountryId !== '' && !isRegistering
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                  : 'bg-editorial-border text-editorial-muted/50 cursor-not-allowed opacity-50'
                  }`}
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Setting up your feed...
                  </>
                ) : (
                  <>
                    Continue to my feed
                    {selectedTopics.length >= 3 && selectedCountryId !== '' && <ChevronRight className="w-5 h-5" />}
                  </>
                )}
              </button>

              <div className={`mt-4 text-center transition-opacity duration-300 ${selectedTopics.length > 0 && selectedTopics.length < 3 ? 'opacity-100' : 'opacity-0'
                }`}>
                <p className="text-xs font-semibold text-rose-500">
                  Pick at least {3 - selectedTopics.length} more topic{3 - selectedTopics.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
