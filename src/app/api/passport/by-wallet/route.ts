import { NextRequest, NextResponse } from 'next/server';
import { getPassportByWallet } from '@/lib/passport/service';
import { isValidEthAddress } from '@/lib/auth/middleware';

export async function GET(req: NextRequest) {
  const walletAddress = req.nextUrl.searchParams.get('walletAddress');
  if (!walletAddress || !isValidEthAddress(walletAddress)) {
    return NextResponse.json({ error: 'Valid walletAddress required' }, { status: 400 });
  }
  const passport = await getPassportByWallet(walletAddress);
  if (!passport) return NextResponse.json({ error: 'No Passport found for this wallet' }, { status: 404 });
  return NextResponse.json({ username: passport.username, walletAddress: passport.walletAddress, displayName: passport.displayName, bio: passport.bio });
}
