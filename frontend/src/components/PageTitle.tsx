import { Group, ThemeIcon, Title } from '@mantine/core';
import type { ReactNode } from 'react';

import { NAV, type Page } from '@/app/nav';

import { HelpLink } from './HelpLink';

export function PageTitle({ page, children }: { page: Page; children: ReactNode }) {
  const { icon: Icon, color } = NAV[page];
  return (
    <Group gap="sm" wrap="nowrap">
      <ThemeIcon
        size={40}
        radius="md"
        variant="gradient"
        gradient={{ from: `${color}.5`, to: `${color}.8`, deg: 135 }}
      >
        <Icon size={22} />
      </ThemeIcon>
      <Title order={2}>{children}</Title>
      {page !== 'help' && <HelpLink to={page} />}
    </Group>
  );
}
