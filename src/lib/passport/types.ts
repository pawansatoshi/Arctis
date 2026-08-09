export interface Passport {
  username: string;
  walletAddress: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
  verified?: boolean;
}

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = /^[a-z0-9_]+$/;

export const RESERVED_USERNAMES = [
  'admin', 'arctis', 'treasury', 'support', 'help', 'api', 'app', 'www',
  'system', 'official', 'team', 'root', 'null', 'undefined', 'test',
  'bridge', 'swap', 'credits', 'membership',
] as const;

export interface UsernameValidation { valid: boolean; reason?: string; }

export function validateUsername(username: string): UsernameValidation {
  const u = username.toLowerCase().trim();
  if (u.length < USERNAME_MIN_LENGTH) return { valid: false, reason: `Username must be at least ${USERNAME_MIN_LENGTH} characters` };
  if (u.length > USERNAME_MAX_LENGTH) return { valid: false, reason: `Username must be at most ${USERNAME_MAX_LENGTH} characters` };
  if (!USERNAME_PATTERN.test(u)) return { valid: false, reason: 'Username can only contain lowercase letters, numbers, and underscores' };
  if ((RESERVED_USERNAMES as readonly string[]).includes(u)) return { valid: false, reason: 'This username is reserved' };
  return { valid: true };
}
