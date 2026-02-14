'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { RegisterSchema } from '@/lib/schemas/auth';
import type { z } from 'zod';

type RegisterInput = z.infer<typeof RegisterSchema>;

export function useRegisterMutation() {
    const t = useTranslations('toasts');
    return useMutation({
        mutationKey: ['auth-register'],
        meta: { errorMessage: t('registerError') },
        mutationFn: async (data: RegisterInput) => {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || 'Error al crear la cuenta');
            }

            return json;
        },
        retry: 0, // Don't retry registration on failure (likely validation error)
    });
}
