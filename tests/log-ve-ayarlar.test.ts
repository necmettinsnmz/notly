import { describe, it, expect, beforeEach } from 'vitest';
import { APP_CONFIG, CEVIRILER, t } from '../ortak/ayarlar';
import { Logger, hesaplaMaliyetVeTasarruf } from '../ortak/log';

describe('Aşama 1: Ortak Ayarlar ve Dil Sistemi (TR / EN)', () => {
  it('Uygulama adı tek bir merkezden okunabilmeli', () => {
    expect(APP_CONFIG.appName).toBe('Notly');
    expect(APP_CONFIG.dailyFreeLimit).toBe(3);
    expect(APP_CONFIG.initialCreditUsd).toBe(60);
  });

  it('Türkçe ve İngilizce sözlüklerdeki tüm anahtarlar birebir eşleşmeli', () => {
    const trKeys = Object.keys(CEVIRILER.tr).sort();
    const enKeys = Object.keys(CEVIRILER.en).sort();
    expect(trKeys).toEqual(enKeys);
    expect(t('tr', 'heroTitle')).toContain('Ses');
    expect(t('en', 'heroTitle')).toContain('Audio');
  });
});

describe('Aşama 1: Log Sistemi ve 3 Katmanlı Maliyet/Tasarruf Ölçer', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger();
  });

  it('Gizli API anahtarlarını log mesajlarından otomatik maskelemeli (Güvenlik)', () => {
    const kayit = logger.info(
      'API',
      'İstek gönderildi: key=AIzaSyD9876543210abcdef1234567890_xyz',
      { apiKey: 'AIzaSySecretKeyValue123456789' }
    );

    expect(kayit.message).not.toContain('AIzaSyD9876543210abcdef1234567890_xyz');
    expect(kayit.message).toContain('[GIZLI_ANAHTAR_KORUNDU]');
    expect(JSON.stringify(kayit.details)).toContain('[GIZLI_ANAHTAR_KORUNDU]');
  });

  it('Katman 1 (Hazır Altyazı) kullanıldığında %85 üzerinde tasarruf hesaplamalı', () => {
    // 60 dakikalık (3600 saniye) bir ders videosu
    const sonuc = hesaplaMaliyetVeTasarruf({
      durationSeconds: 3600,
      method: 'caption',
      outputTokens: 1500,
    });

    expect(sonuc.method).toBe('caption');
    expect(sonuc.actualCostUsd).toBeLessThan(0.01);
    expect(sonuc.rawAudioBaselineUsd).toBeGreaterThan(0.05);
    expect(sonuc.savedPercent).toBeGreaterThan(85);
  });

  it('Katman 2 (1.5x Sıkıştırılmış Ses) kullanıldığında ~%35-50 tasarruf sağlamalı', () => {
    // 30 dakikalık (1800 saniye) ses kaydı
    const sonuc = hesaplaMaliyetVeTasarruf({
      durationSeconds: 1800,
      method: 'compressed_audio',
      outputTokens: 1000,
    });

    expect(sonuc.actualCostUsd).toBeLessThan(sonuc.rawAudioBaselineUsd);
    expect(sonuc.savedPercent).toBeGreaterThanOrEqual(30);
  });

  it('$60 başlangıç kredisinden kalan bakiyeyi doğru takip etmeli', () => {
    logger.recordUsage({
      durationSeconds: 1800,
      method: 'caption',
      outputTokens: 1200,
      mode: 'lecture',
      title: 'Fizik 101 - Ders 1',
      durationMs: 3400,
    });

    const ozet = logger.getStats();
    expect(ozet.totalRequests).toBe(1);
    expect(ozet.totalSavedUsd).toBeGreaterThan(0);
    expect(ozet.remainingCreditUsd).toBeLessThan(60);
    expect(ozet.remainingCreditUsd).toBeGreaterThan(59.98);
  });
});
