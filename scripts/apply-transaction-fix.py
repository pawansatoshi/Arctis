from pathlib import Path

# Central Arc RPC registry: current official Arc Testnet endpoints.
p=Path('src/lib/contracts.ts'); s=p.read_text()
for old,new in {
 'https://rpc.testnet.arc.network':'https://rpc.testnet.arc.io',
 'https://rpc.blockdaemon.testnet.arc.network':'https://rpc.blockdaemon.testnet.arc.io',
 'https://rpc.drpc.testnet.arc.network':'https://rpc.drpc.testnet.arc.io',
 'https://rpc.quicknode.testnet.arc.network':'https://rpc.quicknode.testnet.arc.io',
}.items(): s=s.replace(old,new)
p.write_text(s)

# Remove cirBTC from the ARCTIS swap UI/AI route surface.
p=Path('src/lib/ai/intent/parser.ts'); s=p.read_text()
s=s.replace("const SWAP_TOKENS = ['USDC', 'tUSDC', 'tARC', 'EURC', 'cirBTC'] as const;", "const SWAP_TOKENS = ['USDC', 'tUSDC', 'tARC', 'EURC'] as const;")
s=s.replace("const TOKEN_RE = '(usdc|tusdc|tarc|eurc|cirbtc|btc)';", "const TOKEN_RE = '(usdc|tusdc|tarc|eurc)';")
s=s.replace("  if (value === 'btc') return 'cirBTC';\n", "")
p.write_text(s)

p=Path('src/app/swap/page.tsx'); s=p.read_text()
s=s.replace("type SwapToken = 'USDC' | 'EURC' | 'cirBTC' | 'tUSDC' | 'tARC';", "type SwapToken = 'USDC' | 'EURC' | 'tUSDC' | 'tARC';")
s=s.replace("const TOKENS: SwapToken[] = ['USDC', 'EURC', 'cirBTC', 'tUSDC', 'tARC'];", "const TOKENS: SwapToken[] = ['USDC', 'EURC', 'tUSDC', 'tARC'];")
s=s.replace("const TOKEN_DECIMALS: Record<SwapToken, number> = { USDC: 6, EURC: 6, cirBTC: 8, tUSDC: 6, tARC: 18 };", "const TOKEN_DECIMALS: Record<SwapToken, number> = { USDC: 6, EURC: 6, tUSDC: 6, tARC: 18 };")
s=s.replace('Insufficient ARC for the swap transaction.', 'Insufficient USDC for the swap transaction.')
s=s.replace('Approximately ${formatEther(requiredGas)} ARC is required.', 'Approximately ${formatEther(requiredGas)} USDC is required.')
s=s.replace("const OTC_TOKENS: readonly SwapToken[] = ['USDC', 'tUSDC', 'tARC'];", "const OTC_TOKENS: readonly SwapToken[] = ['USDC', 'tUSDC', 'tARC'];\nconst CIRCLE_KIT_KEY = process.env.NEXT_PUBLIC_CIRCLE_KIT_KEY ?? '';")
s=s.replace("if (circlePair) {\n        const provider", "if (circlePair) {\n        if (!CIRCLE_KIT_KEY) throw new Error('Circle App Kit key is not configured. Set NEXT_PUBLIC_CIRCLE_KIT_KEY in Vercel.');\n        const provider")
s=s.replace("config: { slippageBps: 100 }", "config: { kitKey: CIRCLE_KIT_KEY, slippageBps: 100 }")
s=s.replace("if (quote.rail === 'circle') {\n        const estimate", "if (quote.rail === 'circle') {\n        if (!CIRCLE_KIT_KEY) throw new Error('Circle App Kit key is not configured. Set NEXT_PUBLIC_CIRCLE_KIT_KEY in Vercel.');\n        const estimate")
p.write_text(s)

# Firebase Admin: accept standard PKCS#8 and RSA PEMs plus JSON-encoded env values.
p=Path('src/lib/firebase/admin.ts'); s=p.read_text()
old="""  // Support common secure deployment formats: quoted .env values, literal\\n
  // sequences, JSON-escaped newlines, and base64-encoded PEM content.
  if ((key.startsWith('\\\"') && key.endsWith('\\\"')) || (key.startsWith(\"'\") && key.endsWith(\"'\"))) {
    key = key.slice(1, -1);
  }

  key = key.replace(/\\\\r\\\\n/g, '\\n').replace(/\\\\n/g, '\\n').replace(/\\r\\n/g, '\\n');"""
new="""  // Support common Vercel/.env formats: quoted values, JSON-encoded strings,
  // escaped newlines, and base64-encoded PEM content.
  if ((key.startsWith('\\\"') && key.endsWith('\\\"')) || (key.startsWith(\"'\") && key.endsWith(\"'\"))) {
    try {
      if (key.startsWith('\\\"')) key = JSON.parse(key) as string;
      else key = key.slice(1, -1);
    } catch {
      key = key.slice(1, -1);
    }
  }

  key = key.replace(/\\\\r\\\\n/g, '\\n').replace(/\\\\n/g, '\\n').replace(/\\r\\n/g, '\\n');"""
if old not in s: raise SystemExit('firebase admin normalization target not found')
s=s.replace(old,new)
s=s.replace("  if (!key.includes('-----BEGIN PRIVATE KEY-----') || !key.includes('-----END PRIVATE KEY-----')) {", "  const hasPkcs8 = key.includes('-----BEGIN PRIVATE KEY-----') && key.includes('-----END PRIVATE KEY-----');\n  const hasRsa = key.includes('-----BEGIN RSA PRIVATE KEY-----') && key.includes('-----END RSA PRIVATE KEY-----');\n  if (!hasPkcs8 && !hasRsa) {")
p.write_text(s)

# Firestore: omit undefined optional fields such as note/txHash.
p=Path('src/lib/firebase/transactions.ts'); s=p.read_text()
s=s.replace("  const ref = await db.collection(COL).add({\n    ...tx,\n    walletAddress: walletAddress.toLowerCase(),\n    createdAt: FieldValue.serverTimestamp(),\n  });", "  const cleanTx = Object.fromEntries(Object.entries(tx).filter(([, value]) => value !== undefined));\n  const ref = await db.collection(COL).add({\n    ...cleanTx,\n    walletAddress: walletAddress.toLowerCase(),\n    createdAt: FieldValue.serverTimestamp(),\n  });")
p.write_text(s)

# Circle App Kit Swap needs a kit key; document the public client-side variable.
p=Path('.env.example'); s=p.read_text()
s=s.replace('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=\nNEXT_PUBLIC_NETWORK_ENV=', 'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=\nNEXT_PUBLIC_CIRCLE_KIT_KEY=\nNEXT_PUBLIC_NETWORK_ENV=')
p.write_text(s)

# Firestore persistence must not block the signed on-chain OTC settlement path.
p=Path('src/lib/swap/service.ts'); s=p.read_text()
old="""export async function createSwapRecord(data: Omit<SwapRecord, 'createdAt' | 'completedAt'>): Promise<void> {
  const db = getAdminDb();
  await db.collection(COL).doc(data.id).set({
    ...data,
    walletAddress: data.walletAddress.toLowerCase(),
    createdAt: FieldValue.serverTimestamp(),
  });
}"""
new="""export async function createSwapRecord(data: Omit<SwapRecord, 'createdAt' | 'completedAt'>): Promise<void> {
  try {
    const db = getAdminDb();
    await db.collection(COL).doc(data.id).set({
      ...data,
      walletAddress: data.walletAddress.toLowerCase(),
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    // Persistence is auxiliary to the signed on-chain settlement path.
    // A Firestore configuration failure must not block a valid testnet swap.
  }
}"""
if old not in s: raise SystemExit('swap service target not found')
s=s.replace(old,new)
p.write_text(s)

print('ARCTIS transaction fix applied')
