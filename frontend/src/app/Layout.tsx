import {
  ActionIcon,
  AppShell,
  Burger,
  Group,
  NavLink,
  Text,
  ThemeIcon,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconFlask, IconMoon, IconSun, IconTrendingUp } from '@tabler/icons-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink as RouterNavLink, Outlet, useLocation } from 'react-router';

import { LanguageMenu } from '@/i18n/LanguageMenu';
import { usePreferences } from '@/i18n/preferences';

import { NAV } from './nav';
import { StackSwitch } from './StackSwitch';

const DEMO_BANNER_HEIGHT = 36;

export function Layout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [opened, { toggle, close }] = useDisclosure();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');
  const demo = usePreferences().data?.demo ?? false;

  useEffect(() => {
    document.documentElement.toggleAttribute('data-demo', demo);
  }, [demo]);

  return (
    <AppShell
      header={{ height: demo ? 60 + DEMO_BANNER_HEIGHT : 60 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header className="glass">
        {demo && (
          <Group h={DEMO_BANNER_HEIGHT} className="demo-banner" justify="center" gap="xs" px="md">
            <IconFlask size={18} />
            <Text fw={800} tt="uppercase" lts={1}>
              {t('app.demo')}
            </Text>
            <Text size="sm" fw={500} visibleFrom="sm">
              {t('app.demoBanner')}
            </Text>
          </Group>
        )}
        <Group h={60} px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <ThemeIcon
              size={34}
              radius="md"
              variant="gradient"
              gradient={demo ? { from: 'orange.6', to: 'yellow.5' } : undefined}
            >
              <IconTrendingUp size={20} stroke={2.2} />
            </ThemeIcon>
            <Text fz={20} fw={800} className="brand-text">
              {t('app.name')}
            </Text>
            <StackSwitch />
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
      <AppShell.Navbar p="sm" className="glass">
        {Object.values(NAV).map(({ to, label, icon: Icon, color, end }) => (
          <NavLink
            key={to}
            component={RouterNavLink}
            to={to}
            end={end}
            label={t(label)}
            color={color}
            fw={500}
            mb={4}
            style={{ borderRadius: 'var(--mantine-radius-md)' }}
            leftSection={
              <ThemeIcon variant="light" color={color} size={30} radius="md">
                <Icon size={18} />
              </ThemeIcon>
            }
            onClick={close}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <div className="page" key={pathname}>
          <Outlet />
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
