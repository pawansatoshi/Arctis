import { cn } from '@/lib/utils';

/** Base shimmering placeholder block (uses the existing .skeleton design-system class). Compose into row/card/list skeletons. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

/** A single skeleton row — icon + two lines of text — matches most list items app-wide. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-6 py-4">
      <Skeleton className="w-8 h-8 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-2.5 w-1/2" />
      </div>
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

/** A stack of skeleton rows — drop-in replacement for a loading list/table body. */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
      {Array.from({ length: count }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  );
}

/** A skeleton stat/metric card — matches glass-card metric tiles used on dashboards. */
export function SkeletonCard() {
  return (
    <div className="glass-card p-5 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-2.5 w-16" />
    </div>
  );
}
