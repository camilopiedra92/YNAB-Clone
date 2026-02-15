'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { useRegisterMutation } from '@/hooks/useAuthMutations';
import { useTranslations } from 'next-intl';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { mutateAsync: register, isPending } = useRegisterMutation();
  const t = useTranslations('auth');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }

    try {
      // Register
      await register({ name, email, password });

      // Auto-login after registration
      const loginResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (loginResult?.error) {
        setError(t('accountCreatedLoginManually'));
        return;
      }

      router.push('/budgets');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('createAccountError'));
    }
  }

  return (
    <div className="w-full max-w-md px-6">
      {/* Logo / Title */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/10 mb-6">
          <UserPlus className="w-7 h-7 text-primary" strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-200">
          {t('createAccount')}
        </h1>
        <p className="text-gray-500 mt-2 text-sm">
          {t('createAccountSubtitle')}
        </p>
      </div>

      {/* Form Card */}
      <div className="glass-card">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium border border-red-500/20">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <label htmlFor="name" className="text-meta">
              {t('name')}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                required
                autoComplete="name"
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm font-medium
                  text-gray-200 placeholder:text-gray-600
                  focus:outline-none focus:border-primary/30
                  transition-all duration-200"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-meta">
              {t('email')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                required
                autoComplete="email"
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm font-medium
                  text-gray-200 placeholder:text-gray-600
                  focus:outline-none focus:border-primary/30
                  transition-all duration-200"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label htmlFor="password" className="text-meta">
              {t('password')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordPlaceholder')}
                required
                autoComplete="new-password"
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm font-medium
                  text-gray-200 placeholder:text-gray-600
                  focus:outline-none focus:border-primary/30
                  transition-all duration-200"
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-meta">
              {t('confirmPassword')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('confirmPasswordPlaceholder')}
                required
                autoComplete="new-password"
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm font-medium
                  text-gray-200 placeholder:text-gray-600
                  focus:outline-none focus:border-primary/30
                  transition-all duration-200"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 rounded-xl bg-primary text-white hover:bg-primary/90 text-sm font-bold
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2 transition-all"
          >
            {isPending ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                {t('createAccount')}
              </>
            )}
          </button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            {t('haveAccount')}{' '}
            <Link
              href="/auth/login"
              className="text-primary font-semibold hover:underline transition-colors"
            >
              {t('login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
