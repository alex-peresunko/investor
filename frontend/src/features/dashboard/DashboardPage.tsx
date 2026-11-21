import {
  ActionIcon,
  Alert,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import { usePortfolioReport } from '@/api/reportHooks';
import { PeriodPicker, usePeriod } from '@/components/PeriodPicker';
import { PnlSplit, Stat } from '@/components/Stat';
import { LotsTable } from '@/features/reports/LotsTable';
import { ValueChart } from '@/features/reports/ValueChart';
import { formatDate, formatPercent } from '@/lib/format';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const period = usePeriod();
  const report = usePortfolioReport(period);
  const exportQuery = new URLSearchParams([
    ...Object.entries(period).filter((e): e is [string, string] => Boolean(e[1])),
    ['lang', i18n.language],
  ]).toString();

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>{t('dashboard.title')}</Title>
          {report.data && (
            <Text size="sm" c="dimmed">
              {formatDate(report.data.start)} – {formatDate(report.data.end)}
            </Text>
          )}
        </div>
        <Group>
          <PeriodPicker />
          <Tooltip label={t('dashboard.export')}>
            <ActionIcon
              variant="default"
              size="lg"
              component="a"
              href={`/api/v1/export/portfolio.xlsx?${exportQuery}`}
              aria-label={t('dashboard.exportAria')}
            >
              <IconDownload size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      {report.isPending ? (
        <Loader />
      ) : report.isError ? (
        <Alert color="red">{report.error.message}</Alert>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, xs: 2, md: 5 }}>
            <Stat label={t('stat.pnl')} amount={report.data.totals.pnl} signed>
              <PnlSplit
                realized={report.data.realized}
                unrealized={report.data.unrealized}
                realizedXirr={{
                  usd: report.data.realized_xirr_usd,
                  uah: report.data.realized_xirr_uah,
                }}
              />
            </Stat>
            <Stat label={t('stat.currentValue')} amount={report.data.totals.closing_value} />
            <Stat label={t('stat.invested')} amount={report.data.totals.invested} />
            <Stat label={t('stat.received')} amount={report.data.totals.received} />
            <Stat label={t('stat.xirr')}>
              <Text fz={22} fw={700} mt={4}>
                {formatPercent(report.data.xirr_usd)}{' '}
                <Text span size="sm" c="dimmed">
                  USD
                </Text>
              </Text>
              <Text size="sm" c="dimmed">
                {formatPercent(report.data.xirr_uah)} UAH
              </Text>
            </Stat>
          </SimpleGrid>
          <ValueChart period={period} />
          <Paper withBorder radius="md">
            <Text fw={600} p="md" pb={0}>
              {t('dashboard.packages')}
            </Text>
            <LotsTable lots={report.data.lots} storageKey="table:dashboard-packages" />
          </Paper>
        </>
      )}
    </Stack>
  );
}
