import {
  ActionIcon,
  AppShell,
  Burger,
  Group,
  NavLink,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconCalendarDue,
  IconCertificate,
  IconLayoutDashboard,
  IconListDetails,
  IconMoon,
  IconPackage,
  IconReceipt,
  IconSun,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { NavLink as RouterNavLink, Outlet } from 'react-router';

import { LanguageMenu } from '@/i18n/LanguageMenu';

const NAV = [
  { to: '/', label: 'nav.dashboard', icon: IconLayoutDashboard, end: true },
  { to: '/packages', label: 'nav.packages', icon: IconPackage, end: false },
  { to: '/operations', label: 'nav.operations', icon: IconListDetails, end: false },
  { to: '/upcoming', label: 'nav.upcoming', icon: IconCalendarDue, end: false },
  { to: '/past-payments', label: 'nav.pastPayments', icon: IconReceipt, end: false },
  { to: '/bonds', label: 'nav.bonds', icon: IconCertificate, end: false },
] as const;

export function Layout() {
  const { t } = useTranslation();
  const [opened, { toggle, close }] = useDisclosure();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={4}>{t('app.name')}</Title>
          </Group>
          <Group gap="xs">
            <LanguageMenu />
            <ActionIcon
              variant="default"
              size="lg"
              aria-label={t('app.toggleColorScheme')}
              onClick={() => setColorScheme(scheme === 'light' ? 'dark' : 'light')}
            >
              {scheme === 'light' ? <IconMoon size={18} /> : <IconSun size={18} />}
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="sm">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            component={RouterNavLink}
            to={to}
            end={end}
            label={t(label)}
            leftSection={<Icon size={18} />}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
