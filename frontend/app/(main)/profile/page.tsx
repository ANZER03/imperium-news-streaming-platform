'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { 
  User, 
  Mail, 
  Calendar, 
  Flame, 
  Bookmark, 
  TrendingUp, 
  Edit3, 
  Check, 
  X, 
  Globe,
  Award
} from 'lucide-react';
import { countryService } from '@/lib/services';
import { Country } from '@/lib/types';
import { motion } from 'motion/react';

export default function ProfilePage() {
  const { 
    userId, 
    userToken,
    userName, 
    userEmail, 
    interests, 
    countryIds, 
    savedArticles,
    loginUser 
  } = useAppStore();

  const [countriesList, setCountriesList] = useState<Country[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(userName || '');
  const [editEmail, setEditEmail] = useState(userEmail || '');
  const [formError, setFormError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    countryService.getAll().then(setCountriesList).catch(() => {});
  }, []);

  const handleEditInit = () => {
    setEditName(userName || '');
    setEditEmail(userEmail || '');
    setFormError('');
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setFormError('Name cannot be empty.');
      return;
    }
    if (!editEmail.trim() || !editEmail.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }

    // Save back to Zustand
    loginUser(
      userId || 'imperium', 
      userToken || '', 
      editEmail.trim(), 
      editName.trim()
    );

    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Find country abbreviations for user's countryIds
  const userCountries = countriesList.filter(c => countryIds.includes(c.countryId));

  // Calendar mock for streak (Last 7 days, Monday-Sunday)
  const weekdayStreak = [
    { label: 'M', active: true },
    { label: 'T', active: true },
    { label: 'W', active: false },
    { label: 'T', active: true },
    { label: 'F', active: true },
    { label: 'S', active: true },
    { label: 'S', active: true },
  ];

  // Mock interest weights to show dynamic visual breakdown
  const mockInterestsWeight = [
    { label: 'Technology', value: 85, color: 'bg-violet-500 dark:bg-blue-400' },
    { label: 'Business & Economy', value: 65, color: 'bg-emerald-500' },
    { label: 'Science & Health', value: 40, color: 'bg-amber-500' },
    { label: 'Politics', value: 25, color: 'bg-indigo-500 dark:bg-sky-400' },
  ];

  const handle = userId ? `@${userId.slice(0, 8)}` : '@you';

  return (
    <div className="py-6 px-4 md:px-6 min-h-screen">
      {/* Profile Banner Card */}
      <div className="bg-editorial-surface border border-editorial-border rounded-2xl p-6 relative overflow-hidden mb-6">
        <div className="absolute inset-0 bg-dot-pattern opacity-40 pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          {/* Avatar (Dicebear) */}
          <div className="relative group shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userId ?? 'imperium'}`}
              alt="Profile Avatar"
              className="w-24 h-24 rounded-full border-2 border-editorial-border bg-editorial-bg shadow-md"
            />
            <div className="absolute inset-0 rounded-full bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">Seed: {handle}</span>
            </div>
          </div>

          <div className="flex-1 min-w-0 w-full mt-2">
            {!isEditing ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h1 className="text-2xl font-bold text-editorial-ink leading-tight truncate">
                    {userName || 'Imperium Reader'}
                  </h1>
                  <button
                    onClick={handleEditInit}
                    className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-editorial-border hover:bg-editorial-bg text-editorial-muted hover:text-editorial-ink transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Profile
                  </button>
                </div>
                <p className="text-editorial-muted text-[14px] mt-1 font-mono">{handle}</p>

                <div className="mt-4 flex flex-col gap-2 text-sm text-editorial-muted">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <Mail className="w-4 h-4 text-editorial-muted" />
                    <span>{userEmail || 'reader@imperium.com'}</span>
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <Calendar className="w-4 h-4 text-editorial-muted" />
                    <span>Member since June 2026</span>
                  </div>
                </div>
              </>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-editorial-muted mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-editorial-bg border border-editorial-border rounded-xl px-4 py-2.5 text-sm text-editorial-ink focus:outline-none focus:border-editorial-accent transition-colors"
                    placeholder="Enter name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-editorial-muted mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-editorial-bg border border-editorial-border rounded-xl px-4 py-2.5 text-sm text-editorial-ink focus:outline-none focus:border-editorial-accent transition-colors"
                    placeholder="Enter email address"
                  />
                </div>

                {formError && (
                  <p className="text-xs text-rose-500 font-semibold">{formError}</p>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-editorial-border text-xs font-semibold hover:bg-editorial-bg text-editorial-muted transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-editorial-accent text-white text-xs font-semibold hover:opacity-90 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Save Changes
                  </button>
                </div>
              </form>
            )}

            {saveSuccess && (
              <p className="text-xs text-emerald-500 font-semibold mt-2">
                ✓ Profile details successfully updated!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Grid of widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Streak card */}
        <div className="border border-editorial-border rounded-2xl p-5 bg-editorial-bg relative flex flex-col justify-between min-h-[160px]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-editorial-muted">Reading Streak</h3>
            <Flame className="w-5 h-5 text-amber-500 animate-pulse" />
          </div>

          <div className="my-3">
            <span className="text-4xl font-black font-sans text-editorial-ink">12</span>
            <span className="text-sm font-medium text-editorial-muted ml-1.5">consecutive days</span>
          </div>

          {/* Week checklist */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-editorial-border/60">
            {weekdayStreak.map((day, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-editorial-muted">{day.label}</span>
                <div 
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    day.active 
                      ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                      : 'bg-editorial-surface text-editorial-muted border border-editorial-border/40'
                  }`}
                >
                  {day.active ? '✓' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Summary card */}
        <div className="border border-editorial-border rounded-2xl p-5 bg-editorial-bg relative flex flex-col justify-between min-h-[160px]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-editorial-muted">Intelligence Stats</h3>
            <Award className="w-5 h-5 text-editorial-accent" />
          </div>

          <div className="grid grid-cols-2 gap-4 my-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-editorial-surface flex items-center justify-center shrink-0 border border-editorial-border">
                <Bookmark className="w-5 h-5 text-editorial-accent" />
              </div>
              <div>
                <span className="block text-xl font-bold text-editorial-ink leading-tight">
                  {savedArticles?.length || 0}
                </span>
                <span className="text-xs text-editorial-muted">Bookmarks</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-editorial-surface flex items-center justify-center shrink-0 border border-editorial-border">
                <Globe className="w-5 h-5 text-editorial-accent" />
              </div>
              <div>
                <span className="block text-xl font-bold text-editorial-ink leading-tight">
                  {userCountries.length || 0}
                </span>
                <span className="text-xs text-editorial-muted">Regions</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-editorial-muted mt-2 pt-2 border-t border-editorial-border/60">
            Active Topics: <span className="font-semibold text-editorial-ink">{interests.length || 0} selected</span>
          </div>
        </div>
      </div>

      {/* Reading Interest distribution (Creative Details) */}
      <div className="border border-editorial-border rounded-2xl p-5 bg-editorial-bg mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-editorial-muted flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-editorial-accent" />
            Reading Volume Map
          </h3>
          <span className="text-xs text-editorial-muted">Estimated from reading history</span>
        </div>

        <div className="space-y-4">
          {mockInterestsWeight.map((interest, idx) => (
            <div key={idx}>
              <div className="flex justify-between items-center text-sm mb-1.5">
                <span className="font-semibold text-editorial-ink">{interest.label}</span>
                <span className="text-xs font-mono text-editorial-muted">{interest.value}%</span>
              </div>
              {/* Custom Meter bar */}
              <div className="w-full h-2 bg-editorial-surface rounded-full overflow-hidden border border-editorial-border/50">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${interest.color}`}
                  style={{ width: `${interest.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Regions of interest tags */}
      <div className="border border-editorial-border rounded-2xl p-5 bg-editorial-bg">
        <h3 className="text-sm font-bold uppercase tracking-wider text-editorial-muted mb-3">Ingested Countries</h3>
        {userCountries.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {userCountries.map((c) => (
              <span 
                key={c.countryId}
                className="px-3 py-1 bg-editorial-surface border border-editorial-border rounded-full text-xs font-semibold text-editorial-ink"
              >
                🌍 {c.countryName}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-editorial-muted italic">No specific country feeds configured. Using default globals.</p>
        )}
      </div>
    </div>
  );
}
