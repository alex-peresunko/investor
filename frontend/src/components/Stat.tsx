import { Group, Paper, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';

import { formatMoney, formatPercent } from '@/lib/format';

interface AmountPair {
  uah: string;
  usd: string;
}

/** Text color for a signed amount; zero stays neutral. */
export function signColor(value: number | string): string | undefined {
  const n = Number(value);
  if (n > 0) return 'teal';
  if (n < 0) return 'red';
  return undefined;
}

export function MoneyText({
  value,
  currency,
  signed = false,
}: {
  value: number | string;
  currency: 'UAH' | 'USD';
  signed?: boolean;
}) {
  const n = Number(value);
  const text = formatMoney(n, currency);
  return (
    <Text span inherit c={signed ? signColor(n) : undefined}>
      {signed && n > 0 ? `+${text}` : text}
    </Text>
  );
}

interface StatProps {
  label: string;
  amount?: AmountPair;
  signed?: boolean;
  children?: ReactNode;
}

/** KPI card: USD first (the user's planning currency), UAH below. */
export function Stat({ label, amount, signed = false, children }: StatProps) {
  return (
    <Paper withBorder radius="md" p="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      {amount && (
        <>
          <Text fz={22} fw={700} mt={4}>
            <MoneyText value={amount.usd} currency="USD" signed={signed} />
          </Text>
          <Group gap={4}>
            <Text size="sm" c="dimmed">
              <MoneyText value={amount.uah} currency="UAH" signed={signed} />
            </Text>
          </Group>
        </>
      )}
      {children}
    </Paper>
  );
}

/**
 * Realized / unrealized lines under the P&L figure; they sum to the total shown above. The
 * realized line also shows the annual return (XIRR) of the closed packages.
 */
export function PnlSplit({
  realized,
  unrealized,
  realizedXirr,
}: {
  realized: AmountPair;
  unrealized: AmountPair;
  realizedXirr: { usd: string | null; uah: string | null };
}) {
  return (
    <Stack
      gap={2}
      mt="xs"
      pt="xs"
      style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
    >
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="xs" c="dimmed" title="Sold or redeemed packages">
          Realized
        </Text>
        <Text size="sm" fw={500}>
          <MoneyText value={realized.usd} currency="USD" signed />
        </Text>
      </Group>
      {realizedXirr.usd !== null && (
        <Text size="xs" c="dimmed" ta="right" title="Annual return (XIRR) of closed packages">
          {formatPercent(realizedXirr.usd)} p.a. USD · {formatPercent(realizedXirr.uah)} UAH
        </Text>
      )}
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="xs" c="dimmed" title="Packages still held">
          Unrealized
        </Text>
        <Text size="sm" fw={500}>
          <MoneyText value={unrealized.usd} currency="USD" signed />
        </Text>
      </Group>
    </Stack>
  );
}
