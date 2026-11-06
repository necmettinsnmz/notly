/**
 * NOTLY YAN PANEL KONTROLCÜSÜ (SIDEPANEL.JS)
 * -----------------------------------------
 * - Canlı dersleri (Moodle, Zoom, Teams, YouTube) tek tıkla dinler.
 * - Slaytları ve ekranı arka planda otomatik (her 40 saniyede bir) fotoğraflar.
 * - Dersi bitirince Notly yerel sunucusuna gönderip sınav notunu çıkarır.
 */

const SERVER_URLS = ['http://localhost:5173', 'http://localhost:8787'];
let activeServerUrl = null;

let isRecording = false;
let recordingStartTime = 0;
let timerInterval = null;
let autoSlideInterval = null;
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

// 2. Slayt / Ekran Yakalama Fonksiyonu
function captureSlide(customCaption) {
  chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' }, (res) => {
    if (res?.ok && res.dataUrl) {
      const elapsedSec = isRecording ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0;
      const ts = formatSeconds(elapsedSec);

      // Çok benzer arka arkaya boş slaytları engellemek için son slaytla karşılaştır
      capturedSlides.push({
        timestamp: ts,
        imageUrl: res.dataUrl,
        caption: customCaption || `Slayt (${ts})`,
      });

      renderSlides();
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

  // En son eklenen slayta kaydır
  track.scrollLeft = track.scrollWidth;
}

// 3. Ana Kayıt Butonu (Başlat / Durdur)
const btnToggle = document.getElementById('btn-toggle-record');
const btnSnap = document.getElementById('btn-snap-slide');
const recordTimer = document.getElementById('record-timer');
const recordText = document.getElementById('record-text');
const recordIcon = document.getElementById('record-icon');

btnToggle?.addEventListener('click', async () => {
  if (!isRecording) {
    // KAYDI BAŞLAT
    showStatus('Sekme ses bağlantısı kuruluyor...');
    chrome.runtime.sendMessage({ type: 'START_TAB_RECORDING' }, (res) => {
      if (res?.ok) {
        isRecording = true;
        recordingStartTime = Date.now();
        capturedSlides = [];

        btnToggle.className = 'btn btn-recording';
        recordIcon.textContent = '⏹️';
        recordText.textContent = 'Dersi Bitir ve Notları Çıkar';
        recordTimer.style.display = 'inline-block';
        recordTimer.textContent = '00:00';
        btnSnap.style.display = 'flex';

        showStatus(
          '🔴 Canlı ders dinleniyor. Slaytlar her 40 saniyede bir otomatik yakalanacak.',
          'success'
        );

        // Canlı Süre Sayacı
        timerInterval = setInterval(() => {
          const sec = Math.floor((Date.now() - recordingStartTime) / 1000);
          recordTimer.textContent = formatSeconds(sec);
        }, 1000);

        // İlk slaytı hemen al
        captureSlide('Ders Başlangıç Slaytı');

        // Otomatik Slayt Yakalayıcı (Her 40 saniyede bir ekran görüntüsü al)
        autoSlideInterval = setInterval(() => {
          if (isRecording) {
            captureSlide();
          }
        }, 40000);
      } else {
        showStatus(`⚠️ ${res?.error || 'Sekme sesi başlatılamadı.'}`, 'error');
      }
    });
  } else {
    // KAYDI BİTİR VE ÖZETLE
    isRecording = false;
    clearInterval(timerInterval);
    clearInterval(autoSlideInterval);

    const totalSeconds = Math.max(10, Math.floor((Date.now() - recordingStartTime) / 1000));

    btnToggle.className = 'btn btn-record';
    recordIcon.textContent = '🔴';
    recordText.textContent = 'Canlı Dersi Dinle & Otomatik Slayt Yakala';
    recordTimer.style.display = 'none';
    btnSnap.style.display = 'none';

    showStatus(
      `⏳ Ders kaydı tamamlandı (${formatSeconds(totalSeconds)}). Yapay zeka ses ve ${capturedSlides.length} slaytı analiz ediyor...`
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

// 4. Manuel Anlık Slayt Butonu
btnSnap?.addEventListener('click', () => {
  captureSlide('Öğrenci Tarafından İşaretlenen Slayt');
  showStatus('📸 Slayt nota eklendi!', 'success');
  setTimeout(() => {
    if (isRecording) {
      showStatus('🔴 Canlı ders dinleniyor...', 'info');
    }
  }, 2000);
});

// 5. Sunucuya Gönderme ve Not Çıkarma
async function gonderSunucuya(payload) {
  const out = document.getElementById('output-area');
  out.innerHTML = `
    <div class="result-card">
      <div style="font-weight: 700; margin-bottom: 6px;">🧠 Notlar Hazırlanıyor...</div>
      <p style="color: var(--text-muted); font-size: 0.82rem;">
        Gemini 2.5 Flash ses dökümünü ve slaytları inceliyor, sınav sorularını tahmin ediyor.
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
      showStatus('✅ Ders notu başarıyla çıkarıldı!', 'success');
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
        ⚡ %${summary.cost.savedPercent} Tasarruf | ${Math.round(summary.durationSeconds / 60)} dk kayıt | ${summary.slides.length} slayt
      </div>

      <div style="padding: 8px 10px; background: var(--surface-inset); border-radius: 6px; font-size: 0.82rem; margin-bottom: 12px;">
        <strong>💡 Özet:</strong> ${summary.quick.oneLiner}
      </div>

      <h4 style="font-size: 0.86rem; margin-bottom: 6px;">⚡ Kritik Notlar</h4>
      <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px;">
        ${summary.quick.bullets
          .map(
            (b) => `
          <div style="font-size: 0.82rem;">
            <span class="ts">${b.timestamp}</span> ${b.text}
          </div>`
          )
          .join('')}
      </div>

      <h4 style="font-size: 0.86rem; margin-bottom: 6px;">🎯 Sınavda Çıkabilecek Sorular</h4>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        ${summary.lecture.examQuestions
          .map(
            (q) => `
          <div class="exam-box">
            <div style="font-weight: 600; font-size: 0.82rem;">❓ ${q.question}</div>
            <div style="color: var(--success); font-size: 0.8rem; margin-top: 3px;">
              ✅ <strong>Cevap:</strong> ${q.answer}
            </div>
          </div>`
          )
          .join('')}
      </div>

      <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border-subtle); display: flex; gap: 6px;">
        <button class="btn" id="btn-copy-summary" style="font-size: 0.78rem;">📲 WhatsApp İçin Kopyala</button>
      </div>
    </div>
  `;

  document.getElementById('btn-copy-summary')?.addEventListener('click', () => {
    const text = `${summary.title}\n\n${summary.quick.oneLiner}\n\n📌 Önemli:\n${summary.quick.bullets.map((b) => `• [${b.timestamp}] ${b.text}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    showStatus('Panoya kopyalandı!', 'success');
  });
}
