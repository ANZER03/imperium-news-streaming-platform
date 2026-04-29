'use client';
import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { ChevronRight, Check } from 'lucide-react';

const TOPICS = [
  'Technology', 'Business', 'World News', 'Science', 'Startups', 
  'Sports', 'Entertainment', 'Health', 'Politics', 'Design'
];

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 
  'Germany', 'France', 'Japan', 'India', 'Brazil'
];

export function Onboarding() {
  const { completeOnboarding } = useAppStore();
  const [step, setStep] = useState(1);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev => 
      prev.includes(topic) 
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const handleComplete = () => {
    if (selectedTopics.length > 0 && selectedCountry) {
      completeOnboarding(selectedTopics, selectedCountry);
    }
  };

  if (step === 1) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f6f7fb] px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-10 h-16 md:h-20 w-auto flex justify-center">
            <img 
              src="/imperium_logo.svg" 
              alt="Imperium" 
              className="h-full w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-500 text-white shadow-soft">
              <span className="text-4xl font-bold">i</span>
            </div>
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900">Welcome to Imperium</h1>
          <p className="mb-10 text-lg text-slate-500">Fast, clean, engaging news reading experience. Tailored just for you.</p>
          <button 
            onClick={() => setStep(2)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-4 text-lg font-semibold text-white transition hover:bg-brand-600 active:scale-95"
          >
            Get Started <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f6f7fb] md:items-center md:justify-center md:py-12">
      <div className="flex flex-1 flex-col bg-white px-6 py-8 md:min-h-[600px] md:w-full md:max-w-2xl md:flex-none md:rounded-3xl md:border md:border-slate-200 md:shadow-soft md:p-10">
        <div className="mb-8 flex items-center justify-between">
          <div className="h-8 md:h-10">
            <img 
              src="/imperium_logo.svg" 
              alt="Imperium" 
              className="h-full w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-500">
            Step 2 of 2
          </div>
        </div>
        <h2 className="mb-2 text-3xl font-bold tracking-tight text-slate-900">Personalize your feed</h2>
        <p className="mb-8 text-slate-500">Pick what you are interested in.</p>
        
        <div className="flex-1 space-y-8">
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Topics (Select at least 1)</h3>
            <div className="flex flex-wrap gap-3">
              {TOPICS.map(topic => {
                const isSelected = selectedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    onClick={() => toggleTopic(topic)}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      isSelected 
                        ? 'border-brand-500 bg-brand-50 text-brand-700' 
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {isSelected && <Check className="h-4 w-4" />}
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
             <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Your Region</h3>
             <select 
               value={selectedCountry}
               onChange={(e) => setSelectedCountry(e.target.value)}
               className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
             >
               <option value="" disabled>Select a country</option>
               {COUNTRIES.map(c => (
                 <option key={c} value={c}>{c}</option>
               ))}
             </select>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <button 
            disabled={selectedTopics.length === 0 || !selectedCountry}
            onClick={handleComplete}
            className="inline-flex w-full items-center justify-center rounded-xl bg-brand-500 px-6 py-4 text-lg font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50 disabled:hover:bg-brand-500 active:scale-[0.98]"
          >
            Continue to Feed
          </button>
        </div>
      </div>
    </div>
  );
}
