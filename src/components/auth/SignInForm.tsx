import { useState, type FormEvent } from 'react';
import { KeyRound, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';

interface SignInFormProps {
  onCreateAccount: () => void;
}

export function SignInForm({ onCreateAccount }: SignInFormProps) {
  const { signIn, accessNotice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const message = await signIn(email, password);
      if (message) setError(message);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in to continue</h2>
      <p className="mt-1.5 text-sm text-slate-600">Use the email and password you registered with.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5" noValidate>
        <Field label="Email" htmlFor="email" required>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <TextInput id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" placeholder="you@gmail.com" />
          </div>
        </Field>
        <Field label="Password" htmlFor="password" required>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <TextInput id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" />
          </div>
        </Field>

        {accessNotice && <Alert tone="warning">{accessNotice}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}

        <Button type="submit" loading={submitting} className="w-full py-2.5">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Don't have an account?{' '}
        <button
          type="button"
          onClick={onCreateAccount}
          className="font-semibold text-slate-900 underline decoration-slate-400 decoration-2 underline-offset-4 transition hover:text-slate-600"
        >
          Create one
        </button>
      </p>
    </>
  );
}
