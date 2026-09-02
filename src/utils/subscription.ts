import { SubscriptionUser } from '../types';

const STORAGE_KEY_SUBSCRIBERS = 'ninipro_subscribers_v1';
const STORAGE_KEY_ACTIVE_USER = 'ninipro_active_user_v1';

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

export function getStoredSubscribers(): SubscriptionUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUBSCRIBERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_SUBSCRIBERS, JSON.stringify(DEFAULT_SUBSCRIBERS));
      return DEFAULT_SUBSCRIBERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_SUBSCRIBERS;
  } catch {
    return DEFAULT_SUBSCRIBERS;
  }
}

export function saveSubscribers(list: SubscriptionUser[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SUBSCRIBERS, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save subscribers', err);
  }
}

export function getActiveUser(): SubscriptionUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_USER);
    if (!raw) return null;
    return JSON.parse(raw);
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

export function verifySubscriptionCode(code: string): { success: boolean; user?: SubscriptionUser; error?: string } {
  const raw = (code || '').trim();
  const normalized = normalizeCodeString(raw);
  const cleanAlphaNumeric = normalized.replace(/[^A-Z0-9\u0600-\u06FF]/g, '');

  if (!normalized) {
    return { success: false, error: 'لطفاً کد اشتراک را وارد کنید.' };
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
  const normalized = data.code.trim().toUpperCase();
  if (!normalized) {
    return { success: false, error: 'کد اشتراک نمی‌تواند خالی باشد.' };
  }

  const all = getStoredSubscribers();
  if (all.some(s => s.code.toUpperCase() === normalized)) {
    return { success: false, error: 'این کد اشتراک از قبل تعریف شده است.' };
  }

  const newUser: SubscriptionUser = {
    code: normalized,
    tier: data.tier,
    userName: data.userName.trim() || `کاربر ${normalized}`,
    activatedAt: Date.now(),
    expiresAt: data.days ? Date.now() + data.days * 86400000 : null,
    trafficTotalGB: data.trafficGB,
    trafficUsedGB: 0,
    isAdmin: data.isAdmin,
    status: 'active',
    notes: data.notes,
  };

  const updated = [newUser, ...all];
  saveSubscribers(updated);
  return { success: true, user: newUser };
}
