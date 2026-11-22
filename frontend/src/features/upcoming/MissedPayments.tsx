import { Alert, Anchor, Badge, Button, Paper, Stack, Table, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { type MissedPayment, useMissed } from '@/api/reportHooks';
import { HelpLink } from '@/components/HelpLink';
import { type PaymentDraft, PaymentFormModal } from '@/features/operations/PaymentFormModal';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';

/** Dashboard banner; renders nothing when every due payment is recorded. */
export function MissedPaymentsAlert() {
  const { t } = useTranslation();
  const missed = useMissed();
  const count = missed.data?.length ?? 0;
  if (count === 0) return null;
  return (
    <Alert color="orange" icon={<IconAlertTriangle size={18} />} title={t('missed.alertTitle')}>
      {t('missed.alertBody', { count })}{' '}
      <Anchor component={Link} to="/upcoming" size="sm">
        {t('missed.review')}
      </Anchor>
    </Alert>
  );
}

const draftOf = (item: MissedPayment): PaymentDraft => ({
  instrument_id: item.instrument_id,
  currency: item.currency,
  kind: item.kind,
  pay_date: item.pay_date,
  total_amount: item.expected,
});

/** Table of due but unrecorded payments, each with a button that opens a prefilled payment form. */
export function MissedPaymentsTable() {
  const { t } = useTranslation();
  const missed = useMissed();
  const [draft, setDraft] = useState<PaymentDraft | null>(null);
  const items = missed.data ?? [];
  if (items.length === 0) return null;
  return (
    <Paper withBorder p="md" style={{ borderColor: 'var(--mantine-color-orange-5)' }}>
      <Stack gap="sm">
        <div>
          <Text fw={600} c="orange.8">
            {t('missed.title')} <HelpLink to="upcoming" size="xs" />
          </Text>
          <Text size="sm" c="dimmed">
            {t('missed.subtitle')}
          </Text>
        </div>
        <Table.ScrollContainer minWidth={700}>
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('common.date')}</Table.Th>
                <Table.Th>{t('common.type')}</Table.Th>
                <Table.Th>{t('common.bond')}</Table.Th>
                <Table.Th ta="right">{t('common.bondsHeld')}</Table.Th>
                <Table.Th ta="right">{t('upcoming.expected')}</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((item) => (
                <Table.Tr key={`${item.instrument_id}-${item.kind}-${item.pay_date}`}>
                  <Table.Td>{formatDate(item.pay_date)}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={item.kind === 'coupon' ? 'teal' : 'grape'}>
                      {t(`kind.${item.kind}`)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {item.isin}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {item.name}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">{formatNumber(item.quantity, 0)}</Table.Td>
                  <Table.Td ta="right" fw={600}>
                    {formatMoney(item.expected, item.currency)}
                  </Table.Td>
                  <Table.Td ta="right">
                    <Button size="xs" variant="light" onClick={() => setDraft(draftOf(item))}>
                      {t('missed.record')}
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Stack>
      {draft && <PaymentFormModal payment={null} draft={draft} onClose={() => setDraft(null)} />}
    </Paper>
  );
}
