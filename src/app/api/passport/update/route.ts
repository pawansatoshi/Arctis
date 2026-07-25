import { NextRequest, NextResponse } from 'next/server';
import { verifyApiWallet } from '@/lib/auth/middleware';
import { getPassportByUsername, updatePassportProfile } from '@/lib/passport/service';

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { username: string; displayName?: string; bio?: string; avatarUrl?: string };

    const auth = await verifyApiWallet(req, undefined, true);
    if (!auth.ok) return NextResponse.json({ error: auth.reason ?? 'Wallet signature required' }, { status: 401 });
    const walletAddress = auth.walletAddress;

    const { username, displayName, bio, avatarUrl } = body;
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    if (displayName !== undefined && displayName.length > 50) return NextResponse.json({ error: 'Display name must be 50 characters or fewer' }, { status: 422 });
    if (bio !== undefined && bio.length > 200) return NextResponse.json({ error: 'Bio must be 200 characters or fewer' }, { status: 422 });
    if (avatarUrl) { try { new URL(avatarUrl); } catch { return NextResponse.json({ error: 'avatarUrl must be a valid URL' }, { status: 422 }); } }

    const passport = await getPassportByUsername(username);
    if (!passport) return NextResponse.json({ error: 'Passport not found' }, { status: 404 });
    if (passport.walletAddress.toLowerCase() !== walletAddress) {
      return NextResponse.json({ error: 'Only the Passport owner can update this profile' }, { status: 403 });
    }

    const updates: Partial<{ displayName: string; bio: string; avatarUrl: string }> = {};
    if (displayName !== undefined) updates.displayName = displayName.trim();
    if (bio !== undefined) updates.bio = bio.trim();
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl.trim();

    await updatePassportProfile(username, updates);
    return NextResponse.json({ username: username.toLowerCase(), ...updates });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
