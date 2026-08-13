const inFlight = new Set<string>();

export function tryAcquireExecution(key: string): boolean {
  if (inFlight.has(key)) return false;
  inFlight.add(key);
  return true;
}

export function releaseExecution(key: string): void {
  inFlight.delete(key);
}
