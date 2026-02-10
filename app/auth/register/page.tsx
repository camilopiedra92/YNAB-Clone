'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, Mail, Lock, User, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);

    try {
      // Register
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Error al crear la cuenta');
        setLoading(false);
        return;
      }

      // Auto-login after registration
      const loginResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (loginResult?.error) {
        setError('Cuenta creada. Por favor inicia sesión manualmente.');
        setLoading(false);
        return;
      }

      router.push('/budget');
      router.refresh();
    } catch {
      setError('Error al crear la cuenta');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md px-6">
      {/* Logo / Title */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl neu-raised mb-6">
          <UserPlus className="w-7 h-7 text-primary" strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">
          Crear Cuenta
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Empieza a controlar tu presupuesto
        </p>
      </div>

      {/* Form Card */}
      <div className="neu-card">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-500 text-sm font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <label htmlFor="name" className="text-meta">
              Nombre
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                required
                autoComplete="name"
                className="w-full pl-10 pr-4 py-3 rounded-xl neu-inset-sm text-sm font-medium
                  text-foreground placeholder:text-muted-foreground/50
                  focus:outline-none focus:ring-2 focus:ring-primary/30
                  transition-all duration-200 bg-background"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-meta">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoComplete="email"
                className="w-full pl-10 pr-4 py-3 rounded-xl neu-inset-sm text-sm font-medium
                  text-foreground placeholder:text-muted-foreground/50
                  focus:outline-none focus:ring-2 focus:ring-primary/30
                  transition-all duration-200 bg-background"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label htmlFor="password" className="text-meta">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                autoComplete="new-password"
                className="w-full pl-10 pr-4 py-3 rounded-xl neu-inset-sm text-sm font-medium
                  text-foreground placeholder:text-muted-foreground/50
                  focus:outline-none focus:ring-2 focus:ring-primary/30
                  transition-all duration-200 bg-background"
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-meta">
              Confirmar Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                required
                autoComplete="new-password"
                className="w-full pl-10 pr-4 py-3 rounded-xl neu-inset-sm text-sm font-medium
                  text-foreground placeholder:text-muted-foreground/50
                  focus:outline-none focus:ring-2 focus:ring-primary/30
                  transition-all duration-200 bg-background"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl neu-btn-primary text-sm font-bold
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Crear Cuenta
              </>
            )}
          </button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link
              href="/auth/login"
              className="text-primary font-semibold hover:underline transition-colors"
            >
              Inicia Sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
