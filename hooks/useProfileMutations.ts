'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import type { UpdateProfileInput, ChangePasswordInput } from '@/lib/schemas/auth';
import type { UserProfile } from './useProfile';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { update: updateSession } = useSession();

  return useMutation({
    mutationKey: ['profile-update'],
    meta: {
      successMessage: 'Perfil actualizado',
      errorMessage: 'Error al actualizar el perfil',
    },

    mutationFn: async (data: UpdateProfileInput) => {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al actualizar el perfil');
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
  return useMutation({
    mutationKey: ['password-change'],
    meta: {
      successMessage: 'Contraseña actualizada',
      errorMessage: 'Error al cambiar la contraseña',
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
        throw new Error(json.error || 'Error al cambiar la contraseña');
      }
      return json;
    },
  });
}
