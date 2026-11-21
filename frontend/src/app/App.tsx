import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';

import { LanguageGate } from '@/i18n/LanguageGate';

import { queryClient } from './queryClient';
import { router } from './router';
import { theme } from './theme';

export function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <LanguageGate>
          <RouterProvider router={router} />
        </LanguageGate>
      </QueryClientProvider>
    </MantineProvider>
  );
}
