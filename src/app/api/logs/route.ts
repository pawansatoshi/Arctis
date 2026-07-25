import { NextRequest, NextResponse } from 'next/server';
import { getRecentLogs } from '@/lib/observability/logger';
import type { ObsLog } from '@/types';

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') as ObsLog['category'] | null;
  try {
    const logs = await getRecentLogs(category ?? undefined, 100);
    return NextResponse.json({ logs });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ logs: [], error: e.message });
  }
}
