import { Check, Circle } from 'lucide-react';
import { passwordChecks, passwordStrength, type StrengthLevel } from '@/lib/signupValidation';

const LEVEL_TEXT: Record<StrengthLevel, string> = {
  Weak: 'text-red-700',
  Medium: 'text-amber-700',
  Strong: 'text-sky-700',
  'Out-Class': 'text-emerald-700',
};

const LEVEL_BAR: Record<StrengthLevel, string> = {
  Weak: 'bg-red-500',
  Medium: 'bg-amber-500',
  Strong: 'bg-sky-500',
  'Out-Class': 'bg-emerald-500',
};

const LEVEL_SEGMENTS: Record<StrengthLevel, number> = {
  Weak: 1,
  Medium: 2,
  Strong: 3,
  'Out-Class': 4,
};

export function PasswordStrength({ password }: { password: string }) {
  const level = passwordStrength(password);
  const filled = password ? LEVEL_SEGMENTS[level] : 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">Password strength</span>
        <span className={`font-semibold ${password ? LEVEL_TEXT[level] : 'text-slate-500'}`}>
          {password ? level : 'Not set'}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((segment) => (
          <span
            key={segment}
            className={`h-1.5 rounded-full transition-colors duration-300 ${segment < filled ? LEVEL_BAR[level] : 'bg-slate-200'}`}
          />
        ))}
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {passwordChecks(password).map((check) => (
          <li
            key={check.id}
            className={`flex items-center gap-2 text-xs transition-colors ${check.passed ? 'font-medium text-emerald-700' : 'text-slate-600'}`}
          >
            {check.passed ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
