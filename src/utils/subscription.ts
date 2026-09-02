import { SubscriptionUser } from '../types';

const STORAGE_KEY_SUBSCRIBERS = 'ninipro_subscribers_v2';
const STORAGE_KEY_ACTIVE_USER = 'ninipro_active_user_v1';
const STORAGE_KEY_LOGIN_ATTEMPTS = 'ninipro_login_attempts_v1';

// ============================================================================
// INTEGRITY: subscriber records are stored WITH a checksum so that a user who
// hand-edits localStorage cannot promote themselves to admin / extend expiry /
// lift traffic caps. The checksum covers every security-relevant field.
// ============================================================================
const INTEGRITY_SECRET = 'ninipro::v2::9f3a1c7e5b2d4a8f6e0c1b9d7a3f5e2c';

function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`;
  const entries = Object.entries(obj as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

// Deterministic FNV-1a-based digest (sync, no crypto dependency needed).
// Not a cryptographic secret from a determined attacker with the bundle, but it
// reliably stops casual localStorage tampering, and codes themselves are never
// stored in a "free admin for all" form.
function digest(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c + i, 0x85ebca6b) >>> 0;
  }
  const part1 = h1.toString(16).padStart(8, '0');
  const part2 = h2.toString(16).padStart(8, '0');
  const extra = Math.imul(h1 ^ h2, 0xc2b2ae35) >>> 0;
  return `${part1}${part2}${extra.toString(16).padStart(8, '0')}`;
}

export function computeIntegrityToken(sub: Omit<SubscriptionUser, 'integrity'>): string {
  return digest(`${INTEGRITY_SECRET}|${stableStringify(sub)}`);
}

function withIntegrity(sub: SubscriptionUser): SubscriptionUser {
  const { integrity, ...rest } = sub as SubscriptionUser & { integrity?: string };
  return { ...rest, integrity: computeIntegrityToken(rest) } as SubscriptionUser;
}

export function verifyIntegrity(sub: SubscriptionUser | (SubscriptionUser & { integrity?: string })): boolean {
  if (!sub || typeof sub !== 'object') return false;
  const { integrity, ...rest } = sub as SubscriptionUser & { integrity?: string };
  if (!integrity) return false;
  return digest(`${INTEGRITY_SECRET}|${stableStringify(rest)}`) === integrity;
}

// ---------------------------------------------------------------------------
// Default seeded subscribers (all non-admin codes are purchaseable; admin code
// exists once). Traffic/expiry values are what the admin issued.
// ---------------------------------------------------------------------------
export const DEFAULT_SUBSCRIBERS: SubscriptionUser[] = [
  {
    code: 'NINI-MASTER-2026',
    tier: 'admin_unlimited',
    userName: 'مدیر کل (Super Admin)',
    activatedAt: Date.now() - 30 * 86400000,
    expiresAt: null, // Unlimited
    trafficTotalGB: null, // Unlimited
    trafficUsedGB: 0,
    isAdmin: true,
    status: 'active',
    notes: 'کد دسترسی نامحدود مدیریت با دسترسی کامل به پنل ساخت و ابزارها',
  },
  {
    code: 'NINI-VIP',
    tier: 'vip_premium',
    userName: 'کاربر طلایی (VIP User)',
    activatedAt: Date.now() - 5 * 86400000,
    expiresAt: Date.now() + 365 * 86400000,
    trafficTotalGB: null,
    trafficUsedGB: 8.9,
    isAdmin: false,
    status: 'active',
    notes: 'اشتراک ۱ ساله پرسرعت بدون افت پهنای باند',
  },
  {
    code: 'NINI-PRO-2026',
    tier: 'vip_premium',
    userName: 'اشتراک نوروزی ۲۰۲۶',
    activatedAt: Date.now() - 2 * 86400000,
    expiresAt: Date.now() + 180 * 86400000,
    trafficTotalGB: 200,
    trafficUsedGB: 21.5,
    isAdmin: false,
    status: 'active',
    notes: 'اشتراک ۲۰۰ گیگابایتی شش ماهه',
  },
  {
    code: 'TRIAL-7DAYS',
    tier: 'standard',
    userName: 'تست رایگان ۷ روزه',
    activatedAt: Date.now(),
    expiresAt: Date.now() + 7 * 86400000,
    trafficTotalGB: 25,
    trafficUsedGB: 1.2,
    isAdmin: false,
    status: 'active',
    notes: 'اشتراک تست رایگان اولیه',
  },
];

// Codes that must never be deletable from the admin panel.
export const PROTECTED_CODES = ['NINI-MASTER-2026'];

function seedDefaults(): SubscriptionUser[] {
  const seeded = DEFAULT_SUBSCRIBERS.map(withIntegrity);
  try {
    localStorage.setItem(STORAGE_KEY_SUBSCRIBERS, JSON.stringify(seeded));
  } catch { /* storage unavailable */ }
  return seeded;
}

export function getStoredSubscribers(): SubscriptionUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUBSCRIBERS);
    if (!raw) return seedDefaults();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return seedDefaults();

    // Drop any record that fails integrity or has an invalid shape — this is
    // what makes hand-forged "isAdmin: true" records useless.
    const valid = parsed.filter((s) => {
      if (!s || typeof s !== 'object') return false;
      if (typeof s.code !== 'string' || !s.code) return false;
      if (typeof s.isAdmin !== 'boolean') return false;
      if (!verifyIntegrity(s as SubscriptionUser)) return false;
      return true;
    }) as SubscriptionUser[];

    if (valid.length === 0) return seedDefaults();
    // Ensure the protected master admin code always exists.
    if (!valid.some((s) => PROTECTED_CODES.includes(s.code))) {
      const master = withIntegrity(DEFAULT_SUBSCRIBERS[0]);
      valid.unshift(master);
      saveSubscribers(valid);
    }
    return valid;
  } catch {
    return seedDefaults();
  }
}

export function saveSubscribers(list: SubscriptionUser[]): void {
  try {
    const stamped = list.map(withIntegrity);
    localStorage.setItem(STORAGE_KEY_SUBSCRIBERS, JSON.stringify(stamped));
  } catch (err) {
    console.error('Failed to save subscribers', err);
  }
}

// ---------------------------------------------------------------------------
// Brute-force protection: max 5 failed attempts per 15 minutes.
// ---------------------------------------------------------------------------
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

interface AttemptRecord { count: number; firstAt: number }

export function isLoginLocked(): { locked: boolean; remainingSec: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGIN_ATTEMPTS);
    if (!raw) return { locked: false, remainingSec: 0 };
    const rec = JSON.parse(raw) as AttemptRecord;
    const elapsed = Date.now() - rec.firstAt;
    if (elapsed > ATTEMPT_WINDOW_MS) {
      localStorage.removeItem(STORAGE_KEY_LOGIN_ATTEMPTS);
      return { locked: false, remainingSec: 0 };
    }
    if (rec.count >= MAX_ATTEMPTS) {
      return { locked: true, remainingSec: Math.ceil((ATTEMPT_WINDOW_MS - elapsed) / 1000) };
    }
    return { locked: false, remainingSec: 0 };
  } catch {
    return { locked: false, remainingSec: 0 };
  }
}

export function recordFailedAttempt(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGIN_ATTEMPTS);
    const rec: AttemptRecord = raw ? JSON.parse(raw) : { count: 0, firstAt: Date.now() };
    if (Date.now() - rec.firstAt > ATTEMPT_WINDOW_MS) {
      rec.count = 0;
      rec.firstAt = Date.now();
    }
    rec.count += 1;
    localStorage.setItem(STORAGE_KEY_LOGIN_ATTEMPTS, JSON.stringify(rec));
  } catch { /* storage unavailable */ }
}

export function clearFailedAttempts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_LOGIN_ATTEMPTS);
  } catch { /* storage unavailable */ }
}

// ---------------------------------------------------------------------------
// Active session
// ---------------------------------------------------------------------------
export function getActiveUser(): SubscriptionUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_USER);
    if (!raw) return null;
    const user = JSON.parse(raw) as SubscriptionUser;
    // Session records must pass integrity too, otherwise treat as logged out.
    if (!verifyIntegrity(user)) {
      setActiveUser(null);
      return null;
    }
    // Re-check expiry/traffic at read time so an old session expires live.
    if (user.expiresAt && user.expiresAt < Date.now()) {
      setActiveUser(null);
      return null;
    }
    if (user.trafficTotalGB && user.trafficUsedGB >= user.trafficTotalGB) {
      setActiveUser(null);
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function setActiveUser(user: SubscriptionUser | null): void {
  try {
    if (!user) {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
    } else {
      localStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(user));
    }
  } catch (err) {
    console.error('Failed to set active user', err);
  }
}

// Helper to normalize Persian/Arabic digits and characters
export function normalizeCodeString(input: string): string {
  if (!input) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  let result = input.trim();
  for (let i = 0; i < 10; i++) {
    result = result.replaceAll(persianDigits[i], String(i));
    result = result.replaceAll(arabicDigits[i], String(i));
  }
  // Strip zero-width non-joiner and surrounding quotes
  result = result.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/['"]/g, '');
  return result.toUpperCase();
}

// Input hardening for the login field: cap length and strip control chars.
export function sanitizeLoginInput(input: string): string {
  return input
    .slice(0, 64)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '');
}

export function verifySubscriptionCode(code: string): { success: boolean; user?: SubscriptionUser; error?: string } {
  const raw = sanitizeLoginInput((code || '').trim());
  const normalized = normalizeCodeString(raw);
  const cleanAlphaNumeric = normalized.replace(/[^A-Z0-9]/g, '');

  if (!normalized) {
    return { success: false, error: 'لطفاً کد اشتراک را وارد کنید.' };
  }

  // Brute-force lock check
  const lock = isLoginLocked();
  if (lock.locked) {
    const mins = Math.ceil(lock.remainingSec / 60);
    return {
      success: false,
      error: `به دلیل تلاش‌های ناموفق زیاد، ورود موقتاً قفل شده است. ${mins} دقیقه دیگر دوباره تلاش کنید.`,
    };
  }

  // Strict check: admin access ONLY via admin codes stored in the system.
  // No generic word matches (e.g. "admin", "root", "ادمین") — those are regular
  // text and must never grant admin privileges.
  const allSubscribers = getStoredSubscribers();
  const matched = allSubscribers.find(
    s =>
      s.code.toUpperCase() === normalized ||
      normalizeCodeString(s.code) === normalized ||
      s.code.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanAlphaNumeric
  );

  if (!matched) {
    recordFailedAttempt();
    return {
      success: false,
      error: 'کد اشتراک وارد شده در سیستم ثبت نشده است. برای خرید کد اشتراک با پشتیبانی در تماس باشید.',
    };
  }

  if (matched.status === 'suspended') {
    return { success: false, error: 'این کد اشتراک توسط مدیریت مسدود شده است.' };
  }

  if (matched.expiresAt && matched.expiresAt < Date.now()) {
    return { success: false, error: 'اعتبار زمانی این کد اشتراک به پایان رسیده است.' };
  }

  if (matched.trafficTotalGB && matched.trafficUsedGB >= matched.trafficTotalGB) {
    return { success: false, error: 'حجم ترافیک مجاز این کد اشتراک به پایان رسیده است.' };
  }

  clearFailedAttempts();
  setActiveUser(matched);
  return { success: true, user: matched };
}

export function createNewSubscriptionCode(
  data: {
    code: string;
    userName: string;
    tier: SubscriptionUser['tier'];
    days: number | null; // null = unlimited
    trafficGB: number | null; // null = unlimited
    isAdmin: boolean;
    notes?: string;
  }
): { success: boolean; user?: SubscriptionUser; error?: string } {
  const normalized = sanitizeLoginInput(data.code.trim().toUpperCase());
  if (!normalized) {
    return { success: false, error: 'کد اشتراک نمی‌تواند خالی باشد.' };
  }
  if (normalized.length > 64) {
    return { success: false, error: 'کد اشتراک بیش از حد طولانی است (حداکثر ۶۴ کاراکتر).' };
  }

  const all = getStoredSubscribers();
  if (all.some(s => s.code.toUpperCase() === normalized)) {
    return { success: false, error: 'این کد اشتراک از قبل تعریف شده است.' };
  }

  const newUser: SubscriptionUser = {
    code: normalized,
    tier: data.tier,
    userName: data.userName.trim().slice(0, 80) || `کاربر ${normalized}`,
    activatedAt: Date.now(),
    expiresAt: data.days ? Date.now() + data.days * 86400000 : null,
    trafficTotalGB: data.trafficGB,
    trafficUsedGB: 0,
    isAdmin: data.isAdmin,
    status: 'active',
    notes: data.notes?.slice(0, 200),
  };

  const updated = [newUser, ...all];
  saveSubscribers(updated);
  return { success: true, user: newUser };
}
