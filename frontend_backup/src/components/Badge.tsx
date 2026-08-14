import React from 'react';
import { cn } from '../utils';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'accent' | 'neutral' | 'indigo';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ children, variant = 'neutral', className, ...props }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    success: 'bg-success-500/15 text-success-400 border border-success-500/20',
    warning: 'bg-warning-500/15 text-warning-400 border border-warning-500/20',
    danger: 'bg-danger-500/15 text-danger-400 border border-danger-500/20',
    accent: 'bg-accent-500/15 text-accent-400 border border-accent-500/20',
    neutral: 'bg-base-700 text-gray-400 border border-base-600',
    indigo: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
