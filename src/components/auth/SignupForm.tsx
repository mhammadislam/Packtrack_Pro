import { useEffect, useState, type FormEvent } from 'react';
import { AtSign, CheckCircle2, Clock, KeyRound, Mail, Phone, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { PasswordStrength } from '@/components/auth/PasswordStrength';
import { isUsernameAvailable, suggestUsernames } from '@/lib/signup';
import {
  emailError,
  normalizePhone,
  passwordMeetsRules,
  phoneError,
  usernameError,
} from '@/lib/signupValidation';

type FieldKey = 'username' | 'fullName' | 'email' | 'phone' | 'password' | 'confirmPassword';

interface FormValues {
  username: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface UsernameCheck {
  status: 'idle' | 'checking' | 'available' | 'taken' | 'error';
  suggestions: string[];
}

const EMPTY_VALUES: FormValues = {
  username: '',
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

const IDLE_CHECK: UsernameCheck = { status: 'idle', suggestions: [] };
const USERNAME_CHECK_DELAY_MS = 350;

interface SignupFormProps {
  onSignIn: () => void;
}

export function SignupForm({ onSignIn }: SignupFormProps) {
  const { signUp } = useAuth();
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheck>(IDLE_CHECK);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);

  const usernameFormatError = usernameError(values.username);

  useEffect(() => {
    if (usernameFormatError) {
      setUsernameCheck(IDLE_CHECK);
      return;
    }
    const candidate = values.username;
    let cancelled = false;
    setUsernameCheck({ status: 'checking', suggestions: [] });
    const timer = window.setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(candidate);
        if (cancelled) return;
        if (available) {
          setUsernameCheck({ status: 'available', suggestions: [] });
          return;
        }
        setUsernameCheck({ status: 'taken', suggestions: [] });
        const suggestions = await suggestUsernames(candidate);
        if (!cancelled) setUsernameCheck({ status: 'taken', suggestions });
      } catch {
        if (!cancelled) setUsernameCheck({ status: 'error', suggestions: [] });
      }
    }, USERNAME_CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [values.username, usernameFormatError]);

  const update = (key: FieldKey, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const touch = (key: FieldKey) => {
    setTouched((current) => ({ ...current, [key]: true }));
  };

  const fullNameError = values.fullName.trim().length < 3 ? 'Please enter your full name (at least 3 characters).' : null;
  const emailFormatError = emailError(values.email);
  const phoneFormatError = phoneError(values.phone);
  const passwordError = !values.password
    ? 'Password is required.'
    : passwordMeetsRules(values.password)
      ? null
      : 'Your password does not meet every requirement below.';
  const confirmError = !values.confirmPassword
    ? 'Please confirm your password.'
    : values.confirmPassword !== values.password
      ? 'Passwords do not match.'
      : null;
  const usernameStateError = usernameFormatError
    ?? (usernameCheck.status === 'taken' ? `Username '${values.username}' already taken.` : null)
    ?? (usernameCheck.status === 'error' ? 'We could not check this username. Please try again.' : null);

  const usernameValid = !usernameFormatError && usernameCheck.status === 'available';
  const allValid =
    usernameValid &&
    !fullNameError &&
    !emailFormatError &&
    !phoneFormatError &&
    !passwordError &&
    !confirmError;
  const canSubmit = allValid && !submitting;

  const shown = (key: FieldKey, message: string | null | undefined) =>
    message && (touched[key] || values[key] !== '') ? message : undefined;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ username: true, fullName: true, email: true, phone: true, password: true, confirmPassword: true });
    setFormError(null);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const result = await signUp({
        username: values.username,
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
      });
      if (result.outcome === 'pending_approval') setPendingUsername(values.username.trim());
      else if (result.outcome === 'error' || result.outcome === 'duplicate_email') setFormError(result.message);
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingUsername) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="rounded-full bg-emerald-100 p-3 text-emerald-700">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Your account is created!</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Waiting for Admin approval. You will get approval within 24 hours.
          </p>
        </div>
        <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-sm">
          <div className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-slate-500">Username</span>
            <span className="font-semibold text-slate-900">{pendingUsername}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-slate-500">Status</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
              <Clock className="h-4 w-4" aria-hidden="true" />
              Pending approval
            </span>
          </div>
        </div>
        <Button variant="secondary" onClick={onSignIn} className="w-full py-2.5">
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h2>
      <p className="mt-1.5 text-sm text-slate-600">
        A Super Administrator reviews every new account before it can be used.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5" noValidate>
        <Field
          label="Username"
          htmlFor="username"
          required
          valid={usernameValid}
          error={shown('username', usernameStateError)}
          hint={usernameCheck.status === 'checking' ? 'Checking availability...' : '4-20 characters: letters, numbers, underscore.'}
        >
          <div className="relative">
            <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <TextInput
              id="username"
              autoComplete="username"
              value={values.username}
              onChange={(e) => update('username', e.target.value)}
              onBlur={() => touch('username')}
              className="pl-9"
              placeholder="e.g. aptech_user"
              maxLength={40}
            />
          </div>
        </Field>
        {usernameCheck.status === 'taken' && usernameCheck.suggestions.length > 0 && (
          <div className="-mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>Try:</span>
            {usernameCheck.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => update('username', suggestion)}
                className="rounded-full border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-800 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <Field label="Full name" htmlFor="full-name" required valid={!fullNameError && !!values.fullName} error={shown('fullName', fullNameError)}>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <TextInput
              id="full-name"
              autoComplete="name"
              value={values.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              onBlur={() => touch('fullName')}
              className="pl-9"
              placeholder="e.g. Ahmed Khan"
            />
          </div>
        </Field>

        <Field label="Email" htmlFor="email" required valid={!emailFormatError && !!values.email} error={shown('email', emailFormatError)}>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <TextInput
              id="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(e) => update('email', e.target.value)}
              onBlur={() => touch('email')}
              className="pl-9"
              placeholder="aptech123@gmail.com"
            />
          </div>
        </Field>

        <Field
          label="Phone number"
          htmlFor="phone"
          required
          valid={!phoneFormatError && !!values.phone}
          error={shown('phone', phoneFormatError)}
          hint="Pakistani mobile format: 03xx-xxxxxxx"
        >
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <TextInput
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={values.phone}
              onChange={(e) => update('phone', normalizePhone(e.target.value))}
              onBlur={() => touch('phone')}
              className="pl-9"
              placeholder="03xx-xxxxxxx"
              maxLength={12}
            />
          </div>
        </Field>

        <div className="flex flex-col gap-3">
          <Field label="Password" htmlFor="password" required valid={!passwordError} error={shown('password', passwordError)}>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <TextInput
                id="password"
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={(e) => update('password', e.target.value)}
                onBlur={() => touch('password')}
                className="pl-9"
              />
            </div>
          </Field>
          <PasswordStrength password={values.password} />
        </div>

        <Field label="Confirm password" htmlFor="confirm-password" required valid={!confirmError} error={shown('confirmPassword', confirmError)}>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <TextInput
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={(e) => update('confirmPassword', e.target.value)}
              onBlur={() => touch('confirmPassword')}
              className="pl-9"
            />
          </div>
        </Field>

        {formError && <Alert tone="error">{formError}</Alert>}

        <Button type="submit" loading={submitting} disabled={!canSubmit} className="w-full py-2.5">
          Create account
        </Button>
        {!canSubmit && !submitting && (
          <p className="-mt-3 text-center text-xs text-slate-500">Every field needs a green tick before you can create your account.</p>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSignIn}
          className="font-semibold text-slate-900 underline decoration-slate-400 decoration-2 underline-offset-4 transition hover:text-slate-600"
        >
          Sign in
        </button>
      </p>
    </>
  );
}
