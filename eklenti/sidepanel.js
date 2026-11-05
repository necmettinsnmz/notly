/**
 * NOTLY YAN PANEL (SIDE PANEL) KONTROLCÜSÜ
 * ----------------------------------------
 * Okul sitesindeki veya YouTube'daki dersi tek tıkla yakalar,
 * Notly Köprü Sunucusuna (localhost:5173 veya localhost:8787) gönderir
 * ve tıklanabilir zaman damgalı ders notunu yan panelde gösterir.
 */

const SERVER_URLS = ['http://localhost:5173', 'http://localhost:8787'];
let capturedSlides = [];
let isRecording = false;
let recordingStartMs = 0;

function formatSeconds(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

function parseTimestampToSeconds(ts) {
  const parts = String(ts).split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function renderSlidesPreview() {
  const container = document.getElementById('slides-preview');
  if (!container) return;
  container.innerHTML = capturedSlides
    .map(
      (s) => `
      <div>
        ${s.imageUrl ? `<img src="${s.imageUrl}" alt="${s.caption}" />` : ''}
        <div style="font-size: 0.72rem; color: #94a3b8;">[${s.timestamp}]</div>
      </div>`
    )
    .join('');
}

// 1. O anki slaytı yakala
document.getElementById('btn-capture-slide')?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'INSPECT_ACTIVE_VIDEO' }, (res) => {
    if (res?.ok && res.data) {
      const ts = formatSeconds(res.data.currentTime || 0);
      capturedSlides.push({
        timestamp: ts,
        imageUrl: res.data.slideDataUrl,
        caption: `Slayt (${ts})`,
      });
      renderSlidesPreview();
    }
  });
});

// 2. Sekme sesini canlı kaydet / durdur
document.getElementById('btn-record-tab')?.addEventListener('click', () => {
  const btn = document.getElementById('btn-record-tab');
  if (!isRecording) {
    chrome.runtime.sendMessage({ type: 'START_TAB_RECORDING' }, (res) => {
      if (res?.ok) {
        isRecording = true;
        recordingStartMs = Date.now();
        btn.textContent = '⏹️ Kaydı Bitir ve Ders Notu Çıkar';
        btn.classList.add('btn-danger');
      }
    });
  } else {
    chrome.runtime.sendMessage({ type: 'STOP_TAB_RECORDING' }, async (res) => {
      isRecording = false;
      btn.textContent = '🎙️ İndirilemeyen Dersin Sesini Dinle';
      btn.classList.remove('btn-danger');

      if (res?.ok && res.mediaBase64) {
        const durationSec = Math.max(30, Math.round((Date.now() - recordingStartMs) / 1000));
        await gonderSunucuya({
          title: 'Canlı Ders Kaydı',
          durationSeconds: durationSec,
          method: 'compressed_audio',
          mediaBase64: res.mediaBase64,
          mediaMimeType: res.mediaMimeType,
        });
      }
    });
  }
});

// 3. Sayfadaki videoyu analiz et ve özetle
document.getElementById('btn-summarize-tab')?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'INSPECT_ACTIVE_VIDEO' }, async (res) => {
    const info = res?.data || {
      pageTitle: 'Ders Videosu',
      durationSeconds: 600,
      captionsText: '',
    };

    if (info.slideDataUrl && capturedSlides.length === 0) {
      capturedSlides.push({
        timestamp: formatSeconds(info.currentTime || 0),
        imageUrl: info.slideDataUrl,
        caption: 'Ana Ders Slaytı',
      });
      renderSlidesPreview();
    }

    await gonderSunucuya({
      title: info.pageTitle,
      durationSeconds: info.durationSeconds,
      method: info.captionsText ? 'caption' : 'compressed_audio',
      transcriptOrCaptionText: info.captionsText || '',
    });
  });
});

async function gonderSunucuya(payload) {
  const out = document.getElementById('output-area');
  out.innerHTML = `<div class="card">⏳ Yapay zeka ders notunu hazırlıyor...</div>`;

  for (const baseUrl of SERVER_URLS) {
    try {
      const res = await fetch(`${baseUrl}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          language: 'tr',
          slides: capturedSlides,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        renderSummaryResult(data.summary);
        return;
      }
    } catch {
      // Diğer portu dene
    }
  }

  out.innerHTML = `<div class="card" style="border-color: #ef4444;">
    ⚠️ Notly yerel sunucusuna ulaşılamadı. Bilgisayarında <code>npm run dev</code> komutunun açık olduğundan emin ol.
  </div>`;
}

function renderSummaryResult(summary) {
  const out = document.getElementById('output-area');
  out.innerHTML = `
    <div class="card">
      <div style="font-weight: 700; margin-bottom: 6px;">${summary.title}</div>
      <div style="font-size: 0.78rem; color: #10b981; margin-bottom: 10px;">
        ⚡ %${summary.cost.savedPercent} Tasarruf Edildi ($${summary.cost.actualCostUsd})
      </div>
      <p style="font-size: 0.85rem; color: #cbd5e1;">${summary.quick.oneLiner}</p>

      <h4 style="margin: 12px 0 6px; font-size: 0.88rem;">📌 Önemli Noktalar</h4>
      ${summary.quick.bullets
        .map(
          (b) => `
        <div style="margin-bottom: 6px; font-size: 0.84rem;">
          <span class="ts" data-ts="${b.timestamp}">▶ ${b.timestamp}</span>
          ${b.text}
        </div>`
        )
        .join('')}

      <h4 style="margin: 12px 0 6px; font-size: 0.88rem;">🎯 Olası Sınav Soruları</h4>
      ${summary.lecture.examQuestions
        .map(
          (q) => `
        <div style="margin-bottom: 8px; font-size: 0.83rem; padding: 8px; background: #0f172a; border-radius: 8px;">
          <div><strong>Soru:</strong> ${q.question}</div>
          <div style="color: #10b981; margin-top: 4px;"><strong>Cevap:</strong> ${q.answer}</div>
        </div>`
        )
        .join('')}
    </div>
  `;

  out.querySelectorAll('.ts').forEach((el) => {
    el.addEventListener('click', () => {
      const sec = parseTimestampToSeconds(el.getAttribute('data-ts'));
      chrome.runtime.sendMessage({ type: 'SEEK_ACTIVE_VIDEO', seconds: sec });
    });
  });
}
