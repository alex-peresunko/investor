import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { api } from '@/api/client';
import { queryClient } from '@/app/queryClient';
import { i18n } from '@/i18n/i18n';

import { App } from './App';

/** Serves the saved preferences; every other request fails, which the pages show as an error. */
function savedLanguage(language: 'en' | 'uk') {
  vi.spyOn(api, 'GET').mockImplementation(
    async (path: string) =>
      (path === '/api/v1/preferences'
        ? { data: { language }, response: new Response() }
        : { error: { detail: 'offline' }, response: new Response(null, { status: 503 }) }) as never,
  );
}

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  queryClient.clear();
  await act(() => i18n.changeLanguage('en'));
});

it('renders the shell in English by default', async () => {
  savedLanguage('en');
  render(<App />);
  expect(await screen.findByRole('link', { name: /Packages/ })).toBeTruthy();
  expect(screen.getAllByText('Investor').length).toBeGreaterThan(0);
});

it('opens in the saved language', async () => {
  savedLanguage('uk');
  render(<App />);
  expect(await screen.findByRole('link', { name: /Пакети/ })).toBeTruthy();
  expect(document.documentElement.lang).toBe('uk');
});

it('switches language and saves the choice', async () => {
  savedLanguage('en');
  const patch = vi
    .spyOn(api, 'PATCH')
    .mockImplementation(
      async () => ({ data: { language: 'uk' }, response: new Response() }) as never,
    );
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Language' }));
  fireEvent.click(await screen.findByText('Українська'));

  expect(await screen.findByRole('link', { name: /Облігації/ })).toBeTruthy();
  expect(patch).toHaveBeenCalledWith('/api/v1/preferences', { body: { language: 'uk' } });
});
