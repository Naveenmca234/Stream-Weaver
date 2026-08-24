import { FC } from 'react';

export interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const extractErrorMessage = (err: any, fallback: string = 'An unexpected error occurred. Please try again.'): string => {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  
  // Try to get message from standard axios response structure
  if (err.response?.data?.message && typeof err.response.data.message === 'string') {
    return err.response.data.message;
  }
  
  // Try to get message from Error object
  if (err.message && typeof err.message === 'string') {
    // Prevent showing raw stack traces or internal server error dumps
    if (err.message.includes('<!DOCTYPE html>') || err.message.includes('TypeError') || err.message.length > 200) {
      return fallback;
    }
    return err.message;
  }

  return fallback;
};

const ErrorAlert: FC<ErrorAlertProps> = ({ message, onRetry, className = '' }) => {
  if (!message) return null;

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-4 rounded-[24px] border border-rose-500/20 bg-rose-500/10 p-6 shadow-lg backdrop-blur-xl ${className}`}>
      <div className="flex items-center gap-4 flex-1">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-2xl shadow-inner">⚠️</div>
        <div className="space-y-1">
          <p className="font-semibold text-rose-300">Something went wrong</p>
          <p className="text-sm font-medium text-rose-200/80">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-full bg-rose-500/20 px-6 py-2.5 text-sm font-semibold text-rose-200 hover:bg-rose-500/30 hover:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all shadow-sm"
        >
          Try Again
        </button>
      )}
    </div>
  );
};

export default ErrorAlert;
