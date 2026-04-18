import * as React from 'react';
import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
}

export function Card({ title, description, className, children, ...props }: CardProps) {
  return (
    <div className={clsx('rounded-3xl border border-slate-200 bg-white p-6 shadow-card flex flex-col', className)} {...props}>
      {title ? <div className="mb-4 space-y-1"><h2 className="text-xl font-semibold text-slate-900">{title}</h2><p className="text-sm text-slate-500">{description}</p></div> : null}
      <div className="flex flex-col flex-1 min-h-0 space-y-4">{children}</div>
    </div>
  );
}
