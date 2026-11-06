/**
 * 4 MODLU AKILLI ÖZETLEYİCİ MOTORU
 * --------------------------------
 * Tek bir çağrıda 4 farklı görünümü (Hap Özet, Detaylı Özet, Ders & Sınav Notu, Tam Transkript)
 * aynı anda üretir. Böylece kullanıcı sekmeler arasında gezerken tekrar tekrar API ücreti ödenmez!
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
 * Anahtar henüz girilmediğinde veya çevrimdışı testlerde çalışan akıllı yerel özetleyici
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

  // "Merhaba arkadaşlar", "hoş geldiniz" gibi ders dışı selamlama ve boş lafları filtrele
  const satirlar = hamSatirlar.filter((s) => {
    const metinKismi = s.replace(/^\[\d{2}:\d{2}(?::\d{2})?\]\s*/, '').trim();
    return !/^(merhaba|selam|günaydın|iyi günler|nasılsınız|arkadaşlar|hoş geldiniz|hello|welcome|hi everyone)/i.test(
      metinKismi
    );
  });

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
              ? `${istek.title} konusunun teorik temelleri ve temel aksiyomları açıklandı.`
              : `Theoretical foundations and core axioms of ${istek.title} are established.`,
          },
          {
            timestamp: '02:30',
            text: tr
              ? 'Konunun pratik uygulama adımları, formül analizleri ve problem çözümleri incelendi.'
              : 'Practical application steps, formula proofs, and case solutions were detailed.',
          },
          {
            timestamp: '06:15',
            text: tr
              ? 'Sınavda çıkabilecek kritik soru kalıpları ve metodolojik adımlar özetlendi.'
              : 'Exam-relevant problem patterns and analytical steps were synthesized.',
          },
        ];

  const oneLiner = tr
    ? `"${istek.title}" dersinin temel teorik prensipleri, formülleri ve uygulama adımları akademik ders kitabı standardında derlendi.`
    : `"${istek.title}" lecture core principles, analytical formulas, and methodologies structured in academic textbook prose.`;

  const bullets: ZamanliMadde[] = parcaliSatirlar.slice(0, 5).map((item) => ({
    timestamp: item.timestamp,
    text: item.text,
  }));

  // Tarih/saat veya görev içeren satırları yakala
  const gorevSatirlari = parcaliSatirlar.filter((item) =>
    /(sınav|teslim|ödev|cuma|pazartesi|saat|\d{1,2}:\d{2}|exam|due|deadline|project|meeting)/i.test(
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
              ? `${istek.title} notlarını tekrar gözden geçir ve örnek soruları çöz.`
              : `Review ${istek.title} notes and practice the sample questions.`,
            due: tr ? 'Bu Hafta' : 'This Week',
            timestamp: parcaliSatirlar[0].timestamp,
          },
        ];

  const detailedSections: DetayBolumu[] = [
    {
      heading: tr ? '1. Ana Konu ve Kapsam' : '1. Core Topic & Scope',
      timestamp: parcaliSatirlar[0].timestamp,
      summary: parcaliSatirlar
        .slice(0, Math.ceil(parcaliSatirlar.length / 2))
        .map((p) => p.text)
        .join(' '),
      keyPoints: parcaliSatirlar.slice(0, 3).map((p) => p.text),
    },
    {
      heading: tr ? '2. Kritik Detaylar ve Uygulama' : '2. Critical Details & Application',
      timestamp:
        parcaliSatirlar[Math.min(1, parcaliSatirlar.length - 1)].timestamp,
      summary: parcaliSatirlar
        .slice(Math.floor(parcaliSatirlar.length / 2))
        .map((p) => p.text)
        .join(' '),
      keyPoints: parcaliSatirlar.slice(-2).map((p) => p.text),
    },
  ];

  const concepts: KavramTanimi[] = [
    {
      term: istek.title.split('-')[0].trim() || (tr ? 'Temel Kavram' : 'Core Concept'),
      definition: parcaliSatirlar[0].text,
      timestamp: parcaliSatirlar[0].timestamp,
    },
    {
      term: tr ? 'Uygulama Prensibi' : 'Application Principle',
      definition:
        parcaliSatirlar[Math.min(1, parcaliSatirlar.length - 1)].text,
      timestamp:
        parcaliSatirlar[Math.min(1, parcaliSatirlar.length - 1)].timestamp,
    },
  ];

  const examQuestions: SinavSorusu[] = [
    {
      question: tr
        ? `"${istek.title}" kapsamında vurgulanan en temel prensip ve amacı nedir?`
        : `What is the primary principle and objective emphasized in "${istek.title}"?`,
      answer: parcaliSatirlar[0].text,
      difficulty: tr ? 'Orta' : 'Medium',
      timestamp: parcaliSatirlar[0].timestamp,
    },
    {
      question: tr
        ? 'Anlatımda özellikle dikkat çekilen ikinci kritik nokta veya kural nedir?'
        : 'What is the second critical point or rule highlighted in the recording?',
      answer:
        parcaliSatirlar[Math.min(1, parcaliSatirlar.length - 1)].text,
      difficulty: tr ? 'Zor' : 'Hard',
      timestamp:
        parcaliSatirlar[Math.min(1, parcaliSatirlar.length - 1)].timestamp,
    },
  ];

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
        parcalar.push({
          inlineData: {
            data: istek.mediaBase64,
            mimeType: istek.mediaMimeType,
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
