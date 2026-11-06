/**
 * NOTLY OFFSCREEN SES KAYDEDİCİ
 * -----------------------------
 * Sekme sesini (tabCapture) arka planda kaydeder.
 * Sesi kullanıcının hoparlörüne (AudioContext) geri vererek öğrencinin dersi duymasını sağlar.
 */

let mediaRecorder = null;
let recordedChunks = [];
let activeStream = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  if (message.type === 'START_RECORDING') {
    handleStartRecording(message.streamId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error('Kayıt başlatma hatası:', err);
        sendResponse({ ok: false, error: err.message || String(err) });
      });
    return true; // Asenkron yanıt için
  }

  if (message.type === 'STOP_RECORDING') {
    handleStopRecording()
      .then((data) => sendResponse({ ok: true, ...data }))
      .catch((err) => {
        sendResponse({ ok: false, error: err.message || String(err) });
      });
    return true;
  }
});

async function handleStartRecording(streamId) {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  activeStream = stream;
  recordedChunks = [];

  // Sesi kullanıcının hoparlörüne yönlendir (böylece sekme sessize alınmaz!)
  try {
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(audioCtx.destination);
  } catch (audioErr) {
    console.warn('AudioContext yönlendirmesi uyarısı:', audioErr);
  }

  // MediaRecorder başlat (opus sıkıştırmalı)
  try {
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 32000, // Düşük boyutlu, yüksek kaliteli ses
    });
  } catch {
    mediaRecorder = new MediaRecorder(stream);
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onerror = (event) => {
    console.error('MediaRecorder hatası:', event);
  };

  mediaRecorder.start(1000);
}

function handleStopRecording() {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) {
      return reject(new Error('Aktif bir kayıt bulunamadı.'));
    }

    mediaRecorder.onstop = () => {
      try {
        if (activeStream) {
          activeStream.getTracks().forEach((track) => track.stop());
        }

        const blob = new Blob(recordedChunks, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });

        const reader = new FileReader();
        reader.onloadend = () => {
          const result = String(reader.result || '');
          const base64 = result.includes(',') ? result.split(',')[1] : '';
          resolve({
            mediaBase64: base64,
            mediaMimeType: mediaRecorder.mimeType || 'audio/webm',
            sizeBytes: blob.size,
          });
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(blob);
      } catch (err) {
        reject(err);
      }
    };

    if (mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    } else {
      reject(new Error('Kayıt zaten durdurulmuş.'));
    }
  });
}
