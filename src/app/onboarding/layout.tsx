import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Setup | ARCTIS',
  description: 'Get started with ARCTIS in 2 minutes.',
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
