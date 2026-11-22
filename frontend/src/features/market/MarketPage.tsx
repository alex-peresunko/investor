import { SimpleGrid, Stack, Tabs, Text } from '@mantine/core';
import {
  IconBuildingBank,
  IconCalendarDue,
  IconCertificate,
  IconGavel,
  IconUsers,
  IconUsersGroup,
  IconWallet,
  IconArrowsExchange,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import {
  type HoldersReport,
  type MarketBonds,
  useMarketAuctions,
  useMarketBonds,
  useMarketHolders,
  useMarketRepayments,
} from '@/api/marketHooks';
import { PageTitle } from '@/components/PageTitle';
import { Stat } from '@/components/Stat';
import { formatDate, formatPercent } from '@/lib/format';

import { AuctionsTab } from './AuctionsTab';
import { BondsTab } from './BondsTab';
import { QueryState, useCompact, useSignedCompact } from './common';
import { HoldersTab } from './HoldersTab';
import { RepaymentsTab } from './RepaymentsTab';

const TABS = ['bonds', 'holders', 'repayments', 'auctions'] as const;
type Tab = (typeof TABS)[number];

function Headline({ bonds, holders }: { bonds?: MarketBonds; holders?: HoldersReport }) {
  const { t } = useTranslation();
  const compact = useCompact();
  const signed = useSignedCompact();
  const all = holders?.groups.find((g) => g.group === 'all');
  const holder = (name: 'nbu' | 'individuals') => all?.holders.find((h) => h.holder === name);
  const lastDay = bonds?.trades_as_of;
  const traded = (bonds?.bonds ?? [])
    .filter((b) => b.last_trade?.day === lastDay)
    .reduce((s, b) => s + Number(b.last_trade?.volume_uah ?? 0), 0);
  const shareLine = (name: 'nbu' | 'individuals') => {
    const h = holder(name);
    return h ? (
      <>
        <Text fz={24} fw={800} lh={1.2}>
          {formatPercent(h.share)}
        </Text>
        <Text size="sm" c="dimmed">
          {t('market.headline.amountYtd', {
            amount: compact(h.amount, 'UAH'),
            change: signed(h.change_year, 'UAH'),
          })}
        </Text>
      </>
    ) : (
      <Text c="dimmed">—</Text>
    );
  };

  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
      <Stat icon={IconWallet} label={t('market.headline.outstanding')} help="market">
        <Text fz={24} fw={800} lh={1.2}>
          {bonds ? compact(bonds.outstanding_uah, 'UAH') : '—'}
        </Text>
        <Text size="sm" c="dimmed">
          {bonds ? t('market.headline.bonds', { count: bonds.bonds.length }) : ''}
        </Text>
      </Stat>
      <Stat icon={IconBuildingBank} color="indigo" label={t('market.headline.nbu')}>
        {shareLine('nbu')}
      </Stat>
      <Stat icon={IconUsers} color="orange" label={t('market.headline.individuals')}>
        {shareLine('individuals')}
      </Stat>
      <Stat icon={IconArrowsExchange} color="teal" label={t('market.headline.traded')}>
        <Text fz={24} fw={800} lh={1.2}>
          {lastDay ? compact(traded, 'UAH') : '—'}
        </Text>
        <Text size="sm" c="dimmed">
          {formatDate(lastDay)}
        </Text>
      </Stat>
    </SimpleGrid>
  );
}

export function MarketPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((x) => x === params.get('tab')) ?? 'bonds';
  const bonds = useMarketBonds();
  const holders = useMarketHolders();
  const repayments = useMarketRepayments();
  const auctions = useMarketAuctions();

  return (
    <Stack gap="lg">
      <div>
        <PageTitle page="market">{t('market.title')}</PageTitle>
        <Text size="sm" c="dimmed">
          {t('market.subtitle')}
        </Text>
      </div>
      <Headline bonds={bonds.data} holders={holders.data} />
      <Tabs
        value={tab}
        onChange={(v) => setParams(v && v !== 'bonds' ? { tab: v } : {}, { replace: true })}
        keepMounted={false}
      >
        <Tabs.List mb="md">
          <Tabs.Tab value="bonds" leftSection={<IconCertificate size={16} />}>
            {t('market.tabs.bonds')}
          </Tabs.Tab>
          <Tabs.Tab value="holders" leftSection={<IconUsersGroup size={16} />}>
            {t('market.tabs.holders')}
          </Tabs.Tab>
          <Tabs.Tab value="repayments" leftSection={<IconCalendarDue size={16} />}>
            {t('market.tabs.repayments')}
          </Tabs.Tab>
          <Tabs.Tab value="auctions" leftSection={<IconGavel size={16} />}>
            {t('market.tabs.auctions')}
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="bonds">
          <QueryState query={bonds}>{(data) => <BondsTab data={data} />}</QueryState>
        </Tabs.Panel>
        <Tabs.Panel value="holders">
          <QueryState query={holders}>{(data) => <HoldersTab data={data} />}</QueryState>
        </Tabs.Panel>
        <Tabs.Panel value="repayments">
          <QueryState query={repayments}>{(data) => <RepaymentsTab data={data} />}</QueryState>
        </Tabs.Panel>
        <Tabs.Panel value="auctions">
          <QueryState query={auctions}>{(data) => <AuctionsTab data={data} />}</QueryState>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
