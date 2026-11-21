import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Loader,
  Paper,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconCalendarEvent, IconPencil, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';

import { useDeleteInstrument, useInstruments } from '@/api/hooks';
import type { Instrument } from '@/api/types';
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';

import { BondFormModal } from './BondFormModal';
import { ScheduleModal } from './ScheduleModal';

const FREQUENCY_LABEL: Record<number, string> = {
  0: 'Zero-coupon',
  1: 'Annual',
  2: 'Semi-annual',
  4: 'Quarterly',
  12: 'Monthly',
};

export function BondsPage() {
  const instruments = useInstruments();
  const remove = useDeleteInstrument();
  // undefined = closed, null = new bond.
  const [editing, setEditing] = useState<Instrument | null | undefined>(undefined);
  const [scheduleFor, setScheduleFor] = useState<Instrument | null>(null);

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Bonds</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing(null)}>
          Add bond
        </Button>
      </Group>
      <Paper withBorder radius="md">
        {instruments.isPending ? (
          <Loader m="lg" />
        ) : instruments.isError ? (
          <Alert color="red">{instruments.error.message}</Alert>
        ) : instruments.data.length === 0 ? (
          <Text c="dimmed" p="lg">
            No bonds yet. Add one to start recording purchases.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={800}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ISIN</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th ta="right">Face value</Table.Th>
                  <Table.Th ta="right">Coupon</Table.Th>
                  <Table.Th>Frequency</Table.Th>
                  <Table.Th>Issued</Table.Th>
                  <Table.Th>Maturity</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {instruments.data.map((bond) => (
                  <Table.Tr key={bond.id}>
                    <Table.Td ff="monospace">{bond.isin}</Table.Td>
                    <Table.Td>{bond.name}</Table.Td>
                    <Table.Td ta="right">{formatMoney(bond.face_value, 'UAH')}</Table.Td>
                    <Table.Td ta="right">{formatPercent(bond.coupon_rate)}</Table.Td>
                    <Table.Td>{FREQUENCY_LABEL[bond.coupon_frequency]}</Table.Td>
                    <Table.Td>{formatDate(bond.issue_date)}</Table.Td>
                    <Table.Td>{formatDate(bond.maturity_date)}</Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Tooltip label="Payment schedule">
                          <ActionIcon
                            variant="subtle"
                            onClick={() => setScheduleFor(bond)}
                            aria-label="Payment schedule"
                          >
                            <IconCalendarEvent size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Edit">
                          <ActionIcon
                            variant="subtle"
                            onClick={() => setEditing(bond)}
                            aria-label="Edit bond"
                          >
                            <IconPencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <ConfirmDeleteButton
                          what={`bond ${bond.isin}`}
                          loading={remove.isPending}
                          onConfirm={() => remove.mutateAsync(bond.id)}
                        />
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>
      {editing !== undefined && (
        <BondFormModal opened onClose={() => setEditing(undefined)} instrument={editing} />
      )}
      {scheduleFor && (
        <ScheduleModal instrument={scheduleFor} onClose={() => setScheduleFor(null)} />
      )}
    </>
  );
}
