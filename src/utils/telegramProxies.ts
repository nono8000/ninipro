import { TelegramProxyItem, TelegramProxyProtocol } from '../types';
import { parseSingleConfig } from './configParser';

// ============================================================================
// Telegram proxy sources — REAL live channels & feeds (verified 2026-09).
// The app fetches these at runtime; nothing below is hard-coded fake data.
// ============================================================================

// Official support/promo channels shown as one-click cards in the TG tab.
export const TG_CHANNELS = [
  {
    id: 'chan_dicodeir',
    name: 'دی‌کد (dicodeir)',
    handle: '@dicodeir',
    url: 'https://t.me/dicodeir',
    description: 'آموزش و ابزارهای پروکسی و فیلترشکن',
    gradient: 'from-sky-500 to-blue-600',
  },
  {
    id: 'chan_persianvpnhub',
    name: 'پرشین VPN هاب',
    handle: '@persianvpnhub',
    url: 'https://t.me/persianvpnhub',
    description: 'پروکسی و کانفیگ رایگان روزانه',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'chan_proxyir01',
    name: 'پروکسی ایران ۰۱',
    handle: '@proxyir01',
    url: 'https://t.me/proxyir01',
    description: 'پروکسی‌های تازه MTProto و Socks',
    gradient: 'from-purple-500 to-indigo-600',
  },
];

// Live public feeds that the Telegram tab syncs from:
//  - Argh94/Proxy-List: MTProto (tg://proxy links), SOCKS5, HTTPS, Hysteria2
//  - SoliSpirit/mtproto: MTProto proxies
//  - hookzof/socks5_list: SOCKS5 proxies
export const TG_PROXY_SOURCES = [
  {
    id: 'src_argh_mtproto',
    name: 'MTProto ایران (آرش)',
    url: 'https://raw.githubusercontent.com/Argh94/Proxy-List/main/MTProto.txt',
    kind: 'tg_links' as const,
  },
  {
    id: 'src_soli_mtproto',
    name: 'MTProto جهانی (SoliSpirit)',
    url: 'https://raw.githubusercontent.com/SoliSpirit/mtproto/master/all_proxies.txt',
    kind: 'tg_links' as const,
  },
  {
    id: 'src_argh_socks',
    name: 'SOCKS5 روزانه',
    url: 'https://raw.githubusercontent.com/Argh94/Proxy-List/main/SOCKS5.txt',
    kind: 'socks_lines' as const,
  },
  {
    id: 'src_hookz_socks',
    name: 'SOCKS5 جهانی (hookzof)',
    url: 'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
    kind: 'socks_lines' as const,
  },
  {
    id: 'src_argh_https',
    name: 'HTTPS پروکسی',
    url: 'https://raw.githubusercontent.com/Argh94/Proxy-List/main/HTTPS.txt',
    kind: 'tg_links' as const,
  },
];

// Empty by default: the real proxies arrive from TG_PROXY_SOURCES sync.
// (Old hard-coded fake proxies removed — they never worked.)
export const INITIAL_TELEGRAM_PROXIES: TelegramProxyItem[] = [];

// ---------------------------------------------------------------------------
// tg:// / https://t.me/proxy link -> TelegramProxyItem
// ---------------------------------------------------------------------------
export function parseTgProxyUrl(url: string): TelegramProxyItem | null {
  try {
    const clean = url.trim();
    if (!clean) return null;

    // V2Ray URI? delegate to config converter
    if (
      clean.startsWith('vless://') ||
      clean.startsWith('vmess://') ||
      clean.startsWith('trojan://') ||
      clean.startsWith('ss://') ||
      clean.startsWith('hysteria2://') ||
      clean.startsWith('hy2://') ||
      clean.startsWith('tuic://')
    ) {
      return convertV2RayToTelegramProxy(clean);
    }

    // Telegram proxy url formats
    const isSocks = clean.includes('socks?') || clean.includes('/socks?');
    const isHttp = clean.includes('http?') || clean.includes('/http?');
    const isMtproto = clean.includes('proxy?') || clean.includes('/proxy?');

    if (!isSocks && !isHttp && !isMtproto) {
      // Try raw host:port:secret or host:port:user:pass
      const parts = clean.split(':');
      if (parts.length >= 3) {
        const server = parts[0];
        const port = parseInt(parts[1], 10);
        const secret = parts.slice(2).join(':');
        if (server && !isNaN(port)) {
          const isTlsSecret = secret.startsWith('ee') || secret.length >= 32;
          return {
            id: `tg_parsed_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            title: `پروکسی ${server}:${port}`,
            server,
            port,
            secret,
            ping: null,
            status: 'untested',
            country: 'سرور اختصاصی',
            countryCode: 'NET',
            flag: '🌐',
            type: isTlsSecret ? 'mtproto' : 'socks5',
            protocolDetails: isTlsSecret ? 'MTProto TLS 1.3' : 'Socks5',
            isCustom: true,
          };
        }
      }
      return null;
    }

    const queryStr = clean.split('?')[1];
    if (!queryStr) return null;

    const params = new URLSearchParams(queryStr);
    const server = params.get('server');
    const port = parseInt(params.get('port') || '443', 10);
    const secret = params.get('secret') || params.get('pass') || '';
    const user = params.get('user') || undefined;
    const pass = params.get('pass') || undefined;

    if (!server) return null;

    let type: TelegramProxyProtocol = 'mtproto';
    if (isSocks) type = 'socks5';
    if (isHttp) type = 'http';

    const isTlsSecret = type === 'mtproto' && (secret.startsWith('ee') || secret.startsWith('dd') || secret.length >= 16);

    return {
      id: `tg_parsed_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      server,
      port,
      secret,
      user,
      pass,
      type,
      title: `پروکسی ${type === 'mtproto' ? 'MTProto' : type.toUpperCase()} - ${server}`,
      country: 'پروکسی تلگرام',
      countryCode: 'NET',
      flag: '📡',
      ping: null,
      status: 'untested',
      protocolDetails: isTlsSecret ? 'MTProto (TLS-مقلوب)' : `${type.toUpperCase()} (دریافت از کانال)`,
      isCustom: false,
    };
  } catch {
    return null;
  }
}

/** Parses bulk text containing many tg:// links or socks5://host:port lines */
export function parseBulkTgProxies(text: string): TelegramProxyItem[] {
  if (!text) return [];
  if (text.length > 2_000_000) text = text.slice(0, 2_000_000);

  const items: TelegramProxyItem[] = [];
  const seen = new Set<string>();
  const lines = text.split(/[\r\n]+/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    let proxy: TelegramProxyItem | null = null;

    if (trimmed.includes('proxy?') || trimmed.includes('socks?') || trimmed.includes('http?')) {
      proxy = parseTgProxyUrl(trimmed);
    } else if (trimmed.startsWith('socks5://') || trimmed.startsWith('socks4://')) {
      // format: socks5://host:port
      const rest = trimmed.substring(trimmed.indexOf('://') + 3);
      const [host, portStr] = rest.split(':');
      const port = parseInt(portStr, 10);
      if (host && !isNaN(port)) {
        proxy = {
          id: `tg_socks_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          title: `SOCKS5 ${host}`,
          server: host,
          port,
          secret: '',
          ping: null,
          status: 'untested',
          country: 'پروکسی Socks',
          countryCode: 'NET',
          flag: '🧦',
          type: 'socks5',
          protocolDetails: 'SOCKS5 (بدون احراز هویت)',
          isCustom: false,
        };
      }
    }

    if (proxy) {
      const key = `${proxy.server}:${proxy.port}:${proxy.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push(proxy);
      }
      if (items.length >= 300) break; // cap
    }
  }

  return items;
}

/**
 * Fetches all TG_PROXY_SOURCES and returns aggregated unique proxies.
 */
export async function fetchAllTgProxies(): Promise<{
  proxies: TelegramProxyItem[];
  errors: string[];
}> {
  const all: TelegramProxyItem[] = [];
  const errors: string[] = [];

  for (const src of TG_PROXY_SOURCES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(src.url, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = parseBulkTgProxies(text);
      all.push(...parsed);
    } catch {
      errors.push(src.name);
    }
  }

  // Global dedupe by server:port:type
  const seen = new Set<string>();
  const unique = all.filter((p) => {
    const key = `${p.server}:${p.port}:${p.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { proxies: unique.slice(0, 400), errors };
}

export function getTelegramProxyLinks(proxy: TelegramProxyItem): {
  appLink: string;
  webLink: string;
  copyableText: string;
  quickInfo: string;
} {
  const user = proxy.user || 'ninipro';
  const pass = proxy.pass || proxy.secret;

  switch (proxy.type) {
    case 'mtproto': {
      const encodedSecret = encodeURIComponent(proxy.secret);
      return {
        appLink: `tg://proxy?server=${proxy.server}&port=${proxy.port}&secret=${encodedSecret}`,
        webLink: `https://t.me/proxy?server=${proxy.server}&port=${proxy.port}&secret=${encodedSecret}`,
        copyableText: `tg://proxy?server=${proxy.server}&port=${proxy.port}&secret=${proxy.secret}`,
        quickInfo: `MTProto: ${proxy.server}:${proxy.port}`,
      };
    }

    case 'socks5': {
      const encodedUser = encodeURIComponent(user);
      const encodedPass = encodeURIComponent(pass);
      const hasAuth = !!proxy.user || (proxy.pass && proxy.pass !== 'none');
      const authQuery = hasAuth ? `&user=${encodedUser}&pass=${encodedPass}` : '';
      return {
        appLink: `tg://socks?server=${proxy.server}&port=${proxy.port}${authQuery}`,
        webLink: `https://t.me/socks?server=${proxy.server}&port=${proxy.port}${authQuery}`,
        copyableText: `tg://socks?server=${proxy.server}&port=${proxy.port}${authQuery}`,
        quickInfo: `Socks5: ${proxy.server}:${proxy.port}`,
      };
    }

    case 'http': {
      const encodedUser = encodeURIComponent(user);
      const encodedPass = encodeURIComponent(pass);
      return {
        appLink: `tg://http?server=${proxy.server}&port=${proxy.port}&user=${encodedUser}&pass=${encodedPass}`,
        webLink: `https://t.me/http?server=${proxy.server}&port=${proxy.port}&user=${encodedUser}&pass=${encodedPass}`,
        copyableText: `http://${proxy.user ? `${proxy.user}:${proxy.pass}@` : ''}${proxy.server}:${proxy.port}`,
        quickInfo: `HTTP Proxy: ${proxy.server}:${proxy.port}`,
      };
    }

    // For V2Ray/Xray based protocols (VLESS, VMess, Trojan, Shadowsocks, Hysteria2)
    case 'vless':
    case 'vmess':
    case 'trojan':
    case 'ss':
    case 'hysteria2':
    case 'tuic':
    case 'wireguard': {
      const rawUri = proxy.v2rayRawConfig || `${proxy.type}://${proxy.secret}@${proxy.server}:${proxy.port}`;
      // In local inbound routing mode for Telegram Desktop / Android, Telegram routes to 127.0.0.1:10808 (Socks) or 10809 (HTTP)
      // We provide instant Socks5 one-click link + Full V2Ray URI
      return {
        appLink: `tg://socks?server=127.0.0.1&port=10808`,
        webLink: `https://t.me/socks?server=127.0.0.1&port=10808`,
        copyableText: rawUri,
        quickInfo: `${proxy.type.toUpperCase()}: ${proxy.server}:${proxy.port} (Inbound 10808)`,
      };
    }

    default: {
      const encodedSecret = encodeURIComponent(proxy.secret);
      return {
        appLink: `tg://proxy?server=${proxy.server}&port=${proxy.port}&secret=${encodedSecret}`,
        webLink: `https://t.me/proxy?server=${proxy.server}&port=${proxy.port}&secret=${encodedSecret}`,
        copyableText: proxy.secret,
        quickInfo: `${proxy.server}:${proxy.port}`,
      };
    }
  }
}

/**
 * Converts ANY V2Ray/Xray config (VLESS, VMess, Trojan, SS, Hy2) directly into a Telegram Proxy Item
 */
export function convertV2RayToTelegramProxy(rawText: string): TelegramProxyItem | null {
  const parsed = parseSingleConfig(rawText, 'manual');
  if (!parsed) return null;

  const protocol = parsed.protocol as TelegramProxyProtocol;

  return {
    id: `tg_conv_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    title: `${parsed.flag} ${parsed.name || `پروکسی تلگرام ${protocol.toUpperCase()}`}`,
    server: parsed.server,
    port: parsed.port,
    secret: parsed.raw.split('@')[0]?.split('://')[1] || parsed.raw,
    ping: null,
    status: 'untested',
    country: parsed.country,
    countryCode: parsed.countryCode,
    flag: parsed.flag,
    type: protocol,
    protocolDetails: `${protocol.toUpperCase()} ${parsed.security || 'TLS'} (${parsed.network || 'TCP'})`,
    v2rayRawConfig: parsed.raw,
    isCustom: true,
  };
}

export function generateFakeTlsSecret(customDomain?: string): string {
  const domains = [
    { name: 'google.com', hex: '676f6f676c652e636f6d' },
    { name: 'cloudflare.com', hex: '636c6f7564666c6172652e636f6d' },
    { name: 'telegram.org', hex: '74656c656772616d2e6f7267' },
    { name: 'yandex.ru', hex: '79616e6465782e7275' },
    { name: 'microsoft.com', hex: '6d6963726f736f66742e636f6d' },
    { name: 'digikala.com', hex: '646967696b616c612e636f6d' },
  ];

  let domainHex = domains[0].hex;
  if (customDomain) {
    domainHex = Array.from(customDomain)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');
  } else {
    const randDom = domains[Math.floor(Math.random() * domains.length)];
    domainHex = randDom.hex;
  }

  let randomHex = '';
  const chars = '0123456789abcdef';
  for (let i = 0; i < 32; i++) {
    randomHex += chars[Math.floor(Math.random() * chars.length)];
  }
  return `ee${randomHex}${domainHex}`;
}
