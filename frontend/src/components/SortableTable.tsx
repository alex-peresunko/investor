import { Table, type TableThProps, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconSelector } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

export type SortValue = string | number | null | undefined;
export type SortDirection = 'asc' | 'desc';
export type SortColumns<T, K extends string> = Record<K, (row: T) => SortValue>;

/** Empty values (null, undefined, NaN) go last in both directions. */
function sortBy<T>(rows: readonly T[], value: (row: T) => SortValue, direction: SortDirection) {
  const sign = direction === 'asc' ? 1 : -1;
  const empty = (v: SortValue) => v === null || v === undefined || Number.isNaN(v);
  return [...rows].sort((ra, rb) => {
    const a = value(ra);
    const b = value(rb);
    if (empty(a) || empty(b)) return Number(empty(a)) - Number(empty(b));
    if (typeof a === 'number' && typeof b === 'number') return sign * (a - b);
    return sign * String(a).localeCompare(String(b), undefined, { numeric: true });
  });
}

/**
 * Clicking a header cycles ascending → descending → default. The default order is `defaultKey`
 * ascending; it also breaks ties of the chosen column.
 */
export function useSortedRows<T, K extends string>(
  rows: readonly T[],
  columns: SortColumns<T, K>,
  defaultKey: NoInfer<K>,
) {
  const [sort, setSort] = useState<{ key: K; direction: SortDirection } | null>(null);
  const sorted = useMemo(() => {
    const byDefault = sortBy(rows, columns[defaultKey], 'asc');
    return sort ? sortBy(byDefault, columns[sort.key], sort.direction) : byDefault;
  }, [rows, columns, defaultKey, sort]);

  const th = (key: K) => ({
    direction: sort?.key === key ? sort.direction : null,
    onSort: () =>
      setSort(
        sort?.key !== key
          ? { key, direction: 'asc' }
          : sort.direction === 'asc'
            ? { key, direction: 'desc' }
            : null,
      ),
  });
  return { rows: sorted, th };
}

interface SortThProps extends TableThProps {
  direction: SortDirection | null;
  onSort: () => void;
}

export function SortTh({ direction, onSort, children, ...rest }: SortThProps) {
  const Icon =
    direction === 'asc' ? IconChevronUp : direction === 'desc' ? IconChevronDown : IconSelector;
  return (
    <Table.Th
      aria-sort={
        direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined
      }
      {...rest}
    >
      <UnstyledButton
        onClick={onSort}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          font: 'inherit',
          fontWeight: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
        <Icon size={14} style={{ opacity: direction ? 1 : 0.35 }} />
      </UnstyledButton>
    </Table.Th>
  );
}
