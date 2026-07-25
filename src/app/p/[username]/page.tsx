'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { PassportCard } from '@/components/passport/PassportCard';

interface PassportProfile { walletAddress: string; displayName?: string; bio?: string; verified?: boolean; }

export default function PassportProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const router = useRouter();
  const [profile, setProfile] = useState<PassportProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/passport/resolve?username=${encodeURIComponent(username.toLowerCase())}`)
      .then((r) => { if (r.status === 404) { setNotFound(true); return null; } return r.json(); })
      .then((data) => { if (data) setProfile(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return <div className="page-container max-w-sm flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 text-surface-500 animate-spin" /></div>;
  }

  if (notFound || !profile) {
    return (
      <div className="page-container max-w-sm flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 text-center space-y-3 w-full">
          <AlertCircle className="w-8 h-8 text-surface-600 mx-auto" />
          <div>
            <p className="text-surface-800 font-medium">{username}.arc</p>
            <p className="text-surface-600 text-sm mt-1">This Passport hasn&apos;t been claimed yet</p>
          </div>
          <a href="/passport" className="btn-secondary inline-flex text-sm">Claim it yourself</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container max-w-sm">
      <PassportCard username={username} walletAddress={profile.walletAddress} displayName={profile.displayName} bio={profile.bio} verified={profile.verified} isOwner={false}
        onSend={() => router.push(`/transfer?to=${username}`)} />
    </div>
  );
}
