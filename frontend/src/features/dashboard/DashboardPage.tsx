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

import { usePortfolioReport } from '@/api/reportHooks';
import { PeriodPicker, usePeriod } from '@/components/PeriodPicker';
import { Stat } from '@/components/Stat';
import { LotsTable } from '@/features/reports/LotsTable';
import { ValueChart } from '@/features/reports/ValueChart';
import { formatDate, formatPercent } from '@/lib/format';

export function DashboardPage() {
  const period = usePeriod();
  const report = usePortfolioReport(period);
  const exportQuery = new URLSearchParams(
    Object.entries(period).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Dashboard</Title>
          {report.data && (
            <Text size="sm" c="dimmed">
              {formatDate(report.data.start)} – {formatDate(report.data.end)}
            </Text>
          )}
        </div>
        <Group>
          <PeriodPicker />
          <Tooltip label="Download P&L for this period as Excel">
            <ActionIcon
              variant="default"
              size="lg"
              component="a"
              href={`/api/v1/export/portfolio.xlsx${exportQuery ? `?${exportQuery}` : ''}`}
              aria-label="Export P&L"
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
            <Stat label="Profit / loss" amount={report.data.totals.pnl} signed />
            <Stat label="Current value" amount={report.data.totals.closing_value} />
            <Stat label="Invested" amount={report.data.totals.invested} />
            <Stat label="Received" amount={report.data.totals.received} />
            <Stat label="Annual return (XIRR)">
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
              Packages
            </Text>
            <LotsTable lots={report.data.lots} />
          </Paper>
        </>
      )}
    </Stack>
  );
}
