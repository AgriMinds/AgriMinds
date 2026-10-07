'use client';

import React from 'react';
import { Layers, Calendar, Navigation, Info, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { DroughtMapResponse } from '../../types';
import { Language, translations } from '../../lib/translations';

interface WatershedGridMapProps {
  mapData: DroughtMapResponse | null;
  selectedLead: number;
  onLeadChange: (lead: number) => void;
  selectedCell: { row: number; col: number };
  onCellSelect: (row: number, col: number) => void;
  isLoading: boolean;
  language: Language;
}

export const WatershedGridMap: React.FC<WatershedGridMapProps> = ({
  mapData,
  selectedLead,
  onLeadChange,
  selectedCell,
  onCellSelect,
  isLoading,
  language,
}) => {
  const t = translations[language];

  const getCellColor = (prob: number) => {
    if (prob < 0.25) return 'bg-emerald-600 hover:bg-emerald-500 text-white';
    if (prob < 0.45) return 'bg-amber-400 hover:bg-amber-300 text-stone-900';
    if (prob < 0.65) return 'bg-orange-500 hover:bg-orange-400 text-white';
    return 'bg-rose-600 hover:bg-rose-500 text-white';
  };

  const selectedCellRisk = mapData?.cells.find(
    (c) => c.row === selectedCell.row && c.col === selectedCell.col
  );

  const moveCell = (dRow: number, dCol: number) => {
    const nextRow = Math.min(Math.max(0, selectedCell.row + dRow), 7);
    const nextCol = Math.min(Math.max(0, selectedCell.col + dCol), 7);
    onCellSelect(nextRow, nextCol);
  };

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white p-3.5 sm:p-5 shadow-xs dark:border-stone-800 dark:bg-[#21483b] transition-all">
      {/* Header & Lead Horizon Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3.5 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              {t.gridTitle}
            </h2>
          </div>
          <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {t.gridSubtitle}
          </p>
        </div>

        {/* Lead Month Selector: 1 Mo / 2 Mo / 3 Mo */}
        <div
          role="group"
          aria-label="Forecast lead month"
          className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800/80 p-1 rounded-xl self-start sm:self-auto shadow-2xs"
        >
          <span className="text-[11px] font-semibold px-2 text-stone-500 dark:text-stone-400 hidden xs:flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {t.leadLabel}
          </span>
          {[
            { lead: 1, full: t.lead1, short: '1 Mo' },
            { lead: 2, full: t.lead2, short: '2 Mo' },
            { lead: 3, full: t.lead3, short: '3 Mo' },
          ].map(({ lead, full, short }) => (
            <button
              key={lead}
              onClick={() => onLeadChange(lead)}
              className={`px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                selectedLead === lead
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-stone-700'
              }`}
              aria-pressed={selectedLead === lead}
            >
              <span className="hidden sm:inline">{full}</span>
              <span className="inline sm:hidden">{short}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Target Date Banner */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs px-3 py-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 border border-emerald-200/50 dark:border-emerald-900/50">
        <span className="truncate">
          <strong>{t.targetHorizon}:</strong> {mapData?.target_date || 'Forecast Pending'}
        </span>
        <span className="truncate text-emerald-800 dark:text-emerald-300">
          <strong>{t.issued}:</strong> {mapData?.issued_date || 'June 2026'}
        </span>
        <span className="font-semibold truncate">
          <strong>{t.meanBasinRisk}:</strong> {mapData ? `${(mapData.mean_probability * 100).toFixed(0)}%` : '--'}
        </span>
      </div>

      {/* 8x8 Spatial Grid Visualizer */}
      <div className="mt-4 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-[#21483b]/80 backdrop-blur-xs flex items-center justify-center z-20 rounded-xl">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="animate-spin text-lg">◌</span> {t.computingInference}
            </div>
          </div>
        )}

        <div className="grid grid-cols-8 gap-1 sm:gap-1.5 2xl:gap-2.5 p-1.5 sm:p-2 2xl:p-3 bg-stone-100/90 dark:bg-stone-800/80 rounded-2xl 2xl:rounded-3xl border border-stone-200 dark:border-stone-700">
          {mapData?.probabilities.map((row, r) =>
            row.map((prob, c) => {
              const isSelected = selectedCell.row === r && selectedCell.col === c;
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => onCellSelect(r, c)}
                  className={`aspect-square rounded-md sm:rounded-lg 2xl:rounded-xl flex flex-col items-center justify-center p-0.5 sm:p-1 2xl:p-1.5 font-black transition-all cursor-pointer active:scale-90 ${getCellColor(
                    prob
                  )} ${
                    isSelected
                      ? 'ring-3 sm:ring-4 ring-stone-900 dark:ring-white scale-105 z-10 shadow-lg'
                      : 'opacity-90 hover:opacity-100 hover:scale-[1.02]'
                  }`}
                  aria-label={`Row ${r}, Col ${c}, Drought probability ${(prob * 100).toFixed(0)}%`}
                >
                  <span className="text-[10px] sm:text-xs 2xl:text-sm leading-none font-black">
                    {(prob * 100).toFixed(0)}%
                  </span>
                  <span className="text-[8px] sm:text-[9px] 2xl:text-[11px] opacity-80 hidden sm:block mt-0.5 2xl:mt-1 leading-none font-mono">
                    {r},{c}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Selected Cell Telemetry & Nudge Navigation */}
      {selectedCellRisk && (
        <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-xl bg-stone-50 border border-stone-200 dark:bg-stone-800/50 dark:border-stone-700">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 shrink-0">
              <Navigation className="h-3.5 w-3.5" />
            </div>
            <div className="text-[11px] sm:text-xs truncate text-stone-700 dark:text-stone-300">
              <span>{t.selectedCell}: <strong>{selectedCell.row},{selectedCell.col}</strong></span>{' '}
              <span className="text-stone-400 dark:text-stone-500 font-mono">
                ({selectedCellRisk.latitude}°N, {selectedCellRisk.longitude}°E)
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
            {/* Quick Nudge arrows for mobile touch accessibility */}
            <div className="flex items-center gap-0.5 bg-stone-200/70 dark:bg-stone-700/60 rounded-lg p-0.5">
              <button
                onClick={() => moveCell(0, -1)}
                disabled={selectedCell.col === 0}
                className="p-1 text-stone-600 hover:text-stone-900 dark:text-stone-300 disabled:opacity-30 rounded hover:bg-white dark:hover:bg-stone-600"
                title="Previous column"
                aria-label="Move left"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <button
                onClick={() => moveCell(-1, 0)}
                disabled={selectedCell.row === 0}
                className="p-1 text-stone-600 hover:text-stone-900 dark:text-stone-300 disabled:opacity-30 rounded hover:bg-white dark:hover:bg-stone-600"
                title="Previous row"
                aria-label="Move up"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => moveCell(1, 0)}
                disabled={selectedCell.row === 7}
                className="p-1 text-stone-600 hover:text-stone-900 dark:text-stone-300 disabled:opacity-30 rounded hover:bg-white dark:hover:bg-stone-600"
                title="Next row"
                aria-label="Move down"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
              <button
                onClick={() => moveCell(0, 1)}
                disabled={selectedCell.col === 7}
                className="p-1 text-stone-600 hover:text-stone-900 dark:text-stone-300 disabled:opacity-30 rounded hover:bg-white dark:hover:bg-stone-600"
                title="Next column"
                aria-label="Move right"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            {/* Risk Probability badge */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-extrabold text-stone-900 dark:text-stone-50">
                {(selectedCellRisk.probability * 100).toFixed(1)}%
              </span>
              <span
                className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase tracking-wider ${
                  selectedCellRisk.risk_level === 'Low'
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300'
                    : selectedCellRisk.risk_level === 'Moderate'
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300'
                    : selectedCellRisk.risk_level === 'High'
                    ? 'bg-orange-100 text-orange-900 dark:bg-orange-950/80 dark:text-orange-300'
                    : 'bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-300'
                }`}
              >
                {selectedCellRisk.risk_level}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legend & BBox */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-stone-500 dark:text-stone-400">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="font-bold text-stone-700 dark:text-stone-300">{t.legend}:</span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-600" /> {t.lowRisk}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> {t.moderateRisk}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-500" /> {t.highRisk}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-600" /> {t.severeRisk}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-stone-400 dark:text-stone-500">
          <Info className="h-3 w-3 shrink-0" /> {t.bbox}
        </div>
      </div>
    </div>
  );
};
