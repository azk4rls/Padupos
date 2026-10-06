'use client';

import React from 'react';
import { CalendarDays } from 'lucide-react';
import {
  type DateRangePreset,
  type DateRangeState,
  describeRange,
  isValidCalendarDate,
  validateCustomRange,
} from '@/lib/dateRange';
import { cn } from '@/components/ui/utils';

interface DateRangeFilterProps {
  value: DateRangeState;
  onChange: (next: DateRangeState) => void;
  className?: string;
}

const PRESETS: Array<{ id: Exclude<DateRangePreset, 'custom'>; label: string }> = [
  { id: 'today', label: 'Hari ini' },
  { id: 'last7', label: '7 hari' },
  { id: 'last30', label: '30 hari' },
];

const INPUT_CLASS =
  'rounded-none border border-border bg-background px-2 py-1 text-xs tabular-nums text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900';

/**
 * Period selector for report surfaces.
 *
 * Presets cover the common windows; "Kustom" reveals two explicit date inputs. Only
 * bare `YYYY-MM-DD` values are ever produced, which is the form the backend
 * interprets in the scope timezone — so this control cannot silently shift a window
 * by the viewer's UTC offset.
 */
export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const isCustom = value.preset === 'custom';
  const customError =
    isCustom && isValidCalendarDate(value.startDate) && isValidCalendarDate(value.endDate)
      ? validateCustomRange(value.startDate, value.endDate)
      : null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div
        className="flex items-center border border-border"
        role="group"
        aria-label="Pilih periode"
      >
        {PRESETS.map((preset, index) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={value.preset === preset.id}
            onClick={() => onChange({ preset: preset.id, startDate: '', endDate: '' })}
            className={cn(
              'px-3 py-1 text-xs font-medium transition-colors',
              index > 0 && 'border-l border-border',
              value.preset === preset.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-50 focus-visible:bg-slate-50'
            )}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={isCustom}
          onClick={() =>
            onChange({ preset: 'custom', startDate: value.startDate, endDate: value.endDate })
          }
          className={cn(
            'border-l border-border px-3 py-1 text-xs font-medium transition-colors',
            isCustom
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-50 focus-visible:bg-slate-50'
          )}
        >
          Kustom
        </button>
      </div>

      {isCustom && (
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="range-start">
            Tanggal mulai
          </label>
          <input
            id="range-start"
            type="date"
            value={value.startDate}
            max={value.endDate || undefined}
            onChange={(event) => onChange({ ...value, startDate: event.target.value })}
            className={INPUT_CLASS}
          />
          <span aria-hidden className="text-xs text-muted-foreground">
            &ndash;
          </span>
          <label className="sr-only" htmlFor="range-end">
            Tanggal akhir
          </label>
          <input
            id="range-end"
            type="date"
            value={value.endDate}
            min={value.startDate || undefined}
            onChange={(event) => onChange({ ...value, endDate: event.target.value })}
            className={INPUT_CLASS}
          />
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {describeRange(value)}
      </p>

      {customError && (
        <p role="alert" className="w-full text-xs text-rose-700">
          {customError}
        </p>
      )}
    </div>
  );
}