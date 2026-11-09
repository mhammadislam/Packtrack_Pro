import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface AlertProps {
  tone: 'error' | 'success' | 'warning';
  children: ReactNode;
}

export function Alert({ tone, children }: AlertProps) {
  const isError = tone === 'error';
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle;
  const toneClass = {
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }[tone];
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${toneClass}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof TypeError) return 'Could not reach the server. Check your internet connection and try again.';
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' && error.message) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
