import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { App } from './App';

it('renders the shell with navigation', () => {
  render(<App />);
  expect(screen.getAllByText('Investor').length).toBeGreaterThan(0);
  expect(screen.getByRole('link', { name: /Packages/ })).toBeTruthy();
});
