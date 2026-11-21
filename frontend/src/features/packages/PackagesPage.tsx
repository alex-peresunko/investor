import { Alert, Group, Loader, Paper, SegmentedControl, Stack, Title } from '@mantine/core';
import { useState } from 'react';

import { usePortfolioReport } from '@/api/reportHooks';
import { PeriodPicker, usePeriod } from '@/components/PeriodPicker';
import { LotsTable } from '@/features/reports/LotsTable';

export function PackagesPage() {
  const period = usePeriod();
  const report = usePortfolioReport(period);
  const [status, setStatus] = useState<'all' | 'open' | 'closed'>('all');
  const lots = (report.data?.lots ?? []).filter((lot) => {
    const open = Number(lot.open_quantity) > 0;
    return status === 'all' || (status === 'open') === open;
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Packages</Title>
        <Group>
          <SegmentedControl
            value={status}
            onChange={(v) => setStatus(v === 'open' || v === 'closed' ? v : 'all')}
            data={[
              { value: 'all', label: 'All' },
              { value: 'open', label: 'Open' },
              { value: 'closed', label: 'Closed' },
            ]}
          />
          <PeriodPicker />
        </Group>
      </Group>
      <Paper withBorder radius="md">
        {report.isPending ? (
          <Loader m="lg" />
        ) : report.isError ? (
          <Alert color="red">{report.error.message}</Alert>
        ) : (
          <LotsTable lots={lots} storageKey="table:packages" />
        )}
      </Paper>
    </Stack>
  );
}
