'use client';

import React from 'react';
import { Activity, TrendingUp, TrendingDown, ThermometerSun, Info, Compass } from 'lucide-react';
import { EnsoOutlookResponse } from '../../types';
import { Language, translations } from '../../lib/translations';

interface EnsoMonitorProps {
  ensoData: EnsoOutlookResponse | null;
  isLoading: boolean;
  language: Language;
}

export const EnsoMonitor: React.FC<EnsoMonitorProps> = ({ ensoData, isLoading, language }) => {
  const t = translations[language];

  const currentVal = ensoData?.current_nino34 ?? 0;
  const isElNino = currentVal >= 0.5;
  const isLaNina = currentVal <= -0.5;

  // Calculate needle position for thermometer bar (-2.5 to +2.5 deg C)
  const clampedVal = Math.min(Math.max(currentVal, -2.5), 2.5);
  const needlePercent = ((clampedVal - (-2.5)) / 5.0) * 100;

  return (
    <section aria-label="ENSO Teleconnection Engine" className="rounded-2xl 2xl:rounded-3xl border border-stone-200/90 bg-white p-3.5 sm:p-5 2xl:p-7 shadow-xs dark:border-stone-800 dark:bg-[#21483b] transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3.5 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0">
              <Activity className="h-4 w-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              {t.ensoTitle}
            </h2>
          </div>
          <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {t.ensoSubtitle}
          </p>
        </div>

        {ensoData && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1.5 shadow-2xs ${
                isElNino
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 ring-1 ring-rose-300 dark:ring-rose-800'
                  : isLaNina
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200 ring-1 ring-blue-300 dark:ring-blue-800'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 ring-1 ring-emerald-300 dark:ring-emerald-800'
              }`}
            >
              {isElNino ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : isLaNina ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : (
                <ThermometerSun className="h-3.5 w-3.5" />
              )}
              {ensoData.current_state} ({currentVal > 0 ? `+${currentVal.toFixed(2)}` : currentVal.toFixed(2)}°C)
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-stone-500 text-xs">
          <span className="animate-spin text-lg inline-block mr-2">◌</span> Loading ENSO telemetry...
        </div>
      ) : ensoData ? (
        <div className="mt-4 space-y-4">
          {/* Visual Niño 3.4 Gauge Bar */}
          <div className="rounded-xl bg-stone-50/90 dark:bg-stone-800/50 p-3 sm:p-4 border border-stone-200 dark:border-stone-700">
            <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-2">
              <span className="text-blue-600 font-black">La Niña (&le; -0.5°C)</span>
              <span className="text-emerald-600 font-black">Neutral (-0.5°C to +0.5°C)</span>
              <span className="text-rose-600 font-black">El Niño (&ge; +0.5°C)</span>
            </div>

            {/* Gradient Spectrum Bar with marker */}
            <div className="relative h-3 rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 to-rose-500 overflow-hidden shadow-inner">
              {/* Neutral Zone indicator lines */}
              <div className="absolute top-0 bottom-0 left-[40%] w-0.5 bg-white/60 dark:bg-black/40" />
              <div className="absolute top-0 bottom-0 left-[60%] w-0.5 bg-white/60 dark:bg-black/40" />
            </div>

            {/* Needle indicator */}
            <div className="relative h-4 mt-0.5">
              <div
                className="absolute -translate-x-1/2 flex flex-col items-center transition-all duration-500"
                style={{ left: `${needlePercent}%` }}
              >
                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] border-b-stone-900 dark:border-b-white" />
                <span className="text-[10px] font-black text-stone-900 dark:text-stone-100 font-mono mt-0.5">
                  {currentVal > 0 ? `+${currentVal.toFixed(2)}` : currentVal.toFixed(2)}°C
                </span>
              </div>
            </div>
          </div>

          {/* Teleconnection Impact Note */}
          <div className="rounded-xl bg-stone-50 dark:bg-stone-800/60 p-3.5 border border-stone-200 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-300 leading-relaxed shadow-2xs">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-stone-900 dark:text-stone-100">
                  {t.teleconnectionImpact}:{' '}
                </strong>
                {ensoData.teleconnection_summary}
              </div>
            </div>
          </div>

          {/* Multi-Month Forecast Timeline */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5 text-emerald-600" />
                <span>{t.ensoOutlookTitle}</span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-mono text-stone-400 dark:text-stone-500">
                {t.threshold}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-2.5">
              {ensoData.forecast_series.map((pt, idx) => {
                const val = pt.nino34;
                const ptElNino = val >= 0.5;
                const ptLaNina = val <= -0.5;

                return (
                  <div
                    key={pt.date}
                    className="p-2.5 sm:p-3 rounded-xl border border-stone-200/90 dark:border-stone-700/80 bg-white dark:bg-stone-800/50 text-center shadow-2xs hover:shadow-xs transition-all"
                  >
                    <div className="text-[10px] sm:text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                      {t.monthPlus}{idx + 1}
                    </div>
                    <div className="text-[11px] sm:text-xs font-bold text-stone-700 dark:text-stone-300 mt-0.5 font-mono">
                      {pt.date}
                    </div>
                    <div
                      className={`text-sm sm:text-base font-black mt-1 font-mono ${
                        ptElNino
                          ? 'text-rose-600'
                          : ptLaNina
                          ? 'text-blue-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}°C
                    </div>
                    <div className="text-[9px] sm:text-[10px] uppercase font-bold text-stone-400 dark:text-stone-500 mt-0.5">
                      {ptElNino ? 'El Niño' : ptLaNina ? 'La Niña' : 'Neutral'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
