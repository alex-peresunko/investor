import {
  ActionIcon,
  Alert,
  Grid,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconDownload,
  IconCash,
  IconChartLine,
  IconCoin,
  IconPercentage,
  IconWallet,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import { PageTitle } from '@/components/PageTitle';
import { usePortfolioReport } from '@/api/reportHooks';
import { PeriodPicker, usePeriod } from '@/components/PeriodPicker';
import { PnlSplit, Stat } from '@/components/Stat';
import { LotsTable } from '@/features/reports/LotsTable';
import { MissedPaymentsAlert } from '@/features/upcoming/MissedPayments';
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
          <PageTitle page="dashboard">{t('dashboard.title')}</PageTitle>
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
      <MissedPaymentsAlert />
      {report.isPending ? (
        <Loader />
      ) : report.isError ? (
        <Alert color="red">{report.error.message}</Alert>
      ) : (
        <>
          <Grid>
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Stat
                icon={IconChartLine}
                label={t('stat.pnl')}
                help="pnl"
                amount={report.data.totals.pnl}
                signed
              >
                <PnlSplit
                  realized={report.data.realized}
                  unrealized={report.data.unrealized}
                  realizedXirr={{
                    usd: report.data.realized_xirr_usd,
                    uah: report.data.realized_xirr_uah,
                  }}
                />
              </Stat>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <SimpleGrid cols={{ base: 1, xs: 2 }} h="100%">
                <Stat
                  icon={IconWallet}
                  label={t('stat.currentValue')}
                  help="value"
                  amount={report.data.totals.closing_value}
                />
                <Stat
                  icon={IconCoin}
                  color="blue"
                  label={t('stat.invested')}
                  help="pnl"
                  amount={report.data.totals.invested}
                />
                <Stat
                  icon={IconCash}
                  color="teal"
                  label={t('stat.received')}
                  help="pnl"
                  amount={report.data.totals.received}
                />
                <Stat icon={IconPercentage} color="orange" label={t('stat.xirr')} help="xirr">
                  <Text fz={24} fw={800} lh={1.2}>
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
            </Grid.Col>
          </Grid>
          <ValueChart period={period} />
          <Paper withBorder>
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
