/**
 * Multimodal 4-Mode Summarization Engine
 * Generates Quick Summary, Detailed Textbook Notes, Exam Prep Q&A, and Timestamped Transcript
 * in a single Gemini API pass (or deterministic local text analysis fallback).
 */

import { GoogleGenAI, Type } from '@google/genai';
import { APP_CONFIG, DilKodu, TasarrufYontemi } from './ayarlar';
import { Logger, MaliyetHesabiSonucu, globalLogger } from './log';
import { ayiklaAltyaziMetni } from './tasarruf';

export interface ZamanliMadde {
  text: string;
  timestamp: string;
}

export interface AksiyonMaddesi {
  task: string;
  due: string | null;
  timestamp: string;
}

export interface DetayBolumu {
  heading: string;
  timestamp: string;
  summary: string;
  keyPoints: string[];
}

export interface KavramTanimi {
  term: string;
  definition: string;
  timestamp: string;
}

export interface SinavSorusu {
  question: string;
  answer: string;
  difficulty: 'Kolay' | 'Orta' | 'Zor' | 'Easy' | 'Medium' | 'Hard';
  timestamp: string;
}

export interface SlaytKaresi {
  timestamp: string;
  imageUrl?: string;
  caption: string;
}

export interface TranskriptSegmenti {
  speaker: string;
  timestamp: string;
  text: string;
}

export interface BirlesikOzetSonucu {
  id: string;
  title: string;
  createdAt: string;
  language: DilKodu;
  durationSeconds: number;
  usedLiveApi: boolean;
  slides: SlaytKaresi[];
  quick: {
    oneLiner: string;
    bullets: ZamanliMadde[];
    actionItems: AksiyonMaddesi[];
  };
  detailed: {
    sections: DetayBolumu[];
  };
  lecture: {
    concepts: KavramTanimi[];
    examQuestions: SinavSorusu[];
    instructorHighlights: ZamanliMadde[];
  };
  transcript: {
    segments: TranskriptSegmenti[];
  };
  cost: MaliyetHesabiSonucu;
}

export interface OzetIstegi {
  title: string;
  language: DilKodu;
  durationSeconds?: number;
  method?: TasarrufYontemi;
  /** Hazır altyazı, ders metni veya konuşma dökümü varsa buraya gelir */
  transcriptOrCaptionText?: string;
  /** Ses veya video dosyası base64 olarak gönderildiyse */
  mediaBase64?: string;
  mediaMimeType?: string;
  /** Chrome eklentisinden yakalanan slayt ekran görüntüleri */
  slides?: SlaytKaresi[];
  /** Sunucu ortamındaki Gemini API anahtarı (varsa gerçek Gemini API çağrılır) */
  apiKey?: string;
}

/**
 * Gemini API'den dönecek JSON şeması (4 mod tek pakette)
 */
const GEMINI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    quick: {
      type: Type.OBJECT,
      properties: {
        oneLiner: { type: Type.STRING },
        bullets: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              timestamp: { type: Type.STRING },
            },
            required: ['text', 'timestamp'],
          },
        },
        actionItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              task: { type: Type.STRING },
              due: { type: Type.STRING, nullable: true },
              timestamp: { type: Type.STRING },
            },
            required: ['task', 'timestamp'],
          },
        },
      },
      required: ['oneLiner', 'bullets', 'actionItems'],
    },
    detailed: {
      type: Type.OBJECT,
      properties: {
        sections: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              heading: { type: Type.STRING },
              timestamp: { type: Type.STRING },
              summary: { type: Type.STRING },
              keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['heading', 'timestamp', 'summary', 'keyPoints'],
          },
        },
      },
      required: ['sections'],
    },
    lecture: {
      type: Type.OBJECT,
      properties: {
        concepts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              definition: { type: Type.STRING },
              timestamp: { type: Type.STRING },
            },
            required: ['term', 'definition', 'timestamp'],
          },
        },
        examQuestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              timestamp: { type: Type.STRING },
            },
            required: ['question', 'answer', 'difficulty', 'timestamp'],
          },
        },
        instructorHighlights: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              timestamp: { type: Type.STRING },
            },
            required: ['text', 'timestamp'],
          },
        },
      },
      required: ['concepts', 'examQuestions', 'instructorHighlights'],
    },
    transcript: {
      type: Type.OBJECT,
      properties: {
        segments: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              speaker: { type: Type.STRING },
              timestamp: { type: Type.STRING },
              text: { type: Type.STRING },
            },
            required: ['speaker', 'timestamp', 'text'],
          },
        },
      },
      required: ['segments'],
    },
  },
  required: ['quick', 'detailed', 'lecture', 'transcript'],
};

/**
 * Local fallback & offline text analyzer used when GEMINI_API_KEY is not configured.
 * Processes VTT/SRT captions or plain transcripts deterministically, and provides
 * explicit setup guidance when raw audio/video is submitted without a live API key.
 */
function uretYerelAkilliOzet(
  istek: OzetIstegi,
  temizMetin: string
): Omit<BirlesikOzetSonucu, 'id' | 'createdAt' | 'cost' | 'usedLiveApi'> {
  const tr = istek.language === 'tr';
  const hamSatirlar = temizMetin
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  // Filter conversational filler openings ("Merhaba arkadaşlar", "Hello everyone", etc.)
  const satirlar = hamSatirlar.filter((s) => {
    const metinKismi = s.replace(/^\[\d{2}:\d{2}(?::\d{2})?\]\s*/, '').trim();
    return !/^(merhaba|selam|günaydın|iyi günler|nasılsınız|arkadaşlar|hoş geldiniz|hello|welcome|hi everyone)/i.test(
      metinKismi
    );
  });

  const sesVarMetinYok = satirlar.length === 0 && Boolean(istek.mediaBase64);

  if (sesVarMetinYok) {
    const setupMsg = tr
      ? 'Ham ses/video kaydı algılandı ancak sunucuda aktif bir GEMINI_API_KEY tanımlı değil. Seslerin kelimesi kelimesine deşifre edilip ders kitabı özetine dönüştürülmesi için Google AI Studio anahtarınızı .env dosyasına veya uygulama içi "⚙️ API Ayarları" paneline ekleyin. (Not: .vtt / .srt altyazı ve metin dosyaları API anahtarı olmadan da analiz edilir.)'
      : 'Raw audio/video was captured, but no GEMINI_API_KEY is configured on the server. To transcribe spoken audio and analyze captured slides, add your Google AI Studio key in .env or via the in-app API Settings panel. (Note: VTT/SRT captions and text transcripts work offline as well.)';

    const bullets: ZamanliMadde[] = [
      {
        timestamp: '00:00',
        text: tr
          ? `Ses kaydı (${Math.round((istek.durationSeconds ?? 60) / 60)} dk) ve ${istek.slides?.length ?? 0} slayt karesi yakalandı.`
          : `Audio capture (${Math.round((istek.durationSeconds ?? 60) / 60)} min) and ${istek.slides?.length ?? 0} slide frame(s) received.`,
      },
      {
        timestamp: '00:01',
        text: tr
          ? 'Konuşma tanıma (Speech-to-Text) ve slayt OCR işlemi için GEMINI_API_KEY yapılandırması bekleniyor.'
          : 'Waiting for GEMINI_API_KEY configuration to run multimodal speech-to-text and slide vision.',
      },
    ];

    return {
      title: istek.title,
      language: istek.language,
      durationSeconds: istek.durationSeconds ?? 300,
      slides: istek.slides ?? [],
      quick: {
        oneLiner: setupMsg,
        bullets,
        actionItems: [
          {
            task: tr
              ? 'Google AI Studio üzerinden ücretsiz API anahtarı alıp .env veya arayüzdeki API Ayarları alanından kaydedin.'
              : 'Obtain a Google AI Studio key and save it in .env or via the in-app API Settings input.',
            due: tr ? 'Tek Seferlik Kurulum' : 'One-Time Setup',
            timestamp: '00:00',
          },
        ],
      },
      detailed: {
        sections: [
          {
            heading: tr ? 'API Yapılandırması Gerekli' : 'API Configuration Required',
            timestamp: '00:00',
            summary: setupMsg,
            keyPoints: bullets.map((b) => b.text),
          },
        ],
      },
      lecture: {
        concepts: [
          {
            term: 'GEMINI_API_KEY',
            definition: tr
              ? 'Ham ses/video dosyalarını ve slayt görsellerini analiz etmek için gereken Google Gemini 2.5 Flash anahtarı.'
              : 'Required to run multimodal Gemini 2.5 Flash inference on raw audio/video and slide images.',
            timestamp: '00:00',
          },
        ],
        examQuestions: [
          {
            question: tr
              ? 'Canlı ses kaydından tam ders özeti alabilmek için hangi adım gereklidir?'
              : 'What step is required to generate live transcripts and summaries from audio recordings?',
            answer: tr
              ? 'Sunucuya .env veya API Ayarları üzerinden geçerli bir GEMINI_API_KEY tanımlamak.'
              : 'Configure a valid GEMINI_API_KEY via .env or the in-app API Settings panel.',
            difficulty: tr ? 'Kolay' : 'Easy',
            timestamp: '00:00',
          },
        ],
        instructorHighlights: bullets,
      },
      transcript: {
        segments: [
          {
            speaker: tr ? 'Sistem' : 'System',
            timestamp: '00:00',
            text: setupMsg,
          },
        ],
      },
    };
  }

  const parcaliSatirlar =
    satirlar.length > 0
      ? satirlar.map((satir, idx) => {
          const eslesme = satir.match(/^\[(\d{2}:\d{2}(?::\d{2})?)\]\s*(.*)$/);
          const varsayilanDk = String(Math.floor((idx * 45) / 60)).padStart(2, '0');
          const varsayilanSn = String((idx * 45) % 60).padStart(2, '0');
          return {
            timestamp: eslesme ? eslesme[1] : `${varsayilanDk}:${varsayilanSn}`,
            text: eslesme ? eslesme[2] : satir,
          };
        })
      : [
          {
            timestamp: '00:10',
            text: tr
              ? `${istek.title} konusunda temel teorik çerçeve ve anahtar kavramlar ele alındı.`
              : `Core theoretical framework and primary concepts for ${istek.title} were outlined.`,
          },
          {
            timestamp: '02:30',
            text: tr
              ? 'Uygulama örnekleri ve metodolojik adımlar karşılaştırmalı olarak incelendi.'
              : 'Practical examples and methodological steps were reviewed comparatively.',
          },
        ];

  const oneLiner = tr
    ? `"${istek.title}" içeriğinden ${parcaliSatirlar.length} zaman damgalı bölüm ayıklanarak yerel metin motoruyla özetlendi.`
    : `Extracted ${parcaliSatirlar.length} timestamped segments from "${istek.title}" using the local text analyzer.`;

  const bullets: ZamanliMadde[] = parcaliSatirlar.slice(0, 5).map((item) => ({
    timestamp: item.timestamp,
    text: item.text,
  }));

  const gorevSatirlari = parcaliSatirlar.filter((item) =>
    /(sınav|teslim|ödev|cuma|pazartesi|çarşamba|perşembe|salı|saat|\d{1,2}:\d{2}|exam|due|deadline|project|meeting|homework)/i.test(
      item.text
    )
  );

  const actionItems: AksiyonMaddesi[] =
    gorevSatirlari.length > 0
      ? gorevSatirlari.map((g) => ({
          task: g.text,
          due: tr ? 'Belirtilen Tarih / Saat' : 'Mentioned Date / Time',
          timestamp: g.timestamp,
        }))
      : [
          {
            task: tr
              ? `${istek.title} notlarını gözden geçir ve temel kavramları pekiştir.`
              : `Review ${istek.title} notes and reinforce core concepts.`,
            due: tr ? 'Bu Hafta' : 'This Week',
            timestamp: parcaliSatirlar[0].timestamp,
          },
        ];

  // Divide lines dynamically into 1..3 balanced sections
  const sectionCount = parcaliSatirlar.length >= 6 ? 3 : parcaliSatirlar.length >= 2 ? 2 : 1;
  const chunkSize = Math.ceil(parcaliSatirlar.length / sectionCount);
  const detailedSections: DetayBolumu[] = Array.from({ length: sectionCount }, (_, idx) => {
    const slice = parcaliSatirlar.slice(idx * chunkSize, (idx + 1) * chunkSize);
    const first = slice[0] || parcaliSatirlar[0];
    return {
      heading: tr
        ? `${idx + 1}. Bölüm (${first.timestamp})`
        : `Section ${idx + 1} (${first.timestamp})`,
      timestamp: first.timestamp,
      summary: slice.map((p) => p.text).join(' '),
      keyPoints: slice.slice(0, 4).map((p) => p.text),
    };
  });

  // Extract concepts from colon/definition phrases or meaningful segments
  const kavramSatirlari = parcaliSatirlar.filter((p) =>
    /(:|nedir|olarak adlandırılır|diyoruz|tanımlanır|means|defined as|called)/i.test(p.text)
  );
  const conceptSources = kavramSatirlari.length > 0 ? kavramSatirlari : parcaliSatirlar;

  const concepts: KavramTanimi[] = conceptSources.slice(0, 3).map((src, idx) => {
    const colonParts = src.text.split(':');
    const inferredTerm =
      colonParts.length > 1 && colonParts[0].length < 50
        ? colonParts[0].trim()
        : src.text.split(/\s+/).slice(0, 3).join(' ').replace(/[.,;!?]+$/, '') ||
          (tr ? `Kavram ${idx + 1}` : `Concept ${idx + 1}`);

    return {
      term: inferredTerm,
      definition: colonParts.length > 1 ? colonParts.slice(1).join(':').trim() : src.text,
      timestamp: src.timestamp,
    };
  });

  const examQuestions: SinavSorusu[] = parcaliSatirlar.slice(0, 2).map((src, idx) => ({
    question:
      idx === 0
        ? tr
          ? `"${concepts[0]?.term || istek.title}" kapsamında vurgulanan temel kural veya mekanizma nedir?`
          : `What is the primary rule or mechanism highlighted regarding "${concepts[0]?.term || istek.title}"?`
        : tr
          ? `[${src.timestamp}] bölümünde belirtilen kritik nokta veya uygulama detayı nedir?`
          : `What critical point or practical detail is covered at [${src.timestamp}]?`,
    answer: src.text,
    difficulty: idx === 0 ? (tr ? 'Orta' : 'Medium') : tr ? 'Zor' : 'Hard',
    timestamp: src.timestamp,
  }));

  const segments: TranskriptSegmenti[] = parcaliSatirlar.map((p, i) => ({
    speaker: tr ? (i % 2 === 0 ? 'Anlatıcı' : 'Konuşmacı') : 'Speaker',
    timestamp: p.timestamp,
    text: p.text,
  }));

  return {
    title: istek.title,
    language: istek.language,
    durationSeconds: istek.durationSeconds ?? 300,
    slides: istek.slides ?? [],
    quick: {
      oneLiner,
      bullets,
      actionItems,
    },
    detailed: {
      sections: detailedSections,
    },
    lecture: {
      concepts,
      examQuestions,
      instructorHighlights: bullets.slice(0, 3),
    },
    transcript: {
      segments,
    },
  };
}

/**
 * Hem gerçek Gemini API ile hem de çevrimdışı/demo modda çalışan ana özetleme fonksiyonu
 */
export async function uretAkilliOzet(
  istek: OzetIstegi,
  logger: Logger = globalLogger
): Promise<BirlesikOzetSonucu> {
  const baslangicMs = Date.now();
  let temizMetin = istek.transcriptOrCaptionText?.trim() ?? '';
  let tahminiSure = istek.durationSeconds ?? 300;
  let kullanilanYontem: TasarrufYontemi =
    istek.method ?? (temizMetin ? 'caption' : 'compressed_audio');

  // Eğer altyazı/metin verildiyse Katman 1 (Altyazı Avcısı) ile temizle
  if (temizMetin) {
    const ayiklanan = ayiklaAltyaziMetni(temizMetin);
    temizMetin = ayiklanan.temizMetin;
    if (!istek.durationSeconds) {
      tahminiSure = ayiklanan.tahminiSureSaniye;
    }
  }

  logger.info(
    'OZETLEYICI',
    `"${istek.title}" için özetleme başlatıldı (Yöntem: ${kullanilanYontem}, Süre: ${tahminiSure}sn)`
  );

  let uretilenVeri: Omit<BirlesikOzetSonucu, 'id' | 'createdAt' | 'cost' | 'usedLiveApi'> | null =
    null;
  let usedLiveApi = false;

  const apiKey = istek.apiKey || process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim().length > 10) {
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      const dilTalimati =
        istek.language === 'tr'
          ? 'Tüm özetleri, kavramları ve sınav sorularını akıcı ve net bir TÜRKÇE ile yaz.'
          : 'Write all summaries, concepts, and exam questions in clear ENGLISH.';

      const parcalar: Array<Record<string, unknown>> = [];

      if (istek.mediaBase64 && istek.mediaMimeType) {
        // Base64 başlığındaki "data:...;base64," önekini temizle (Gemini API saf base64 bekler)
        const rawMediaBase64 = istek.mediaBase64.includes(',')
          ? istek.mediaBase64.split(',')[1]
          : istek.mediaBase64;

        // MIME türünü codec eklerinden arındır (örn: "audio/webm;codecs=opus" -> "audio/webm")
        const temizMimeType = istek.mediaMimeType.split(';')[0].trim();

        parcalar.push({
          inlineData: {
            data: rawMediaBase64,
            mimeType: temizMimeType,
          },
        });
      }

      // Ekteki slayt ekran görüntülerini Gemini'ye multimodal görsel veri olarak ver
      if (istek.slides && istek.slides.length > 0) {
        for (const slide of istek.slides) {
          if (slide.imageUrl && slide.imageUrl.includes(',')) {
            const rawBase64 = slide.imageUrl.split(',')[1];
            parcalar.push({
              inlineData: {
                data: rawBase64,
                mimeType: 'image/jpeg',
              },
            });
            parcalar.push({
              text: `[DERS SLAYTI - Zaman: ${slide.timestamp}] ${slide.caption || 'Slayt Ekran Görüntüsü'}`,
            });
          }
        }
      }

      const sistemMetni = `Sen üniversite düzeyinde dersleri analiz eden, akademik yayın ve ders kitabı pedagojisine hakim uzman bir profesör ve baş asistansın.
Ders Başlığı: "${istek.title}"
${dilTalimati}

### KESİN PEDAGOJİK VE YAZIM KURALLARI:
1. AKADEMİK DERS KİTABI ÜSLUBU:
   - "Merhaba arkadaşlar", "nasılsınız", "bugün hava güzel", ders dışı espriler ve dolgu lafları TAMAMEN ÇIKAR.
   - Özetler doğrudan konuyu sıfırdan adım adım öğreten, üniversite ders kitabı ciddiyetinde ve akıcılığında olmalıdır.
2. DETAYLI ÖZET (detailed.sections):
   - Konu başlıklarına ayrılmış; tanımları, kuralları, mekanizmaları ve neden-sonuç ilişkilerini hiçbir boşluk bırakmadan eksiksiz açıklayan bir ders kitabı bölümü gibi yazılmalıdır.
3. HAP ÖZET (quick.oneLiner & quick.bullets):
   - Konunun ana fikrini, temel prensibini ve kritik kavramsal özetini doğrudan aktarır.
4. DERS İÇİ İDARİ DUYURULAR VE TARİHLER (quick.actionItems):
   - Hocanın ders içinde söylediği "vize şu gün", "proje teslimi cuma", "ödev raporunu sisteme yükleyin", "yoklama alınacak" gibi idari bilgileri dersin akademik özetine KARIŞTIRMA!
   - Bunları yalnızca 'actionItems' alanında, tarih ve saatleriyle birlikte net bir yapılacaklar/duyurular listesi olarak belirt.
5. GÖRSEL VE SLAYT ENTEGRASYONU (MULTIMODAL VISION):
   - Konuşmada "ekranda gördüğünüz gibi", "buradaki formülden anlaşıldığı üzere", "tabloda dikkat ederseniz" denildiğinde ekteki slayt ve ekran görüntülerini detaylıca incele.
   - Slaytlarda geçen matematiksel formülleri, şemaları, kod parçalarını ve tanımları doğrudan detaylı ders özetine dahil et ve konuyu açıklamak için kullan.
6. TAM METİN (transcript.segments):
   - Konuşulanları saniye saniye zaman damgalarıyla dök.

Lütfen içeriği yukarıdaki kurallara göre analiz et ve JSON şemasına birebir uygun doldur.
Zaman damgalarını MM:SS formatında ver.
${temizMetin ? `\nİçerik Dökümü:\n${temizMetin}` : ''}`;

      parcalar.push({ text: sistemMetni });

      const response = await ai.models.generateContent({
        model: APP_CONFIG.defaultModel,
        contents: parcalar,
        config: {
          responseMimeType: 'application/json',
          responseSchema: GEMINI_RESPONSE_SCHEMA,
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        uretilenVeri = {
          title: istek.title,
          language: istek.language,
          durationSeconds: tahminiSure,
          slides: istek.slides ?? [],
          quick: parsed.quick,
          detailed: parsed.detailed,
          lecture: parsed.lecture,
          transcript: parsed.transcript,
        };
        usedLiveApi = true;
        logger.info('GEMINI_API', 'Canlı Gemini API yanıtı başarıyla alındı.');
      }
    } catch (hata) {
      const mesaj = hata instanceof Error ? hata.message : String(hata);
      logger.warn(
        'GEMINI_API',
        `Canlı API çağrısı başarısız oldu, yerel akıllı motora geçiliyor: ${mesaj}`
      );
    }
  }

  if (!uretilenVeri) {
    uretilenVeri = uretYerelAkilliOzet(
      { ...istek, durationSeconds: tahminiSure },
      temizMetin
    );
  }

  const gecenSureMs = Math.max(1, Date.now() - baslangicMs);
  const ciktiMetinUzunlugu = JSON.stringify(uretilenVeri).length;
  const tahminiCiktiToken = Math.max(350, Math.ceil(ciktiMetinUzunlugu / 4));

  const maliyetKaydi = logger.recordUsage({
    durationSeconds: tahminiSure,
    method: kullanilanYontem,
    outputTokens: tahminiCiktiToken,
    mode: 'lecture',
    title: istek.title,
    durationMs: gecenSureMs,
  });

  return {
    id: `sum_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    usedLiveApi,
    ...uretilenVeri,
    cost: maliyetKaydi,
  };
}

/**
 * Özeti tek tıkla WhatsApp'ta paylaşmaya uygun şık metne dönüştürür
 */
export function formatWhatsAppMetni(ozet: BirlesikOzetSonucu, dil: DilKodu = 'tr'): string {
  const tr = dil === 'tr';
  const maddeler = ozet.quick.bullets
    .map((b) => `• *[${b.timestamp}]* ${b.text}`)
    .join('\n');
  const gorevler = ozet.quick.actionItems
    .map((a) => `☑️ ${a.task} (${a.timestamp})`)
    .join('\n');

  return [
    `📌 *${ozet.title}*`,
    `_${ozet.quick.oneLiner}_`,
    '',
    tr ? '*⚡ Önemli Maddeler:*' : '*⚡ Key Takeaways:*',
    maddeler,
    '',
    tr ? '*🗓️ Yapılacaklar / Kararlar:*' : '*🗓️ Action Items:*',
    gorevler,
    '',
    `✨ _${APP_CONFIG.appName} ile özetlendi (%${ozet.cost.savedPercent} tasarruf)_`,
  ].join('\n');
}

/**
 * Özeti indirilebilir Markdown (.md) ders notuna dönüştürür
 */
export function formatMarkdownMetni(ozet: BirlesikOzetSonucu, dil: DilKodu = 'tr'): string {
  const tr = dil === 'tr';
  const satirlar: string[] = [
    `# ${ozet.title}`,
    `> ${ozet.quick.oneLiner}`,
    '',
    `## ⚡ ${tr ? 'Hap Özet' : 'Quick Summary'}`,
    ...ozet.quick.bullets.map((b) => `- **[${b.timestamp}]** ${b.text}`),
    '',
    `## 📌 ${tr ? 'Yapılacaklar ve Tarihler' : 'Action Items & Dates'}`,
    ...ozet.quick.actionItems.map(
      (a) => `- [ ] **${a.task}** ${a.due ? `_(${a.due})_` : ''} \`[${a.timestamp}]\``
    ),
    '',
    `## 📋 ${tr ? 'Detaylı Bölüm Özeti' : 'Detailed Breakdown'}`,
    ...ozet.detailed.sections.flatMap((sec) => [
      `### ${sec.heading} \`[${sec.timestamp}]\``,
      sec.summary,
      ...sec.keyPoints.map((kp) => `  - ${kp}`),
      '',
    ]),
    `## 🎓 ${tr ? 'Temel Kavramlar' : 'Key Concepts'}`,
    ...ozet.lecture.concepts.map(
      (c) => `- **${c.term}** \`[${c.timestamp}]\`: ${c.definition}`
    ),
    '',
    `## 🎯 ${tr ? 'Sınavda Çıkabilecek Sorular' : 'Potential Exam Questions'}`,
    ...ozet.lecture.examQuestions.flatMap((q, i) => [
      `### ${i + 1}. ${q.question} _(${q.difficulty})_ \`[${q.timestamp}]\``,
      `**${tr ? 'Cevap' : 'Answer'}:** ${q.answer}`,
      '',
    ]),
    `## 📝 ${tr ? 'Tam Transkript' : 'Full Transcript'}`,
    ...ozet.transcript.segments.map(
      (s) => `- **[${s.timestamp}] ${s.speaker}:** ${s.text}`
    ),
  ];

  return satirlar.join('\n');
}
