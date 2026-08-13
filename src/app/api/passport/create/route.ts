import { NextRequest, NextResponse } from 'next/server';
import { verifyApiWallet } from '@/lib/auth/middleware';
import { validateUsername } from '@/lib/passport/types';
import { isUsernameTaken, getPassportByWallet, createPassport } from '@/lib/passport/service';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rateLimit';

const MAX_AVATAR_CHARS = 700_000;
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { username: string; displayName?: string; avatarUrl?: string };

    const auth = await verifyApiWallet(req, undefined, true);
    if (!auth.ok) return NextResponse.json({ error: auth.reason ?? 'Wallet signature required' }, { status: 401 });
    const walletAddress = auth.walletAddress;

    const rl = await checkRateLimit(`passport-create:${walletAddress}`, RATE_LIMITS.passport.maxCalls, RATE_LIMITS.passport.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests — please wait before trying again', resetAt: rl.resetAt }, { status: 429 });
    }

    const { username, displayName, avatarUrl } = body;
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });

    const check = validateUsername(username);
    if (!check.valid) return NextResponse.json({ error: check.reason }, { status: 422 });
    if (displayName && displayName.length > 50) return NextResponse.json({ error: 'Display name must be 50 characters or fewer' }, { status: 422 });
    if (avatarUrl !== undefined && avatarUrl !== '') {
      if (avatarUrl.length > MAX_AVATAR_CHARS || !AVATAR_RE.test(avatarUrl)) return NextResponse.json({ error: 'Profile photo must be a JPEG, PNG, or WebP image under 700 KB' }, { status: 422 });
    }

    const existingForWallet = await getPassportByWallet(walletAddress);
    if (existingForWallet) {
      return NextResponse.json({ error: 'This wallet already has a Passport', existingUsername: existingForWallet.username }, { status: 409 });
    }

    if (await isUsernameTaken(username)) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    await createPassport(username, walletAddress, displayName, avatarUrl || undefined);

    return NextResponse.json({
      username: username.toLowerCase(),
      walletAddress,
      displayName: displayName?.trim() || null,
      avatarUrl: avatarUrl || null,
      passportHandle: `${username.toLowerCase()}.arc`,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
