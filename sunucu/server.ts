/**
 * GİZLİ KÖPRÜ SUNUCU (BACKEND PROXY)
 * ----------------------------------
 * Bu sunucu:
 * 1. Senin Google AI Studio API anahtarını (.env dosyasından) gizli tutar, tarayıcıya sızdırmaz.
 * 2. Kullanıcı başına günlük ücretsiz 3 özet hakkını (Kota Kalkanı) kontrol eder.
 * 3. Hem Web Sitesinden hem de Chrome Eklentisinden gelen istekleri karşılar.
 * 4. Tüm işlemleri ve maliyetleri Geliştirici Log Paneline kaydeder.
 */

import http, { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_CONFIG } from '../ortak/ayarlar';
import { Logger } from '../ortak/log';
import { DailyQuotaManager } from '../ortak/tasarruf';
import { uretAkilliOzet, OzetIstegi } from '../ortak/ozetleyici';

/**
 * .env dosyası varsa içindeki anahtarları okur
 */
function yukleEnvDosyasi(): void {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;
    const icerik = fs.readFileSync(envPath, 'utf-8');
    for (const satir of icerik.split('\n')) {
      const temiz = satir.trim();
      if (!temiz || temiz.startsWith('#')) continue;
      const esittirIdx = temiz.indexOf('=');
      if (esittirIdx === -1) continue;
      const anahtar = temiz.slice(0, esittirIdx).trim();
      const deger = temiz.slice(esittirIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (anahtar && !process.env[anahtar]) {
        process.env[anahtar] = deger;
      }
    }
  } catch {
    // .env okunamazsa varsayılan ortam değişkenleriyle devam et
  }
}

yukleEnvDosyasi();

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
    req.on('data', (chunk: Buffer) => parcalar.push(chunk));
    req.on('end', () => resolve(Buffer.concat(parcalar).toString('utf-8')));
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

  logger.info('SUNUCU', `${APP_CONFIG.appName} Gizli Köprü Sunucusu başlatıldı.`);

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      gonderJson(res, 200, { ok: true });
      return;
    }

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
          ? 'Canlı Gemini API Aktif ($60 Kredi Korumalı)'
          : 'Akıllı Yerel/Demo Motoru Aktif (.env içine GEMINI_API_KEY eklenince canlıya geçer)',
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
        const { apiKey } = JSON.parse(hamGovde);
        if (typeof apiKey === 'string' && apiKey.trim().length > 10) {
          process.env.GEMINI_API_KEY = apiKey.trim();
          const envPath = path.resolve(process.cwd(), '.env');
          fs.writeFileSync(envPath, `GEMINI_API_KEY=${apiKey.trim()}\nPORT=5173\n`);
          logger.info('AYAR', 'Gemini API anahtarı kaydedildi ve canlı mod aktif edildi.');
          gonderJson(res, 200, { ok: true, message: 'Canlı Gemini 2.5 Flash aktif!' });
          return;
        } else {
          gonderJson(res, 400, { ok: false, message: 'Geçersiz API anahtarı formatı.' });
          return;
        }
      } catch (err) {
        gonderJson(res, 500, { ok: false, error: String(err) });
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
              'Günlük ücretsiz 3 özet hakkın doldu. Geliştirici panelinden test için kotayı sıfırlayabilirsin.',
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
        const mesaj = hata instanceof Error ? hata.message : String(hata);
        logger.error('SUNUCU_HATA', `Özetleme sırasında hata: ${mesaj}`);
        gonderJson(res, 500, {
          error: 'INTERNAL_ERROR',
          message: mesaj,
        });
      }
      return;
    }

    gonderJson(res, 404, { error: 'NOT_FOUND', path: url.pathname });
  });

  return server;
}

// Eğer bu dosya doğrudan çalıştırıldıysa (npm run dev:server) portu dinle
const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const port = Number(process.env.PORT || 8787);
  const srv = createNotlyServer();
  srv.listen(port, () => {
    console.log(`\n🚀 [${APP_CONFIG.appName}] Gizli Köprü Sunucu çalışıyor: http://localhost:${port}`);
    console.log(`🛡️  Sağlık ve Kota Kontrolü: http://localhost:${port}/api/health\n`);
  });
}
