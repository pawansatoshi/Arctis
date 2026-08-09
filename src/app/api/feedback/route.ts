import { NextRequest, NextResponse } from 'next/server';
import { saveFeedback, getAllFeedback } from '@/lib/firebase/feedback';
import { obs } from '@/lib/observability/logger';

// POST /api/feedback — submit feedback
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name: string; country: string; email?: string;
      category: string; message: string; walletAddress?: string;
    };
    if (!body.name?.trim() || !body.message?.trim() || !body.category) {
      return NextResponse.json({ error: 'name, category, message required' }, { status: 400 });
    }
    const id = await saveFeedback({
      name: body.name.trim(),
      country: body.country || 'Unknown',
      email: body.email?.trim(),
      category: body.category as 'bug_report' | 'feature_request' | 'improvement' | 'general',
      message: body.message.trim(),
      walletAddress: body.walletAddress,
    });
    void obs.info('auth', 'Feedback submitted', { id, category: body.category }, body.walletAddress);
    return NextResponse.json({ success: true, id });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/feedback — admin only list
export async function GET() {
  try {
    const feedback = await getAllFeedback(100);
    return NextResponse.json({ feedback });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message, feedback: [] }, { status: 500 });
  }
}
