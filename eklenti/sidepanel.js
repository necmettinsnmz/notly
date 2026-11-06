/**
 * NOTLY YAN PANEL KONTROLCÜSÜ (SIDEPANEL.JS)
 * -----------------------------------------
 * - Canlı dersleri (Moodle, Zoom, Teams, YouTube) tek tıkla dinler.
 * - Hoca "ekrana bakın / burası sınavda çıkar" dediğinde ekranı fotoğraflar.
 * - Slaytları ve sesi yapay zekaya multimodal (görsel + ses) olarak gönderir.
 * - Çıktıyı akademik ders kitabı pedagojisiyle (sohbetsiz, doğrudan ders) üretir.
 */

const SERVER_URLS = ['http://localhost:5173', 'http://localhost:8787'];
let activeServerUrl = null;

let isRecording = false;
let recordingStartTime = 0;
let timerInterval = null;
let capturedSlides = [];

function formatSeconds(totalSec) {
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(Math.floor(totalSec % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

function showStatus(text, type = 'info') {
  const box = document.getElementById('status-box');
  if (!box) return;
  box.style.display = 'block';
  box.textContent = text;
  if (type === 'error') {
    box.style.borderColor = 'var(--danger)';
    box.style.color = 'var(--danger)';
  } else if (type === 'success') {
    box.style.borderColor = 'var(--success)';
    box.style.color = 'var(--success)';
  } else {
    box.style.borderColor = 'var(--border-subtle)';
    box.style.color = 'var(--text-muted)';
  }
}

// 1. Yerel Sunucu Bağlantı Kontrolü
async function checkServerHealth() {
  const pill = document.getElementById('server-status');
  for (const url of SERVER_URLS) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) {
        activeServerUrl = url;
        pill.textContent = `● Sunucu Bağlı (${url.includes('5173') ? '5173' : '8787'})`;
        pill.className = 'server-pill online';
        return;
      }
    } catch {
      // Diğer portu dene
    }
  }
  activeServerUrl = null;
  pill.textContent = '○ Sunucu Bekleniyor (npm run dev)';
  pill.className = 'server-pill';
}

setInterval(checkServerHealth, 3500);
checkServerHealth();

// 1.1 Aktif Sekme Göstergesi ve Güvenlik Denetimi
let currentActiveTab = null;

function isRestrictedUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const u = url.trim().toLowerCase();
  return (
    u === '' ||
    u.startsWith('chrome://') ||
    u.startsWith('chrome-extension://') ||
    u.startsWith('edge://') ||
    u.startsWith('about:') ||
    u.startsWith('devtools://') ||
    u.startsWith('view-source:') ||
    u.includes('chromewebstore.google.com')
  );
}

async function updateTargetTabBadge() {
  const badge = document.getElementById('target-tab-badge');
  const titleSpan = document.getElementById('target-tab-title');

  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs[0];
    if (!tab) {
      currentActiveTab = null;
      if (badge && titleSpan) {
        badge.className = 'target-tab-badge';
        titleSpan.textContent = 'Sekme aranıyor...';
      }
      return;
    }

    currentActiveTab = tab;

    if (!badge || !titleSpan) return;

    if (isRestrictedUrl(tab.url)) {
      badge.className = 'target-tab-badge restricted';
      titleSpan.textContent = '⚠️ Sistem Sekmesi (Kayıt İçin Ders Sekmesine Geçin)';
    } else {
      badge.className = 'target-tab-badge ready';
      const cleanTitle = (tab.title || 'Ders Sayfası').replace(/ - YouTube$/, '');
      titleSpan.textContent = `🎯 ${cleanTitle.slice(0, 32)}`;
    }
  } catch {
    currentActiveTab = null;
  }
}

if (chrome.tabs) {
  chrome.tabs.onActivated.addListener(updateTargetTabBadge);
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.status === 'complete' || changeInfo.title || changeInfo.url) {
      updateTargetTabBadge();
    }
  });
}
updateTargetTabBadge();
setInterval(updateTargetTabBadge, 2500);

// 2. Slayt / Ekran Yakalama Fonksiyonu (Akıllı Yakalayıcı)
function captureSlide(customCaption) {
  chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' }, (res) => {
    if (res?.ok && res.dataUrl) {
      const elapsedSec = isRecording ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0;
      const ts = formatSeconds(elapsedSec);

      capturedSlides.push({
        timestamp: ts,
        imageUrl: res.dataUrl,
        caption: customCaption || `Slayt [${ts}] (Hoca Vurgusu)`,
      });

      renderSlides();
      showStatus(`📸 Slayt [${ts}] yapay zekaya incelenmek üzere kaydedildi!`, 'success');
    } else {
      // Başlangıç otomatik karesi alınamazsa ses kaydının yeşil durum mesajını ezme
      if (customCaption !== 'Ders Başlangıç Referans Slaytı') {
        showStatus(`⚠️ Slayt yakalanamadı: ${res?.error || 'Sekme açık değil'}`, 'error');
      }
    }
  });
}

function renderSlides() {
  const track = document.getElementById('slides-track');
  const count = document.getElementById('slide-count');
  const section = document.getElementById('slides-section');

  if (!track || !count) return;
  count.textContent = `${capturedSlides.length} slayt`;

  if (capturedSlides.length > 0 && section) {
    section.style.display = 'block';
  }

  track.innerHTML = capturedSlides
    .map(
      (s) => `
      <div class="slide-thumb">
        <img src="${s.imageUrl}" alt="${s.caption}" />
        <span class="slide-ts">${s.timestamp}</span>
      </div>`
    )
    .join('');

  track.scrollLeft = track.scrollWidth;
}

// 3. Ana Kayıt Butonu (Başlat / Durdur)
const btnToggle = document.getElementById('btn-toggle-record');
const btnSnap = document.getElementById('btn-snap-slide');
const recordTimer = document.getElementById('record-timer');
const recordText = document.getElementById('record-text');
const recordIcon = document.getElementById('record-icon');

// 3. Ana Kayıt Fonksiyonu (Kullanıcı Tıklaması ile Senkron Yetkilendirme)
function startRecordingForTab(tab) {
  if (!tab || !tab.id) {
    showStatus('⚠️ Hedef ders sekmesi henüz algılanamadı.', 'error');
    return;
  }

  if (isRestrictedUrl(tab.url)) {
    showStatus(
      '⚠️ Chrome güvenlik kuralı: Sistem sayfalarında (chrome:// veya eklentiler) ses kaydı yapılamaz. Lütfen ders sekmenize geçin.',
      'error'
    );
    return;
  }

  showStatus('Sekme ses bağlantısı kuruluyor...');

  // KULLANICI TIKLAMASI (USER GESTURE) ANINDA DOĞRUDAN ÇAĞRI:
  // Bu çağrı doğrudan click olayının içinde yapıldığı için Chrome güvenlik engelini aşar!
  chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
    if (chrome.runtime.lastError || !streamId) {
      showStatus(
        `⚠️ ${chrome.runtime.lastError?.message || 'Sekme sesine erişilemedi. Lütfen derste ses çaldığından emin olun.'}`,
        'error'
      );
      return;
    }

    // streamId alındı! Arka plan servisine aktararak offscreen kaydı başlat
    chrome.runtime.sendMessage(
      { type: 'START_OFFSCREEN_RECORDING', streamId },
      (res) => {
        if (res?.ok) {
          isRecording = true;
          recordingStartTime = Date.now();
          capturedSlides = [];

          btnToggle.className = 'btn btn-recording';
          recordIcon.textContent = '⏹️';
          recordText.textContent = 'Dersi Bitir ve Ders Kitabı Notu Çıkar';
          recordTimer.style.display = 'inline-block';
          recordTimer.textContent = '00:00';
          btnSnap.style.display = 'flex';

          showStatus(
            '🔴 Canlı ders dinleniyor. Hoca ekrandaki bir formüle veya şekle değindiğinde butona basarak o kareyi kaydedin.',
            'success'
          );

          // Canlı Süre Sayacı
          timerInterval = setInterval(() => {
            const sec = Math.floor((Date.now() - recordingStartTime) / 1000);
            recordTimer.textContent = formatSeconds(sec);
          }, 1000);

          // İlk slaytı başlangıç referansı olarak yakala
          captureSlide('Ders Başlangıç Referans Slaytı');
        } else {
          showStatus(`⚠️ ${res?.error || 'Sekme sesi başlatılamadı.'}`, 'error');
        }
      }
    );
  });
}

btnToggle?.addEventListener('click', () => {
  if (!isRecording) {
    if (currentActiveTab && currentActiveTab.id) {
      startRecordingForTab(currentActiveTab);
    } else {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab) {
          currentActiveTab = tab;
          startRecordingForTab(tab);
        } else {
          showStatus('⚠️ Hedef ders sekmesi henüz algılanamadı. Lütfen ders sekmesine tıklayın.', 'error');
        }
      });
    }
  } else {
    // KAYDI BİTİR VE ÖZETLE
    isRecording = false;
    clearInterval(timerInterval);

    const totalSeconds = Math.max(10, Math.floor((Date.now() - recordingStartTime) / 1000));

    btnToggle.className = 'btn btn-record';
    recordIcon.textContent = '🔴';
    recordText.textContent = 'Canlı Dersi Dinle ve Not Al';
    recordTimer.style.display = 'none';
    btnSnap.style.display = 'none';

    showStatus(
      `⏳ Ders bitti (${formatSeconds(totalSeconds)}). Yapay zeka konuşmaları ve ${capturedSlides.length} slayttaki formülleri inceleyerek ders kitabı notunu hazırlıyor...`
    );

    chrome.runtime.sendMessage({ type: 'STOP_TAB_RECORDING' }, async (stopRes) => {
      if (stopRes?.ok && stopRes.mediaBase64) {
        await gonderSunucuya({
          title: 'Canlı Ders Kaydı',
          durationSeconds: totalSeconds,
          method: 'compressed_audio',
          mediaBase64: stopRes.mediaBase64,
          mediaMimeType: stopRes.mediaMimeType,
          slides: capturedSlides,
        });
      } else {
        showStatus('Kayıtlı ses verisi alınamadı.', 'error');
      }
    });
  }
});

// 4. Hoca Vurgusu Slayt Butonu (veya Klavyeden Kısayol)
btnSnap?.addEventListener('click', () => {
  captureSlide('Hoca Tarafından Vurgulanan Kritik Slayt');
});

// 5. Sunucuya Gönderme ve Ders Notu Çıkarma
async function gonderSunucuya(payload) {
  const out = document.getElementById('output-area');
  out.innerHTML = `
    <div class="result-card">
      <div style="font-weight: 700; margin-bottom: 6px;">🧠 Ders Kitabı Özeti Üretiliyor...</div>
      <p style="color: var(--text-muted); font-size: 0.82rem;">
        Gemini 2.5 Flash gereksiz selamlaşmaları ve boş lafları eliyor, dersi konu konu akademik pedagojiyle derliyor.
      </p>
    </div>`;

  const serverUrl = activeServerUrl || 'http://localhost:5173';

  try {
    const res = await fetch(`${serverUrl}/api/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': 'chrome_extension_user',
      },
      body: JSON.stringify({
        ...payload,
        language: 'tr',
      }),
    });

    const data = await res.json();
    if (res.ok && data.summary) {
      renderSummary(data.summary);
      showStatus('✅ Akademik ders notu başarıyla çıkarıldı!', 'success');
    } else {
      showStatus(`Hata: ${data.message || 'Özet üretilemedi.'}`, 'error');
    }
  } catch (err) {
    out.innerHTML = `
      <div class="result-card" style="border-color: var(--danger);">
        ⚠️ Notly yerel sunucusuna bağlanılamadı. Lütfen terminalde <code>npm run dev</code> komutunun açık olduğundan emin olun.
      </div>`;
  }
}

function renderSummary(summary) {
  const out = document.getElementById('output-area');
  out.innerHTML = `
    <div class="result-card">
      <div style="font-size: 1.05rem; font-weight: 750; margin-bottom: 4px;">
        🎓 ${summary.title}
      </div>
      <div style="font-size: 0.74rem; color: var(--success); font-family: var(--font-mono); margin-bottom: 10px;">
        ⚡ %${summary.cost.savedPercent} Tasarruf | ${Math.round(summary.durationSeconds / 60)} dk | ${summary.slides.length} slayt incelendi
      </div>

      <!-- 1. HAP ÖZET -->
      <div style="padding: 10px 12px; background: var(--surface-inset); border-radius: 6px; font-size: 0.84rem; margin-bottom: 14px; border-left: 3px solid var(--accent);">
        <strong>📖 Dersin Özü:</strong>
        <p style="margin-top: 4px; color: var(--text-primary);">${summary.quick.oneLiner}</p>
      </div>

      <!-- 2. DETAYLI DERS KİTABI ANLATIMI -->
      <h4 style="font-size: 0.9rem; margin-bottom: 8px;">📋 Detaylı Ders Kitabı Anlatımı</h4>
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;">
        ${summary.detailed.sections
          .map(
            (sec) => `
          <div style="padding: 8px 10px; background: var(--surface-inset); border-radius: 6px; border: 1px solid var(--border-subtle);">
            <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 4px;">
              <span class="ts">${sec.timestamp}</span> ${sec.heading}
            </div>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 6px;">${sec.summary}</p>
            <ul style="padding-left: 1rem; font-size: 0.8rem; color: var(--text-primary);">
              ${sec.keyPoints.map((kp) => `<li>${kp}</li>`).join('')}
            </ul>
          </div>`
          )
          .join('')}
      </div>

      <!-- 3. DERS İÇİ DUYURULAR VE TARİHLER (HOCANIN BİLGİLENDİRMELERİ) -->
      ${
        summary.quick.actionItems && summary.quick.actionItems.length > 0
          ? `
        <h4 style="font-size: 0.9rem; margin-bottom: 6px; color: var(--warning);">📌 Ders İçi Duyurular, Ödev & Sınav Tarihleri</h4>
        <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px;">
          ${summary.quick.actionItems
            .map(
              (a) => `
            <div style="padding: 6px 9px; background: var(--surface-inset); border-radius: 6px; border-left: 3px solid var(--warning); font-size: 0.82rem;">
              <span class="ts">${a.timestamp}</span>
              <strong>${a.task}</strong>
              ${a.due ? `<span style="color: var(--warning); margin-left: 6px; font-weight: 600;">[${a.due}]</span>` : ''}
            </div>`
            )
            .join('')}
        </div>`
          : ''
      }

      <!-- 4. OLASI SINAV SORULARI VE CEVAPLARI -->
      <h4 style="font-size: 0.9rem; margin-bottom: 8px;">🎯 Sınavda Çıkabilecek Sorular & Cevapları</h4>
      <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px;">
        ${summary.lecture.examQuestions
          .map(
            (q) => `
          <div class="exam-box">
            <div style="font-weight: 600; font-size: 0.82rem;">❓ ${q.question}</div>
            <div style="color: var(--success); font-size: 0.8rem; margin-top: 4px;">
              ✅ <strong>Cevap:</strong> ${q.answer}
            </div>
          </div>`
          )
          .join('')}
      </div>

      <!-- 5. AKSİYON BUTONLARI -->
      <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border-subtle); display: flex; gap: 6px;">
        <button class="btn" id="btn-copy-summary" style="font-size: 0.78rem;">📲 Notları Kopyala</button>
      </div>
    </div>
  `;

  document.getElementById('btn-copy-summary')?.addEventListener('click', () => {
    const text = `${summary.title}\n\n${summary.quick.oneLiner}\n\n📋 Detaylı Özet:\n${summary.detailed.sections.map((s) => `• ${s.heading}: ${s.summary}`).join('\n')}\n\n📌 Duyurular:\n${summary.quick.actionItems.map((a) => `• ${a.task}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    showStatus('Panoya kopyalandı!', 'success');
  });
}
