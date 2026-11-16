import { describe, it, expect, beforeEach } from 'vitest';
import { ayiklaAltyaziMetni, DailyQuotaManager } from '../ortak/tasarruf';
import { uretAkilliOzet, formatWhatsAppMetni, formatMarkdownMetni } from '../ortak/ozetleyici';
import { Logger } from '../ortak/log';

describe('Aşama 2: 3 Katmanlı Tasarruf Motoru ve Kota Kalkanı', () => {
  it('WebVTT ve SRT altyazı dosyalarını temiz zaman damgalı metne dönüştürmeli (Katman 1)', () => {
    const ornekVtt = `WEBVTT

1
00:00:12.000 --> 00:00:18.500
Merhaba arkadaşlar, bugün Newton'un hareket yasalarını işleyeceğiz.

2
00:02:45.000 --> 00:02:55.000
Sınavda özellikle ikinci yasa olan F = m.a formülünden soru gelecek.`;

    const sonuc = ayiklaAltyaziMetni(ornekVtt);
    expect(sonuc.temizMetin).toContain('[00:12]');
    expect(sonuc.temizMetin).toContain('Newton');
    expect(sonuc.temizMetin).toContain('[02:45]');
    expect(sonuc.tahminiSureSaniye).toBeGreaterThanOrEqual(165);
    expect(sonuc.satirSayisi).toBe(2);
  });

  it('Kullanıcı başına günlük 3 ücretsiz özet sınırını korumalı (Katman 3 - Kota Kalkanı)', () => {
    const kota = new DailyQuotaManager(3);
    const kullaniciId = 'ogrenci_test_ip_1';

    expect(kota.getRemaining(kullaniciId)).toBe(3);
    expect(kota.consume(kullaniciId).allowed).toBe(true);
    expect(kota.consume(kullaniciId).allowed).toBe(true);
    expect(kota.consume(kullaniciId).allowed).toBe(true);
    expect(kota.getRemaining(kullaniciId)).toBe(0);

    // 4. istek engellenmeli!
    const dorduncuIstek = kota.consume(kullaniciId);
    expect(dorduncuIstek.allowed).toBe(false);
    expect(dorduncuIstek.remaining).toBe(0);
  });
});

describe('Aşama 2: 4 Modlu Tek Seferde Özetleme ve Dışa Aktarma (WhatsApp & Markdown)', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger();
  });

  it('Tek bir işlemde 4 modu (Hap, Detaylı, Ders Notu, Transkript) eksiksiz üretmeli', async () => {
    const sonuc = await uretAkilliOzet(
      {
        title: 'Bilgisayar Ağları - TCP/IP Ders 3',
        language: 'tr',
        durationSeconds: 900,
        method: 'caption',
        transcriptOrCaptionText:
          '[00:10] Bugün TCP ve UDP protokollerinin farklarını inceliyoruz.\n[04:20] TCP bağlantı yönelimlidir ve paketlerin sırayla gitmesini garanti eder.\n[09:15] Haftaya cuma günü 14:00\'te laboratuvar sınavı yapılacaktır.',
      },
      logger
    );

    // 1. Hap Özet kontrolü
    expect(sonuc.quick.oneLiner.length).toBeGreaterThan(10);
    expect(sonuc.quick.bullets.length).toBeGreaterThan(0);
    expect(sonuc.quick.actionItems.length).toBeGreaterThan(0);

    // 2. Detaylı Özet kontrolü
    expect(sonuc.detailed.sections.length).toBeGreaterThan(0);

    // 3. Ders Notu & Sınav Soruları kontrolü
    expect(sonuc.lecture.concepts.length).toBeGreaterThan(0);
    expect(sonuc.lecture.examQuestions.length).toBeGreaterThan(0);
    expect(sonuc.lecture.examQuestions[0].question).toBeTruthy();
    expect(sonuc.lecture.examQuestions[0].answer).toBeTruthy();

    // 4. Tam Transkript kontrolü
    expect(sonuc.transcript.segments.length).toBeGreaterThan(0);

    // 5. Maliyet ve Tasarruf log kontrolü
    expect(sonuc.cost.method).toBe('caption');
    expect(sonuc.cost.savedPercent).toBeGreaterThan(80);
  });

  it('Özeti WhatsApp ve Markdown formatlarına temiz şekilde dönüştürmeli', async () => {
    const sonuc = await uretAkilliOzet(
      {
        title: 'Proje Toplantısı',
        language: 'tr',
        durationSeconds: 300,
        method: 'compressed_audio',
        transcriptOrCaptionText: '[00:05] Pazartesi saat 10:00 sunum teslimi var.',
      },
      logger
    );

    const wp = formatWhatsAppMetni(sonuc, 'tr');
    const md = formatMarkdownMetni(sonuc, 'tr');

    expect(wp).toContain('*Proje Toplantısı*');
    expect(md).toContain('# Proje Toplantısı');
    expect(md).toContain('## 🎯');
  });

  it('API anahtarı olmadan ham ses gönderildiğinde açık kurulum yönergesi döndürmeli', async () => {
    const oncekiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const sonuc = await uretAkilliOzet(
        {
          title: 'Canlı Ses Kaydı',
          language: 'tr',
          durationSeconds: 180,
          method: 'compressed_audio',
          mediaBase64: 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8=',
          mediaMimeType: 'audio/webm',
        },
        logger
      );
      expect(sonuc.usedLiveApi).toBe(false);
      expect(sonuc.quick.oneLiner).toContain('GEMINI_API_KEY');
    } finally {
      if (oncekiKey !== undefined) {
        process.env.GEMINI_API_KEY = oncekiKey;
      }
    }
  });
});
