import {
  IconCalendarDue,
  IconCertificate,
  IconChartCandle,
  IconHelp,
  IconLayoutDashboard,
  IconListDetails,
  IconPackage,
  IconReceipt,
} from '@tabler/icons-react';

export const NAV = {
  dashboard: {
    to: '/',
    label: 'nav.dashboard',
    icon: IconLayoutDashboard,
    color: 'brand',
    end: true,
  },
  packages: {
    to: '/packages',
    label: 'nav.packages',
    icon: IconPackage,
    color: 'violet',
    end: false,
  },
  operations: {
    to: '/operations',
    label: 'nav.operations',
    icon: IconListDetails,
    color: 'blue',
    end: false,
  },
  upcoming: {
    to: '/upcoming',
    label: 'nav.upcoming',
    icon: IconCalendarDue,
    color: 'orange',
    end: false,
  },
  pastPayments: {
    to: '/past-payments',
    label: 'nav.pastPayments',
    icon: IconReceipt,
    color: 'teal',
    end: false,
  },
  bonds: { to: '/bonds', label: 'nav.bonds', icon: IconCertificate, color: 'grape', end: false },
  market: {
    to: '/market',
    label: 'nav.market',
    icon: IconChartCandle,
    color: 'cyan',
    end: false,
  },
  help: { to: '/help', label: 'nav.help', icon: IconHelp, color: 'gray', end: false },
} as const;

export type Page = keyof typeof NAV;
