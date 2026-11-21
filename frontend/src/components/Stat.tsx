import { Group, Paper, SimpleGrid, Text, ThemeIcon } from '@mantine/core';
import type { Icon } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { formatMoney, formatPercent } from '@/lib/format';

import { type HelpSection, HelpLink, type HelpTopic } from './HelpLink';

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
  icon: Icon;
  /** Mantine color name for the icon and the top accent; signed stats follow the sign instead. */
  color?: string;
  amount?: AmountPair;
  signed?: boolean;
  help?: HelpSection | HelpTopic;
  children?: ReactNode;
}

/** KPI card: USD first (the user's planning currency), UAH below. */
export function Stat({
  label,
  icon: Icon,
  color = 'brand',
  amount,
  signed = false,
  help,
  children,
}: StatProps) {
  const accent = (signed && amount && signColor(amount.usd)) || color;
  return (
    <Paper
      withBorder
      p="md"
      h="100%"
      className="stat"
      style={{
        '--stat-from': `var(--mantine-color-${accent}-4)`,
        '--stat-to': `var(--mantine-color-${accent}-7)`,
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
        <Group gap={4} wrap="nowrap">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts={0.4}>
            {label}
          </Text>
          {help && <HelpLink to={help} size="xs" />}
        </Group>
        <ThemeIcon variant="light" color={accent} size={32} radius="md">
          <Icon size={18} />
        </ThemeIcon>
      </Group>
      {amount && (
        <>
          <Text fz={24} fw={800} lh={1.2}>
            <MoneyText value={amount.usd} currency="USD" signed={signed} />
          </Text>
          <Text size="sm" c="dimmed">
            <MoneyText value={amount.uah} currency="UAH" signed={signed} />
          </Text>
        </>
      )}
      {children}
    </Paper>
  );
}

/**
 * Realized / unrealized tiles under the P&L figure; they sum to the total shown above. The
 * realized tile also shows the annual return (XIRR) of the closed packages.
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
  const { t } = useTranslation();
  return (
    <SimpleGrid cols={2} spacing="xs" mt="md">
      <SplitTile label={t('stat.realized')} hint={t('stat.realizedHint')} amount={realized}>
        {realizedXirr.usd !== null && (
          <Text size="xs" c="dimmed" mt={4} title={t('stat.realizedXirrHint')}>
            {t('stat.xirrLine', {
              usd: formatPercent(realizedXirr.usd),
              uah: formatPercent(realizedXirr.uah),
            })}
          </Text>
        )}
      </SplitTile>
      <SplitTile label={t('stat.unrealized')} hint={t('stat.unrealizedHint')} amount={unrealized} />
    </SimpleGrid>
  );
}

function SplitTile({
  label,
  hint,
  amount,
  children,
}: {
  label: string;
  hint: string;
  amount: AmountPair;
  children?: ReactNode;
}) {
  return (
    <Paper p="sm" radius="md" bg="var(--mantine-color-default-hover)">
      <Group gap={4} wrap="nowrap">
        <Text size="xs" c="dimmed" title={hint}>
          {label}
        </Text>
        <HelpLink to="realized" size="xs" />
      </Group>
      <Text size="lg" fw={700} lh={1.3}>
        <MoneyText value={amount.usd} currency="USD" signed />
      </Text>
      <Text size="xs" c="dimmed">
        <MoneyText value={amount.uah} currency="UAH" signed />
      </Text>
      {children}
    </Paper>
  );
}
