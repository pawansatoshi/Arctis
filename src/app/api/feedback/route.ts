import { NextResponse } from 'next/server';
import { saveFeedback, getAllFeedback } from '@/lib/firebase/feedback';
import { obs } from '@/lib/observability/logger';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FEEDBACK_EMAIL = 'pawansatoshi@gmail.com';

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { name?: string; country?: string; email?: string; category?: string; message?: string; walletAddress?: string };
    if (!body.name?.trim() || !body.message?.trim() || !body.category?.trim()) {
      return NextResponse.json({ error: 'Name, category and message are required.' }, { status: 400 });
    }

    const feedback = {
      name: body.name.trim(),
      country: body.country?.trim() || 'Unknown',
      email: body.email?.trim() || undefined,
      category: body.category as 'bug_report' | 'feature_request' | 'improvement' | 'general',
      message: body.message.trim(),
      walletAddress: body.walletAddress?.trim() || undefined,
    };

    const id = await saveFeedback(feedback);
    void obs.info('auth', 'Feedback submitted', { id, category: feedback.category });

    if (resend) {
      try {
        await resend.emails.send({
          from: 'ARCTIS Feedback <onboarding@resend.dev>',
          to: [FEEDBACK_EMAIL],
          subject: `[ARCTIS Feedback] ${feedback.category} — ${feedback.name}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto"><h2>New ARCTIS Feedback</h2><table style="border-collapse:collapse;width:100%"><tr><td style="padding:8px;font-weight:bold">Category</td><td style="padding:8px">${escapeHtml(feedback.category)}</td></tr><tr><td style="padding:8px;font-weight:bold">Name</td><td style="padding:8px">${escapeHtml(feedback.name)}</td></tr><tr><td style="padding:8px;font-weight:bold">Country</td><td style="padding:8px">${escapeHtml(feedback.country)}</td></tr><tr><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px">${escapeHtml(feedback.email || 'Not provided')}</td></tr><tr><td style="padding:8px;font-weight:bold">Wallet</td><td style="padding:8px">${escapeHtml(feedback.walletAddress || 'Not provided')}</td></tr></table><h3>Message</h3><div style="white-space:pre-wrap;background:#f5f5f5;padding:16px;border-radius:8px">${escapeHtml(feedback.message)}</div><p style="color:#777;font-size:12px">Feedback ID: ${escapeHtml(id)}</p></div>`,
        });
        void obs.info('auth', 'Feedback email notification sent', { id });
      } catch (emailError) {
        void obs.warn('auth', 'Feedback email notification failed', { id, error: emailError instanceof Error ? emailError.message : String(emailError) });
      }
    } else {
      // Feedback itself is healthy without email notification. Keep missing
      // optional infrastructure out of the production error stream.
      void obs.warn('auth', 'Feedback email notification unavailable', { id, reason: 'RESEND_API_KEY not configured' });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const feedback = await getAllFeedback(100);
    return NextResponse.json({ feedback });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message, feedback: [] }, { status: 500 });
  }
}
