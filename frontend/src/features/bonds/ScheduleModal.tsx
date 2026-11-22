import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Table,
  Text,
} from '@mantine/core';
import { IconPlus, IconRefresh, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useRegenerateSchedule, useReplaceSchedule, useSchedule } from '@/api/hooks';
import type { Instrument, ScheduledPaymentInput } from '@/api/types';
import { DateField } from '@/components/DateField';
import { MoneyInput } from '@/components/MoneyInput';

interface Row {
  key: number;
  kind: 'coupon' | 'redemption';
  pay_date: string | null;
  amount_per_unit: number | string;
}

interface Props {
  instrument: Instrument;
  onClose: () => void;
}

export function ScheduleModal({ instrument, onClose }: Props) {
  const { t } = useTranslation();
  const schedule = useSchedule(instrument.id);
  return (
    <Modal
      opened
      onClose={onClose}
      title={t('schedule.title', { isin: instrument.isin })}
      size="xl"
    >
      {schedule.isPending ? (
        <Loader />
      ) : schedule.isError ? (
        <Alert color="red">{schedule.error.message}</Alert>
      ) : (
        <ScheduleEditor
          key={schedule.dataUpdatedAt}
          instrument={instrument}
          initial={schedule.data.map((item, index) => ({
            key: index,
            kind: item.kind,
            pay_date: item.pay_date,
            amount_per_unit: Number(item.amount_per_unit),
          }))}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function ScheduleEditor({
  instrument,
  initial,
  onClose,
}: {
  instrument: Instrument;
  initial: Row[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>(initial);
  const replace = useReplaceSchedule();
  const regenerate = useRegenerateSchedule();
  const update = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const valid = rows.every((r) => r.pay_date && Number(r.amount_per_unit) > 0);

  const save = async () => {
    const items: ScheduledPaymentInput[] = rows.map((r) => ({
      kind: r.kind,
      pay_date: r.pay_date ?? '',
      amount_per_unit: String(r.amount_per_unit),
    }));
    await replace.mutateAsync({ id: instrument.id, items });
    onClose();
  };

  return (
    <>
      <Text size="sm" c="dimmed" mb="sm">
        {t('schedule.hint')}
      </Text>
      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('common.type')}</Table.Th>
            <Table.Th>{t('common.date')}</Table.Th>
            <Table.Th>
              {t('schedule.amountPerBond', {
                currency: t(`currencyUnit.${instrument.currency}`),
              })}
            </Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.key}>
              <Table.Td>
                <Select
                  data={[
                    { value: 'coupon', label: t('kind.coupon') },
                    { value: 'redemption', label: t('kind.redemption') },
                  ]}
                  value={row.kind}
                  allowDeselect={false}
                  onChange={(v) =>
                    update(row.key, { kind: v === 'redemption' ? 'redemption' : 'coupon' })
                  }
                />
              </Table.Td>
              <Table.Td>
                <DateField
                  value={row.pay_date}
                  onChange={(v) => update(row.key, { pay_date: v })}
                />
              </Table.Td>
              <Table.Td>
                <MoneyInput
                  decimalScale={6}
                  value={row.amount_per_unit}
                  onChange={(v) => update(row.key, { amount_per_unit: v })}
                />
              </Table.Td>
              <Table.Td>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label={t('schedule.removeRow')}
                  onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                >
                  <IconX size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Group justify="space-between" mt="md">
        <Group>
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() =>
              setRows((current) => [
                ...current,
                {
                  key: Math.max(0, ...current.map((r) => r.key)) + 1,
                  kind: 'coupon',
                  pay_date: null,
                  amount_per_unit: '',
                },
              ])
            }
          >
            {t('schedule.addRow')}
          </Button>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            loading={regenerate.isPending}
            onClick={() => regenerate.mutate(instrument.id)}
          >
            {t('schedule.generate')}
          </Button>
        </Group>
        <Group>
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} disabled={!valid} loading={replace.isPending}>
            {t('schedule.save')}
          </Button>
        </Group>
      </Group>
    </>
  );
}
