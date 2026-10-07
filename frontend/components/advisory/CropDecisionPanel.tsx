'use client';

import React from 'react';
import {
  Wheat,
  Clock,
  Droplets,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  XCircle,
  ShieldCheck,
} from 'lucide-react';
import { AdvisoryResponse } from '../../types';
import { Language, translations } from '../../lib/translations';

interface CropDecisionPanelProps {
  crop: 'tef' | 'wheat' | 'maize';
  onCropChange: (c: 'tef' | 'wheat' | 'maize') => void;
  iekAgrees: boolean | null;
  onIekChange: (agrees: boolean | null) => void;
  advisory: AdvisoryResponse | null;
  isLoading: boolean;
  language: Language;
}

export const CropDecisionPanel: React.FC<CropDecisionPanelProps> = ({
  crop,
  onCropChange,
  iekAgrees,
  onIekChange,
  advisory,
  isLoading,
  language,
}) => {
  const t = translations[language];

  const getRiskBorder = (level?: string) => {
    switch (level) {
      case 'Low':
        return 'border-l-emerald-600 bg-emerald-50/60 text-emerald-950 dark:bg-emerald-950/25 dark:text-emerald-100 border-emerald-200/50 dark:border-emerald-900/50';
      case 'Moderate':
        return 'border-l-amber-500 bg-amber-50/60 text-amber-950 dark:bg-amber-950/25 dark:text-amber-100 border-amber-200/50 dark:border-amber-900/50';
      case 'High':
        return 'border-l-orange-500 bg-orange-50/60 text-orange-950 dark:bg-orange-950/25 dark:text-orange-100 border-orange-200/50 dark:border-orange-900/50';
      case 'Severe':
        return 'border-l-rose-600 bg-rose-50/60 text-rose-950 dark:bg-rose-950/25 dark:text-rose-100 border-rose-200/50 dark:border-rose-900/50';
      default:
        return 'border-l-stone-400 bg-stone-50 dark:border-stone-700 dark:bg-stone-800';
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white p-3.5 sm:p-5 shadow-xs dark:border-stone-800 dark:bg-[#21483b] transition-all">
      {/* Panel Header */}
      <div className="border-b border-stone-100 pb-3.5 dark:border-stone-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0">
            <Wheat className="h-4 w-4" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            {t.advisoryTitle}
          </h2>
        </div>
        <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          {t.advisorySubtitle}
        </p>
      </div>

      {/* Inputs: Crop Selector & IEK Toggle */}
      <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Crop Selection */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            {t.targetCrop}
          </label>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:gap-2">
            {[
              { id: 'tef', label: t.tefLabel, desc: t.tefDesc },
              { id: 'wheat', label: t.wheatLabel, desc: t.wheatDesc },
              { id: 'maize', label: t.maizeLabel, desc: t.maizeDesc },
            ].map((c) => {
              const isActive = crop === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => onCropChange(c.id as 'tef' | 'wheat' | 'maize')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                    isActive
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-600/30 dark:bg-emerald-950/50 dark:text-emerald-100 dark:border-emerald-500 shadow-xs'
                      : 'border-stone-200 bg-white hover:bg-stone-50/80 dark:border-stone-700 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300'
                  }`}
                  aria-pressed={isActive}
                >
                  <div className="text-xs font-black truncate">{c.label}</div>
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                    {c.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Indigenous Ecological Knowledge (IEK) */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" /> {t.iekTitle}
          </label>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:gap-2">
            <button
              onClick={() => onIekChange(true)}
              className={`p-1.5 sm:p-2 rounded-xl border text-center transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                iekAgrees === true
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black ring-2 ring-emerald-600/30 dark:bg-emerald-950/50 dark:text-emerald-100 shadow-xs'
                  : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700 dark:border-stone-700 dark:bg-stone-800/80 dark:text-stone-300'
              }`}
              aria-pressed={iekAgrees === true}
            >
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto text-emerald-600 mb-0.5" />
              <div className="text-[11px] font-bold truncate">{t.iekAgrees}</div>
            </button>
            <button
              onClick={() => onIekChange(false)}
              className={`p-1.5 sm:p-2 rounded-xl border text-center transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-rose-500 ${
                iekAgrees === false
                  ? 'border-rose-600 bg-rose-50 text-rose-950 font-black ring-2 ring-rose-600/30 dark:bg-rose-950/50 dark:text-rose-100 shadow-xs'
                  : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700 dark:border-stone-700 dark:bg-stone-800/80 dark:text-stone-300'
              }`}
              aria-pressed={iekAgrees === false}
            >
              <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto text-rose-600 mb-0.5" />
              <div className="text-[11px] font-bold truncate">{t.iekDisagrees}</div>
            </button>
            <button
              onClick={() => onIekChange(null)}
              className={`p-1.5 sm:p-2 rounded-xl border text-center transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-stone-500 ${
                iekAgrees === null
                  ? 'border-stone-600 bg-stone-100 text-stone-900 font-black ring-2 ring-stone-600/20 dark:bg-stone-700 dark:text-stone-100 shadow-xs'
                  : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-600 dark:border-stone-700 dark:bg-stone-800/80 dark:text-stone-400'
              }`}
              aria-pressed={iekAgrees === null}
            >
              <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto text-stone-500 mb-0.5" />
              <div className="text-[11px] font-bold truncate">{t.iekNotSet}</div>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Advisory Output */}
      <div className="mt-4">
        {isLoading ? (
          <div className="p-8 text-center text-stone-500 text-xs">
            <span className="animate-spin text-lg inline-block mr-2">◌</span> Evaluating agronomic thresholds...
          </div>
        ) : advisory ? (
          <div
            className={`rounded-2xl border border-l-6 p-4 sm:p-5 transition-all shadow-xs ${getRiskBorder(
              advisory.risk_level
            )}`}
          >
            {/* Risk & Season Summary Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 pb-3.5">
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider opacity-75">
                  {t.evalCrop}: <strong className="capitalize">{advisory.crop}</strong>
                </span>
                <h3 className="text-lg sm:text-2xl font-black tracking-tight">
                  {t.evalRisk}: {advisory.risk_level}
                </h3>
                <p className="text-xs mt-0.5 opacity-85">
                  {advisory.season} | ENSO: <strong>{advisory.enso_state}</strong>
                </p>
              </div>

              <div className="self-start sm:self-auto sm:text-right bg-white/60 dark:bg-[#21483b]/60 sm:bg-transparent px-3 py-1.5 sm:p-0 rounded-xl">
                <span className="text-[10px] sm:text-[11px] font-semibold opacity-75">{t.cropAdjustedRisk}</span>
                <div className="text-2xl sm:text-3xl font-black tracking-tight leading-none">
                  {(advisory.adjusted_probability * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] opacity-75 mt-0.5">
                  {t.rawGrid}: {(advisory.raw_probability * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* 4 Action Directives */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3">
              {/* Strategy */}
              <div className="rounded-xl bg-white/80 dark:bg-[#21483b]/70 p-3 sm:p-3.5 border border-black/5 dark:border-white/5 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-stone-200">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0">
                    <Wheat className="h-3 w-3" />
                  </div>
                  <span>{t.strategyTitle}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed font-medium text-stone-700 dark:text-stone-300">
                  {advisory.crop_recommendation}
                </p>
              </div>

              {/* Planting Window */}
              <div className="rounded-xl bg-white/80 dark:bg-[#21483b]/70 p-3 sm:p-3.5 border border-black/5 dark:border-white/5 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-stone-200">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 shrink-0">
                    <Clock className="h-3 w-3" />
                  </div>
                  <span>{t.plantingTitle}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed font-medium text-stone-700 dark:text-stone-300">
                  {advisory.planting_window}
                </p>
              </div>

              {/* Water Management */}
              <div className="rounded-xl bg-white/80 dark:bg-[#21483b]/70 p-3 sm:p-3.5 border border-black/5 dark:border-white/5 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-stone-200">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-400 shrink-0">
                    <Droplets className="h-3 w-3" />
                  </div>
                  <span>{t.waterTitle}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed font-medium text-stone-700 dark:text-stone-300">
                  {advisory.water_management}
                </p>
              </div>

              {/* Preparedness */}
              <div className="rounded-xl bg-white/80 dark:bg-[#21483b]/70 p-3 sm:p-3.5 border border-black/5 dark:border-white/5 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-stone-200">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 shrink-0">
                    <AlertTriangle className="h-3 w-3" />
                  </div>
                  <span>{t.prepTitle}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed font-medium text-stone-700 dark:text-stone-300">
                  {advisory.preparedness_action}
                </p>
              </div>
            </div>

            {/* IEK Consensus & Confidence Rating */}
            <div className="mt-3.5 rounded-xl bg-white/90 dark:bg-[#21483b]/80 p-3 text-xs border border-dashed border-stone-300 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-900 dark:text-stone-100">
                    {t.iekIntegration}:{' '}
                  </span>
                  <span className="text-stone-700 dark:text-stone-300 italic">
                    {advisory.iek_assessment}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-[11px] font-bold text-stone-700 dark:text-stone-300">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>{t.confidenceRating}: {advisory.confidence_level}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-stone-400 text-xs">
            Select a grid cell above to generate crop-specific recommendations.
          </div>
        )}
      </div>
    </div>
  );
};
