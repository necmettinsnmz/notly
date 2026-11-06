/**
 * NOTLY CHROME EKLENTİSİ — ARKA PLAN SERVİSİ (BACKGROUND SERVICE WORKER)
 * ----------------------------------------------------------------------
 * 1. Eklenti ikonuna tıklanınca Yan Paneli (Side Panel) açar.
 * 2. chrome.tabs.captureVisibleTab ile sekmede görünen ders slaytını fotoğraflar.
 * 3. Offscreen belgede MediaRecorder ile sekme sesini kaydeder.
 */

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('SidePanel hatası:', err));

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Sekmedeki ders videosunun sesini MediaRecorder ile kaydeder.',
  });
}

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // 1. Sekmedeki Görünen Ekranı / Slaytı Fotoğrafla
  if (message.type === 'CAPTURE_VISIBLE_TAB') {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id) {
        sendResponse({ ok: false, error: 'Aktif ders sekmesi bulunamadı.' });
        return;
      }

      if (isRestrictedUrl(activeTab.url)) {
        sendResponse({
          ok: false,
          error:
            'Chrome güvenlik kuralı: "chrome://" sistem sayfalarında veya boş sekmede kayıt yapılamaz. Lütfen dersinizin (Moodle, Zoom, YouTube vb.) açık olduğu sekmeye geçip butona basın.',
        });
        return;
      }

      try {
        chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 75 }, (dataUrl) => {
          if (chrome.runtime.lastError || !dataUrl) {
            sendResponse({
              ok: false,
              error:
                chrome.runtime.lastError?.message ||
                'Ekran yakalanamadı. Lütfen ders sekmesinin açık olduğundan emin olun.',
            });
            return;
          }

          sendResponse({
            ok: true,
            dataUrl,
            title: activeTab.title || 'Canlı Ders',
          });
        });
      } catch (err) {
        sendResponse({
          ok: false,
          error: `Ekran görüntüsü alınamadı: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });
    return true;
  }

  // 2. Yan Panelden Kullanıcı Hareketiyle (User Gesture) Alınan streamId ile Kaydı Başlat
  if (message.type === 'START_OFFSCREEN_RECORDING') {
    (async () => {
      try {
        await ensureOffscreenDocument();

        chrome.runtime.sendMessage(
          { target: 'offscreen', type: 'START_RECORDING', streamId: message.streamId },
          (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({
                ok: false,
                error: `Offscreen iletişim hatası: ${chrome.runtime.lastError.message}`,
              });
              return;
            }
            sendResponse(response || { ok: true });
          }
        );
      } catch (err) {
        sendResponse({
          ok: false,
          error: `Offscreen başlatılamadı: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    })();
    return true;
  }

  // 3. Eski tip doğrudan istek için yedek handler
  if (message.type === 'START_TAB_RECORDING') {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id || isRestrictedUrl(activeTab.url)) {
        sendResponse({
          ok: false,
          error: 'Sistem sayfalarında kayıt yapılamaz. Lütfen ders sekmesine geçin.',
        });
        return;
      }

      try {
        chrome.tabCapture.getMediaStreamId({ targetTabId: activeTab.id }, async (streamId) => {
          if (chrome.runtime.lastError || !streamId) {
            sendResponse({
              ok: false,
              error:
                chrome.runtime.lastError?.message ||
                'Sekme sesi izin vermedi. Lütfen sekmede ses çaldığından emin olun.',
            });
            return;
          }

          try {
            await ensureOffscreenDocument();
            chrome.runtime.sendMessage(
              { target: 'offscreen', type: 'START_RECORDING', streamId },
              (response) => sendResponse(response || { ok: true })
            );
          } catch (err) {
            sendResponse({ ok: false, error: String(err) });
          }
        });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    });
    return true;
  }

  // 4. Sekme Ses Kaydını Bitir ve Sesi Al
  if (message.type === 'STOP_TAB_RECORDING') {
    chrome.runtime.sendMessage(
      { target: 'offscreen', type: 'STOP_RECORDING' },
      (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            ok: false,
            error: chrome.runtime.lastError.message,
          });
          return;
        }
        sendResponse(response || { ok: false, error: 'Offscreen yanıt vermedi.' });
      }
    );
    return true;
  }
});
