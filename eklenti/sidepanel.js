/**
 * NOTLY YAN PANEL KONTROLCÜSÜ (SIDEPANEL.JS)
 * -----------------------------------------
 * - Canlı dersleri (Moodle, Zoom, Teams, YouTube) tek tıkla dinler.
 * - getDisplayMedia ile doğrudan sekme veya pencere sesini ve görüntüsünü alır.
 * - Hoca "ekrana bakın / burası sınavda çıkar" dediğinde anında yüksek çözünürlüklü slayt karesi yakalar.
 * - Slaytları ve sesi yapay zekaya multimodal (görsel + ses) olarak gönderir.
 * - Çıktıyı akademik ders kitabı pedagojisiyle (sohbetsiz, doğrudan ders) üretir.
 */

const SERVER_URLS = ['http://localhost:5173', 'http://localhost:8787'];
let activeServerUrl = null;

let isRecording = false;
let recordingStartTime = 0;
let timerInterval = null;
let capturedSlides = [];

// Canlı Yayın ve Medya Değişkenleri
let mediaStream = null;
let mediaRecorder = null;
let audioChunks = [];
const liveVideo = document.createElement('video');
liveVideo.muted = true;
liveVideo.autoplay = true;
liveVideo.playsInline = true;

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

// 2. Slayt / Ekran Yakalama Fonksiyonu (Doğrudan Video Akışından Kristal Netlikte Kare Alır)
function snapSlideFromVideo(customCaption) {
  if (!liveVideo || !liveVideo.videoWidth) {
    return;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = liveVideo.videoWidth;
    canvas.height = liveVideo.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(liveVideo, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    const elapsedSec = isRecording ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0;
    const ts = formatSeconds(elapsedSec);

    capturedSlides.push({
      timestamp: ts,
      imageUrl: dataUrl,
      caption: customCaption || `Slayt [${ts}] (Hoca Vurgusu)`,
    });

    renderSlides();
    showStatus(`📸 Slayt [${ts}] kaydedildi! Yapay zeka formülleri ve şemaları çözecek.`, 'success');
  } catch (err) {
    console.error('Slayt alma hatası:', err);
  }
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

// 3. Ana Kayıt Kontrolleri
const btnToggle = document.getElementById('btn-toggle-record');
const btnSnap = document.getElementById('btn-snap-slide');
const recordTimer = document.getElementById('record-timer');
const recordText = document.getElementById('record-text');
const recordIcon = document.getElementById('record-icon');
const targetTabBadge = document.getElementById('target-tab-badge');
const targetTabTitle = document.getElementById('target-tab-title');

async function startRecording() {
  try {
    showStatus('Dersinizin açık olduğu sekme veya pencereyi seçin...');

    // Chrome'un yerel ve güvenli ekran/sekme paylaşım penceresini açar
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'browser',
      },
      audio: {
        suppressLocalAudioPlayback: false,
      },
    });

    const audioTracks = mediaStream.getAudioTracks();
    if (audioTracks.length === 0) {
      showStatus(
        '⚠️ Seçilen sekmenin sesi paylaşılmadı. Lütfen açılan pencerede "Sekme Sesini Paylaş" kutucuğunun açık olduğundan emin olun.',
        'error'
      );
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
      return;
    }

    // Video akışını gizli video elementine bağla (slayt yakalamak için)
    liveVideo.srcObject = mediaStream;
    await liveVideo.play().catch(() => {});

    // Kullanıcı tarayıcıdaki "Paylaşımı Durdur" butonuna basarsa otomatik olarak sonlandır
    const videoTrack = mediaStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        if (isRecording) {
          stopRecordingAndSummarize();
        }
      };
    }

    // MediaRecorder ile ses kaydını başlat
    audioChunks = [];
    const audioOnlyStream = new MediaStream(audioTracks);

    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    }

    mediaRecorder = new MediaRecorder(audioOnlyStream, mimeType ? { mimeType } : undefined);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.start(1000);

    isRecording = true;
    recordingStartTime = Date.now();
    capturedSlides = [];

    btnToggle.className = 'btn btn-recording';
    recordIcon.textContent = '⏹️';
    recordText.textContent = 'Dersi Bitir ve Ders Kitabı Notu Çıkar';
    recordTimer.style.display = 'inline-block';
    recordTimer.textContent = '00:00';
    btnSnap.style.display = 'flex';

    if (targetTabBadge && targetTabTitle) {
      targetTabBadge.className = 'target-tab-badge ready';
      targetTabTitle.textContent = '🔴 Canlı Ders Dinleniyor ve Kaydediliyor';
    }

    showStatus(
      '🔴 Canlı ders dinleniyor. Hoca ekrandaki bir formüle veya önemli bir konuya değindiğinde butona basarak o kareyi kaydedin.',
      'success'
    );

    timerInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - recordingStartTime) / 1000);
      recordTimer.textContent = formatSeconds(sec);
    }, 1000);

    // İlk slaytı başlangıç referansı olarak 800ms sonra yakala
    setTimeout(() => {
      snapSlideFromVideo('Ders Başlangıç Referans Slaytı');
    }, 800);
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      showStatus('Sekme seçimi iptal edildi.', 'info');
    } else {
      showStatus(`⚠️ Kayıt başlatılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }
}

async function stopRecordingAndSummarize() {
  if (!isRecording) return;
  isRecording = false;
  clearInterval(timerInterval);

  const totalSeconds = Math.max(5, Math.floor((Date.now() - recordingStartTime) / 1000));

  btnToggle.className = 'btn btn-record';
  recordIcon.textContent = '🔴';
  recordText.textContent = 'Canlı Dersi Dinle ve Not Al';
  recordTimer.style.display = 'none';
  btnSnap.style.display = 'none';

  if (targetTabBadge && targetTabTitle) {
    targetTabBadge.className = 'target-tab-badge';
    targetTabTitle.textContent = 'Ders Tamamlandı — Not Hazırlanıyor';
  }

  showStatus(
    `⏳ Ders bitti (${formatSeconds(totalSeconds)}). Yapay zeka ses kaydını ve ${capturedSlides.length} slayt görüntüsünü inceleyerek ders kitabı notunu hazırlıyor...`
  );

  // Kaydediciyi ve medya akışlarını durdur
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }

  // Chunks toparlanması için kısa bir bekleme
  await new Promise((r) => setTimeout(r, 500));

  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  if (audioBlob.size === 0) {
    showStatus('⚠️ Kaydedilen ses verisi boş çıktı.', 'error');
    return;
  }

  // Base64'e dönüştür ve sunucuya gönder
  const reader = new FileReader();
  reader.readAsDataURL(audioBlob);
  reader.onloadend = async () => {
    const base64Audio = reader.result;

    await gonderSunucuya({
      title: 'Canlı Ders Kaydı',
      durationSeconds: totalSeconds,
      method: 'compressed_audio',
      mediaBase64: typeof base64Audio === 'string' ? base64Audio : '',
      mediaMimeType: 'audio/webm',
      slides: capturedSlides,
    });
  };
}

btnToggle?.addEventListener('click', () => {
  if (!isRecording) {
    startRecording();
  } else {
    stopRecordingAndSummarize();
  }
});

btnSnap?.addEventListener('click', () => {
  snapSlideFromVideo('Hoca Tarafından Vurgulanan Kritik Slayt');
});

// 4. Sunucuya Gönderme ve Ders Notu Çıkarma
async function gonderSunucuya(payload) {
  const out = document.getElementById('output-area');
  if (!out) return;

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
  } catch {
    out.innerHTML = `
      <div class="result-card" style="border-color: var(--danger);">
        ⚠️ Notly yerel sunucusuna bağlanılamadı. Lütfen terminalde <code>npm run dev</code> komutunun açık olduğundan emin olun.
      </div>`;
  }
}

function renderSummary(summary) {
  const out = document.getElementById('output-area');
  if (!out) return;

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

      <!-- 3. DERS İÇİ DUYURULAR VE TARİHLER -->
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
