'use client';

import React from 'react';
import { Mountain, CloudDrizzle, Target, Cpu } from 'lucide-react';
import { DroughtMapResponse } from '../../types';
import { Language, translations } from '../../lib/translations';

interface WatershedSummaryProps {
  mapData: DroughtMapResponse | null;
  selectedLead: number;
  language: Language;
}

export const WatershedSummary: React.FC<WatershedSummaryProps> = ({
  mapData,
  selectedLead,
  language,
}) => {
  const t = translations[language];

  const meanRisk = mapData ? `${(mapData.mean_probability * 100).toFixed(0)}%` : '--';
  const minRisk = mapData ? `${(mapData.min_probability * 100).toFixed(0)}%` : '--';
  const maxRisk = mapData ? `${(mapData.max_probability * 100).toFixed(0)}%` : '--';

  return (
    <section aria-label="Watershed Executive Metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 2xl:gap-6">
      {/* 1. Basin Mean Drought Risk */}
      <div className="relative overflow-hidden rounded-2xl 2xl:rounded-3xl border border-stone-200/90 bg-white p-3.5 sm:p-5 2xl:p-6 shadow-2xs dark:border-stone-800 dark:bg-[#21483b] transition-all hover:shadow-xs">
        <div className="flex items-center gap-1.5 sm:gap-2 text-stone-500 dark:text-stone-400 text-[11px] sm:text-xs 2xl:text-sm font-semibold">
          <div className="flex h-6 w-6 sm:h-7 sm:w-7 2xl:h-9 2xl:w-9 items-center justify-center rounded-lg 2xl:rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0">
            <CloudDrizzle className="h-3.5 w-3.5 sm:h-4 sm:w-4 2xl:h-5 2xl:w-5" />
          </div>
          <span className="truncate">{t.basinMeanRisk}</span>
        </div>
        <div className="mt-2 text-2xl sm:text-3xl lg:text-4xl 2xl:text-5xl font-black text-stone-900 dark:text-stone-50 tracking-tight">
          {meanRisk}
        </div>
        <div className="text-[10px] sm:text-xs 2xl:text-sm text-stone-400 dark:text-stone-500 mt-1 truncate">
          {t.spread}: {minRisk} ({t.min}) – {maxRisk} ({t.max})
        </div>
      </div>

      {/* 2. Forecast Target */}
      <div className="relative overflow-hidden rounded-2xl 2xl:rounded-3xl border border-stone-200/90 bg-white p-3.5 sm:p-5 2xl:p-6 shadow-2xs dark:border-stone-800 dark:bg-[#21483b] transition-all hover:shadow-xs">
        <div className="flex items-center gap-1.5 sm:gap-2 text-stone-500 dark:text-stone-400 text-[11px] sm:text-xs 2xl:text-sm font-semibold">
          <div className="flex h-6 w-6 sm:h-7 sm:w-7 2xl:h-9 2xl:w-9 items-center justify-center rounded-lg 2xl:rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 shrink-0">
            <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 2xl:h-5 2xl:w-5" />
          </div>
          <span className="truncate">{t.forecastTarget}</span>
        </div>
        <div className="mt-2 text-xl sm:text-2xl lg:text-3xl 2xl:text-4xl font-black text-stone-900 dark:text-stone-50 tracking-tight truncate">
          {mapData?.target_date || `+${selectedLead} Months`}
        </div>
        <div className="text-[10px] sm:text-xs 2xl:text-sm text-stone-400 dark:text-stone-500 mt-1 truncate">
          Lead {selectedLead} mo {t.leadAdvance}
        </div>
      </div>

      {/* 3. Agro-Ecological Basin */}
      <div className="relative overflow-hidden rounded-2xl 2xl:rounded-3xl border border-stone-200/90 bg-white p-3.5 sm:p-5 2xl:p-6 shadow-2xs dark:border-stone-800 dark:bg-[#21483b] transition-all hover:shadow-xs">
        <div className="flex items-center gap-1.5 sm:gap-2 text-stone-500 dark:text-stone-400 text-[11px] sm:text-xs 2xl:text-sm font-semibold">
          <div className="flex h-6 w-6 sm:h-7 sm:w-7 2xl:h-9 2xl:w-9 items-center justify-center rounded-lg 2xl:rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400 shrink-0">
            <Mountain className="h-3.5 w-3.5 sm:h-4 sm:w-4 2xl:h-5 2xl:w-5" />
          </div>
          <span className="truncate">{t.basinName}</span>
        </div>
        <div className="mt-2 text-xl sm:text-2xl lg:text-3xl 2xl:text-4xl font-black text-stone-900 dark:text-stone-50 tracking-tight truncate">
          {t.chokeMountain}
        </div>
        <div className="text-[10px] sm:text-xs 2xl:text-sm text-stone-400 dark:text-stone-500 mt-1 truncate">
          {t.elevation}
        </div>
      </div>

      {/* 4. AI Framework */}
      <div className="relative overflow-hidden rounded-2xl 2xl:rounded-3xl border border-stone-200/90 bg-white p-3.5 sm:p-5 2xl:p-6 shadow-2xs dark:border-stone-800 dark:bg-[#21483b] transition-all hover:shadow-xs">
        <div className="flex items-center gap-1.5 sm:gap-2 text-stone-500 dark:text-stone-400 text-[11px] sm:text-xs 2xl:text-sm font-semibold">
          <div className="flex h-6 w-6 sm:h-7 sm:w-7 2xl:h-9 2xl:w-9 items-center justify-center rounded-lg 2xl:rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 shrink-0">
            <Cpu className="h-3.5 w-3.5 sm:h-4 sm:w-4 2xl:h-5 2xl:w-5" />
          </div>
          <span className="truncate">{t.aiFramework}</span>
        </div>
        <div className="mt-2 text-xl sm:text-2xl lg:text-3xl 2xl:text-4xl font-black text-stone-900 dark:text-stone-50 tracking-tight truncate">
          {t.superHybrid}
        </div>
        <div className="text-[10px] sm:text-xs 2xl:text-sm text-stone-400 dark:text-stone-500 mt-1 truncate">
          {t.aiComponents}
        </div>
      </div>
    </section>
  );
};
