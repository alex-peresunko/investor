import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { expect, it } from 'vitest';

import { PeriodPicker } from './PeriodPicker';

function LocationProbe() {
  return <div data-testid="search">{useLocation().search}</div>;
}

it('applies a custom range after picking start and end dates', () => {
  render(
    <MantineProvider env="test">
      <MemoryRouter initialEntries={['/?start=2026-11-01&end=2026-11-21']}>
        <PeriodPicker />
        <LocationProbe />
      </MemoryRouter>
    </MantineProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /01\.11\.2026/ }));
  fireEvent.click(screen.getByRole('button', { name: '5 November 2026' }));
  // The first click must not reset the picker: the same dropdown accepts the end date.
  fireEvent.click(screen.getByRole('button', { name: '12 November 2026' }));
  expect(screen.getByTestId('search').textContent).toBe('?start=2026-11-05&end=2026-11-12');
});
