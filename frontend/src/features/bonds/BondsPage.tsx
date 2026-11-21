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
import { useTranslation } from 'react-i18next';

import { useDeleteInstrument, useInstruments } from '@/api/hooks';
import type { Instrument } from '@/api/types';
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton';
import { type SortColumns, SortTh, useSortedRows } from '@/components/SortableTable';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';

import { BondFormModal } from './BondFormModal';
import { ScheduleModal } from './ScheduleModal';

const COLUMNS = {
  isin: (b) => b.isin,
  name: (b) => b.name,
  face: (b) => Number(b.face_value),
  coupon: (b) => Number(b.coupon_rate),
  frequency: (b) => b.coupon_frequency,
  issued: (b) => b.issue_date,
  maturity: (b) => b.maturity_date,
} satisfies SortColumns<Instrument, string>;

export function BondsPage() {
  const { t } = useTranslation();
  const instruments = useInstruments();
  const remove = useDeleteInstrument();
  const sort = useSortedRows('table:bonds', instruments.data ?? [], COLUMNS, 'issued');
  // undefined = closed, null = new bond.
  const [editing, setEditing] = useState<Instrument | null | undefined>(undefined);
  const [scheduleFor, setScheduleFor] = useState<Instrument | null>(null);

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Title order={2}>{t('bonds.title')}</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing(null)}>
          {t('bonds.add')}
        </Button>
      </Group>
      <Paper withBorder radius="md">
        {instruments.isPending ? (
          <Loader m="lg" />
        ) : instruments.isError ? (
          <Alert color="red">{instruments.error.message}</Alert>
        ) : instruments.data.length === 0 ? (
          <Text c="dimmed" p="lg">
            {t('bonds.empty')}
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={800}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <SortTh {...sort.th('isin')}>{t('bonds.isin')}</SortTh>
                  <SortTh {...sort.th('name')}>{t('bonds.name')}</SortTh>
                  <SortTh ta="right" {...sort.th('face')}>
                    {t('bonds.faceValue')}
                  </SortTh>
                  <SortTh ta="right" {...sort.th('coupon')}>
                    {t('bonds.coupon')}
                  </SortTh>
                  <SortTh {...sort.th('frequency')}>{t('bonds.frequency')}</SortTh>
                  <SortTh {...sort.th('issued')}>{t('bonds.issued')}</SortTh>
                  <SortTh {...sort.th('maturity')}>{t('bonds.maturity')}</SortTh>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sort.rows.map((bond) => (
                  <Table.Tr key={bond.id}>
                    <Table.Td ff="monospace">{bond.isin}</Table.Td>
                    <Table.Td>{bond.name}</Table.Td>
                    <Table.Td ta="right">{formatMoney(bond.face_value, 'UAH')}</Table.Td>
                    <Table.Td ta="right">{formatPercent(bond.coupon_rate)}</Table.Td>
                    <Table.Td>{t(`bonds.frequencies.${bond.coupon_frequency}`)}</Table.Td>
                    <Table.Td>{formatDate(bond.issue_date)}</Table.Td>
                    <Table.Td>{formatDate(bond.maturity_date)}</Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Tooltip label={t('bonds.schedule')}>
                          <ActionIcon
                            variant="subtle"
                            onClick={() => setScheduleFor(bond)}
                            aria-label={t('bonds.schedule')}
                          >
                            <IconCalendarEvent size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={t('common.edit')}>
                          <ActionIcon
                            variant="subtle"
                            onClick={() => setEditing(bond)}
                            aria-label={t('bonds.editAria')}
                          >
                            <IconPencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <ConfirmDeleteButton
                          what={t('bonds.deleteWhat', { isin: bond.isin })}
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
