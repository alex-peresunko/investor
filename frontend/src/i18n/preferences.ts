import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '@/api/client';
import type { Language } from '@/api/types';

import { i18n } from './i18n';

const preferencesKey = ['preferences'] as const;

/** Loads the saved preferences and applies the saved language before resolving. */
export function usePreferences() {
  return useQuery({
    queryKey: preferencesKey,
    queryFn: async () => {
      const preferences = unwrap(await api.GET('/api/v1/preferences'));
      await i18n.changeLanguage(preferences.language);
      return preferences;
    },
    staleTime: Infinity,
    retry: false,
  });
}

export function useSetLanguage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (language: Language) =>
      unwrap(await api.PATCH('/api/v1/preferences', { body: { language } })),
    onSuccess: async (preferences) => {
      await i18n.changeLanguage(preferences.language);
      queryClient.setQueryData(preferencesKey, preferences);
    },
    onError: (error: Error) =>
      notifications.show({ color: 'red', title: i18n.t('notify.error'), message: error.message }),
  });
}

/** Saves the annual deposit rate, a fraction such as "0.12". */
export function useSetDepositRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (depositRate: string) =>
      unwrap(await api.PATCH('/api/v1/preferences', { body: { deposit_rate: depositRate } })),
    onSuccess: (preferences) => queryClient.setQueryData(preferencesKey, preferences),
    onError: (error: Error) =>
      notifications.show({ color: 'red', title: i18n.t('notify.error'), message: error.message }),
  });
}
