import type { ReactNode } from 'react';
import DashboardLayout from '../dashboard/layout';

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
