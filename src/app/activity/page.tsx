import { redirect } from 'next/navigation';

/**
 * History is the canonical user-facing historical surface.
 * The activity API remains the shared aggregation source for history data.
 */
export default function ActivityRedirect() {
  redirect('/history');
}
