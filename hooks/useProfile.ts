'use client';

import { useQuery } from '@tanstack/react-query';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  locale: string;
  createdAt: string;
}

export function useProfile() {
  return useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await fetch('/api/user/profile');
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — profile data rarely changes
  });
}
