/**
 * HAZIR ÖRNEK KAYITLAR (TEK TIKLA DENEME İÇİN)
 * --------------------------------------------
 * Kullanıcının elinde hazır ses/video olmasa bile sistemi anında test edebilmesi için
 * gerçekçi bir üniversite dersi (slayt görselleriyle birlikte) ve uzun bir WhatsApp sesli mesajı içerir.
 */

import { SlaytKaresi } from '../ortak/ozetleyici';

function olusturSlaytSvgDataUrl(baslik: string, altMetin: string, renk: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">
    <rect width="480" height="270" rx="14" fill="${renk}"/>
    <rect x="20" y="20" width="440" height="230" rx="10" fill="rgba(15,23,42,0.78)" stroke="rgba(255,255,255,0.2)"/>
    <text x="40" y="75" fill="#a5b4fc" font-family="sans-serif" font-size="14" font-weight="bold">OTOMATİK YAKALANAN DERS SLAYTI</text>
    <text x="40" y="125" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="bold">${baslik}</text>
    <text x="40" y="168" fill="#cbd5e1" font-family="sans-serif" font-size="15">${altMetin}</text>
    <circle cx="425" cy="215" r="18" fill="#6366f1"/>
    <text x="418" y="220" fill="#fff" font-family="sans-serif" font-size="13" font-weight="bold">AI</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const ORNEK_DERS_VERISI = {
  tr: {
    title: 'Yapay Zeka ve Derin Öğrenme 101 - Hafta 4 (Moodle Kaydı)',
    durationSeconds: 2700, // 45 dakika
    method: 'caption' as const,
    slides: [
      {
        timestamp: '00:45',
        caption: 'Slayt 1: Yapay Sinir Ağları ve Aktivasyon Fonksiyonları (ReLU vs Sigmoid)',
        imageUrl: olusturSlaytSvgDataUrl(
          '1. Aktivasyon Fonksiyonları',
          'ReLU(x) = max(0, x) -> Vanishing Gradient Çözümü',
          '#312e81'
        ),
      },
      {
        timestamp: '14:20',
        caption: 'Slayt 2: Geri Yayılım (Backpropagation) ve Zincir Kuralı',
        imageUrl: olusturSlaytSvgDataUrl(
          '2. Backpropagation Algoritması',
          'Ağırlık Güncellemesi: w = w - η * (∂L / ∂w)',
          '#1e3a8a'
        ),
      },
      {
        timestamp: '28:10',
        caption: 'Slayt 3: Overfitting (Aşırı Öğrenme) ve Dropout Tekniği',
        imageUrl: olusturSlaytSvgDataUrl(
          '3. Overfitting Önleme: Dropout',
          'Eğitim sırasında nöronların %20-%50 rastgele kapatılması',
          '#065f46'
        ),
      },
    ] satisfies SlaytKaresi[],
    transcript: `WEBVTT

1
00:00:45.000 --> 00:02:10.000
Merhaba arkadaşlar, bu haftaki dersimizde derin sinir ağlarında aktivasyon fonksiyonlarını ve neden doğrusal olmayan (non-linear) yapıya ihtiyaç duyduğumuzu inceleyeceğiz. Özellikle ReLU fonksiyonu, pozitif değerleri olduğu gibi geçirirken negatifleri sıfırlar ve vanishing gradient (kaybolan gradyan) problemini büyük ölçüde çözer.

2
00:14:20.000 --> 00:18:00.000
İkinci önemli konumuz Geri Yayılım yani Backpropagation algoritması. Ağın tahmin hatasını (loss) çıktı katmanından geriye doğru türev zincir kuralıyla yayarak her bir ağırlığın ne kadar güncelleneceğini hesaplarız. Öğrenme oranı (learning rate) çok büyük seçilirse model minimum noktasını kaçırır.

3
00:28:10.000 --> 00:34:00.000
Model eğitim verisini ezberlemeye başladığında buna Overfitting (Aşırı Öğrenme) diyoruz. Bunu engellemek için Dropout yöntemini kullanırız; her eğitim adımında nöronların belirli bir yüzdesini rastgele devre dışı bırakırız.

4
00:41:00.000 --> 00:44:30.000
Önemli duyuru: 18 Kasım Cuma günü saat 15:00'te vize sınavımız yapılacak ve Python ile basit bir sinir ağı eğitme ödevini 22 Kasım saat 23:59'a kadar sisteme yüklemeniz gerekiyor.`,
  },
  en: {
    title: 'Artificial Intelligence & Deep Learning 101 - Week 4 Lecture',
    durationSeconds: 2700,
    method: 'caption' as const,
    slides: [
      {
        timestamp: '00:45',
        caption: 'Slide 1: Neural Networks & Activation Functions (ReLU vs Sigmoid)',
        imageUrl: olusturSlaytSvgDataUrl(
          '1. Activation Functions',
          'ReLU(x) = max(0, x) -> Solves Vanishing Gradient',
          '#312e81'
        ),
      },
      {
        timestamp: '14:20',
        caption: 'Slide 2: Backpropagation & Chain Rule Optimization',
        imageUrl: olusturSlaytSvgDataUrl(
          '2. Backpropagation Algorithm',
          'Weight Update: w = w - η * (∂L / ∂w)',
          '#1e3a8a'
        ),
      },
      {
        timestamp: '28:10',
        caption: 'Slide 3: Preventing Overfitting with Dropout Regularization',
        imageUrl: olusturSlaytSvgDataUrl(
          '3. Preventing Overfitting: Dropout',
          'Randomly disabling 20%-50% of neurons during training',
          '#065f46'
        ),
      },
    ] satisfies SlaytKaresi[],
    transcript: `WEBVTT

1
00:00:45.000 --> 00:02:10.000
Welcome everyone, today we explore activation functions in deep neural networks and why non-linearity is essential. Specifically, the ReLU function passes positive values unchanged while zeroing out negatives, mitigating the vanishing gradient problem.

2
00:14:20.000 --> 00:18:00.000
Our second core topic is Backpropagation. By propagating the loss backward from the output layer using the calculus chain rule, we compute gradients to update weights. If the learning rate is too high, optimization diverges.

3
00:28:10.000 --> 00:34:00.000
When a model memorizes training data instead of generalizing, we call it Overfitting. We prevent this using Dropout regularization, which randomly deactivates a fraction of neurons during each training step.

4
00:41:00.000 --> 00:44:30.000
Important announcement: Our midterm exam is scheduled for Friday, November 18 at 15:00, and the Python neural network homework is due November 22 by 23:59.`,
  },
};

export const ORNEK_WHATSAPP_SESI = {
  tr: {
    title: 'WhatsApp Sesli Mesaj - Ev Arkadaşı Ahmet (03:20)',
    durationSeconds: 200,
    method: 'compressed_audio' as const,
    slides: [],
    transcript: `[00:08] Kanka selam, şimdi emlakçıyla ve doğalgaz idaresiyle konuştum, uzun uzun anlatıyorum kusura bakma yoldayım.
[00:45] İlk olarak elektrik ve internet faturasını bu akşam saat 20:00'ye kadar yatırmamız lazımmış, kişi başı 480 TL düşüyor, bana IBAN'dan atarsan ben tek seferde öderim.
[01:50] İkincisi yarın sabah saat 10:30 ile 12:00 arası kombi bakımı için usta gelecek, ben derste olacağım için kapıyı senin açman gerekiyor.
[02:55] Akşam gelirken marketten süt ve kahve almayı unutma, evde hiç kalmamış.`,
  },
  en: {
    title: 'WhatsApp Voice Note - Roommate Alex (03:20)',
    durationSeconds: 200,
    method: 'compressed_audio' as const,
    slides: [],
    transcript: `[00:08] Hey bro, I just finished talking to the landlord and the utility company while walking home.
[00:45] First, we need to pay the electricity and internet bills by 8:00 PM tonight; your share is $35, transfer it to me and I will pay online.
[01:50] Second, the heating technician is coming tomorrow between 10:30 AM and 12:00 PM, I have a lecture so please stay home to open the door.
[02:55] Also don't forget to grab milk and coffee on your way back this evening.`,
  },
};
