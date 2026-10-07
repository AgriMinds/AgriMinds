'use client';

import React, { useEffect, useState } from 'react';
import { Moon, Sprout, MapPin, Globe, Sun, Wifi, WifiOff } from 'lucide-react';
import { Language, translations } from '../../lib/translations';

interface NavbarProps {
  apiStatus: 'healthy' | 'offline' | 'loading';
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ apiStatus, language, onLanguageChange }) => {
  const t = translations[language];
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('agriminds-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(savedTheme ? savedTheme === 'dark' : prefersDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    window.localStorage.setItem('agriminds-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-emerald-900/10 bg-white/95 backdrop-blur-md shadow-xs dark:bg-[#21483b]/95 dark:border-stone-800 transition-colors">
      <div className="mx-auto flex max-w-[1920px] items-center justify-between px-3 sm:px-6 lg:px-8 2xl:px-10 py-2.5 sm:py-3.5 2xl:py-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-700/20 ring-1 ring-emerald-600/30">
            <Sprout className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-base sm:text-xl font-black tracking-tight text-stone-900 dark:text-stone-50 truncate">
                AgriMinds
              </h1>
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-600/20 shrink-0">
                AI-DREWS
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-stone-500 font-medium dark:text-stone-400 flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 text-emerald-600 shrink-0 inline" />
              <span className="truncate">{t.subtitle}</span>
            </p>
          </div>
        </div>

        {/* Right Actions: Theme, Status Badge & Language Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsDark((current) => !current)}
            className="flex size-9 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-700 transition-colors hover:bg-stone-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:border-emerald-800/80 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-900/80"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={isDark}
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>

          {/* API Status badge */}
          <div
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold border border-stone-200 bg-stone-50/90 dark:border-stone-800 dark:bg-stone-800/80"
            title={apiStatus === 'healthy' ? t.engineOnline : apiStatus === 'loading' ? t.engineConnecting : t.engineOffline}
          >
            <span
              className={`h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full shrink-0 ${
                apiStatus === 'healthy'
                  ? 'bg-emerald-500 animate-pulse'
                  : apiStatus === 'loading'
                  ? 'bg-amber-500 animate-bounce'
                  : 'bg-rose-500'
              }`}
            />
            <span className="hidden md:inline text-stone-700 dark:text-stone-300 font-medium">
              {apiStatus === 'healthy'
                ? t.engineOnline
                : apiStatus === 'loading'
                ? t.engineConnecting
                : t.engineOffline}
            </span>
            <span className="inline md:hidden text-[10px] font-bold text-stone-600 dark:text-stone-400">
              {apiStatus === 'healthy' ? (
                <Wifi className="h-3 w-3 text-emerald-600" />
              ) : (
                <WifiOff className="h-3 w-3 text-rose-500" />
              )}
            </span>
          </div>

          {/* Language Selector: EN | አማ | ORO */}
          <div
            role="group"
            aria-label="Language selection"
            className="flex items-center gap-1 p-0.5 sm:p-1 rounded-xl border border-stone-200 bg-stone-100/80 dark:border-stone-700 dark:bg-stone-800/90 shadow-2xs"
          >
            <div className="hidden sm:flex pl-1 pr-0.5 text-stone-400">
              <Globe className="h-3.5 w-3.5" />
            </div>

            {(['en', 'am', 'or'] as Language[]).map((lang) => {
              const isActive = language === lang;
              const label = lang === 'en' ? 'EN' : lang === 'am' ? 'አማ' : 'ORO';
              return (
                <button
                  key={lang}
                  onClick={() => onLanguageChange(lang)}
                  className={`px-2 py-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                    isActive
                      ? 'bg-white text-emerald-700 shadow-xs dark:bg-stone-700 dark:text-emerald-300'
                      : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
                  }`}
                  aria-pressed={isActive}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
