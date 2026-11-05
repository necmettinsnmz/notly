/**
 * NOTLY — ANA WEB UYGULAMASI (TR / EN ÇİFT DİLLİ)
 * -----------------------------------------------
 * Kullanıcının hiçbir API anahtarı girmeden ses, video veya ders altyazısını
 * 4 farklı modda özetlediği, zaman damgalarına tıklayarak kayıtta gezindiği
 * ve senin Geliştirici Panelinden tüm logları/maliyetleri izlediğin ekran.
 */

import { APP_CONFIG, DilKodu, OzetModu, TasarrufYontemi, t } from '../ortak/ayarlar';
import {
  BirlesikOzetSonucu,
  SlaytKaresi,
  formatMarkdownMetni,
  formatWhatsAppMetni,
} from '../ortak/ozetleyici';
import { zamanDamgasiniSaniyeyeCevir } from '../ortak/tasarruf';
import { ORNEK_DERS_VERISI, ORNEK_WHATSAPP_SESI } from './ornekVeriler';

interface UygulamaDurumu {
  dil: DilKodu;
  tema: 'dark' | 'light';
  aktifMod: OzetModu;
  baslik: string;
  altyaziMetni: string;
  sureSaniye: number;
  yontem: TasarrufYontemi;
  sikistirmaAktif: boolean;
  slaytlar: SlaytKaresi[];
  medyaUrl: string | null;
  medyaBase64: string | null;
  medyaMimeType: string | null;
  yukleniyor: boolean;
  hataMesaji: string | null;
  bildirimMesaji: string | null;
  aktifOzet: BirlesikOzetSonucu | null;
  gecmis: BirlesikOzetSonucu[];
  acikSinavSorulari: Set<number>;
  kalanKota: number;
  kotaLimiti: number;
  devPanelAcik: boolean;
  proModalAcik: boolean;
  coffeeModalAcik: boolean;
  kayitYapiliyor: boolean;
  sunucuDurumu: {
    modeLabel: string;
    stats: {
      totalRequests: number;
      totalSpentUsd: number;
      totalSpentTry: number;
      totalSavedUsd: number;
      totalSavedTry: number;
      remainingCreditUsd: number;
    };
    logs: Array<{
      id: string;
      timestamp: string;
      level: string;
      category: string;
      message: string;
    }>;
  };
}

const GECMIS_STORAGE_KEY = 'notly_gecmis_v1';
const CLIENT_ID_KEY = 'notly_client_id';

function alTarayiciKimligi(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = `usr_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

function yukleGecmis(): BirlesikOzetSonucu[] {
  try {
    const ham = localStorage.getItem(GECMIS_STORAGE_KEY);
    return ham ? JSON.parse(ham) : [];
  } catch {
    return [];
  }
}

function kaydetGecmis(liste: BirlesikOzetSonucu[]): void {
  try {
    localStorage.setItem(GECMIS_STORAGE_KEY, JSON.stringify(liste.slice(0, 25)));
  } catch {
    // Hafıza doluysa yoksay
  }
}

const state: UygulamaDurumu = {
  dil: 'tr',
  tema: 'dark',
  aktifMod: 'quick',
  baslik: '',
  altyaziMetni: '',
  sureSaniye: 300,
  yontem: 'caption',
  sikistirmaAktif: true,
  slaytlar: [],
  medyaUrl: null,
  medyaBase64: null,
  medyaMimeType: null,
  yukleniyor: false,
  hataMesaji: null,
  bildirimMesaji: null,
  aktifOzet: null,
  gecmis: yukleGecmis(),
  acikSinavSorulari: new Set([0]),
  kalanKota: APP_CONFIG.dailyFreeLimit,
  kotaLimiti: APP_CONFIG.dailyFreeLimit,
  devPanelAcik: false,
  proModalAcik: false,
  coffeeModalAcik: false,
  kayitYapiliyor: false,
  sunucuDurumu: {
    modeLabel: 'Yükleniyor...',
    stats: {
      totalRequests: 0,
      totalSpentUsd: 0,
      totalSpentTry: 0,
      totalSavedUsd: 0,
      totalSavedTry: 0,
      remainingCreditUsd: APP_CONFIG.initialCreditUsd,
    },
    logs: [],
  },
};

if (state.gecmis.length > 0) {
  state.aktifOzet = state.gecmis[0];
}

let mediaRecorderRef: MediaRecorder | null = null;
let kayitParcalari: BlobPart[] = [];

async function yenileSunucuVeLoglar(): Promise<void> {
  try {
    const clientId = alTarayiciKimligi();
    const [healthRes, logsRes] = await Promise.all([
      fetch('/api/health', { headers: { 'X-Client-Id': clientId } }),
      fetch('/api/logs', { headers: { 'X-Client-Id': clientId } }),
    ]);

    if (healthRes.ok) {
      const h = await healthRes.json();
      state.kalanKota = h.quota.remaining;
      state.kotaLimiti = h.quota.limit;
      state.sunucuDurumu.modeLabel = h.modeLabel;
      state.sunucuDurumu.stats = h.stats;
    }
    if (logsRes.ok) {
      const l = await logsRes.json();
      state.sunucuDurumu.logs = l.logs || [];
      state.sunucuDurumu.stats = l.stats || state.sunucuDurumu.stats;
    }
    render();
  } catch {
    // Çevrimdışıysa varsayılan değerlerle devam et
  }
}

function gosterBildirim(mesaj: string): void {
  state.bildirimMesaji = mesaj;
  render();
  setTimeout(() => {
    state.bildirimMesaji = null;
    render();
  }, 3200);
}

async function calistirOzetleme(): Promise<void> {
  if (!state.baslik.trim() && !state.altyaziMetni.trim() && !state.medyaBase64) {
    // Kullanıcı hiçbir şey seçmeden direkt "Özetle"ye bastıysa örnek dersi yükle
    yukleOrnekDers();
  }

  state.yukleniyor = true;
  state.hataMesaji = null;
  render();

  try {
    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': alTarayiciKimligi(),
      },
      body: JSON.stringify({
        title:
          state.baslik.trim() ||
          (state.dil === 'tr' ? 'Ses / Video Kaydı Özeti' : 'Audio / Video Summary'),
        language: state.dil,
        durationSeconds: state.sureSaniye,
        method: state.altyaziMetni.trim()
          ? 'caption'
          : state.sikistirmaAktif
            ? 'compressed_audio'
            : 'raw_audio',
        transcriptOrCaptionText: state.altyaziMetni,
        mediaBase64: state.medyaBase64 ?? undefined,
        mediaMimeType: state.medyaMimeType ?? undefined,
        slides: state.slaytlar,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      state.hataMesaji =
        data.error === 'QUOTA_EXCEEDED'
          ? t(state.dil, 'quotaExceededError')
          : data.message || 'Bir hata oluştu.';
      state.yukleniyor = false;
      render();
      return;
    }

    const yeniOzet: BirlesikOzetSonucu = data.summary;
    state.aktifOzet = yeniOzet;
    state.kalanKota = data.quota.remaining;
    state.sunucuDurumu.stats = data.stats;
    state.gecmis = [yeniOzet, ...state.gecmis.filter((g) => g.id !== yeniOzet.id)];
    kaydetGecmis(state.gecmis);

    state.yukleniyor = false;
    await yenileSunucuVeLoglar();
  } catch (err) {
    state.yukleniyor = false;
    state.hataMesaji = err instanceof Error ? err.message : 'Bağlantı hatası';
    render();
  }
}

function yukleOrnekDers(): void {
  const ornek = ORNEK_DERS_VERISI[state.dil];
  state.baslik = ornek.title;
  state.altyaziMetni = ornek.transcript;
  state.sureSaniye = ornek.durationSeconds;
  state.yontem = 'caption';
  state.slaytlar = ornek.slides;
  state.aktifMod = 'lecture';
  render();
}

function yukleOrnekWhatsApp(): void {
  const ornek = ORNEK_WHATSAPP_SESI[state.dil];
  state.baslik = ornek.title;
  state.altyaziMetni = ornek.transcript;
  state.sureSaniye = ornek.durationSeconds;
  state.yontem = 'compressed_audio';
  state.slaytlar = [];
  state.aktifMod = 'quick';
  render();
}

function atlaZamanDamgasina(zaman: string): void {
  const saniye = zamanDamgasiniSaniyeyeCevir(zaman);
  const oynatici = document.getElementById('medya-oynatici') as HTMLMediaElement | null;
  if (oynatici) {
    oynatici.currentTime = saniye;
    oynatici.play().catch(() => {});
  }
  gosterBildirim(
    state.dil === 'tr'
      ? `⏩ Kayıtta ${zaman} (${saniye}. saniye) noktasına atlandı.`
      : `⏩ Jumped to ${zaman} (${saniye}s) in recording.`
  );
}

async function sifirlaGunlukKota(): Promise<void> {
  await fetch('/api/quota/reset', {
    method: 'POST',
    headers: { 'X-Client-Id': alTarayiciKimligi() },
  });
  await yenileSunucuVeLoglar();
  gosterBildirim(
    state.dil === 'tr'
      ? '✅ Günlük ücretsiz kullanım hakkın tekrar 3/3 olarak sıfırlandı!'
      : '✅ Daily free quota reset to 3/3!'
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderAktifSekmeIcerigi(ozet: BirlesikOzetSonucu): string {
  const tr = state.dil === 'tr';

  if (state.aktifMod === 'quick') {
    return `
      <div style="margin-bottom: 1.1rem; padding: 0.9rem 1.1rem; border-radius: 12px; background: var(--accent-soft); border-left: 4px solid var(--accent);">
        <strong>💡 ${tr ? 'Tek Cümlelik Özet:' : 'One-Sentence Summary:'}</strong>
        <p style="margin-top: 0.25rem;">${escapeHtml(ozet.quick.oneLiner)}</p>
      </div>

      <h3 style="margin-bottom: 0.7rem; font-size: 1rem;">${tr ? '⚡ Kritik Maddeler (Saniyeye tıklayarak kayıtta o ana git)' : '⚡ Key Takeaways (Click timestamp to jump)'}</h3>
      <ul class="bullet-list" style="margin-bottom: 1.3rem;">
        ${ozet.quick.bullets
          .map(
            (b) => `
          <li class="bullet-item">
            <span class="timestamp-chip" data-ts="${escapeHtml(b.timestamp)}">▶ ${escapeHtml(b.timestamp)}</span>
            <span>${escapeHtml(b.text)}</span>
          </li>`
          )
          .join('')}
      </ul>

      <h3 style="margin-bottom: 0.7rem; font-size: 1rem;">${t(state.dil, 'actionItemsTitle')}</h3>
      <ul class="bullet-list">
        ${ozet.quick.actionItems
          .map(
            (a) => `
          <li class="bullet-item" style="border-left: 3px solid var(--success);">
            <span class="timestamp-chip" data-ts="${escapeHtml(a.timestamp)}">▶ ${escapeHtml(a.timestamp)}</span>
            <strong>${escapeHtml(a.task)}</strong>
            ${a.due ? `<span class="badge badge-success" style="margin-left: 0.5rem;">🗓️ ${escapeHtml(a.due)}</span>` : ''}
          </li>`
          )
          .join('')}
      </ul>
    `;
  }

  if (state.aktifMod === 'detailed') {
    return `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${ozet.detailed.sections
          .map(
            (sec) => `
          <div class="bullet-item">
            <div style="margin-bottom: 0.45rem;">
              <span class="timestamp-chip" data-ts="${escapeHtml(sec.timestamp)}">▶ ${escapeHtml(sec.timestamp)}</span>
              <strong style="font-size: 1.05rem;">${escapeHtml(sec.heading)}</strong>
            </div>
            <p style="color: var(--text-muted); margin-bottom: 0.6rem;">${escapeHtml(sec.summary)}</p>
            <ul style="padding-left: 1.2rem;">
              ${sec.keyPoints.map((kp) => `<li>${escapeHtml(kp)}</li>`).join('')}
            </ul>
          </div>`
          )
          .join('')}
      </div>
    `;
  }

  if (state.aktifMod === 'lecture') {
    const slaytBolumu =
      ozet.slides && ozet.slides.length > 0
        ? `
      <h3 style="margin-bottom: 0.5rem; font-size: 1rem;">🖼️ ${tr ? 'Videodan Otomatik Yakalanan Slayt Kareleri' : 'Auto-Captured Lecture Slides'}</h3>
      <div class="slides-grid">
        ${ozet.slides
          .map(
            (s) => `
          <div class="slide-card">
            ${s.imageUrl ? `<img src="${s.imageUrl}" alt="${escapeHtml(s.caption)}" />` : ''}
            <div class="slide-card-body">
              <span class="timestamp-chip" data-ts="${escapeHtml(s.timestamp)}">▶ ${escapeHtml(s.timestamp)}</span>
              <span>${escapeHtml(s.caption)}</span>
            </div>
          </div>`
          )
          .join('')}
      </div>`
        : '';

    return `
      ${slaytBolumu}

      <h3 style="margin-bottom: 0.7rem; font-size: 1rem;">${t(state.dil, 'keyConceptsTitle')}</h3>
      <ul class="bullet-list" style="margin-bottom: 1.4rem;">
        ${ozet.lecture.concepts
          .map(
            (c) => `
          <li class="bullet-item">
            <span class="timestamp-chip" data-ts="${escapeHtml(c.timestamp)}">▶ ${escapeHtml(c.timestamp)}</span>
            <strong>${escapeHtml(c.term)}:</strong> ${escapeHtml(c.definition)}
          </li>`
          )
          .join('')}
      </ul>

      <h3 style="margin-bottom: 0.7rem; font-size: 1rem;">${t(state.dil, 'examQuestionsTitle')}</h3>
      <div>
        ${ozet.lecture.examQuestions
          .map((q, idx) => {
            const acik = state.acikSinavSorulari.has(idx);
            return `
            <div class="exam-card" data-exam-idx="${idx}">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                <div>
                  <span class="timestamp-chip" data-ts="${escapeHtml(q.timestamp)}">▶ ${escapeHtml(q.timestamp)}</span>
                  <strong>Soru ${idx + 1}: ${escapeHtml(q.question)}</strong>
                </div>
                <span class="badge badge-accent">${escapeHtml(q.difficulty)}</span>
              </div>
              ${
                acik
                  ? `<div class="exam-answer">✅ <strong>${tr ? 'Cevap:' : 'Answer:'}</strong> ${escapeHtml(q.answer)}</div>`
                  : `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.4rem;">👀 ${tr ? 'Cevabı görmek için bu karta tıkla' : 'Click card to reveal answer'}</div>`
              }
            </div>`;
          })
          .join('')}
      </div>
    `;
  }

  // Tam Transkript Modu
  return `
    <ul class="bullet-list">
      ${ozet.transcript.segments
        .map(
          (seg) => `
        <li class="bullet-item">
          <span class="timestamp-chip" data-ts="${escapeHtml(seg.timestamp)}">▶ ${escapeHtml(seg.timestamp)}</span>
          <strong>${escapeHtml(seg.speaker)}:</strong> ${escapeHtml(seg.text)}
        </li>`
        )
        .join('')}
    </ul>
  `;
}

function render(): void {
  document.documentElement.setAttribute('data-theme', state.tema);
  document.documentElement.setAttribute('lang', state.dil);

  const kok = document.getElementById('app');
  if (!kok) return;

  const tr = state.dil === 'tr';
  const stats = state.sunucuDurumu.stats;

  kok.innerHTML = `
    <div class="container">
      <!-- ÜST BAR -->
      <header class="navbar">
        <div class="brand">
          <div class="brand-logo">N</div>
          <div>
            <div class="brand-title">${APP_CONFIG.appName}</div>
            <div class="brand-sub">${t(state.dil, 'appTagline')}</div>
          </div>
        </div>

        <div class="nav-actions">
          <span class="badge badge-success" title="3 Katmanlı Tasarruf Motoru">
            ⚡ ${t(state.dil, 'costSavedBadge')} ($${stats.remainingCreditUsd} / $${APP_CONFIG.initialCreditUsd})
          </span>
          <span class="badge badge-accent">
            🎟️ ${t(state.dil, 'remainingQuotaLabel')}: <strong>${state.kalanKota} / ${state.kotaLimiti}</strong>
          </span>
          <button class="btn btn-coffee" id="btn-coffee">${t(state.dil, 'buyCoffeeBtn')}</button>
          <button class="btn btn-primary btn-sm" id="btn-pro">${t(state.dil, 'upgradeProBtn')}</button>
          <button class="btn" id="btn-lang">${state.dil === 'tr' ? '🌐 EN' : '🌐 TR'}</button>
          <button class="btn" id="btn-theme">${state.tema === 'dark' ? '☀️' : '🌙'}</button>
          <button class="btn" id="btn-dev-panel">${t(state.dil, 'devPanelButton')}</button>
        </div>
      </header>

      ${
        state.proModalAcik
          ? `
        <div class="card" style="border: 1px solid var(--accent); background: var(--surface); padding: 1.5rem; margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
            <div>
              <h3 style="font-size: 1.2rem; font-weight: 750;">${t(state.dil, 'proModalTitle')}</h3>
              <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0.4rem 0 0.8rem;">
                ${t(state.dil, 'proModalSubtitle')}
              </p>
              <div class="badge badge-accent" style="font-size: 0.9rem; padding: 0.4rem 0.8rem; margin-bottom: 1rem;">
                💳 ${t(state.dil, 'proPriceText')}
              </div>
              <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="alert('${tr ? 'Lemon Squeezy / Shopier ödeme akışı buraya bağlanır. Şirket kurmadan, anında kredi kartıyla tahsilat yapabilirsin!' : 'Connects to Lemon Squeezy / Shopier checkout.'}')">
                  🚀 ${tr ? 'Hemen Abone Ol (Lemon Squeezy / Shopier)' : 'Subscribe Now'}
                </button>
                <button class="btn" id="btn-close-pro">${tr ? 'Kapat' : 'Close'}</button>
              </div>
            </div>
          </div>
        </div>`
          : ''
      }

      ${
        state.coffeeModalAcik
          ? `
        <div class="card" style="border: 1px solid var(--warning); background: var(--surface); padding: 1.5rem; margin-bottom: 1.5rem;">
          <h3 style="font-size: 1.2rem; font-weight: 750;">${t(state.dil, 'coffeeModalTitle')}</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0.4rem 0 1rem;">
            ${t(state.dil, 'coffeeModalSubtitle')}
          </p>
          <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
            <a href="https://buymeacoffee.com" target="_blank" class="btn btn-coffee" style="text-decoration: none;">
              ☕ Buy Me a Coffee / Destek Sayfası
            </a>
            <button class="btn" id="btn-close-coffee">${tr ? 'Kapat' : 'Close'}</button>
          </div>
        </div>`
          : ''
      }

      ${
        state.bildirimMesaji
          ? `<div class="card" style="background: var(--success-soft); border-color: var(--success); padding: 0.8rem 1.2rem; margin-bottom: 1rem;">
              <strong>${escapeHtml(state.bildirimMesaji)}</strong>
            </div>`
          : ''
      }

      ${
        state.hataMesaji
          ? `<div class="card" style="background: rgba(239,68,68,0.15); border-color: var(--danger); padding: 0.9rem 1.2rem; margin-bottom: 1rem;">
              <strong>⚠️ ${escapeHtml(state.hataMesaji)}</strong>
            </div>`
          : ''
      }

      <!-- GELİŞTİRİCİ LOG VE MALİYET PANELİ (AÇILIR/KAPANIR) -->
      ${
        state.devPanelAcik
          ? `
        <section class="card dev-panel" style="border: 2px solid var(--accent);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem; margin-bottom: 1rem;">
            <div>
              <h2 style="font-size: 1.15rem;">🛠️ ${tr ? 'Canlı Sistem Logları & $60 Kredi Takip Paneli' : 'Live System Logs & $60 Credit Tracker'}</h2>
              <p style="font-size: 0.83rem; color: var(--text-muted);">${escapeHtml(state.sunucuDurumu.modeLabel)}</p>
            </div>
            <button class="btn" id="btn-reset-quota">🔄 ${tr ? 'Test İçin Günlük Kotayı Sıfırla (3/3 Yap)' : 'Reset Daily Quota (3/3)'}</button>
          </div>

          <div class="stats-grid">
            <div class="stat-box">
              <div style="font-size: 0.78rem; color: var(--text-muted);">${tr ? 'Kalan $60 API Kredisi' : 'Remaining $60 Credit'}</div>
              <div class="stat-value" style="color: var(--success);">$${stats.remainingCreditUsd}</div>
            </div>
            <div class="stat-box">
              <div style="font-size: 0.78rem; color: var(--text-muted);">${tr ? 'Toplam Harcanan' : 'Total Spent'}</div>
              <div class="stat-value">$${stats.totalSpentUsd} <span style="font-size: 0.85rem; color: var(--text-muted);">(${stats.totalSpentTry} ₺)</span></div>
            </div>
            <div class="stat-box">
              <div style="font-size: 0.78rem; color: var(--text-muted);">${tr ? 'Tasarruf Motorunun Kurtardığı' : 'Saved by Savings Engine'}</div>
              <div class="stat-value" style="color: var(--accent);">$${stats.totalSavedUsd} <span style="font-size: 0.85rem; color: var(--text-muted);">(${stats.totalSavedTry} ₺)</span></div>
            </div>
            <div class="stat-box">
              <div style="font-size: 0.78rem; color: var(--text-muted);">${tr ? 'Toplam Özet İşlemi' : 'Total Summaries'}</div>
              <div class="stat-value">${stats.totalRequests}</div>
            </div>
          </div>

          <div style="overflow-x: auto;">
            <table class="log-table">
              <thead>
                <tr>
                  <th>${tr ? 'Saat' : 'Time'}</th>
                  <th>${tr ? 'Seviye' : 'Level'}</th>
                  <th>${tr ? 'Kategori' : 'Category'}</th>
                  <th>${tr ? 'Detay / Maliyet Kaydı' : 'Message'}</th>
                </tr>
              </thead>
              <tbody>
                ${
                  state.sunucuDurumu.logs.length > 0
                    ? state.sunucuDurumu.logs
                        .slice(0, 12)
                        .map(
                          (l) => `
                      <tr>
                        <td style="font-family: monospace;">${new Date(l.timestamp).toLocaleTimeString()}</td>
                        <td><span class="badge">${escapeHtml(l.level)}</span></td>
                        <td><strong>${escapeHtml(l.category)}</strong></td>
                        <td>${escapeHtml(l.message)}</td>
                      </tr>`
                        )
                        .join('')
                    : `<tr><td colspan="4" style="color: var(--text-muted);">${tr ? 'Henüz işlem kaydı yok.' : 'No logs yet.'}</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </section>`
          : ''
      }

      <!-- HERO BAŞLIK -->
      <section class="hero">
        <h1>${t(state.dil, 'heroTitle')}</h1>
        <p>${t(state.dil, 'heroSubtitle')}</p>
      </section>

      <!-- YÜKLEME VE GİRİŞ KARTI -->
      <section class="card input-section">
        <div class="quick-demos">
          <button class="btn" id="btn-demo-lecture">🎓 ${t(state.dil, 'sampleButton')}</button>
          <button class="btn" id="btn-demo-whatsapp">💬 ${t(state.dil, 'sampleWhatsAppButton')}</button>
          <button class="btn ${state.kayitYapiliyor ? 'btn-danger' : ''}" id="btn-mic-record">
            🎙️ ${state.kayitYapiliyor ? t(state.dil, 'stopRecordButton') : t(state.dil, 'recordButton')}
          </button>
        </div>

        <div class="dropzone" id="dropzone-area">
          <input type="file" id="file-input" accept="audio/*,video/*,.vtt,.srt,.txt" style="display: none;" />
          <div style="font-size: 1.5rem; margin-bottom: 0.35rem;">📂</div>
          <div class="dropzone-title">${t(state.dil, 'dropzoneTitle')}</div>
          <div class="dropzone-sub">${t(state.dil, 'dropzoneSubtitle')}</div>
        </div>

        ${
          state.medyaUrl
            ? `<div style="margin-bottom: 1rem;">
                <audio id="medya-oynatici" controls src="${state.medyaUrl}" style="width: 100%;"></audio>
              </div>`
            : ''
        }

        <div class="form-group">
          <label class="form-label">${tr ? 'Kayıt / Ders Başlığı' : 'Recording / Lecture Title'}</label>
          <input
            type="text"
            class="input"
            id="input-title"
            placeholder="${tr ? 'Örn: Fizik 101 - Vize Tekrar Dersi' : 'e.g. Physics 101 - Midterm Review'}"
            value="${escapeHtml(state.baslik)}"
          />
        </div>

        <div class="form-group">
          <label class="form-label">${t(state.dil, 'pasteTranscriptLabel')}</label>
          <textarea
            class="textarea"
            id="input-transcript"
            placeholder="${t(state.dil, 'pasteTranscriptPlaceholder')}"
          >${escapeHtml(state.altyaziMetni)}</textarea>
        </div>

        <div class="controls-row">
          <label class="checkbox-label">
            <input type="checkbox" id="chk-compression" ${state.sikistirmaAktif ? 'checked' : ''} />
            <span>${t(state.dil, 'compressionToggleLabel')}</span>
          </label>

          <button class="btn btn-primary" id="btn-summarize" ${state.yukleniyor ? 'disabled' : ''}>
            ${state.yukleniyor ? `⏳ ${t(state.dil, 'processingText')}` : `✨ ${t(state.dil, 'summarizeButton')}`}
          </button>
        </div>
      </section>

      <!-- SONUÇ KARTI (4 MOD SEKME) -->
      ${
        state.aktifOzet
          ? `
        <section class="card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <h2 style="font-size: 1.35rem;">${escapeHtml(state.aktifOzet.title)}</h2>
              <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.2rem;">
                ⏱️ ${Math.round(state.aktifOzet.durationSeconds / 60)} dk |
                💰 ${tr ? 'Maliyet:' : 'Cost:'} <strong>$${state.aktifOzet.cost.actualCostUsd}</strong> |
                🛡️ <strong>%${state.aktifOzet.cost.savedPercent} ${tr ? 'Tasarruf Edildi' : 'Saved'}</strong> (${escapeHtml(state.aktifOzet.cost.method)})
              </div>
            </div>

            <div class="export-bar" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn" id="btn-copy-wp">${t(state.dil, 'copyWhatsApp')}</button>
              <button class="btn" id="btn-download-md">${t(state.dil, 'downloadMarkdown')}</button>
              <button class="btn" id="btn-print-pdf">${t(state.dil, 'printPdf')}</button>
            </div>
          </div>

          <div class="tabs">
            <button class="tab-btn ${state.aktifMod === 'quick' ? 'active' : ''}" data-mode="quick">${t(state.dil, 'modeQuick')}</button>
            <button class="tab-btn ${state.aktifMod === 'detailed' ? 'active' : ''}" data-mode="detailed">${t(state.dil, 'modeDetailed')}</button>
            <button class="tab-btn ${state.aktifMod === 'lecture' ? 'active' : ''}" data-mode="lecture">${t(state.dil, 'modeLecture')}</button>
            <button class="tab-btn ${state.aktifMod === 'transcript' ? 'active' : ''}" data-mode="transcript">${t(state.dil, 'modeTranscript')}</button>
          </div>

          <div class="tab-content">
            ${renderAktifSekmeIcerigi(state.aktifOzet)}
          </div>
        </section>`
          : ''
      }

      <!-- GEÇMİŞ ÖZETLER -->
      <section class="card history-section">
        <h3 style="font-size: 1.05rem; margin-bottom: 0.8rem;">${t(state.dil, 'historyTitle')}</h3>
        ${
          state.gecmis.length === 0
            ? `<p style="color: var(--text-muted); font-size: 0.9rem;">${t(state.dil, 'noHistoryText')}</p>`
            : `<div style="display: flex; flex-direction: column; gap: 0.55rem;">
                ${state.gecmis
                  .map(
                    (g) => `
                  <div class="bullet-item" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" data-history-id="${g.id}">
                    <div>
                      <strong>${escapeHtml(g.title)}</strong>
                      <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.6rem;">
                        ${new Date(g.createdAt).toLocaleTimeString()} — %${g.cost.savedPercent} tasarruf ($${g.cost.actualCostUsd})
                      </span>
                    </div>
                    <span class="badge">${tr ? 'Aç →' : 'Open →'}</span>
                  </div>`
                  )
                  .join('')}
              </div>`
        }
      </section>
    </div>
  `;

  baglaOlayDinleyicileri();
}

function baglaOlayDinleyicileri(): void {
  document.getElementById('btn-pro')?.addEventListener('click', () => {
    state.proModalAcik = !state.proModalAcik;
    state.coffeeModalAcik = false;
    render();
  });

  document.getElementById('btn-close-pro')?.addEventListener('click', () => {
    state.proModalAcik = false;
    render();
  });

  document.getElementById('btn-coffee')?.addEventListener('click', () => {
    state.coffeeModalAcik = !state.coffeeModalAcik;
    state.proModalAcik = false;
    render();
  });

  document.getElementById('btn-close-coffee')?.addEventListener('click', () => {
    state.coffeeModalAcik = false;
    render();
  });

  document.getElementById('btn-lang')?.addEventListener('click', () => {
    state.dil = state.dil === 'tr' ? 'en' : 'tr';
    render();
  });

  document.getElementById('btn-theme')?.addEventListener('click', () => {
    state.tema = state.tema === 'dark' ? 'light' : 'dark';
    render();
  });

  document.getElementById('btn-dev-panel')?.addEventListener('click', () => {
    state.devPanelAcik = !state.devPanelAcik;
    if (state.devPanelAcik) {
      yenileSunucuVeLoglar();
    } else {
      render();
    }
  });

  document.getElementById('btn-reset-quota')?.addEventListener('click', () => {
    sifirlaGunlukKota();
  });

  document.getElementById('btn-demo-lecture')?.addEventListener('click', () => {
    yukleOrnekDers();
    calistirOzetleme();
  });

  document.getElementById('btn-demo-whatsapp')?.addEventListener('click', () => {
    yukleOrnekWhatsApp();
    calistirOzetleme();
  });

  document.getElementById('input-title')?.addEventListener('input', (e) => {
    state.baslik = (e.target as HTMLInputElement).value;
  });

  document.getElementById('input-transcript')?.addEventListener('input', (e) => {
    state.altyaziMetni = (e.target as HTMLTextAreaElement).value;
  });

  document.getElementById('chk-compression')?.addEventListener('change', (e) => {
    state.sikistirmaAktif = (e.target as HTMLInputElement).checked;
  });

  document.getElementById('btn-summarize')?.addEventListener('click', () => {
    calistirOzetleme();
  });

  // Dosya seçme & Sürükle-bırak
  const dropzone = document.getElementById('dropzone-area');
  const fileInput = document.getElementById('file-input') as HTMLInputElement | null;

  dropzone?.addEventListener('click', () => fileInput?.click());
  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) isleSecilenDosya(file);
  });

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) isleSecilenDosya(file);
  });

  // Mikrofonla canlı kayıt
  document.getElementById('btn-mic-record')?.addEventListener('click', async () => {
    if (state.kayitYapiliyor && mediaRecorderRef) {
      mediaRecorderRef.stop();
      state.kayitYapiliyor = false;
      render();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      kayitParcalari = [];
      mediaRecorderRef = new MediaRecorder(stream);
      mediaRecorderRef.ondataavailable = (ev) => {
        if (ev.data.size > 0) kayitParcalari.push(ev.data);
      };
      mediaRecorderRef.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(kayitParcalari, { type: 'audio/webm' });
        const dosya = new File([blob], `Ses_Kaydi_${new Date().toLocaleTimeString()}.webm`, {
          type: 'audio/webm',
        });
        isleSecilenDosya(dosya);
      };
      mediaRecorderRef.start();
      state.kayitYapiliyor = true;
      render();
    } catch {
      state.hataMesaji =
        state.dil === 'tr'
          ? 'Mikrofon izni alınamadı. Tarayıcıdan mikrofon izni verdiğine emin ol.'
          : 'Microphone permission denied.';
      render();
    }
  });

  // 4 Mod Sekmeleri
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mod = btn.getAttribute('data-mode') as OzetModu;
      if (mod) {
        state.aktifMod = mod;
        render();
      }
    });
  });

  // Zaman damgalarına tıklama
  document.querySelectorAll('.timestamp-chip').forEach((chip) => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const ts = chip.getAttribute('data-ts');
      if (ts) atlaZamanDamgasina(ts);
    });
  });

  // Sınav sorularına tıklayınca cevabı aç/kapat
  document.querySelectorAll('.exam-card').forEach((card) => {
    card.addEventListener('click', () => {
      const idx = Number(card.getAttribute('data-exam-idx'));
      if (state.acikSinavSorulari.has(idx)) {
        state.acikSinavSorulari.delete(idx);
      } else {
        state.acikSinavSorulari.add(idx);
      }
      render();
    });
  });

  // WhatsApp Kopyala
  document.getElementById('btn-copy-wp')?.addEventListener('click', async () => {
    if (!state.aktifOzet) return;
    const metin = formatWhatsAppMetni(state.aktifOzet, state.dil);
    await navigator.clipboard.writeText(metin);
    gosterBildirim(
      state.dil === 'tr'
        ? '📲 WhatsApp formatında panoya kopyalandı! İstediğin sohbete yapıştırabilirsin.'
        : '📲 Copied in WhatsApp format!'
    );
  });

  // Markdown İndir
  document.getElementById('btn-download-md')?.addEventListener('click', () => {
    if (!state.aktifOzet) return;
    const md = formatMarkdownMetni(state.aktifOzet, state.dil);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.aktifOzet.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // PDF Yazdır
  document.getElementById('btn-print-pdf')?.addEventListener('click', () => {
    window.print();
  });

  // Geçmişten özet açma
  document.querySelectorAll('[data-history-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-history-id');
      const bulunan = state.gecmis.find((g) => g.id === id);
      if (bulunan) {
        state.aktifOzet = bulunan;
        render();
      }
    });
  });
}

function isleSecilenDosya(file: File): void {
  state.baslik = file.name.replace(/\.[^.]+$/, '');
  state.slaytlar = [];

  if (/\.(vtt|srt|txt)$/i.test(file.name)) {
    const reader = new FileReader();
    reader.onload = () => {
      state.altyaziMetni = String(reader.result || '');
      state.yontem = 'caption';
      render();
    };
    reader.readAsText(file);
    return;
  }

  state.medyaUrl = URL.createObjectURL(file);
  state.sureSaniye = Math.max(60, Math.round(file.size / 16000));
  state.yontem = state.sikistirmaAktif ? 'compressed_audio' : 'raw_audio';

  // Küçük ses dosyalarını (< 8 MB) base64 olarak da hazırla
  if (file.size < 8 * 1024 * 1024) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : '';
      state.medyaBase64 = base64;
      state.medyaMimeType = file.type || 'audio/webm';
    };
    reader.readAsDataURL(file);
  }

  gosterBildirim(
    state.dil === 'tr'
      ? `📂 "${file.name}" yüklendi. "Şimdi Özetle" butonuna basabilirsin.`
      : `📂 "${file.name}" loaded. Click Summarize.`
  );
}

render();
yenileSunucuVeLoglar();
