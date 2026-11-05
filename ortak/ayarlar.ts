/**
 * ORTAK AYARLAR VE ÇOKLU DİL (TR / EN) SÖZLÜĞÜ
 * ---------------------------------------------
 * Bu dosya projenin "Kumanda Merkezi"dir.
 * Uygulamanın adını, günlük ücretsiz kullanım hakkını veya ekrandaki yazıları
 * değiştirmek istediğinde sadece bu dosyadaki değerleri değiştirmen yeterlidir!
 */

export type DilKodu = 'tr' | 'en';
export type OzetModu = 'quick' | 'detailed' | 'lecture' | 'transcript';
export type TasarrufYontemi = 'caption' | 'compressed_audio' | 'raw_audio';

export const APP_CONFIG = {
  /** Uygulamanın görünen adı — buradan değiştirdiğinde tüm sitede ve eklentide değişir */
  appName: 'Notly',

  /** Sürüm numarası */
  version: '0.1.0',

  /** Ücretsiz bir kullanıcının 24 saat içinde yapabileceği maksimum özet sayısı */
  dailyFreeLimit: 3,

  /** Google AI Studio'dan aldığın başlangıç kredisi ($) */
  initialCreditUsd: 60.0,

  /** Dolar -> TL tahmini kur (Geliştirici panelinde TL karşılığını görmek için) */
  usdToTryRate: 36.5,

  /** Kullanılacak yapay zeka modeli (Tek satırdan değiştirilebilir) */
  defaultModel: 'gemini-2.5-flash',

  /** Sesi sıkıştırırken varsayılan hızlandırma oranı (1.5x = %33 daha kısa süre) */
  defaultSpeedMultiplier: 1.5,

  /** Fiyatlandırma sabitleri (1 Milyon Token başına USD) */
  pricing: {
    audioInputPerMillionUsd: 0.70, // Ses girdisi (1M token)
    textInputPerMillionUsd: 0.15,  // Metin/Altyazı girdisi (1M token - 4.5x daha ucuz!)
    textOutputPerMillionUsd: 0.60, // Üretilen özet çıktısı (1M token)
    audioTokensPerSecond: 25,      // 1 saniye ses = ~25 token
    captionTokensPerSecond: 3.5,   // 1 saniye konuşma altyazısı = ~3.5 metin tokeni
  },
} as const;

/**
 * TÜRKÇE VE İNGİLİZCE ARAYÜZ METİNLERİ
 */
export const CEVIRILER = {
  tr: {
    appTagline: 'Ses, WhatsApp Mesajı ve Ders Videolarından Anında Akıllı Notlar',
    heroTitle: 'Ses ve Videoları Saniyeler İçinde Özetle',
    heroSubtitle:
      'API anahtarı veya karmaşık ayar gerekmez. Dosyanı bırak, ses kaydet veya ders videosunu yakala; 4 farklı modda notun hazır olsun.',
    remainingQuotaLabel: 'Bugünkü Ücretsiz Hakkın',
    dropzoneTitle: 'Ses veya Video Dosyasını Buraya Sürükle & Bırak',
    dropzoneSubtitle: 'MP3, WAV, M4A, OGG (WhatsApp), MP4, WebM desteklenir',
    recordButton: 'Mikrofonla Kaydet',
    stopRecordButton: 'Kaydı Bitir',
    pasteTranscriptLabel: 'Veya Hazır Video Altyazısı / Ders Metni Yapıştır (Sıfır Ses Maliyeti ⚡)',
    pasteTranscriptPlaceholder:
      'YouTube/Moodle altyazısını, toplantı metnini veya örnek ders içeriğini buraya yapıştırabilirsin...',
    sampleButton: 'Örnek Ders ile Hemen Dene (Demo)',
    sampleWhatsAppButton: 'Örnek WhatsApp Sesi Dene',
    compressionToggleLabel: 'Akıllı Ses Sıkıştırma (1.5x Hız + Sessizlik Kırpma → ~%45 Tasarruf)',
    summarizeButton: 'Şimdi Özetle ve Not Çıkar',
    processingText: 'Yapay zeka içeriği analiz ediyor...',
    modeQuick: '⚡ Hap Özet',
    modeDetailed: '📋 Detaylı Özet',
    modeLecture: '🎓 Ders & Sınav Notu',
    modeTranscript: '📝 Tam Metin',
    actionItemsTitle: '📌 Yapılacaklar, Tarihler ve Kararlar',
    examQuestionsTitle: '🎯 Sınavda Çıkabilecek Sorular (Cevap için tıkla)',
    keyConceptsTitle: '📖 Temel Kavramlar ve Tanımlar',
    copyWhatsApp: '📲 WhatsApp İçin Kopyala',
    downloadMarkdown: '📄 Markdown (.md) İndir',
    printPdf: '🖨️ PDF Ders Notu Yazdır',
    devPanelButton: '🛠️ Log & Maliyet Paneli',
    historyTitle: '🕘 Geçmiş Özetlerim',
    noHistoryText: 'Henüz bir özet çıkarmadın. Yukarıdan örnek bir dersle hemen dene!',
    costSavedBadge: 'Tasarruf Motoru Aktif',
    quotaExceededError: 'Günlük ücretsiz 3 özet hakkın doldu. Yarın sıfırlanacak veya Pro pakete geçebilirsin.',
    buyCoffeeBtn: '☕ Destek Ol',
    upgradeProBtn: '⚡ Pro Sınırsız',
    proModalTitle: '⚡ Notly Pro — Sınırsız Ders ve Ses Özeti',
    proModalSubtitle: 'Günde 3 özet sınırını kaldır; 2-3 saatlik uzun sınav kayıtlarını, otomatik sınav tahminlerini ve sınırsız PDF ders notunu aç.',
    proPriceText: 'Aylık 99 ₺ (Öğrenci İndirimi) veya $3.99 / ay',
    coffeeModalTitle: '☕ Notly Geliştiricisine Bir Kahve Ismarla',
    coffeeModalSubtitle: 'Notly bağımsız bir öğrenci projesidir. Sunucu ve yapay zeka altyapı masraflarına katkıda bulunmak istersen dilediğin tutarda destek olabilirsin!',
  },
  en: {
    appTagline: 'Instant Smart Notes from Audio, WhatsApp Voice & Lecture Videos',
    heroTitle: 'Summarize Audio and Videos in Seconds',
    heroSubtitle:
      'No API key or complex setup needed. Drop a file, record voice, or capture a lecture tab; get smart notes in 4 modes.',
    remainingQuotaLabel: 'Daily Free Quota Left',
    dropzoneTitle: 'Drag & Drop Audio or Video File Here',
    dropzoneSubtitle: 'Supports MP3, WAV, M4A, OGG (WhatsApp), MP4, WebM',
    recordButton: 'Record Microphone',
    stopRecordButton: 'Stop Recording',
    pasteTranscriptLabel: 'Or Paste Video Captions / Lecture Text (Zero Audio Cost ⚡)',
    pasteTranscriptPlaceholder:
      'Paste YouTube/Moodle captions, meeting text, or lecture notes here...',
    sampleButton: 'Try with Sample Lecture (Demo)',
    sampleWhatsAppButton: 'Try Sample WhatsApp Voice',
    compressionToggleLabel: 'Smart Audio Compression (1.5x Speed + Silence Trim → ~45% Savings)',
    summarizeButton: 'Summarize & Generate Notes',
    processingText: 'AI is analyzing your content...',
    modeQuick: '⚡ Quick Summary',
    modeDetailed: '📋 Detailed Breakdown',
    modeLecture: '🎓 Lecture & Exam Notes',
    modeTranscript: '📝 Full Transcript',
    actionItemsTitle: '📌 Action Items, Dates & Decisions',
    examQuestionsTitle: '🎯 Potential Exam Questions (Click to reveal answer)',
    keyConceptsTitle: '📖 Key Concepts & Definitions',
    copyWhatsApp: '📲 Copy for WhatsApp',
    downloadMarkdown: '📄 Download Markdown (.md)',
    printPdf: '🖨️ Print / Save PDF Notes',
    devPanelButton: '🛠️ Logs & Cost Panel',
    historyTitle: '🕘 My Past Summaries',
    noHistoryText: 'No summaries yet. Try a sample lecture above!',
    costSavedBadge: 'Savings Engine Active',
    quotaExceededError: 'Your 3 free daily summaries are used up. Resets tomorrow or upgrade to Pro.',
    buyCoffeeBtn: '☕ Buy Coffee',
    upgradeProBtn: '⚡ Go Pro',
    proModalTitle: '⚡ Notly Pro — Unlimited Lecture & Voice Notes',
    proModalSubtitle: 'Lift the 3/day quota. Unlock 2-3 hour long midterm recordings, auto exam prep questions, and unlimited PDF lecture exports.',
    proPriceText: '$3.99 / month (Special Student Rate) or 99 ₺',
    coffeeModalTitle: '☕ Support the Student Creator',
    coffeeModalSubtitle: 'Notly is an independent student project. If it helped you save time in class, support the server & API costs with a coffee!',
  },
} as const;

export type CeviriAnahtari = keyof typeof CEVIRILER.tr;

/**
 * Seçilen dile göre doğru metni getiren yardımcı fonksiyon
 */
export function t(dil: DilKodu, anahtar: CeviriAnahtari): string {
  return CEVIRILER[dil][anahtar];
}
