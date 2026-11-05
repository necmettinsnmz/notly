/**
 * NOTLY OFFSCREEN SES KAYDEDİCİ
 * -----------------------------
 * Chrome Manifest V3 kuralları gereği sekme sesi burada kaydedilir.
 * Ayrıca sesi AudioContext ile hoparlöre geri bağlarız ki öğrenci dersi dinlemeye devam edebilsin!
 */

let mediaRecorder = null;
let audioChunks = [];
let activeStream = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'OFFSCREEN_START') {
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: message.streamId,
          },
        },
        video: false,
      })
      .then((stream) => {
        activeStream = stream;
        audioChunks = [];

        // Sesi kullanıcının hoparlörüne geri ver (sekme sessize alınmasın!)
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(audioCtx.destination);

        mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 32000, // Düşük boyutlu sıkıştırılmış ses (Katman 2 Tasarrufu!)
        });

        mediaRecorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) audioChunks.push(ev.data);
        };

        mediaRecorder.start(1000);
        sendResponse({ ok: true });
      })
      .catch((err) => {
        sendResponse({ ok: false, error: String(err) });
      });
    return true;
  }

  if (message.type === 'OFFSCREEN_STOP') {
    if (!mediaRecorder) {
      sendResponse({ ok: false, error: 'Aktif kayıt yok.' });
      return true;
    }

    mediaRecorder.onstop = () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : '';
        sendResponse({
          ok: true,
          mediaBase64: base64,
          mediaMimeType: 'audio/webm',
        });
      };
      reader.readAsDataURL(blob);
    };

    mediaRecorder.stop();
    return true;
  }
});
