/**
 * NOTLY YAN PANEL KONTROLCÜSÜ (SIDEPANEL.JS)
 * -----------------------------------------
 * 1. Canlı Dersi Dinle: getDisplayMedia ile sekme/pencere sesi ve slaytlarını kaydeder.
 * 2. Kompakt Mod: Kayıt başladığında veya istendiğinde 40px mini bara küçülür.
 * 3. Dosya Yükle: MP3, WAV, M4A, WebM, MP4, SRT, VTT dosyalarını sürükle-bırak ile özetler.
 * 4. 4 Modlu Görünüm: Hap Özet, Detaylı Ders Kitabı Anlatımı, Sınav Soruları, Tam Metin.
 */

const SERVER_URLS = ['http://localhost:5173', 'http://localhost:8787'];
let activeServerUrl = null;

let isRecording = false;
let recordingStartTime = 0;
let timerInterval = null;
let capturedSlides = [];
let activeSummaryData = null;

// Medya Akışı Değişkenleri
let mediaStream = null;
let mediaRecorder = null;
let audioChunks = [];
const liveVideo = document.createElement('video');
liveVideo.muted = true;
liveVideo.autoplay = true;
liveVideo.playsInline = true;

// Yüklenen Dosya Verileri
let uploadedFile = null;
let uploadedBase64 = null;
let uploadedText = null;

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

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 1. Sunucu ve Canlı Gemini API Kontrolü
async function checkServerHealth() {
  const pill = document.getElementById('server-status');
  const apiBadge = document.getElementById('api-status-badge');

  for (const url of SERVER_URLS) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) {
        const data = await res.json();
        activeServerUrl = url;
        if (pill) {
          pill.textContent = `● Sunucu (${url.includes('5173') ? '5173' : '8787'})`;
          pill.className = 'server-pill online';
        }
        if (apiBadge) {
          if (data.liveGeminiConnected) {
            apiBadge.textContent = '🟢 Gemini 2.5 Flash';
            apiBadge.className = 'api-pill live';
            apiBadge.title = 'Canlı yapay zeka bağlı. Anahtarı değiştirmek için tıklayın.';
          } else {
            apiBadge.textContent = '🔑 API Ayarla';
            apiBadge.className = 'api-pill';
            apiBadge.title = 'Canlı ses analizi için GEMINI_API_KEY girmek üzere tıklayın.';
          }
        }
        return;
      }
    } catch {
      // Diğer portu dene
    }
  }
  activeServerUrl = null;
  if (pill) {
    pill.textContent = '○ Sunucu Bekleniyor';
    pill.className = 'server-pill';
  }
}

setInterval(checkServerHealth, 3500);
checkServerHealth();

// 1.1 Eklenti İçi API Anahtarı Ayar Kutusu
document.getElementById('api-status-badge')?.addEventListener('click', () => {
  const box = document.getElementById('api-settings-box');
  if (!box) return;
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('ext-btn-save-key')?.addEventListener('click', async () => {
  const input = document.getElementById('ext-api-key-input');
  const key = input && 'value' in input ? String(input.value).trim() : '';
  if (!key) {
    showStatus('⚠️ Lütfen geçerli bir GEMINI_API_KEY (AIza...) girin.', 'error');
    return;
  }

  const serverUrl = activeServerUrl || 'http://localhost:5173';
  try {
    const res = await fetch(`${serverUrl}/api/settings/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      showStatus(`⚠️ ${data.message || data.error || 'Anahtar kaydedilemedi.'}`, 'error');
      return;
    }

    if (input && 'value' in input) input.value = '';
    const box = document.getElementById('api-settings-box');
    if (box) box.style.display = 'none';
    await checkServerHealth();
    showStatus('✅ GEMINI_API_KEY kaydedildi ve canlı yapay zeka aktif edildi!', 'success');
  } catch {
    showStatus('⚠️ Yerel sunucuya bağlanılamadı (npm run dev çalıştığından emin olun).', 'error');
  }
});

// 2. Kompakt Görünüm / Mini Bar Yönetimi
function setCompactMode(isCompact) {
  if (isCompact) {
    document.body.classList.add('compact-view');
  } else {
    document.body.classList.remove('compact-view');
  }
}

document.getElementById('btn-toggle-compact')?.addEventListener('click', () => {
  setCompactMode(true);
});

document.getElementById('mini-btn-expand')?.addEventListener('click', () => {
  setCompactMode(false);
});

// 3. Giriş Yöntemi Geçişleri (Canlı Ders vs Dosya Yükle)
const tabBtnLive = document.getElementById('tab-btn-live');
const tabBtnFile = document.getElementById('tab-btn-file');
const secLive = document.getElementById('section-live-lecture');
const secFile = document.getElementById('section-file-upload');

tabBtnLive?.addEventListener('click', () => {
  tabBtnLive.classList.add('active');
  tabBtnFile?.classList.remove('active');
  if (secLive) secLive.style.display = 'block';
  if (secFile) secFile.style.display = 'none';
});

tabBtnFile?.addEventListener('click', () => {
  tabBtnFile.classList.add('active');
  tabBtnLive?.classList.remove('active');
  if (secFile) secFile.style.display = 'block';
  if (secLive) secLive.style.display = 'none';
});

// 4. Slayt Yakalama
function snapSlideFromVideo(customCaption) {
  if (!liveVideo || !liveVideo.videoWidth) return;

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
    showStatus(`📸 Slayt [${ts}] kaydedildi!`, 'success');
  } catch (err) {
    console.error('Slayt yakalama hatası:', err);
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

// 5. Canlı Kayıt Kontrolleri
const btnToggle = document.getElementById('btn-toggle-record');
const btnSnap = document.getElementById('btn-snap-slide');
const recordTimer = document.getElementById('record-timer');
const recordText = document.getElementById('record-text');
const recordIcon = document.getElementById('record-icon');
const miniTimer = document.getElementById('mini-timer');
const miniBtnSnap = document.getElementById('mini-btn-snap');
const miniBtnStop = document.getElementById('mini-btn-stop');

async function startRecording() {
  try {
    showStatus('Ders sekmesini veya penceresini seçmeniz bekleniyor...');

    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' },
      audio: { suppressLocalAudioPlayback: false },
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

    liveVideo.srcObject = mediaStream;
    await liveVideo.play().catch(() => {});

    const videoTrack = mediaStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        if (isRecording) stopRecordingAndSummarize();
      };
    }

    audioChunks = [];
    const audioOnlyStream = new MediaStream(audioTracks);

    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    }

    mediaRecorder = new MediaRecorder(audioOnlyStream, mimeType ? { mimeType } : undefined);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
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

    // Kayıt başladığında kullanıcının isteği doğrultusunda paneli mini bar moduna küçült
    setCompactMode(true);

    timerInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - recordingStartTime) / 1000);
      const str = formatSeconds(sec);
      recordTimer.textContent = str;
      if (miniTimer) miniTimer.textContent = str;
    }, 1000);

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

  // Kayıt bitince tam paneli tekrar aç
  setCompactMode(false);

  showStatus(
    `⏳ Ders bitti (${formatSeconds(totalSeconds)}). Yapay zeka ses kaydını ve ${capturedSlides.length} slayt görüntüsünü inceleyerek ders kitabı notunu hazırlıyor...`
  );

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }

  await new Promise((r) => setTimeout(r, 500));

  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  if (audioBlob.size === 0) {
    showStatus('⚠️ Kaydedilen ses verisi boş çıktı.', 'error');
    return;
  }

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
  if (!isRecording) startRecording();
  else stopRecordingAndSummarize();
});

btnSnap?.addEventListener('click', () => {
  snapSlideFromVideo('Hoca Vurgusu Slaytı');
});

miniBtnSnap?.addEventListener('click', () => {
  snapSlideFromVideo('Hoca Vurgusu Slaytı');
});

miniBtnStop?.addEventListener('click', () => {
  stopRecordingAndSummarize();
});

// 6. Dosya Yükleme (Drag & Drop + Dosya Seçici)
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const filePreview = document.getElementById('file-preview-card');
const fileNameText = document.getElementById('file-name-text');
const btnRemoveFile = document.getElementById('btn-remove-file');
const btnProcessFile = document.getElementById('btn-process-file');

dropZone?.addEventListener('click', () => fileInput?.click());

dropZone?.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone?.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone?.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    handleFileSelect(e.dataTransfer.files[0]);
  }
});

fileInput?.addEventListener('change', () => {
  if (fileInput.files && fileInput.files[0]) {
    handleFileSelect(fileInput.files[0]);
  }
});

function handleFileSelect(file) {
  uploadedFile = file;
  if (fileNameText) fileNameText.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
  if (filePreview) filePreview.style.display = 'flex';
  if (dropZone) dropZone.style.display = 'none';
  if (btnProcessFile) btnProcessFile.style.display = 'flex';

  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (ext === 'vtt' || ext === 'srt') {
    const reader = new FileReader();
    reader.onload = () => {
      uploadedText = reader.result;
      uploadedBase64 = null;
    };
    reader.readAsText(file);
  } else {
    const reader = new FileReader();
    reader.onload = () => {
      uploadedBase64 = reader.result;
      uploadedText = null;
    };
    reader.readAsDataURL(file);
  }
}

btnRemoveFile?.addEventListener('click', () => {
  uploadedFile = null;
  uploadedBase64 = null;
  uploadedText = null;
  if (fileInput) fileInput.value = '';
  if (filePreview) filePreview.style.display = 'none';
  if (dropZone) dropZone.style.display = 'block';
  if (btnProcessFile) btnProcessFile.style.display = 'none';
});

btnProcessFile?.addEventListener('click', async () => {
  if (!uploadedFile) return;

  showStatus('⏳ Dosya analiz ediliyor ve yapay zeka ders kitabı notunu hazırlıyor...');
  btnProcessFile.disabled = true;

  const payload = {
    title: uploadedFile.name.replace(/\.[^/.]+$/, ''),
    language: 'tr',
  };

  if (uploadedText) {
    payload.method = 'caption';
    payload.transcriptOrCaptionText = uploadedText;
  } else if (uploadedBase64) {
    payload.method = 'compressed_audio';
    payload.mediaBase64 = uploadedBase64;
    payload.mediaMimeType = uploadedFile.type || 'audio/webm';
  }

  await gonderSunucuya(payload);
  btnProcessFile.disabled = false;
});

// 7. Sunucuya Gönderme ve Ders Notu Çıkarma
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
      activeSummaryData = data.summary;
      renderSummaryWithTabs(data.summary);
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

// 8. 4 Modlu Görünüm (Hap Özet, Detaylı Özet, Sınav Notu, Tam Metin)
function renderSummaryWithTabs(summary) {
  const out = document.getElementById('output-area');
  if (!out) return;

  const durationMin = Math.round((summary.durationSeconds || 60) / 60);

  out.innerHTML = `
    <div class="result-card">
      <div style="font-size: 1.05rem; font-weight: 750; margin-bottom: 4px;">
        🎓 ${escapeHtml(summary.title)}
      </div>
      <div style="font-size: 0.72rem; color: var(--success); font-family: var(--font-mono); margin-bottom: 8px;">
        ⚡ ${durationMin} dk süre | ${summary.slides?.length || 0} slayt incelendi | ${summary.usedLiveApi ? '🟢 Canlı Gemini 2.5 Flash' : 'ℹ️ Yerel Analiz Modu'}
      </div>

      <!-- 4 MODLU SEKMELER -->
      <div class="view-tabs">
        <button class="view-tab active" data-target="panel-quick">⚡ Hap Özet</button>
        <button class="view-tab" data-target="panel-detailed">📋 Detaylı Anlatım</button>
        <button class="view-tab" data-target="panel-exam">🎯 Sınav Soruları</button>
        <button class="view-tab" data-target="panel-transcript">📝 Tam Metin</button>
      </div>

      <!-- 1. HAP ÖZET PANELİ -->
      <div id="panel-quick" class="tab-panel active">
        <div style="padding: 10px 12px; background: var(--surface-inset); border-radius: 6px; font-size: 0.84rem; margin-bottom: 10px; border-left: 3px solid var(--accent);">
          <strong>📖 Dersin Özü:</strong>
          <p style="margin-top: 4px; color: var(--text-primary);">${escapeHtml(summary.quick?.oneLiner)}</p>
        </div>

        <h4 style="font-size: 0.82rem; margin: 8px 0 4px;">Kritik Maddeler:</h4>
        <ul style="padding-left: 1.1rem; font-size: 0.8rem; margin-bottom: 12px;">
          ${(summary.quick?.bullets || []).map((b) => `<li style="margin-bottom: 4px;"><span class="ts">${escapeHtml(b.timestamp)}</span> ${escapeHtml(b.text)}</li>`).join('')}
        </ul>

        ${
          summary.quick?.actionItems && summary.quick.actionItems.length > 0
            ? `
          <h4 style="font-size: 0.82rem; margin: 8px 0 4px; color: var(--warning);">📌 Ders İçi Duyurular, Ödev & Sınav Tarihleri:</h4>
          <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;">
            ${summary.quick.actionItems
              .map(
                (a) => `
              <div style="padding: 6px 8px; background: var(--surface-inset); border-radius: 5px; border-left: 3px solid var(--warning); font-size: 0.78rem;">
                <span class="ts">${escapeHtml(a.timestamp)}</span> <strong>${escapeHtml(a.task)}</strong>
                ${a.due ? `<span style="color: var(--warning); margin-left: 4px;">[${escapeHtml(a.due)}]</span>` : ''}
              </div>`
              )
              .join('')}
          </div>`
            : ''
        }
      </div>

      <!-- 2. DETAYLI DERS KİTABI PANELİ -->
      <div id="panel-detailed" class="tab-panel">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${(summary.detailed?.sections || [])
            .map(
              (sec) => `
            <div style="padding: 8px 10px; background: var(--surface-inset); border-radius: 6px; border: 1px solid var(--border-subtle);">
              <div style="font-weight: 700; font-size: 0.84rem; margin-bottom: 4px;">
                <span class="ts">${escapeHtml(sec.timestamp)}</span> ${escapeHtml(sec.heading)}
              </div>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 6px; line-height: 1.4;">${escapeHtml(sec.summary)}</p>
              <ul style="padding-left: 1rem; font-size: 0.78rem; color: var(--text-primary);">
                ${sec.keyPoints.map((kp) => `<li style="margin-bottom: 2px;">${escapeHtml(kp)}</li>`).join('')}
              </ul>
            </div>`
            )
            .join('')}
        </div>
      </div>

      <!-- 3. SINAV SORULARI PANELİ -->
      <div id="panel-exam" class="tab-panel">
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${(summary.lecture?.examQuestions || [])
            .map(
              (q) => `
            <div class="exam-box">
              <div style="font-weight: 600; font-size: 0.82rem; margin-bottom: 4px;">
                <span class="ts" style="background: rgba(245, 158, 11, 0.15); color: var(--warning);">${escapeHtml(q.difficulty)}</span> ❓ ${escapeHtml(q.question)}
              </div>
              <div style="color: var(--success); font-size: 0.78rem;">
                ✅ <strong>Cevap:</strong> ${escapeHtml(q.answer)}
              </div>
            </div>`
            )
            .join('')}
        </div>
      </div>

      <!-- 4. TAM METİN / TRANSKRİPT PANELİ -->
      <div id="panel-transcript" class="tab-panel">
        <div style="max-height: 300px; overflow-y: auto; padding-right: 4px;">
          ${
            summary.transcript?.segments && summary.transcript.segments.length > 0
              ? summary.transcript.segments
                  .map(
                    (t) => `
                <div class="transcript-row">
                  <span class="ts">${escapeHtml(t.timestamp)}</span>
                  <strong style="color: var(--accent); margin-right: 4px;">${escapeHtml(t.speaker)}:</strong>
                  <span>${escapeHtml(t.text)}</span>
                </div>`
                  )
                  .join('')
              : '<p style="color: var(--text-muted); font-size: 0.8rem;">Transkript dökümü hazırlanıyor...</p>'
          }
        </div>
      </div>

      <!-- ALT AKSİYON BUTONLARI -->
      <div class="summary-actions-bar" style="margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border-subtle); display: flex; gap: 6px;">
        <button class="btn" id="btn-copy-all" style="font-size: 0.74rem; margin-bottom: 0;">📋 Kopyala</button>
        <button class="btn" id="btn-download-md" style="font-size: 0.74rem; margin-bottom: 0;">📄 .md</button>
        <button class="btn" id="btn-print-pdf" style="font-size: 0.74rem; margin-bottom: 0;">🖨️ PDF</button>
      </div>
    </div>
  `;

  // Sekme Değiştirici Olayları
  const tabs = out.querySelectorAll('.view-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      out.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-target');
      if (targetId) {
        document.getElementById(targetId)?.classList.add('active');
      }
    });
  });

  // Kopyalama Butonu
  document.getElementById('btn-copy-all')?.addEventListener('click', () => {
    const text = `${summary.title}\n\n📖 DERSİN ÖZÜ:\n${summary.quick?.oneLiner}\n\n📋 DETAYLI ANLATIM:\n${(summary.detailed?.sections || []).map((s) => `• ${s.heading}:\n  ${s.summary}`).join('\n\n')}\n\n🎯 SINAV SORULARI:\n${(summary.lecture?.examQuestions || []).map((q) => `S: ${q.question}\nC: ${q.answer}`).join('\n\n')}`;
    navigator.clipboard.writeText(text);
    showStatus('Ders notları panoya kopyalandı!', 'success');
  });

  // Markdown İndirme Butonu
  document.getElementById('btn-download-md')?.addEventListener('click', () => {
    const text = `# ${summary.title}\n\n> Süre: ${durationMin} dakika\n\n## 📖 Dersin Özü\n${summary.quick?.oneLiner}\n\n## 📋 Detaylı Ders Kitabı Anlatımı\n${(summary.detailed?.sections || []).map((s) => `### ${s.heading} (${s.timestamp})\n${s.summary}\n\n${s.keyPoints.map((kp) => `- ${kp}`).join('\n')}`).join('\n\n')}\n\n## 🎯 Sınav Soruları ve Cevapları\n${(summary.lecture?.examQuestions || []).map((q) => `**Soru [${q.difficulty}]:** ${q.question}\n**Cevap:** ${q.answer}`).join('\n\n')}`;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${summary.title.replace(/[^a-zA-Z0-9çşğüöıÇŞĞÜÖİ_-]/g, '_')}_Ders_Notu.md`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus('Ders notu .md olarak indirildi!', 'success');
  });

  // PDF Yazdır / Kaydet Butonu
  document.getElementById('btn-print-pdf')?.addEventListener('click', () => {
    window.print();
  });
}
