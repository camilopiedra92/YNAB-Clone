'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { UpdateProfileInput, ChangePasswordInput } from '@/lib/schemas/auth';
import type { UserProfile } from './useProfile';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { update: updateSession } = useSession();
  const t = useTranslations('toasts');

  return useMutation({
    mutationKey: ['profile-update'],
    meta: {
      successMessage: t('profileUpdateSuccess'),
      errorMessage: t('profileUpdateError'),
    },

    mutationFn: async (data: UpdateProfileInput) => {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error updating profile');
      }
      return json as UserProfile;
    },

    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['profile'] });

      const previous = queryClient.getQueryData<UserProfile>(['profile']);

      queryClient.setQueryData<UserProfile>(['profile'], (old) => {
        if (!old) return old;
        return { ...old, name: vars.name, email: vars.email };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['profile'], context.previous);
      }
    },

    onSuccess: async (data) => {
      // Sync the session JWT with the new name — immediate sidebar update
      await updateSession({ name: data.name });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useChangePassword() {
  const t = useTranslations('toasts');

  return useMutation({
    mutationKey: ['password-change'],
    meta: {
      successMessage: t('passwordChangeSuccess'),
      errorMessage: t('passwordChangeError'),
    },
    retry: 0,

    mutationFn: async (data: ChangePasswordInput) => {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error changing password');
      }
      return json;
    },
  });
}

export function useUpdateLocale() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationKey: ['locale-update'],
    meta: {
      skipGlobalError: false,
    },

    mutationFn: async (locale: string) => {
      const res = await fetch('/api/user/locale', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error updating locale');
      }
      return json as { locale: string };
    },

    onMutate: async (locale) => {
      await queryClient.cancelQueries({ queryKey: ['profile'] });

      const previous = queryClient.getQueryData<UserProfile>(['profile']);

      queryClient.setQueryData<UserProfile>(['profile'], (old) => {
        if (!old) return old;
        return { ...old, locale };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['profile'], context.previous);
      }
    },

    onSuccess: () => {
      // Full page refresh to apply new locale everywhere (server components, layout, etc.)
      router.refresh();
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

