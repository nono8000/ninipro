import { ChannelSource, ConfigItem } from '../types';
import { parseBulkConfigs } from './configParser';

// ============================================================================
// REAL, LIVE-TESTED public config sources (verified reachable, 2026-09).
// Each entry feeds a specific protocol mix so "دریافت خودکار" actually pulls
// working configs of every supported protocol: VLESS, VMess, Trojan, SS, Hy2.
// ============================================================================
export const DEFAULT_CHANNEL_SOURCES: ChannelSource[] = [
  {
    id: 'ch_epodonios_all',
    name: 'مخزن Epodonios (همه پروتکل‌ها)',
    handle: '@Epodonios',
    url: 'https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/Sub1.txt',
    count: 0,
    status: 'active',
    enabled: true,
  },
  {
    id: 'ch_barryfar_all',
    name: 'V2ray Configs باری‌فر (همه پروتکل‌ها)',
    handle: '@barry_far',
    url: 'https://raw.githubusercontent.com/barry-far/V2ray-Config/main/All_Configs_Sub.txt',
    count: 0,
    status: 'active',
    enabled: true,
  },
  {
    id: 'ch_arshia_mix',
    name: 'v2rayExtractor میکس (Hy2 + VLESS + SS)',
    handle: '@arshiacomplus',
    url: 'https://raw.githubusercontent.com/arshiacomplus/v2rayExtractor/main/mix/sub.html',
    count: 0,
    status: 'active',
    enabled: true,
  },
  {
    id: 'ch_epodonios_vless',
    name: 'VLESS Reality (تفکیک‌شده)',
    handle: '@Epodonios',
    url: 'https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/Splitted-By-Protocol/vless.txt',
    count: 0,
    status: 'active',
    enabled: true,
  },
  {
    id: 'ch_epodonios_trojan',
    name: 'Trojan TLS (تفکیک‌شده)',
    handle: '@Epodonios',
    url: 'https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/Splitted-By-Protocol/trojan.txt',
    count: 0,
    status: 'active',
    enabled: true,
  },
  {
    id: 'ch_epodonios_vmess',
    name: 'VMess CDN (تفکیک‌شده)',
    handle: '@Epodonios',
    url: 'https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/Splitted-By-Protocol/vmess.txt',
    count: 0,
    status: 'active',
    enabled: true,
  },
  {
    id: 'ch_epodonios_ss',
    name: 'Shadowsocks (تفکیک‌شده)',
    handle: '@Epodonios',
    url: 'https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/Splitted-By-Protocol/ss.txt',
    count: 0,
    status: 'active',
    enabled: true,
  },
  {
    id: 'ch_mahdibland',
    name: 'V2RayAggregator (SS + VMess + Trojan)',
    handle: '@mahdibland',
    url: 'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt',
    count: 0,
    status: 'active',
    enabled: true,
  },
];

// Small seed pool so a fresh install has something to show even before the
// first sync (raw public sample configs, replaced by real fetch results).
export const PRELOADED_CONFIGS_RAW = `vless://e4514801-0d5a-42ba-869f-39bd605aef9e@13.135.142.182:22222?encryption=none&security=none&type=tcp#Sample-VLESS-Seed`;

export function getPreloadedConfigs(): ConfigItem[] {
  return parseBulkConfigs(PRELOADED_CONFIGS_RAW, 'auto_pool', 'مخزن اصلی ninipro');
}

// ---------------------------------------------------------------------------
// URL validation: only https, only public hosts (SSRF guard).
// ---------------------------------------------------------------------------
const BLOCKED_URL_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^\[?fc00:/i,
  /^\[?fd/i,
  /\.local$/i,
  /\.internal$/i,
];

export function isValidChannelUrl(url: string): { valid: boolean; reason?: string } {
  if (!url || !url.trim()) return { valid: false, reason: 'لینک خالی است.' };
  if (url.length > 2048) return { valid: false, reason: 'لینک بیش از حد طولانی است.' };

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { valid: false, reason: 'قالب لینک نامعتبر است.' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, reason: 'فقط لینک‌های HTTPS پشتیبانی می‌شوند.' };
  }

  const host = parsed.hostname;
  if (BLOCKED_URL_HOST_PATTERNS.some((re) => re.test(host))) {
    return { valid: false, reason: 'آدرس‌های داخلی و لوکال مجاز نیستند.' };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Robust text fetch: timeout + size cap + base64 auto-decode
// ---------------------------------------------------------------------------
const FETCH_TIMEOUT_MS = 10000;
const MAX_RESPONSE_BYTES = 3_000_000; // 3MB cap per source

async function fetchTextWithLimits(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/plain, text/html, application/json, */*' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) return text.slice(0, MAX_RESPONSE_BYTES);
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

function looksLikeBase64(text: string): boolean {
  const sample = text.slice(0, 200).trim();
  if (sample.includes('://')) return false;
  return /^[A-Za-z0-9+/=\r\n_-]+$/.test(sample);
}

// Fetch configs from one channel source. Returns parsed configs; on failure
// returns an honest error (NO fake generated configs).
export async function fetchChannelConfigs(
  channel: ChannelSource
): Promise<{ success: boolean; configs: ConfigItem[]; error?: string }> {
  const urlCheck = isValidChannelUrl(channel.url);
  if (!urlCheck.valid) {
    return { success: false, configs: [], error: urlCheck.reason };
  }

  try {
    let text = await fetchTextWithLimits(channel.url);

    // Some sources return the whole subscription base64-encoded
    if (looksLikeBase64(text)) {
      const { safeBase64Decode } = await import('./configParser');
      const decoded = safeBase64Decode(text);
      if (decoded && decoded.includes('://')) text = decoded;
    }

    const configs = parseBulkConfigs(text, 'channel', channel.name);
    if (configs.length > 0) {
      return { success: true, configs };
    }
    return {
      success: false,
      configs: [],
      error: 'هیچ کانفیگ معتبری در این منبع یافت نشد.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error && err.name === 'AbortError'
      ? 'زمان انتظار منبع به پایان رسید (Timeout).'
      : 'عدم دسترسی به منبع (خطای شبکه یا CORS).';
    console.warn(`Channel fetch failed for ${channel.name}:`, err);
    return { success: false, configs: [], error: msg };
  }
}
