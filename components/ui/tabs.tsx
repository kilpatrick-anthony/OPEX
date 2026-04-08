'use client';

import * as React from 'react';
import { clsx } from 'clsx';

interface TabsProps {
  items: Array<{ value: string; label: string }>;
  value: string;
  onValueChange: (value: string) => void;
}

export function Tabs({ items, value, onValueChange }: TabsProps) {
  return (
    <div className="flex flex-wrap gap-2 rounded-full bg-slate-100 p-1">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onValueChange(item.value)}
          className={clsx(
            'rounded-full px-4 py-2 text-sm font-medium transition-colors',
            value === item.value
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-white hover:text-slate-900',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
