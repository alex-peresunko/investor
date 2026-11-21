import { MantineProvider, Table } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { type SortColumns, SortTh, useSortedRows } from './SortableTable';

interface Row {
  id: string;
  date: string;
  amount: number | null;
}

const ROWS: Row[] = [
  { id: 'b', date: '2026-03-01', amount: 5 },
  { id: 'c', date: '2026-01-01', amount: null },
  { id: 'a', date: '2026-02-01', amount: 20 },
  { id: 'd', date: '2026-04-01', amount: 5 },
];

const COLUMNS = {
  date: (r) => r.date,
  amount: (r) => r.amount,
} satisfies SortColumns<Row, string>;

function Harness() {
  const sort = useSortedRows(ROWS, COLUMNS, 'date');
  return (
    <MantineProvider env="test">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <SortTh {...sort.th('date')}>Date</SortTh>
            <SortTh {...sort.th('amount')}>Amount</SortTh>
          </Table.Tr>
        </Table.Thead>
      </Table>
      <div data-testid="order">{sort.rows.map((r) => r.id).join('')}</div>
    </MantineProvider>
  );
}

it('cycles ascending, descending, default; empties last; ties in date order', () => {
  render(<Harness />);
  const order = () => screen.getByTestId('order').textContent;
  const amount = screen.getByRole('button', { name: 'Amount' });

  expect(order()).toBe('cabd');
  fireEvent.click(amount);
  expect(order()).toBe('bdac');
  const header = () => screen.getByRole('columnheader', { name: 'Amount' });
  expect(header().getAttribute('aria-sort')).toBe('ascending');
  fireEvent.click(amount);
  expect(order()).toBe('abdc');
  fireEvent.click(amount);
  expect(order()).toBe('cabd');
  expect(header().getAttribute('aria-sort')).toBeNull();
});
