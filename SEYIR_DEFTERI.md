# 📓 Notly — Proje Seyir Defteri ve Öğrenme Rehberi

> **Bu Dosya Nedir?**
> Projeye her adımda ne ekleyip ne çıkardığımızı, hangi dosyanın ne işe yaradığını ve kodlama bilmeyen birinin bile açıp kendi başına neleri değiştirebileceğini anlatan **canlı kontrol defterimizdir**.

---

## 📅 Kayıt #1 — 5 Kasım 2026 (v0.1.0 Kurulum ve Tam Sistem İnşası)

### 1. Bugün Projeye Neler Ekledik?

| Klasör / Dosya | Gerçek Hayatta Ne İşe Yarar? (Sıfır Jargon) |
|---|---|
| [`ortak/ayarlar.ts`](./ortak/ayarlar.ts) | **Kumanda Merkezi:** Uygulamanın adı (`Notly`), günlük ücretsiz hak sayısı (`3`), `$60` başlangıç kredisi ve Türkçe/İngilizce tüm ekran yazıları burada durur. |
| [`ortak/log.ts`](./ortak/log.ts) | **Kara Kutu & Muhasebeci:** Yapılan her işlemi kaydeder, yanlışlıkla bir API anahtarı yazılırsa otomatik sansürler (`[GIZLI_ANAHTAR_KORUNDU]`) ve her özetin kaç sent/kuruş harcadığını hesaplar. |
| [`ortak/tasarruf.ts`](./ortak/tasarruf.ts) | **3 Katmanlı Tasarruf Motoru:** Videoda hazır altyazı varsa sesi hiç yüklemeden yazıyı çeker (%90+ tasarruf), günlük 3 ücretsiz özeti takip eder. |
| [`ortak/ozetleyici.ts`](./ortak/ozetleyici.ts) | **Yapay Zeka Beyni:** Tek bir seferde 4 farklı özeti (*Hap, Detaylı, Ders & Sınav Notu, Tam Metin*) üretir. Ayrıca tek tıkla **WhatsApp** ve **Markdown** formatına çevirir. |
| [`sunucu/server.ts`](./sunucu/server.ts) | **Gizli Kasa (Köprü Sunucu):** Senin Google AI Studio API anahtarını tarayıcıdan gizler. Kullanıcılar hiçbir API anahtarı girmeden doğrudan kullanır. |
| [`web/main.ts`](./web/main.ts) ve [`web/style.css`](./web/style.css) | **Web Sitesi:** Dosya sürükle-bırak, mikrofon kaydı, TR/EN dil seçimi, Koyu/Açık tema, tıklanabilir saniyeler ve **🛠️ Log & Maliyet Paneli** ekranı. |
| [`eklenti/`](./eklenti/manifest.json) | **Chrome Eklentisi:** Okul sitelerindeki (Moodle, Canvas vb.) indirilemeyen videoların sesini ve slayt fotoğraflarını yakalayan yan panel eklentisi. |
| [`tests/`](./tests/) | **Otomatik Kalite Kontrol Robotları:** Yaptığımız bir değişiklik sistemi bozdu mu diye 1 saniyede 14 farklı testi otomatik çalıştırır. |

---

### 2. 🧪 Şimdi Sıra Sende: "Kendin Dene ve Öğren" Görevleri!

Sadece sohbet etmek yerine kodu bizzat deneyerek öğrenmen için 3 küçük deney hazırladım:

#### Deney 1: Uygulamanın Adını veya Günlük Hakkı Değiştir (1 Dakika)
1. Sol taraftaki dosya listesinden [`ortak/ayarlar.ts`](./ortak/ayarlar.ts) dosyasını aç.
2. **14. satırdaki** `appName: 'Notly'` yazısını bul ve `'Notly'` yerine istediğin bir ismi yaz (örneğin `'DersJet'` veya kendi seçtiğin bir ad).
3. **19. satırdaki** `dailyFreeLimit: 3` sayısını `5` yap.
4. Dosyayı kaydet (`Ctrl + S`) — açık olan web sayfasında ismin ve günlük hakkın **anında değiştiğini** göreceksin!

#### Deney 2: Geliştirici Log & Maliyet Panelini İncele
1. Web sayfasında sağ üstteki **`🛠️ Log & Maliyet Paneli`** butonuna tıkla.
2. **`🎓 Örnek Ders ile Hemen Dene`** butonuna bas.
3. Log panelinde o işlemin kaç saniye sürdüğünü, kaç token harcadığını ve `$60` kredinden ne kadar düştüğünü (`$59.9994`) canlı olarak gör!
4. Üst üste 3 kez özet çıkardığında 4. denemede **"Günlük ücretsiz hakkın doldu"** korumasının devreye girdiğini gör, ardından paneldeki **`🔄 Test İçin Günlük Kotayı Sıfırla`** butonuna basarak hakkını yenile!

#### Deney 3: Google AI Studio `$60` Kredini ve Anahtarını Bağla
1. Google AI Studio'da (`aistudio.google.com`) gönderdiğin ekran görüntüsündeki **"Set up billing -> Claim credits -> Link API key"** adımlarını tamamla.
2. Aldığın `AIzaSy...` ile başlayan anahtarı kopyala.
3. Projemizdeki `.env.example` dosyasının adını `.env` yap (veya yeni bir `.env` dosyası oluştur) ve içine şu satırı yapıştır:
   ```env
   GEMINI_API_KEY=AIzaSySeninAnahtarinBuraya
   ```
4. `.env` dosyası `.gitignore` içinde korumalı olduğu için **asla GitHub'a yüklenmez**, sadece senin bilgisayarındaki gizli sunucuda kalır!
