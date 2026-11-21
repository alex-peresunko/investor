import { Center, SegmentedControl, Tooltip } from '@mantine/core';
import { IconDatabase, IconFlask } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

import { usePreferences } from '@/i18n/preferences';

interface Stacks {
  live: number;
  demo: number;
}

function peerOrigin(port: number): string {
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}

/**
 * Switches between the live and demo stacks, keeping the current page. Shown only while the other
 * stack answers.
 */
export function StackSwitch() {
  const { t } = useTranslation();
  const { pathname, search } = useLocation();
  const demo = usePreferences().data?.demo ?? false;
  const stacks = useQuery({
    queryKey: ['stacks'],
    queryFn: async (): Promise<Stacks> => {
      const response = await fetch('/stacks.json');
      if (!response.ok) throw new Error(response.statusText);
      return (await response.json()) as Stacks;
    },
    staleTime: Infinity,
    retry: false,
  });
  const peer = stacks.data && peerOrigin(demo ? stacks.data.live : stacks.data.demo);
  const peerUp = useQuery({
    queryKey: ['stacks', 'peer', peer],
    // An opaque no-cors response still proves the other stack is listening.
    queryFn: async () => {
      await fetch(`${peer}/healthz`, { mode: 'no-cors', cache: 'no-store' });
      return true;
    },
    enabled: Boolean(peer),
    retry: false,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  if (peer && peerUp.data) {
    return (
      <Tooltip label={t('app.stackHint')} withArrow>
        <SegmentedControl
          size="xs"
          radius="xl"
          color={demo ? 'orange' : 'brand'}
          value={demo ? 'demo' : 'live'}
          onChange={() => window.location.assign(`${peer}${pathname}${search}`)}
          data={[
            {
              value: 'live',
              label: (
                <Center style={{ gap: 6 }}>
                  <IconDatabase size={14} />
                  {t('app.stackLive')}
                </Center>
              ),
            },
            {
              value: 'demo',
              label: (
                <Center style={{ gap: 6 }}>
                  <IconFlask size={14} />
                  {t('app.stackDemo')}
                </Center>
              ),
            },
          ]}
        />
      </Tooltip>
    );
  }
  return null;
}
