import { NextRequest, NextResponse } from 'next/server';

// GET /api/auth/nonce?wallet=0x...
// Returns a timestamp-based nonce for the client to sign
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'Valid wallet address required' }, { status: 400 });
  }
  const nonce = Date.now().toString();
  return NextResponse.json({ nonce, wallet: wallet.toLowerCase() });
}
