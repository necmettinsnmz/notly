# System Architecture — Notly

This document details the engineering design, token economics, security boundaries, and browser capture architecture of **Notly**.

---

## 1. End-to-End Request Lifecycle

Notly decouples client surfaces (Web PWA and Chrome MV3 Extension) from LLM credentials via a lightweight, zero-framework Node.js HTTP proxy (`sunucu/server.ts`). During local development, `vite.config.ts` mounts `createNotlyServer()` directly onto `/api/*` middleware so both frontend and backend share port `5173`.

1. **Ingestion (`web/` or `eklenti/`)**:
   - **Captions / Text**: `.vtt`, `.srt`, or pasted text is uploaded directly as UTF-8 strings.
   - **Recorded / Uploaded Audio**: Recorded `audio/webm;codecs=opus` chunks or uploaded audio files (`<= 50 MB`) are Base64-encoded and submitted via `POST /api/summarize`.
   - **Lecture Slides**: Video frames sampled via HTML5 `<canvas>` are attached as Base64 `image/jpeg` payloads alongside their `MM:SS` timestamps.
2. **Quota & Telemetry Guard (`sunucu/server.ts`)**:
   - Identifies the caller via `X-Client-Id` (or socket remote IP) and checks `DailyQuotaManager.consume()`.
   - Enforces a 64 MB maximum HTTP payload size (`MAX_BODY_BYTES`).
   - Dynamically reloads `.env` if modified on disk (tracked by `mtimeMs`) so API keys saved via `/api/settings/key` take effect without restarting the server.
3. **Multimodal Inference (`ortak/ozetleyici.ts`)**:
   - Strips `data:<mime>;base64,` prefixes and codec suffixes (e.g. `audio/webm;codecs=opus` → `audio/webm`) to conform strictly to Gemini API `inlineData` requirements.
   - Prompts Gemini 2.5 Flash with structured JSON Schema (`GEMINI_RESPONSE_SCHEMA`) so all four views (`quick`, `detailed`, `lecture`, `transcript`) are generated in **one round-trip**.
   - If no `GEMINI_API_KEY` is configured or live inference fails, falls back gracefully to `uretYerelAkilliOzet()`: parses captions deterministically or returns explicit setup instructions for raw audio payloads.

---

## 2. 3-Layer Cost & Token Optimization (`ortak/tasarruf.ts` & `ortak/log.ts`)

Unoptimized raw audio processing consumes `~25 tokens/sec` (`~90,000 tokens/hour`). Notly implements three cost-control layers:

| Layer | Strategy | Implementation | Cost Reduction |
|---|---|---|---|
| **Layer 1** | Caption-First Extraction | `ayiklaAltyaziMetni()` strips WEBVTT/SRT metadata and HTML tags into compact `[MM:SS] Sentence` lines (`~3.5 text tokens/sec` vs `25 audio tokens/sec`). | **~85–95%** vs raw audio |
| **Layer 2** | Compression Modeling | Models `1.5x` speech speedup + silence trimming (`effectiveSeconds = (duration / 1.5) * 0.88`). | **~41%** audio token cut |
| **Layer 3** | Per-Client Quota Shield | `DailyQuotaManager` enforces configurable per-24h client limits (`DAILY_FREE_LIMIT`, default `3`). | Prevents runaway usage |

`hesaplaMaliyetVeTasarruf()` computes both actual USD/TRY spend and the exact delta saved compared to an unoptimized raw-audio baseline.

---

## 3. Chrome Extension MV3 Capture Architecture (`eklenti/`)

Early iterations attempted `chrome.tabCapture.getMediaStreamId()` from `background.js` when triggered inside the Chrome Side Panel. Under Chromium's security architecture (see Chromium Issue #328456885), interactions inside a persistent Side Panel document do **not** transfer `activeTab` user-gesture activation to adjacent webpage tabs, causing `Extension has not been invoked for the current page`.

To eliminate this restriction cleanly while improving slide quality:

- **`eklenti/sidepanel.js`** invokes the W3C standard **`navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: { suppressLocalAudioPlayback: false } })`** directly inside the user click handler.
- **Benefits:**
  1. Zero `activeTab` side-panel context failures across Chrome tabs, Zoom windows, Moodle portals, or YouTube.
  2. Live video frames are rendered to an off-DOM `<video>` element, allowing `snapSlideFromVideo()` to extract pure slide regions via `<canvas>` without browser tabs, bookmark bars, or the side panel itself appearing in captured slides.
  3. Audio tracks are isolated into a `MediaStream` for `audio/webm;codecs=opus` `MediaRecorder` encoding while keeping local playback audible to the student.
  4. When recording starts, `document.body.classList.add('compact-view')` collapses the Side Panel UI into a minimal floating recording bar (`Timer | 📸 Slayt | ⏹️ Bitir | ⤢`).

---

## 4. Security & Privacy Controls

1. **Server-Side Credential Isolation:** `GEMINI_API_KEY` is read exclusively by `sunucu/server.ts` and never serialized into `/api/health`, `/api/logs`, or client bundles.
2. **Automatic Secret Redaction (`ortak/log.ts`):** `maskeleGizliBilgi()` scrubs `AIza[0-9A-Za-z\-_]{10,}` and key-value secrets (`apiKey=...`, `secret=...`, `token=...`) before persisting entries or log metadata.
3. **HTML Escaping:** Both `web/main.ts` and `eklenti/sidepanel.js` sanitize dynamic strings through `escapeHtml()` before DOM injection.
4. **Input Validation:** `POST /api/settings/key` enforces Google AI Studio key format checks (`startsWith('AIza') && length >= 20`) and caps HTTP request payloads at 64 MB.
