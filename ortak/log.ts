/**
 * LOG SİSTEMİ VE 3 KATMANLI MALİYET / TASARRUF ÖLÇER
 * ---------------------------------------------------
 * Bu dosya iki kritik işi yapar:
 * 1. Uygulamada olan her adımı kaydeder (ama API anahtarı gibi gizli bilgileri otomatik maskeler).
 * 2. Her özetleme işleminde kaç token harcandığını, kaç sent/kuruş tuttuğunu,
 *    tasarruf motorumuzun ne kadar para kurtardığını ve $60 krediden ne kadar kaldığını hesaplar.
 */

import { APP_CONFIG, OzetModu, TasarrufYontemi } from './ayarlar';

export type LogSeviyesi = 'INFO' | 'WARN' | 'ERROR' | 'COST';

export interface LogKaydi {
  id: string;
  timestamp: string;
  level: LogSeviyesi;
  category: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface MaliyetHesabiGirdisi {
  /** Ses veya videonun orijinal süresi (saniye) */
  durationSeconds: number;
  /** Hangi tasarruf katmanı kullanıldı? */
  method: TasarrufYontemi;
  /** Yapay zekanın ürettiği özetin yaklaşık token sayısı */
  outputTokens: number;
}

export interface MaliyetHesabiSonucu {
  method: TasarrufYontemi;
  inputTokens: number;
  outputTokens: number;
  /** Bu işlem için harcanan gerçek tutar ($) */
  actualCostUsd: number;
  /** Gerçek tutarın TL karşılığı (₺) */
  actualCostTry: number;
  /** Eğer tasarruf motoru olmasaydı (ham ses/video gitseydi) harcanacak tutar ($) */
  rawAudioBaselineUsd: number;
  /** Cebimizde kalan / kurtarılan tutar ($) */
  savedUsd: number;
  /** Kurtarılan yüzde (%) */
  savedPercent: number;
}

export interface KullanimKaydi extends MaliyetHesabiSonucu {
  id: string;
  timestamp: string;
  title: string;
  mode: OzetModu;
  durationSeconds: number;
  durationMs: number;
}

/**
 * Metin içindeki olası Google API anahtarlarını (AIza...) veya gizli alanları maskeler.
 */
export function maskeleGizliBilgi(metin: string): string {
  // Google API anahtarları genellikle "AIza" ile başlar
  return metin
    .replace(/AIza[0-9A-Za-z\-_]{10,}/g, '[GIZLI_ANAHTAR_KORUNDU]')
    .replace(/(apiKey|api_key|secret|token)\s*[:=]\s*["']?[^\s"',}]+/gi, '$1=[GIZLI_ANAHTAR_KORUNDU]');
}

/**
 * 3 Katmanlı Tasarruf Motorunun Maliyet Hesaplayıcısı
 */
export function hesaplaMaliyetVeTasarruf(girdi: MaliyetHesabiGirdisi): MaliyetHesabiSonucu {
  const { durationSeconds, method, outputTokens } = girdi;
  const p = APP_CONFIG.pricing;

  // Referans: Hiç sıkıştırma yapmadan ham ses gönderilseydi ne tutardı?
  const rawInputTokens = Math.ceil(durationSeconds * p.audioTokensPerSecond);
  const outputCostUsd = (outputTokens / 1_000_000) * p.textOutputPerMillionUsd;
  const rawAudioBaselineUsd =
    (rawInputTokens / 1_000_000) * p.audioInputPerMillionUsd + outputCostUsd;

  let inputTokens = rawInputTokens;
  let inputCostUsd = 0;

  if (method === 'caption') {
    // Katman 1: Hazır altyazı/metin kullanıldı -> Ses tokeni yerine çok ucuz metin tokeni!
    inputTokens = Math.ceil(durationSeconds * p.captionTokensPerSecond);
    inputCostUsd = (inputTokens / 1_000_000) * p.textInputPerMillionUsd;
  } else if (method === 'compressed_audio') {
    // Katman 2: Ses 1.5x hızlandırıldı ve sessizlikler (~%12) kırpıldı
    const effectiveSeconds = (durationSeconds / APP_CONFIG.defaultSpeedMultiplier) * 0.88;
    inputTokens = Math.ceil(effectiveSeconds * p.audioTokensPerSecond);
    inputCostUsd = (inputTokens / 1_000_000) * p.audioInputPerMillionUsd;
  } else {
    // Katman 3: Ham ses
    inputTokens = rawInputTokens;
    inputCostUsd = (inputTokens / 1_000_000) * p.audioInputPerMillionUsd;
  }

  const actualCostUsd = Number((inputCostUsd + outputCostUsd).toFixed(6));
  const baselineRounded = Number(rawAudioBaselineUsd.toFixed(6));
  const savedUsd = Number(Math.max(0, baselineRounded - actualCostUsd).toFixed(6));
  const savedPercent =
    baselineRounded > 0 ? Math.round((savedUsd / baselineRounded) * 100) : 0;

  return {
    method,
    inputTokens,
    outputTokens,
    actualCostUsd,
    actualCostTry: Number((actualCostUsd * APP_CONFIG.usdToTryRate).toFixed(4)),
    rawAudioBaselineUsd: baselineRounded,
    savedUsd,
    savedPercent,
  };
}

/**
 * Uygulama İçi Log ve İstatistik Yöneticisi
 */
export class Logger {
  private logs: LogKaydi[] = [];
  private usageHistory: KullanimKaydi[] = [];

  private sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!details) return undefined;
    const raw = JSON.stringify(details);
    return JSON.parse(maskeleGizliBilgi(raw));
  }

  public log(
    level: LogSeviyesi,
    category: string,
    message: string,
    details?: Record<string, unknown>
  ): LogKaydi {
    const kayit: LogKaydi = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      message: maskeleGizliBilgi(message),
      details: this.sanitizeDetails(details),
    };
    this.logs.unshift(kayit);
    // Hafızanın şişmemesi için son 200 logu tut
    if (this.logs.length > 200) {
      this.logs.pop();
    }
    return kayit;
  }

  public info(category: string, message: string, details?: Record<string, unknown>): LogKaydi {
    return this.log('INFO', category, message, details);
  }

  public warn(category: string, message: string, details?: Record<string, unknown>): LogKaydi {
    return this.log('WARN', category, message, details);
  }

  public error(category: string, message: string, details?: Record<string, unknown>): LogKaydi {
    return this.log('ERROR', category, message, details);
  }

  public recordUsage(params: {
    durationSeconds: number;
    method: TasarrufYontemi;
    outputTokens: number;
    mode: OzetModu;
    title: string;
    durationMs: number;
  }): KullanimKaydi {
    const hesap = hesaplaMaliyetVeTasarruf({
      durationSeconds: params.durationSeconds,
      method: params.method,
      outputTokens: params.outputTokens,
    });

    const kayit: KullanimKaydi = {
      ...hesap,
      id: `use_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      title: params.title,
      mode: params.mode,
      durationSeconds: params.durationSeconds,
      durationMs: params.durationMs,
    };

    this.usageHistory.unshift(kayit);
    this.log(
      'COST',
      'TASARRUF_MOTORU',
      `"${params.title}" özetlendi (${params.method}) — Harcanan: $${hesap.actualCostUsd} | Tasarruf: %${hesap.savedPercent}`,
      {
        inputTokens: hesap.inputTokens,
        outputTokens: hesap.outputTokens,
        actualCostUsd: hesap.actualCostUsd,
        savedUsd: hesap.savedUsd,
        durationMs: params.durationMs,
      }
    );

    return kayit;
  }

  public getLogs(): LogKaydi[] {
    return [...this.logs];
  }

  public getUsageHistory(): KullanimKaydi[] {
    return [...this.usageHistory];
  }

  public getStats() {
    const totalSpentUsd = Number(
      this.usageHistory.reduce((acc, item) => acc + item.actualCostUsd, 0).toFixed(6)
    );
    const totalSavedUsd = Number(
      this.usageHistory.reduce((acc, item) => acc + item.savedUsd, 0).toFixed(6)
    );
    const remainingCreditUsd = Number(
      Math.max(0, APP_CONFIG.initialCreditUsd - totalSpentUsd).toFixed(4)
    );

    return {
      totalRequests: this.usageHistory.length,
      totalSpentUsd,
      totalSpentTry: Number((totalSpentUsd * APP_CONFIG.usdToTryRate).toFixed(2)),
      totalSavedUsd,
      totalSavedTry: Number((totalSavedUsd * APP_CONFIG.usdToTryRate).toFixed(2)),
      remainingCreditUsd,
    };
  }
}

export const globalLogger = new Logger();
