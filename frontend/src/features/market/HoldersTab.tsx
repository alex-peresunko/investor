import { AreaChart, DonutChart } from '@mantine/charts';
import {
  ColorSwatch,
  Grid,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { HolderGroup, HoldersReport } from '@/api/marketHooks';
import { signColor } from '@/components/Stat';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';

import { HOLDER_COLORS, HOLDERS, SourceNote, useCompact, useSignedCompact } from './common';

type Range = '1y' | '5y' | 'all';
type Mode = 'amount' | 'share';

const RANGE_YEARS: Record<Range, number | null> = { '1y': 1, '5y': 5, all: null };

function cssColor(color: string) {
  const [name, shade] = color.split('.');
  return `var(--mantine-color-${name}-${shade})`;
}

export function HoldersTab({ data }: { data: HoldersReport }) {
  const { t } = useTranslation();
  const compact = useCompact();
  const signed = useSignedCompact();
  const [group, setGroup] = useState<HolderGroup>('all');
  const [range, setRange] = useState<Range>('5y');
  const [mode, setMode] = useState<Mode>('share');

  const current = data.groups.find((g) => g.group === group) ?? data.groups[0];
  if (!current) return null;
  const present = HOLDERS.filter((h) =>
    data.history.some((p) => p.group === group && Number(p.by_holder[h] ?? 0) > 0),
  );
  const years = RANGE_YEARS[range];
  const from = years === null ? null : dayjs(data.day).subtract(years, 'year');
  const history = data.history
    .filter((p) => p.group === group && (from === null || !dayjs(p.day).isBefore(from)))
    .map((p) => ({
      day: formatDate(p.day),
      // Billions of UAH keep the axis readable.
      ...Object.fromEntries(present.map((h) => [h, Number(p.by_holder[h] ?? 0) / 1e9])),
    }));
  const slices = current.holders.filter((s) => Number(s.amount) > 0);
  const groups: { value: HolderGroup; label: string }[] = [
    { value: 'all', label: t('common.all') },
    { value: 'UAH', label: 'UAH' },
    { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EUR' },
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <SegmentedControl
          size="xs"
          value={group}
          onChange={(v) => setGroup(groups.find((g) => g.value === v)?.value ?? 'all')}
          data={groups}
        />
        <Text size="xs" c="dimmed">
          {t('market.holders.denomination')}
        </Text>
      </Group>
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder p="md" h="100%">
            <Text fw={600}>{t('market.holders.structure')}</Text>
            <Text size="xs" c="dimmed" mb="sm">
              {formatDate(data.day)}
            </Text>
            <Group justify="center">
              <DonutChart
                size={200}
                thickness={28}
                withTooltip
                tooltipDataSource="segment"
                chartLabel={compact(current.total, 'UAH')}
                valueFormatter={(v) => compact(v, 'UAH')}
                data={slices.map((s) => ({
                  name: t(`market.holder.${s.holder}`),
                  value: Number(s.amount),
                  color: HOLDER_COLORS[s.holder],
                }))}
              />
            </Group>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper withBorder h="100%">
            <Table.ScrollContainer minWidth={560}>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('market.holders.holder')}</Table.Th>
                    <Table.Th ta="right">{t('market.holders.amount')}</Table.Th>
                    <Table.Th ta="right">{t('market.holders.share')}</Table.Th>
                    <Table.Th ta="right" title={formatDate(data.month_base_day)}>
                      {t('market.holders.changeMonth')}
                    </Table.Th>
                    <Table.Th ta="right" title={formatDate(data.year_base_day)}>
                      {t('market.holders.changeYear')}
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {current.holders
                    .filter((s) => present.includes(s.holder))
                    .map((s) => (
                      <Table.Tr key={s.holder}>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <ColorSwatch size={10} color={cssColor(HOLDER_COLORS[s.holder])} />
                            {t(`market.holder.${s.holder}`)}
                          </Group>
                        </Table.Td>
                        <Table.Td ta="right">{compact(s.amount, 'UAH')}</Table.Td>
                        <Table.Td ta="right">{formatPercent(s.share)}</Table.Td>
                        <Table.Td ta="right" c={signColor(s.change_month ?? 0)}>
                          {signed(s.change_month, 'UAH')}
                        </Table.Td>
                        <Table.Td ta="right" c={signColor(s.change_year ?? 0)}>
                          {signed(s.change_year, 'UAH')}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  <Table.Tr fw={700}>
                    <Table.Td>{t('market.holders.total')}</Table.Td>
                    <Table.Td ta="right">{compact(current.total, 'UAH')}</Table.Td>
                    <Table.Td ta="right">{formatPercent(1)}</Table.Td>
                    <Table.Td ta="right" c={signColor(current.change_month ?? 0)}>
                      {signed(current.change_month, 'UAH')}
                    </Table.Td>
                    <Table.Td ta="right" c={signColor(current.change_year ?? 0)}>
                      {signed(current.change_year, 'UAH')}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            <Text size="xs" c="dimmed" px="md" pb="sm">
              {t('market.holders.changeHint', {
                month: formatDate(data.month_base_day),
                year: formatDate(data.year_base_day),
              })}
            </Text>
          </Paper>
        </Grid.Col>
      </Grid>
      <Paper withBorder p="md">
        <Group justify="space-between" mb="md">
          <Text fw={600}>{t('market.holders.history')}</Text>
          <Group>
            <SegmentedControl
              size="xs"
              value={mode}
              onChange={(v) => setMode(v === 'amount' ? 'amount' : 'share')}
              data={[
                { value: 'share', label: t('market.holders.modeShare') },
                { value: 'amount', label: t('market.holders.modeAmount') },
              ]}
            />
            <SegmentedControl
              size="xs"
              value={range}
              onChange={(v) => setRange(v === '1y' || v === 'all' ? v : '5y')}
              data={[
                { value: '1y', label: t('market.range.1y') },
                { value: '5y', label: t('market.range.5y') },
                { value: 'all', label: t('market.range.all') },
              ]}
            />
          </Group>
        </Group>
        <AreaChart
          h={320}
          data={history}
          dataKey="day"
          type={mode === 'share' ? 'percent' : 'stacked'}
          withLegend
          curveType="monotone"
          fillOpacity={0.6}
          strokeWidth={1}
          withDots={false}
          yAxisProps={{ width: 70 }}
          valueFormatter={(v) => t('market.billions', { value: formatNumber(v, 1) })}
          series={present.map((h) => ({
            name: h,
            label: t(`market.holder.${h}`),
            color: HOLDER_COLORS[h],
          }))}
        />
        <Group justify="space-between" mt="xs">
          <Text size="xs" c="dimmed">
            {t('market.holders.historyHint')}
          </Text>
          <SourceNote source={t('market.source.holders')} day={data.day} />
        </Group>
      </Paper>
    </Stack>
  );
}
