export const ALLOWED_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];

const USERNAME_PATTERN = /^[A-Za-z0-9_]{4,20}$/;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_PATTERN = /^03[0-4]\d{8}$/;
const REPEATED_DIGITS = /(\d)\1{4}/;
const SEQUENTIAL_DIGITS = /01234|12345|23456|34567|45678|56789|98765|87654|76543|65432|54321|43210/;

const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '12345678910',
  '11111111',
  '00000000',
  'password',
  'password1',
  'password123',
  'password@123',
  'p@ssw0rd',
  'qwerty',
  'qwerty123',
  'qwertyuiop',
  'aptech123',
  'abc12345',
  'letmein',
  'welcome123',
  'admin123',
  'iloveyou',
  'football',
  'monkey',
  'dragon',
  'princess',
]);

export function usernameError(value: string): string | null {
  if (!value) return 'Username is required.';
  if (!USERNAME_PATTERN.test(value)) {
    return 'Username must be 4-20 characters: letters, numbers or underscore only, with no spaces.';
  }
  return null;
}

export function emailError(value: string): string | null {
  const email = value.trim();
  if (!email) return 'Email is required.';
  if (!EMAIL_PATTERN.test(email)) return 'Please enter a valid email like aptech123@gmail.com';
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    return 'Only Gmail, Yahoo, Outlook and Hotmail addresses are accepted.';
  }
  return null;
}

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
}

export function phoneError(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 'Phone number is required.';
  if (!PHONE_PATTERN.test(digits)) return 'Use the Pakistani mobile format 03xx-xxxxxxx (11 digits).';
  if (REPEATED_DIGITS.test(digits) || SEQUENTIAL_DIGITS.test(digits)) {
    return 'This phone number looks invalid. Please enter your real mobile number.';
  }
  return null;
}

export interface PasswordCheck {
  id: 'length' | 'uppercase' | 'lowercase' | 'number' | 'special' | 'common';
  label: string;
  passed: boolean;
}

export function passwordChecks(password: string): PasswordCheck[] {
  const isCommon = COMMON_PASSWORDS.has(password.toLowerCase());
  return [
    { id: 'length', label: 'At least 12 characters', passed: password.length >= 12 },
    { id: 'uppercase', label: 'One uppercase letter (A-Z)', passed: /[A-Z]/.test(password) },
    { id: 'lowercase', label: 'One lowercase letter (a-z)', passed: /[a-z]/.test(password) },
    { id: 'number', label: 'One number (0-9)', passed: /\d/.test(password) },
    { id: 'special', label: 'One special character (! @ # $ % and more)', passed: /[^A-Za-z0-9\s]/.test(password) },
    { id: 'common', label: 'Not a common password', passed: password.length > 0 && !isCommon },
  ];
}

export function passwordMeetsRules(password: string): boolean {
  return passwordChecks(password).every((check) => check.passed);
}

export type StrengthLevel = 'Weak' | 'Medium' | 'Strong' | 'Out-Class';

export function passwordStrength(password: string): StrengthLevel {
  if (!password) return 'Weak';
  const classCount = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9\s]/].filter((rule) => rule.test(password)).length;
  const uniqueRatio = new Set(password).size / password.length;
  const score = Math.min(40, password.length * 2.5) + classCount * 10 + (uniqueRatio >= 0.6 ? 12 : 0);
  if (score >= 85 && password.length >= 16) return 'Out-Class';
  if (score >= 70) return 'Strong';
  if (score >= 45) return 'Medium';
  return 'Weak';
}
