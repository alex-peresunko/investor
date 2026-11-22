import { Group, Loader, NumberInput, Paper, Table, Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type BenchmarkReport, type Period, useBenchmark } from '@/api/reportHooks';
import { HelpLink } from '@/components/HelpLink';
import { MoneyText } from '@/components/Stat';
import { usePreferences, useSetDepositRate } from '@/i18n/preferences';
import { formatPercent } from '@/lib/format';

type Alternative = BenchmarkReport['bonds'];

/** Percent as typed (15,5) to the backend's fraction ("0.1550"); null when not a valid rate. */
export function toFraction(percent: string | number): string | null {
  const n = typeof percent === 'number' ? percent : Number(percent);
  if (percent === '' || !Number.isFinite(n) || n < 0 || n > 100) return null;
  return (n / 100).toFixed(4);
}

export function BenchmarkCard({ period }: { period: Period }) {
  const { t } = useTranslation();
  const saved = usePreferences().data?.deposit_rate;
  const [percent, setPercent] = useState<string | number>('');
  const loaded = useRef(false);
  useEffect(() => {
    if (saved === undefined || loaded.current) return;
    loaded.current = true;
    setPercent(Math.round(Number(saved) * 10000) / 100);
  }, [saved]);
  const [debounced] = useDebouncedValue(percent, 400);
  const rate = toFraction(debounced);
  const benchmark = useBenchmark(period, rate);
  const setDepositRate = useSetDepositRate();
  const { mutate } = setDepositRate;
  useEffect(() => {
    if (rate !== null && saved !== undefined && Number(rate) !== Number(saved)) mutate(rate);
  }, [rate, saved, mutate]);

  const data = benchmark.data;
  return (
    <Paper withBorder>
      <Group justify="space-between" p="md" pb={0} align="flex-end">
        <Group gap={4}>
          <Text fw={600}>{t('benchmark.title')}</Text>
          <HelpLink to="benchmark" />
          {benchmark.isFetching && <Loader size="xs" ml="xs" />}
        </Group>
        <NumberInput
          label={t('benchmark.depositRate')}
          value={percent}
          onChange={setPercent}
          error={percent !== '' && toFraction(percent) === null}
          min={0}
          max={100}
          decimalScale={2}
          decimalSeparator=","
          suffix=" %"
          hideControls
          w={160}
        />
      </Group>
      {benchmark.isError ? (
        <Text c="red" p="md">
          {benchmark.error.message}
        </Text>
      ) : data ? (
        <Table.ScrollContainer minWidth={560}>
          <Table verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('benchmark.option')}</Table.Th>
                <Table.Th ta="right">{t('benchmark.pnl')}</Table.Th>
                <Table.Th ta="right">{t('benchmark.xirr')}</Table.Th>
                <Table.Th ta="right">{t('benchmark.bondsAhead')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Row label={t('benchmark.bonds')} row={data.bonds} />
              <Row label={t('benchmark.usdCash')} row={data.usd_cash} bonds={data.bonds} />
              <Row
                label={t('benchmark.uahDeposit', { rate: formatPercent(data.deposit_rate) })}
                row={data.uah_deposit}
                bonds={data.bonds}
              />
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : (
        <Loader m="md" />
      )}
    </Paper>
  );
}

function Row({ label, row, bonds }: { label: string; row: Alternative; bonds?: Alternative }) {
  return (
    <Table.Tr fw={bonds ? undefined : 600}>
      <Table.Td>{label}</Table.Td>
      <Table.Td ta="right">
        <Pair usd={row.pnl.usd} uah={row.pnl.uah} />
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm">{formatPercent(row.xirr_usd)} USD</Text>
        <Text size="xs" c="dimmed">
          {formatPercent(row.xirr_uah)} UAH
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        {bonds ? (
          <Pair
            usd={Number(bonds.pnl.usd) - Number(row.pnl.usd)}
            uah={Number(bonds.pnl.uah) - Number(row.pnl.uah)}
          />
        ) : (
          '—'
        )}
      </Table.Td>
    </Table.Tr>
  );
}

function Pair({ usd, uah }: { usd: string | number; uah: string | number }) {
  return (
    <>
      <Text size="sm">
        <MoneyText value={usd} currency="USD" signed />
      </Text>
      <Text size="xs" c="dimmed">
        <MoneyText value={uah} currency="UAH" signed />
      </Text>
    </>
  );
}
