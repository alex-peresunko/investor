import { ActionIcon, Tooltip } from '@mantine/core';
import { IconHelpCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export const HELP_SECTIONS = [
  'overview',
  'terms',
  'bonds',
  'operations',
  'packages',
  'dashboard',
  'upcoming',
  'planner',
  'pastPayments',
  'market',
  'calculations',
  'data',
] as const;
export const HELP_TOPICS = ['value', 'pnl', 'realized', 'usd', 'xirr', 'benchmark'] as const;

export type HelpSection = (typeof HELP_SECTIONS)[number];
export type HelpTopic = (typeof HELP_TOPICS)[number];

export function HelpLink({ to, size = 'sm' }: { to: HelpSection | HelpTopic; size?: 'xs' | 'sm' }) {
  const { t } = useTranslation();
  return (
    <Tooltip label={t('help.explain')} withArrow>
      <ActionIcon
        component={Link}
        to={`/help#${to}`}
        variant="subtle"
        color="gray"
        size={size}
        radius="xl"
        aria-label={t('help.explain')}
      >
        <IconHelpCircle size={size === 'xs' ? 14 : 16} />
      </ActionIcon>
    </Tooltip>
  );
}
