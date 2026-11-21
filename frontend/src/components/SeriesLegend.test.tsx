import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';

import { SeriesLegend, useSeriesToggle } from './SeriesLegend';

const SERIES = [
  { name: 'a', label: 'Alpha', color: 'teal.6' },
  { name: 'b', label: 'Beta', color: 'grape.6' },
];

function Harness() {
  const { visible, isVisible, toggle } = useSeriesToggle('test-chart', SERIES);
  return (
    <MantineProvider env="test">
      <SeriesLegend series={SERIES} isVisible={isVisible} onToggle={toggle} />
      <div data-testid="visible">{visible.map((s) => s.name).join(',')}</div>
    </MantineProvider>
  );
}

beforeEach(() => window.localStorage.clear());

it('toggles series, keeps at least one, and remembers the selection', () => {
  const { unmount } = render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Alpha' }));
  expect(screen.getByTestId('visible').textContent).toBe('b');
  fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
  expect(screen.getByTestId('visible').textContent).toBe('b');
  unmount();

  render(<Harness />);
  expect(screen.getByTestId('visible').textContent).toBe('b');
  expect(screen.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed')).toBe('false');
});
