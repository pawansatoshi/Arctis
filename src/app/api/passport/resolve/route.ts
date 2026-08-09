import { NextRequest, NextResponse } from 'next/server';
import { getPassportByUsername } from '@/lib/passport/service';

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')?.toLowerCase().trim();
  if (!username || username.length < 2) return NextResponse.json({ error: 'username required' }, { status: 400 });

  const passport = await getPassportByUsername(username);
  if (!passport) return NextResponse.json({ error: 'Passport not found' }, { status: 404 });

  return NextResponse.json({ walletAddress: passport.walletAddress, displayName: passport.displayName, bio: passport.bio });
}
