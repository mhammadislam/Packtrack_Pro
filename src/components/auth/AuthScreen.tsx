import { useState } from 'react';
import { Factory } from 'lucide-react';
import { SignInForm } from '@/components/auth/SignInForm';
import { SignupForm } from '@/components/auth/SignupForm';

type Mode = 'signin' | 'signup';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');

  return (
    <div className="flex min-h-screen">
      <aside className="relative hidden w-[44%] flex-col justify-between overflow-hidden border-r border-slate-200 bg-slate-50 p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #38bdf8 0, #38bdf8 2px, transparent 2px, transparent 28px)',
          }}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <span className="rounded-xl bg-black p-2.5 text-white">
            <Factory className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-900">PackTrack Pro</p>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Packaging ERP</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-[1.15] tracking-tight text-slate-900">
            Every roll, bag and kilogram, tracked from press to dispatch.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-slate-600">
            Record production across nine departments, watch machine status live, and export shift-ready reports to Excel or PDF.
          </p>
        </div>
        <p className="relative text-sm text-slate-500">Printing, lamination, bag making, PVC, slitting and rewinding in one system.</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-12 sm:px-10">
        <div className={`w-full ${mode === 'signup' ? 'max-w-lg' : 'max-w-md'}`}>
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="rounded-xl bg-black p-2.5 text-white">
              <Factory className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-lg font-bold text-slate-900">PackTrack Pro</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Packaging ERP</p>
            </div>
          </div>

          <div className="glass-panel p-6 sm:p-8">
            {mode === 'signin' ? (
              <SignInForm onCreateAccount={() => setMode('signup')} />
            ) : (
              <SignupForm onSignIn={() => setMode('signin')} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
