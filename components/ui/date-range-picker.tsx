'use client';

import { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import type { DateRange as RdpRange } from 'react-day-picker';
import { format } from 'date-fns';
import 'react-day-picker/dist/style.css';

export type DateRange = { from: Date; to?: Date };

interface Props {
  range: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
}

export function DateRangePicker({ range, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const label = range?.from
    ? range.to
      ? `${format(range.from, 'd MMM yyyy')} – ${format(range.to, 'd MMM yyyy')}`
      : `From ${format(range.from, 'd MMM yyyy')}`
    : 'Custom range';

  function handleSelect(r: RdpRange | undefined) {
    if (!r?.from) { onChange(undefined); return; }
    onChange({ from: r.from, to: r.to });
    if (r.from && r.to) setOpen(false);
  }

  function clearRange(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
    onChange(undefined);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
          range
            ? 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        {/* Calendar icon */}
        <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
        <span>{label}</span>
        {range && (
          <span
            role="button"
            tabIndex={0}
            onClick={clearRange}
            onKeyDown={(e) => e.key === 'Enter' && clearRange(e)}
            aria-label="Clear date range"
            className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-sky-500 hover:bg-sky-200 hover:text-sky-800 cursor-pointer"
          >
            ×
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-[200] overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Select date range</p>
            {range?.from && range?.to && (
              <button
                type="button"
                onClick={() => { onChange(undefined); }}
                className="text-xs text-slate-400 hover:text-slate-700 underline"
              >
                Clear
              </button>
            )}
          </div>

          {range?.from && !range?.to && (
            <p className="mb-2 rounded-xl bg-sky-50 px-3 py-1.5 text-xs text-sky-600">
              Now pick an end date
            </p>
          )}

          <DayPicker
            mode="range"
            selected={range as RdpRange | undefined}
            onSelect={handleSelect}
            defaultMonth={range?.from ?? new Date(2026, 3, 1)}
            numberOfMonths={2}
            className="rdp-opex"
          />

          {/* Range summary footer */}
          {range?.from && range?.to && (
            <div className="mt-3 border-t border-slate-100 pt-3 flex items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                <span className="font-medium text-slate-800">{format(range.from, 'd MMM yyyy')}</span>
                <span className="mx-2 text-slate-300">→</span>
                <span className="font-medium text-slate-800">{format(range.to, 'd MMM yyyy')}</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700 transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
