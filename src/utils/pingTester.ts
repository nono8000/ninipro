import { ConfigItem, TelegramProxyItem } from '../types';

// ============================================================================
// REAL TCP reachability probing.
//
// Browsers cannot send raw TCP SYN packets, so a "ping" to an arbitrary
// host:port is approximated with fetch() + AbortController timing:
//   - Fast failure/rejection  => host is UNREACHABLE (dead)
//   - TLS/HTTP handshake response (even 4xx/5xx or cert error) => host LIVE
//   - measured wall time => latency estimate (includes handshake overhead)
//
// This is a genuine network probe of the real server — dramatically more
// truthful than random numbers. Note it measures handshake latency, not
// protocol-level speed.
// ============================================================================

const PROBE_TIMEOUT_MS = 4000;

interface ProbeResult { alive: boolean; latencyMs: number | null }

async function probeHost(server: string, port: number): Promise<ProbeResult> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    // https://host:port triggers a real TCP connect + (when TLS) handshake.
    // Any response — even a TLS error thrown quickly — proves the port answered.
    await fetch(`https://${server}:${port}/`, {
      mode: 'no-cors',
      signal: controller.signal,
      // cache must not fake a fast result
      cache: 'no-store',
    });
    // A completed (opaque) response means the TCP+TLS+HTTP stack answered.
    const elapsed = Math.round(performance.now() - started);
    return { alive: true, latencyMs: elapsed };
  } catch (err) {
    const elapsed = Math.round(performance.now() - started);
    if (err instanceof DOMException && err.name === 'AbortError') {
      // Timed out: no answer within budget -> treat as dead/slow
      return { alive: false, latencyMs: null };
    }
    // A fast rejection is ambiguous: it can mean "TCP RST" (dead) OR a TLS
    // certificate failure from a LIVE non-HTTPS service. Heuristic: if the
    // failure came back very quickly (<1200ms) it is usually an immediate
    // connection error (unreachable). Slower failures usually spent time in a
    // real handshake (live host with mismatched TLS).
    if (elapsed >= 1200) {
      return { alive: true, latencyMs: elapsed };
    }
    return { alive: false, latencyMs: null };
  } finally {
    clearTimeout(timer);
  }
}

function classify(pingMs: number | null): ConfigItem['status'] {
  if (pingMs === null) return 'dead';
  if (pingMs > 3000) return 'slow';
  return 'healthy';
}

// Ping single config (real probe)
export async function testConfigPing(
  config: ConfigItem
): Promise<{ ping: number; status: ConfigItem['status'] }> {
  const probe = await probeHost(config.server, config.port);
  const status = classify(probe.latencyMs);
  return { ping: probe.alive ? probe.latencyMs ?? -1 : -1, status: probe.alive ? status : 'dead' };
}

// Batch test all configs with concurrency control
export async function batchTestConfigs(
  configs: ConfigItem[],
  onProgress?: (testedCount: number, total: number, updatedItem: ConfigItem) => void
): Promise<ConfigItem[]> {
  const updatedConfigs = [...configs];
  const concurrency = 8;
  let index = 0;
  let completed = 0;

  async function worker() {
    while (index < updatedConfigs.length) {
      const currentIndex = index++;
      const item = updatedConfigs[currentIndex];

      const { ping, status } = await testConfigPing(item);
      const updated: ConfigItem = {
        ...item,
        ping,
        status,
      };
      updatedConfigs[currentIndex] = updated;
      completed++;

      if (onProgress) {
        onProgress(completed, updatedConfigs.length, updated);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, configs.length) }, () => worker());
  await Promise.all(workers);

  return updatedConfigs;
}

// Ping Telegram proxy (real probe; MTProto ports answer TCP, so same method)
export async function testTelegramProxyPing(
  proxy: TelegramProxyItem
): Promise<{ ping: number; status: TelegramProxyItem['status'] }> {
  const probe = await probeHost(proxy.server, proxy.port);
  if (!probe.alive) return { ping: -1, status: 'dead' };
  const status: TelegramProxyItem['status'] =
    probe.latencyMs !== null && probe.latencyMs > 3000 ? 'slow' : 'healthy';
  return { ping: probe.latencyMs ?? -1, status };
}
