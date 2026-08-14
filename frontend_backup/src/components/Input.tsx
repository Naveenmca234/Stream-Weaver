import React from 'react';
import { cn } from '../utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, fullWidth = true, ...props }, ref) => {
    return (
      <div className={cn('flex flex-col gap-1', fullWidth && 'w-full')}>
        {label && (
          <label className="text-sm font-medium text-gray-300">
            {label}
            {props.required && <span className="text-danger-500 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'bg-base-800 border rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-500 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-base-950',
            error
              ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/50'
              : 'border-base-600 focus:border-accent-500 focus:ring-accent-500/50',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger-500 mt-1">{error}</p>}
        {helperText && !error && <p className="text-xs text-gray-500 mt-1">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
