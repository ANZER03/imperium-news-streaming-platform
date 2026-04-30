'use client';
import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { ChevronRight, ArrowLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import topicsData from '@/lib/data/topics.json';
import countriesData from '@/lib/data/countries.json';

type Topic = { id: string; name: string };
type Country = { id: number; pays: string; abr: string };

const TOPICS = topicsData as Topic[];
const COUNTRIES = countriesData as Country[];

export function Onboarding() {
  const { completeOnboarding } = useAppStore();
  const [view, setView] = useState<'welcome' | 'onboarding'>('welcome');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');

  const toggleTopic = (topicId: string) => {
    setSelectedTopics(prev =>
      prev.includes(topicId)
        ? prev.filter(t => t !== topicId)
        : [...prev, topicId]
    );
  };

  const handleComplete = () => {
    if (selectedTopics.length >= 3 && selectedCountry) {
      // Find the name of the selected topics from IDs
      const topicNames = selectedTopics.map(id => TOPICS.find(t => t.id === id)?.name || id);
      completeOnboarding(topicNames, selectedCountry);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white font-sans text-editorial-ink selection:bg-brand-100 overflow-x-hidden">
      <AnimatePresence mode="wait">
        {view === 'welcome' ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col lg:flex-row min-h-[100dvh]"
          >
            {/* Branding Column */}
            <div className="flex-[0.8] lg:flex-none lg:w-[45%] lg:max-w-[550px] bg-brand-500 text-white flex flex-col items-center justify-center p-12 lg:p-16 text-center">
              <div className="mb-8 lg:mb-10 flex flex-col items-center">
                <div className="mb-4">
                  <img src="/logo.svg" alt="Imperium" className="w-16 h-16 brightness-0 invert" />
                </div>
                <h1 className="text-4xl lg:text-5xl font-bold tracking-tighter mb-1">imperium</h1>
                <p className="text-xs font-bold tracking-[0.2em] opacity-50">NEWS</p>
              </div>

              <div className="w-10 h-0.5 bg-white/40 rounded-full mb-8" />

              <h2 className="text-3xl lg:text-4xl font-bold leading-[1.1] mb-4">Stay informed.<br />Think clearly.</h2>
              <p className="text-white/70 text-base lg:text-lg max-w-xs mx-auto mb-10 leading-relaxed">Trusted news from sources that matter, personalized for you.</p>

              <div className="flex flex-col gap-4 text-left w-full max-w-xs mx-auto">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/50 shrink-0" />
                  <span className="text-sm font-medium text-white/80">Credible sources, zero noise</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/50 shrink-0" />
                  <span className="text-sm font-medium text-white/80">Personalized to your interests</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/50 shrink-0" />
                  <span className="text-sm font-medium text-white/80">Real-time global coverage</span>
                </div>
              </div>

              {/* Mobile Action Button - only visible on small screens */}
              <div className="mt-12 w-full max-w-xs lg:hidden">
                <button
                  onClick={() => setView('onboarding')}
                  className="w-full h-14 bg-white text-brand-500 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 shadow-xl"
                >
                  Get Started <ChevronRight className="w-5 h-5" />
                </button>
                <p className="text-xs text-white/50 mt-4">No account required to browse</p>
              </div>
            </div>

            {/* Desktop Action Column */}
            <div className="hidden lg:flex flex-1 items-center justify-center p-16 bg-white">
              <div className="max-w-[380px] w-full">
                <h3 className="text-3xl font-bold text-editorial-ink mb-4">Welcome to Imperium</h3>
                <p className="text-editorial-muted mb-10 leading-relaxed">Set up your personalized news experience in under a minute. No account needed.</p>
                <button
                  onClick={() => setView('onboarding')}
                  className="group w-full h-14 bg-brand-500 text-white rounded-2xl flex items-center justify-center gap-2 font-bold transition-all hover:bg-brand-600 active:scale-95 shadow-lg shadow-brand-500/20"
                >
                  Get Started
                  <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </button>
                <p className="text-sm text-editorial-muted text-center mt-4">No account required to browse</p>
              </div>
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
                className="flex items-center gap-2 text-sm font-semibold text-editorial-muted hover:text-editorial-ink transition-colors mb-8"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Welcome
              </button>

              <div className="mb-6">
                <h2 className="text-2xl lg:text-3xl font-bold text-editorial-ink mb-2">What interests you?</h2>
                <p className="text-editorial-muted text-sm capitalize">Pick at least 3 topics to personalize your feed.</p>
              </div>

              <div className="flex flex-wrap gap-2.5 mb-10">
                {TOPICS.map((topic) => {
                  const isSelected = selectedTopics.includes(topic.id);
                  return (
                    <button
                      key={topic.id}
                      onClick={() => toggleTopic(topic.id)}
                      className={`h-10 px-5 rounded-full text-sm font-semibold flex items-center gap-2 transition-all ${isSelected
                        ? 'bg-brand-500 text-white'
                        : 'bg-editorial-surface text-editorial-muted hover:bg-editorial-border/50'
                        }`}
                    >
                      {isSelected && <Check className="w-4 h-4" />}
                      {topic.name}
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
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className={`w-full h-14 bg-editorial-surface border border-editorial-border rounded-xl px-4 text-sm font-medium appearance-none outline-none focus:border-brand-500 transition-colors ${selectedCountry ? 'text-editorial-ink' : 'text-editorial-muted'
                    }`}
                >
                  <option value="" disabled>Select your country…</option>
                  {COUNTRIES.map(c => (
                    <option key={c.id} value={c.pays}>{c.pays}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-editorial-muted/50">
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </div>
              </div>

              <button
                onClick={handleComplete}
                disabled={selectedTopics.length < 3 || !selectedCountry}
                className={`w-full h-14 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 ${selectedTopics.length >= 3 && selectedCountry
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                  : 'bg-editorial-border text-editorial-muted/50 cursor-not-allowed opacity-50'
                  }`}
              >
                Continue to my feed
                {selectedTopics.length >= 3 && selectedCountry && <ChevronRight className="w-5 h-5" />}
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

