'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

export function Welcome() {
  const router = useRouter();

  return (
    <div className="min-h-[100dvh] bg-white font-sans text-editorial-ink selection:bg-brand-100 overflow-x-hidden">
      <div className="flex flex-col lg:flex-row min-h-[100dvh] lg:h-screen w-full bg-white lg:overflow-hidden">
        
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
            className="w-full max-w-md mx-auto"
          >
            {/* Decorative Dash */}
            <div className="w-10 h-1 bg-brand-500 mb-8 rounded-full"></div>

            <h1 className="text-5xl font-bold text-gray-900 mb-4 leading-tight">
              Welcome to <br />
              Imperium <span className="text-brand-500">news</span>
            </h1>

            <p className="text-gray-500 text-lg mb-10 max-w-md leading-relaxed">
              Every story. Every second. Everywhere. Intelligence-powered
              news that keeps you ahead of the world.
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
                  <p className="text-sm text-gray-500">Breaking news the moment it happens</p>
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
                  <p className="text-sm text-gray-500">A feed that learns what matters to you</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shrink-0 shadow-lg shadow-purple-200">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Global coverage</h4>
                  <p className="text-sm text-gray-500">Every country, every topic — one place</p>
                </div>
              </li>
            </ul>

            {/* Call to Action Buttons */}
            <div className="flex flex-col gap-4 max-w-sm">
              <button
                onClick={() => router.push('/login')}
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-purple-200 group"
              >
                Get Started
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-6 max-w-sm text-center">
              No account required to explore
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
