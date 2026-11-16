/**
 * Core Application Configuration & Localization Dictionary (TR / EN)
 * Centralized runtime parameters, token pricing constants, and i18n strings.
 */

export type DilKodu = 'tr' | 'en';
export type OzetModu = 'quick' | 'detailed' | 'lecture' | 'transcript';
export type TasarrufYontemi = 'caption' | 'compressed_audio' | 'raw_audio';

export const APP_CONFIG = {
  /** Application display name across Web UI and Chrome Extension */
  appName: 'Notly',

  /** Semantic version */
  version: '1.0.0',

  /** Maximum free summaries allowed per client within a 24-hour window */
  dailyFreeLimit: 3,

  /** Initial API credit pool baseline (USD) for usage tracking */
  initialCreditUsd: 60.0,

  /** Approximate USD to TRY conversion rate for dual-currency cost reporting */
  usdToTryRate: 36.5,

  /** Primary multimodal Gemini model identifier */
  defaultModel: 'gemini-2.5-flash',

  /** Audio preprocessing speed factor for token reduction (1.5x = ~33% duration cut) */
  defaultSpeedMultiplier: 1.5,

  /** Gemini pricing parameters (USD per 1M tokens) */
  pricing: {
    audioInputPerMillionUsd: 0.70, // Audio input (1M tokens)
    textInputPerMillionUsd: 0.15,  // Caption/text input (1M tokens)
    textOutputPerMillionUsd: 0.60, // Generated output (1M tokens)
    audioTokensPerSecond: 25,      // 1s audio ≈ 25 tokens
    captionTokensPerSecond: 3.5,   // 1s captions ≈ 3.5 text tokens
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
    modeDetailed: '📋 Detaylı Özet (Ders Kitabı Dili)',
    modeLecture: '🎓 Ders & Sınav Notu',
    modeTranscript: '📝 Tam Metin (Saniye Saniye)',
    actionItemsTitle: '📌 Ders İçi Duyurular, Ödev & Sınav Tarihleri',
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
    modeDetailed: '📋 Detailed Outline (Textbook Style)',
    modeLecture: '🎓 Lecture & Exam Notes',
    modeTranscript: '📝 Full Transcript (Second by Second)',
    actionItemsTitle: '📌 Course Announcements, Deadlines & Exams',
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
