'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { 
  Settings, 
  Sun, 
  Moon, 
  Sliders, 
  Bell, 
  RotateCcw, 
  Check,
  Cpu,
  Globe,
  Tag
} from 'lucide-react';
import { countryService, topicService } from '@/lib/services';
import { Country, Topic } from '@/lib/types';
import { motion } from 'motion/react';

export default function SettingsPage() {
  const router = useRouter();
  const { 
    userId,
    theme, 
    setTheme, 
    interests, 
    countryIds, 
    completeOnboarding, 
    resetOnboarding 
  } = useAppStore();

  const [countriesList, setCountriesList] = useState<Country[]>([]);
  const [topicsList, setTopicsList] = useState<Topic[]>([]);
  
  // Simulated settings
  const [streamSpeed, setStreamSpeed] = useState<'realtime' | 'balanced' | 'digest'>('realtime');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(false);
  const [saveStatus, setSaveStatus] = useState(false);

  useEffect(() => {
    countryService.getAll().then(setCountriesList).catch(() => {});
    topicService.getAll().then(setTopicsList).catch(() => {});
  }, []);

  const handleToggleCountry = (countryId: number) => {
    const isSelected = countryIds.includes(countryId);
    const updatedIds = isSelected 
      ? countryIds.filter(id => id !== countryId)
      : [...countryIds, countryId];
    
    completeOnboarding(interests, updatedIds, userId || 'imperium');
    triggerSaveNotification();
  };

  const handleToggleTopic = (topicId: string) => {
    const isSelected = interests.includes(topicId);
    const updatedTopics = isSelected
      ? interests.filter(t => t !== topicId)
      : [...interests, topicId];

    completeOnboarding(updatedTopics, countryIds, userId || 'imperium');
    triggerSaveNotification();
  };

  const triggerSaveNotification = () => {
    setSaveStatus(true);
    setTimeout(() => setSaveStatus(false), 2000);
  };

  const handleReset = () => {
    resetOnboarding();
    router.push('/welcome');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="py-6 px-4 md:px-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight text-editorial-ink flex items-center gap-2">
            Settings
          </h1>
          <p className="text-editorial-muted text-sm mt-1">
            Manage your interface, streaming sources, and notification channels.
          </p>
        </div>

        {saveStatus && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20"
          >
            <Check className="w-3.5 h-3.5" />
            Preferences Saved
          </motion.div>
        )}
      </div>

      <div className="space-y-6">
        {/* Theme Settings */}
        <section className="border border-editorial-border rounded-2xl p-5 bg-editorial-bg">
          <h2 className="text-sm font-bold uppercase tracking-wider text-editorial-muted mb-4 flex items-center gap-2">
            {theme === 'dark' ? <Moon className="w-4 h-4 text-editorial-accent" /> : <Sun className="w-4 h-4 text-editorial-accent" />}
            Interface Appearance
          </h2>
          
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-[15px] text-editorial-ink block">Theme Mode</span>
              <span className="text-xs text-editorial-muted">Select your preferred viewing brightness</span>
            </div>
            
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 text-xs font-bold border border-editorial-border rounded-xl px-4 py-2 hover:bg-editorial-surface text-editorial-ink transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Switch to Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-500" />
                  <span>Switch to Dark</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Data Stream & CDC Options */}
        <section className="border border-editorial-border rounded-2xl p-5 bg-editorial-bg">
          <h2 className="text-sm font-bold uppercase tracking-wider text-editorial-muted mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-editorial-accent" />
            Ingestion Pipeline Controls
          </h2>

          <div>
            <label className="font-semibold text-[15px] text-editorial-ink block">Ingestion Sync Mode</label>
            <p className="text-xs text-editorial-muted mb-3">Adjust how quickly Kafka streams new events from CDC connectors</p>
            
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'realtime', label: 'Real-Time', desc: '500ms intervals' },
                { id: 'balanced', label: 'Balanced', desc: '10s batches' },
                { id: 'digest', label: 'Digest', desc: 'Daily delivery' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setStreamSpeed(opt.id as any);
                    triggerSaveNotification();
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    streamSpeed === opt.id
                      ? 'border-editorial-accent bg-editorial-accent/5 font-semibold text-editorial-accent shadow-sm'
                      : 'border-editorial-border bg-editorial-bg text-editorial-muted hover:bg-editorial-surface hover:text-editorial-ink'
                  }`}
                >
                  <span className="text-sm">{opt.label}</span>
                  <span className="text-[10px] opacity-85 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Target Topics */}
        <section className="border border-editorial-border rounded-2xl p-5 bg-editorial-bg">
          <h2 className="text-sm font-bold uppercase tracking-wider text-editorial-muted mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-editorial-accent" />
            Ingested Topics
          </h2>
          <p className="text-xs text-editorial-muted mb-4">Toggle news categories to include in your personalized intelligence feed</p>

          <div className="flex flex-wrap gap-2">
            {topicsList.map(topic => {
              const selected = interests.includes(topic.topicId);
              return (
                <button
                  key={topic.topicId}
                  onClick={() => handleToggleTopic(topic.topicId)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                    selected
                      ? 'bg-editorial-accent text-white border-editorial-accent shadow-sm'
                      : 'bg-editorial-bg text-editorial-muted border-editorial-border hover:bg-editorial-surface hover:text-editorial-ink'
                  }`}
                >
                  {topic.displayName}
                </button>
              );
            })}
          </div>
        </section>

        {/* Target Countries */}
        <section className="border border-editorial-border rounded-2xl p-5 bg-editorial-bg">
          <h2 className="text-sm font-bold uppercase tracking-wider text-editorial-muted mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-editorial-accent" />
            Country Data Feeds
          </h2>
          <p className="text-xs text-editorial-muted mb-4">Toggle geographical regions to filter your active news streams</p>

          <div className="grid grid-cols-2 gap-3">
            {countriesList.map(c => {
              const selected = countryIds.includes(c.countryId);
              return (
                <button
                  key={c.countryId}
                  onClick={() => handleToggleCountry(c.countryId)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selected
                      ? 'border-editorial-accent bg-editorial-accent/5 text-editorial-ink font-semibold'
                      : 'border-editorial-border bg-editorial-bg text-editorial-muted hover:bg-editorial-surface hover:text-editorial-ink'
                  }`}
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                    selected 
                      ? 'border-editorial-accent bg-editorial-accent text-white' 
                      : 'border-editorial-border bg-editorial-bg'
                  }`}>
                    {selected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="text-sm">
                    {c.countryName} ({c.abbreviation})
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Notification settings */}
        <section className="border border-editorial-border rounded-2xl p-5 bg-editorial-bg">
          <h2 className="text-sm font-bold uppercase tracking-wider text-editorial-muted mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-editorial-accent" />
            Alert Subscriptions
          </h2>

          <div className="space-y-4">
            <label className="flex items-start justify-between cursor-pointer group">
              <div className="pr-4">
                <span className="font-semibold text-[15px] text-editorial-ink group-hover:text-editorial-accent transition-colors block">
                  Email Alerts
                </span>
                <span className="text-xs text-editorial-muted">Receive major trend breakout summaries in your inbox</span>
              </div>
              <input 
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => { setEmailAlerts(e.target.checked); triggerSaveNotification(); }}
                className="w-4.5 h-4.5 rounded accent-editorial-accent cursor-pointer"
              />
            </label>

            <div className="h-px bg-editorial-border/60" />

            <label className="flex items-start justify-between cursor-pointer group">
              <div className="pr-4">
                <span className="font-semibold text-[15px] text-editorial-ink group-hover:text-editorial-accent transition-colors block">
                  Push Alerts
                </span>
                <span className="text-xs text-editorial-muted">Get notified instantly of real-time high-velocity trend breakouts</span>
              </div>
              <input 
                type="checkbox"
                checked={pushAlerts}
                onChange={(e) => { setPushAlerts(e.target.checked); triggerSaveNotification(); }}
                className="w-4.5 h-4.5 rounded accent-editorial-accent cursor-pointer"
              />
            </label>

            <div className="h-px bg-editorial-border/60" />

            <label className="flex items-start justify-between cursor-pointer group">
              <div className="pr-4">
                <span className="font-semibold text-[15px] text-editorial-ink group-hover:text-editorial-accent transition-colors block">
                  Pipeline Diagnostic Reports
                </span>
                <span className="text-xs text-editorial-muted">Receive low-level alerts regarding Kafka stream lag or Redis index updates</span>
              </div>
              <input 
                type="checkbox"
                checked={systemAlerts}
                onChange={(e) => { setSystemAlerts(e.target.checked); triggerSaveNotification(); }}
                className="w-4.5 h-4.5 rounded accent-editorial-accent cursor-pointer"
              />
            </label>
          </div>
        </section>

        {/* Danger zone / Reset */}
        <section className="border border-rose-500/20 rounded-2xl p-5 bg-rose-500/5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-rose-600 mb-2 flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Danger Zone
          </h2>
          <p className="text-xs text-rose-700/80 mb-4">Permanent actions. Be careful!</p>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="font-semibold text-[14px] text-rose-900 dark:text-rose-200 block">Reset Stream Profile</span>
              <span className="text-xs text-rose-600/80">Wipes onboarding choices and logs out of current session</span>
            </div>
            
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-rose-500/30 hover:bg-rose-500/10 text-rose-600 font-bold text-xs rounded-xl transition-all cursor-pointer shrink-0"
            >
              Reset Session
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
