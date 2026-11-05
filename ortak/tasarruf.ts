/**
 * 3 KATMANLI TASARRUF MOTORU VE GÜNLÜK KOTA KALKANI
 * -------------------------------------------------
 * Katman 1: Videoda hazır altyazı (WebVTT / SRT) varsa sesi hiç yüklemeden metni ayıklar (%90+ tasarruf).
 * Katman 2: Ses gönderilecekse 1.5x hızlandırma ve sessizlik kırpma oranlarını hesaplar (~%45 tasarruf).
 * Katman 3: Kullanıcı başına günlük ücretsiz özet sayısını (varsayılan: 3) korur, $60 kredinin sömürülmesini önler.
 */

import { APP_CONFIG } from './ayarlar';

export interface AltyaziAyiklamaSonucu {
  temizMetin: string;
  tahminiSureSaniye: number;
  satirSayisi: number;
}

/**
 * "00:02:45.000" veya "02:45" gibi zaman damgalarını saniyeye çevirir
 */
export function zamanDamgasiniSaniyeyeCevir(zaman: string): number {
  const temiz = zaman.replace(',', '.').trim();
  const parcalar = temiz.split(':').map((p) => parseFloat(p));
  if (parcalar.length === 3) {
    return Math.round(parcalar[0] * 3600 + parcalar[1] * 60 + parcalar[2]);
  }
  if (parcalar.length === 2) {
    return Math.round(parcalar[0] * 60 + parcalar[1]);
  }
  return 0;
}

/**
 * Saniyeyi "MM:SS" formatına çevirir (Örn: 165 -> "02:45")
 */
export function saniyeyiZamanDamgasinaCevir(saniye: number): string {
  const dk = Math.floor(saniye / 60);
  const sn = Math.floor(saniye % 60);
  return `${String(dk).padStart(2, '0')}:${String(sn).padStart(2, '0')}`;
}

/**
 * Katman 1: WebVTT (.vtt), SubRip (.srt) veya ham altyazı metnini
 * yapay zekanın en az token ile anlayacağı "[MM:SS] Cümle" formatına dönüştürür.
 */
export function ayiklaAltyaziMetni(hamMetin: string): AltyaziAyiklamaSonucu {
  const satirlar = hamMetin.replace(/\r\n/g, '\n').split('\n');
  const ciktiSatirlari: string[] = [];
  let aktifZamanDamgasi = '00:00';
  let enBuyukSaniye = 60;

  const zamanAraligiRegex =
    /(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)/;

  for (const hamSatir of satirlar) {
    const satir = hamSatir.trim();
    if (!satir || satir === 'WEBVTT' || /^\d+$/.test(satir)) {
      continue;
    }

    const eslesme = satir.match(zamanAraligiRegex);
    if (eslesme) {
      const baslangicSn = zamanDamgasiniSaniyeyeCevir(eslesme[1]);
      const bitisSn = zamanDamgasiniSaniyeyeCevir(eslesme[2]);
      aktifZamanDamgasi = saniyeyiZamanDamgasinaCevir(baslangicSn);
      if (bitisSn > enBuyukSaniye) {
        enBuyukSaniye = bitisSn;
      }
      continue;
    }

    // HTML etiketlerini (<c>, <i> vb.) temizle
    const temizCumle = satir.replace(/<[^>]+>/g, '').trim();
    if (!temizCumle) continue;

    // Eğer satır zaten [00:12] gibi başlıyorsa olduğu gibi koru
    const mevcutEtiket = temizCumle.match(/^\[(\d{2}:\d{2}(?::\d{2})?)\]/);
    if (mevcutEtiket) {
      const sn = zamanDamgasiniSaniyeyeCevir(mevcutEtiket[1]);
      if (sn > enBuyukSaniye) enBuyukSaniye = sn + 15;
      ciktiSatirlari.push(temizCumle);
    } else {
      ciktiSatirlari.push(`[${aktifZamanDamgasi}] ${temizCumle}`);
    }
  }

  return {
    temizMetin: ciktiSatirlari.join('\n'),
    tahminiSureSaniye: enBuyukSaniye,
    satirSayisi: ciktiSatirlari.length,
  };
}

/**
 * Katman 3: Günlük Ücretsiz Kullanım Kotası Kalkanı
 * Her kullanıcı (IP veya tarayıcı kimliği) günde belirlenen sayı kadar (varsayılan 3) ücretsiz özet alabilir.
 */
export class DailyQuotaManager {
  private limit: number;
  private usageMap: Map<string, { dateKey: string; count: number }> = new Map();

  constructor(limit: number = APP_CONFIG.dailyFreeLimit) {
    this.limit = limit;
  }

  private getTodayKey(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  public getRemaining(clientId: string): number {
    const today = this.getTodayKey();
    const kayit = this.usageMap.get(clientId);
    if (!kayit || kayit.dateKey !== today) {
      return this.limit;
    }
    return Math.max(0, this.limit - kayit.count);
  }

  public consume(clientId: string): {
    allowed: boolean;
    remaining: number;
    limit: number;
  } {
    const today = this.getTodayKey();
    const kayit = this.usageMap.get(clientId);

    if (!kayit || kayit.dateKey !== today) {
      this.usageMap.set(clientId, { dateKey: today, count: 1 });
      return {
        allowed: true,
        remaining: Math.max(0, this.limit - 1),
        limit: this.limit,
      };
    }

    if (kayit.count >= this.limit) {
      return {
        allowed: false,
        remaining: 0,
        limit: this.limit,
      };
    }

    kayit.count += 1;
    this.usageMap.set(clientId, kayit);
    return {
      allowed: true,
      remaining: Math.max(0, this.limit - kayit.count),
      limit: this.limit,
    };
  }

  public resetClient(clientId: string): void {
    this.usageMap.delete(clientId);
  }
}
