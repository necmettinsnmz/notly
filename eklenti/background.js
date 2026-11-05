/**
 * NOTLY CHROME EKLENTİSİ — ARKA PLAN SERVİSİ (BACKGROUND SERVICE WORKER)
 * ----------------------------------------------------------------------
 * 1. Eklenti ikonuna tıklanınca sağ tarafta Yan Paneli (Side Panel) açar.
 * 2. Aktif sekmedeki videonun altyazısını, süresini ve o anki slayt görüntüsünü yakalar.
 * 3. İndirilemeyen videolar için sekme sesini (tabCapture) Offscreen belgeye yönlendirir.
 */

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('SidePanel hatası:', err));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // 1. Sayfadaki videodan hazır altyazı ve slayt karesi yakala
  if (message.type === 'INSPECT_ACTIVE_VIDEO') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id) {
        sendResponse({ ok: false, error: 'Aktif sekme bulunamadı.' });
        return;
      }

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            const video = document.querySelector('video');
            const pageTitle = document.title || 'Ders Videosu';

            if (!video) {
              return {
                hasVideo: false,
                pageTitle,
                durationSeconds: 300,
                currentTime: 0,
                captionsText: '',
                slideDataUrl: null,
              };
            }

            // Videonun o anki karesini (Slayt) Canvas ile yakala
            let slideDataUrl = null;
            try {
              const canvas = document.createElement('canvas');
              canvas.width = 480;
              canvas.height = 270;
              const ctx = canvas.getContext('2d');
              if (ctx && video.videoWidth > 0) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                slideDataUrl = canvas.toDataURL('image/jpeg', 0.78);
              }
            } catch {
              // CORS veya DRM korumalı videoda kare yakalanamazsa sessizce geç
              slideDataUrl = null;
            }

            // HTML5 textTracks (altyazılar) varsa oku
            const satirlar = [];
            if (video.textTracks && video.textTracks.length > 0) {
              for (let i = 0; i < video.textTracks.length; i++) {
                const track = video.textTracks[i];
                if (track.cues && track.cues.length > 0) {
                  for (let j = 0; j < track.cues.length; j++) {
                    const cue = track.cues[j];
                    const dk = String(Math.floor(cue.startTime / 60)).padStart(2, '0');
                    const sn = String(Math.floor(cue.startTime % 60)).padStart(2, '0');
                    satirlar.push(`[${dk}:${sn}] ${cue.text}`);
                  }
                  break;
                }
              }
            }

            return {
              hasVideo: true,
              pageTitle,
              durationSeconds: Math.round(video.duration || 600),
              currentTime: Math.round(video.currentTime || 0),
              captionsText: satirlar.join('\n'),
              slideDataUrl,
            };
          },
        });

        sendResponse({ ok: true, data: results[0]?.result });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    });
    return true;
  }

  // 2. Zaman damgasına tıklanınca sayfadaki videoyu o saniyeye sar
  if (message.type === 'SEEK_ACTIVE_VIDEO') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id) return;
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        args: [message.seconds],
        func: (targetSeconds) => {
          const video = document.querySelector('video');
          if (video) {
            video.currentTime = targetSeconds;
            video.play().catch(() => {});
          }
        },
      });
      sendResponse({ ok: true });
    });
    return true;
  }

  // 3. Sekme sesini kaydetmeyi başlat (İndirilemeyen okul videoları için)
  if (message.type === 'START_TAB_RECORDING') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id) {
        sendResponse({ ok: false, error: 'Sekme bulunamadı.' });
        return;
      }

      chrome.tabCapture.getMediaStreamId({ targetTabId: activeTab.id }, async (streamId) => {
        if (chrome.runtime.lastError || !streamId) {
          sendResponse({
            ok: false,
            error: chrome.runtime.lastError?.message || 'Sekme sesi alınamadı.',
          });
          return;
        }

        const contexts = await chrome.runtime.getContexts({
          contextTypes: ['OFFSCREEN_DOCUMENT'],
        });

        if (contexts.length === 0) {
          await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['USER_MEDIA'],
            justification: 'Sekmedeki ders videosunun sesini özetlemek için kaydeder.',
          });
        }

        chrome.runtime.sendMessage(
          { type: 'OFFSCREEN_START', streamId },
          (offscreenRes) => {
            sendResponse(offscreenRes || { ok: true });
          }
        );
      });
    });
    return true;
  }

  // 4. Sekme sesi kaydını bitir ve base64 sesi al
  if (message.type === 'STOP_TAB_RECORDING') {
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' }, (offscreenRes) => {
      sendResponse(offscreenRes);
    });
    return true;
  }
});
