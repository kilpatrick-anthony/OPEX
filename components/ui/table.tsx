import * as React from 'react';
import { clsx } from 'clsx';

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {}

export function Table({ className, children, ...props }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-card">
      <table className={clsx('min-w-full divide-y divide-slate-200', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-slate-50 text-left text-sm uppercase tracking-wide text-slate-500">
      {children}
    </thead>
  );
}

export function TableRow({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-slate-200 last:border-none hover:bg-slate-50">{children}</tr>;
}

export function TableCell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <td className={clsx('px-4 py-4 text-sm text-slate-700', className)}>{children}</td>;
}
