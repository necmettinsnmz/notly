/**
 * Notly API Proxy Server
 * ----------------------
 * Secure Node.js proxy protecting server-side GEMINI_API_KEY credentials,
 * enforcing per-client daily free quotas, logging sanitized cost telemetry,
 * and handling multimodal requests from both the Web PWA and Chrome Extension.
 */

import http, { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_CONFIG } from '../ortak/ayarlar';
import { Logger } from '../ortak/log';
import { DailyQuotaManager } from '../ortak/tasarruf';
import { uretAkilliOzet, OzetIstegi } from '../ortak/ozetleyici';

const MAX_BODY_BYTES = 64 * 1024 * 1024; // 64 MB limit for long lecture audio payloads
let lastEnvMtimeMs = -1;

/**
 * Loads or reloads environment variables from `.env` when updated on disk.
 */
function yukleEnvDosyasi(): void {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;

    const stat = fs.statSync(envPath);
    if (stat.mtimeMs === lastEnvMtimeMs) return;
    lastEnvMtimeMs = stat.mtimeMs;

    const icerik = fs.readFileSync(envPath, 'utf-8');
    for (const satir of icerik.split('\n')) {
      const temiz = satir.trim();
      if (!temiz || temiz.startsWith('#')) continue;
      const esittirIdx = temiz.indexOf('=');
      if (esittirIdx === -1) continue;
      const anahtar = temiz.slice(0, esittirIdx).trim();
      const deger = temiz.slice(esittirIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (anahtar && deger) {
        process.env[anahtar] = deger;
      }
    }
  } catch {
    // Fall back to existing process.env values if .env cannot be read
  }
}

yukleEnvDosyasi();

class PayloadTooLargeError extends Error {
  constructor() {
    super('Request payload exceeds maximum 64 MB limit.');
    this.name = 'PayloadTooLargeError';
  }
}

function gonderJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id',
  });
  res.end(JSON.stringify(payload));
}

function okuIstekGovdesi(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const parcalar: Buffer[] = [];
    let toplamBayt = 0;
    let asildi = false;

    req.on('data', (chunk: Buffer) => {
      if (asildi) return;
      toplamBayt += chunk.length;
      if (toplamBayt > MAX_BODY_BYTES) {
        asildi = true;
        reject(new PayloadTooLargeError());
        return;
      }
      parcalar.push(chunk);
    });
    req.on('end', () => {
      if (!asildi) {
        resolve(Buffer.concat(parcalar).toString('utf-8'));
      }
    });
    req.on('error', reject);
  });
}

function alKullaniciKimligi(req: IncomingMessage): string {
  const baslikId = req.headers['x-client-id'];
  if (typeof baslikId === 'string' && baslikId.trim()) {
    return baslikId.trim();
  }
  return req.socket.remoteAddress || 'yerel_kullanici';
}

export function createNotlyServer() {
  const logger = new Logger();
  const gunlukLimit = Number(process.env.DAILY_FREE_LIMIT || APP_CONFIG.dailyFreeLimit);
  const kotaYoneticisi = new DailyQuotaManager(gunlukLimit);

  logger.info('SUNUCU', `${APP_CONFIG.appName} v${APP_CONFIG.version} Proxy Sunucusu başlatıldı.`);

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      gonderJson(res, 200, { ok: true });
      return;
    }

    // Pick up runtime .env changes without requiring a server restart
    yukleEnvDosyasi();

    const url = new URL(req.url || '/', 'http://localhost');
    const clientId = alKullaniciKimligi(req);
    const hasLiveApiKey = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10
    );

    // 1. Sağlık ve Durum Kontrolü
    if (req.method === 'GET' && url.pathname === '/api/health') {
      gonderJson(res, 200, {
        ok: true,
        appName: APP_CONFIG.appName,
        version: APP_CONFIG.version,
        liveGeminiConnected: hasLiveApiKey,
        modeLabel: hasLiveApiKey
          ? 'Canlı Gemini 2.5 Flash Aktif (API Anahtarı Korumalı)'
          : 'Yerel Metin Analizi Modu (Ses/Video için GEMINI_API_KEY gerekli)',
        quota: {
          remaining: kotaYoneticisi.getRemaining(clientId),
          limit: gunlukLimit,
        },
        stats: logger.getStats(),
      });
      return;
    }

    // 2. Günlük Kota Sorgulama
    if (req.method === 'GET' && url.pathname === '/api/quota') {
      gonderJson(res, 200, {
        remaining: kotaYoneticisi.getRemaining(clientId),
        limit: gunlukLimit,
      });
      return;
    }

    // 3. Test İçin Günlük Kotayı Sıfırlama (Geliştirici Paneli Butonu)
    if (req.method === 'POST' && url.pathname === '/api/quota/reset') {
      kotaYoneticisi.resetClient(clientId);
      logger.info('KOTA', `Kullanıcı (${clientId}) günlük kotası sıfırlandı.`);
      gonderJson(res, 200, {
        ok: true,
        remaining: kotaYoneticisi.getRemaining(clientId),
        limit: gunlukLimit,
      });
      return;
    }

    // 4. Geliştirici Log ve Maliyet Paneli Verileri
    if (req.method === 'GET' && url.pathname === '/api/logs') {
      gonderJson(res, 200, {
        stats: logger.getStats(),
        logs: logger.getLogs(),
        usageHistory: logger.getUsageHistory(),
      });
      return;
    }

    // 4.1 Gemini API Anahtarı Kaydetme
    if (req.method === 'POST' && url.pathname === '/api/settings/key') {
      try {
        const hamGovde = await okuIstekGovdesi(req);
        const { apiKey } = JSON.parse(hamGovde) as { apiKey?: unknown };
        const temizAnahtar = typeof apiKey === 'string' ? apiKey.trim() : '';

        if (!temizAnahtar.startsWith('AIza') || temizAnahtar.length < 20) {
          gonderJson(res, 400, {
            ok: false,
            message: 'Geçersiz API anahtarı formatı. Google AI Studio anahtarı "AIza" ile başlamalı ve en az 20 karakter olmalıdır.',
          });
          return;
        }

        process.env.GEMINI_API_KEY = temizAnahtar;
        const envPath = path.resolve(process.cwd(), '.env');
        let mevcutSatirlar: string[] = [];
        if (fs.existsSync(envPath)) {
          mevcutSatirlar = fs
            .readFileSync(envPath, 'utf-8')
            .split('\n')
            .filter((s) => !s.trim().startsWith('GEMINI_API_KEY='));
        }
        const guncelIcerik = [
          `GEMINI_API_KEY=${temizAnahtar}`,
          ...mevcutSatirlar.map((s) => s.trimEnd()).filter(Boolean),
          ...(mevcutSatirlar.some((s) => s.trim().startsWith('PORT=')) ? [] : ['PORT=5173']),
        ].join('\n') + '\n';

        fs.writeFileSync(envPath, guncelIcerik, 'utf-8');
        lastEnvMtimeMs = fs.statSync(envPath).mtimeMs;
        logger.info('AYAR', 'Gemini API anahtarı yapılandırıldı ve canlı model etkinleştirildi.');
        gonderJson(res, 200, { ok: true, message: 'Canlı Gemini 2.5 Flash aktif!' });
        return;
      } catch (err) {
        const status = err instanceof PayloadTooLargeError ? 413 : 400;
        gonderJson(res, status, { ok: false, error: err instanceof Error ? err.message : String(err) });
        return;
      }
    }

    // 5. Ana Özetleme Endpoint'i
    if (req.method === 'POST' && url.pathname === '/api/summarize') {
      try {
        const kotaDurumu = kotaYoneticisi.consume(clientId);
        if (!kotaDurumu.allowed) {
          logger.warn('KOTA', `Kullanıcı (${clientId}) günlük ücretsiz sınırı aştı.`);
          gonderJson(res, 429, {
            error: 'QUOTA_EXCEEDED',
            message:
              'Günlük ücretsiz 3 özet hakkı doldu. Geliştirici panelinden test için kotayı sıfırlayabilirsiniz.',
            quota: kotaDurumu,
          });
          return;
        }

        const hamGovde = await okuIstekGovdesi(req);
        const veri = JSON.parse(hamGovde) as OzetIstegi;

        const ozet = await uretAkilliOzet(
          {
            ...veri,
            apiKey: process.env.GEMINI_API_KEY,
          },
          logger
        );

        gonderJson(res, 200, {
          summary: ozet,
          quota: kotaDurumu,
          stats: logger.getStats(),
        });
      } catch (hata) {
        const isTooLarge = hata instanceof PayloadTooLargeError;
        const mesaj = hata instanceof Error ? hata.message : String(hata);
        logger.error('SUNUCU_HATA', `Özetleme sırasında hata: ${mesaj}`);
        gonderJson(res, isTooLarge ? 413 : 500, {
          error: isTooLarge ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR',
          message: mesaj,
        });
      }
      return;
    }

    gonderJson(res, 404, { error: 'NOT_FOUND', path: url.pathname });
  });

  return server;
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const port = Number(process.env.PORT || 8787);
  const srv = createNotlyServer();
  srv.listen(port, () => {
    console.log(`\n🚀 [${APP_CONFIG.appName}] API Proxy Server running at http://localhost:${port}`);
    console.log(`🛡️  Health & Quota endpoint: http://localhost:${port}/api/health\n`);
  });
}
