'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { ChevronRight, ArrowLeft, Check, Loader2, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { countryService } from '@/lib/services/country.service';
import { topicService } from '@/lib/services/topic.service';
import { userService } from '@/lib/services/user.service';
import { Country, Topic } from '@/lib/types';

const toFlag = (code: string) =>
  code.toUpperCase().replace(/[A-Z]/g, c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0)));

export function Onboarding() {
  const router = useRouter();
  const { completeOnboarding, userId, userEmail } = useAppStore();
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedCountryIds, setSelectedCountryIds] = useState<number[]>([]);
  
  const [countries, setCountries] = useState<Country[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  const toggleCountry = (id: number) => {
    setSelectedCountryIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleComplete = async () => {
    if (selectedTopics.length >= 3 && selectedCountryIds.length > 0) {
      try {
        setIsRegistering(true);
        setError(null);

        // Call user service to register onboarding details with backend
        const { userId: onboardedUserId } = await userService.onboard(selectedCountryIds, selectedTopics);
        const topicNames = selectedTopics.map(id => topics.find(t => t.topicId === id)?.displayName || id);

        // Fake database persistence in localStorage.
        // Must store onboardedUserId (the real backend ID) so re-login restores the exact same user.
        if (userEmail) {
          localStorage.setItem(
            `onboard_data_${userEmail.toLowerCase()}`,
            JSON.stringify({
              userId: onboardedUserId,
              interests: topicNames,
              countryIds: selectedCountryIds,
            })
          );
        }

        // Always use the backend-assigned userId, not the mock auth one.
        completeOnboarding(topicNames, selectedCountryIds, onboardedUserId);
        router.replace('/');
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
        <p className="text-editorial-muted font-medium">Preparing your questionnaire...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white font-sans text-editorial-ink selection:bg-brand-100 overflow-x-hidden flex flex-col items-center justify-center p-6 md:p-12 lg:p-16">
      <motion.div
        key="onboarding-form"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-[500px] w-full"
      >
        <button
          onClick={() => router.push('/login')}
          disabled={isRegistering}
          className="flex items-center gap-2 text-sm font-semibold text-editorial-muted hover:text-editorial-ink transition-colors mb-8 disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Auth
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

        {/* Country picker — multi-select */}
        <div className="relative mb-10" ref={countryRef}>
          {/* Selected chips */}
          {selectedCountryIds.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedCountryIds.map(id => {
                const c = countries.find(c => c.countryId === id);
                if (!c) return null;
                return (
                  <span key={id} className="flex items-center gap-1.5 bg-brand-500 text-white text-sm font-medium px-3 py-1 rounded-full">
                    <span className="text-base leading-none">{toFlag(c.abbreviation)}</span>
                    {c.countryName}
                    <button type="button" onClick={() => toggleCountry(id)} className="ml-1 hover:opacity-70">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Trigger */}
          <button
            type="button"
            disabled={isRegistering}
            onClick={() => setCountryOpen(o => !o)}
            className={`w-full h-14 bg-editorial-surface border rounded-xl px-4 text-sm font-medium flex items-center justify-between transition-colors outline-none
              ${countryOpen ? 'border-brand-500' : 'border-editorial-border'}
              ${isRegistering ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="text-editorial-muted">
              {selectedCountryIds.length === 0 ? 'Select countries…' : `${selectedCountryIds.length} selected — add more`}
            </span>
            <ChevronRight className={`w-4 h-4 text-editorial-muted/60 transition-transform ${countryOpen ? '-rotate-90' : 'rotate-90'}`} />
          </button>

          <AnimatePresence>
            {countryOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 mt-2 w-full bg-white border border-editorial-border rounded-xl shadow-lg overflow-hidden"
              >
                {/* Search */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-editorial-border">
                  <Search className="w-4 h-4 text-editorial-muted shrink-0" />
                  <input
                    autoFocus
                    value={countrySearch}
                    onChange={e => setCountrySearch(e.target.value)}
                    placeholder="Search country…"
                    className="flex-1 bg-transparent text-sm text-editorial-ink outline-none placeholder:text-editorial-muted/60"
                  />
                  {countrySearch && (
                    <button onClick={() => setCountrySearch('')}>
                      <X className="w-3.5 h-3.5 text-editorial-muted" />
                    </button>
                  )}
                </div>

                {/* List */}
                <ul className="max-h-52 overflow-y-auto">
                  {countries
                    .filter(c => c.countryName.toLowerCase().includes(countrySearch.toLowerCase()))
                    .map(c => {
                      const selected = selectedCountryIds.includes(c.countryId);
                      return (
                        <li key={c.countryId}>
                          <button
                            type="button"
                            onClick={() => toggleCountry(c.countryId)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-editorial-surface
                              ${selected ? 'bg-brand-50 text-brand-650 font-semibold' : 'text-editorial-ink'}`}
                          >
                            <span className="text-lg leading-none">{toFlag(c.abbreviation)}</span>
                            {c.countryName}
                            {selected && <Check className="w-4 h-4 ml-auto" />}
                          </button>
                        </li>
                      );
                    })}
                  {countries.filter(c => c.countryName.toLowerCase().includes(countrySearch.toLowerCase())).length === 0 && (
                    <li className="px-4 py-6 text-sm text-center text-editorial-muted">No country found</li>
                  )}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm font-medium">
            {error}
          </div>
        )}

        <button
          onClick={handleComplete}
          disabled={selectedTopics.length < 3 || selectedCountryIds.length === 0 || isRegistering}
          className={`w-full h-14 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 ${selectedTopics.length >= 3 && selectedCountryIds.length > 0 && !isRegistering
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
              {selectedTopics.length >= 3 && selectedCountryIds.length > 0 && <ChevronRight className="w-5 h-5" />}
            </>
          )}
        </button>

        <div className={`mt-4 text-center transition-opacity duration-300 ${selectedTopics.length > 0 && selectedTopics.length < 3 ? 'opacity-100' : 'opacity-0'
          }`}>
          <p className="text-xs font-semibold text-rose-500">
            Pick at least {3 - selectedTopics.length} more topic{3 - selectedTopics.length > 1 ? 's' : ''}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
