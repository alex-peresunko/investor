import { createBrowserRouter } from 'react-router';

import { BondsPage } from '@/features/bonds/BondsPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { OperationsPage } from '@/features/operations/OperationsPage';
import { PackageDetailPage } from '@/features/packages/PackageDetailPage';
import { PackagesPage } from '@/features/packages/PackagesPage';
import { PastPaymentsPage } from '@/features/received/PastPaymentsPage';
import { UpcomingPage } from '@/features/upcoming/UpcomingPage';

import { Layout } from './Layout';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'bonds', element: <BondsPage /> },
      { path: 'packages', element: <PackagesPage /> },
      { path: 'packages/:lotId', element: <PackageDetailPage /> },
      { path: 'operations', element: <OperationsPage /> },
      { path: 'upcoming', element: <UpcomingPage /> },
      { path: 'past-payments', element: <PastPaymentsPage /> },
    ],
  },
]);
