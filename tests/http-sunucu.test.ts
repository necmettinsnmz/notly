import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createNotlyServer } from '../sunucu/server';

describe('Aşama 2: Gizli Köprü Sunucu HTTP API Testleri', () => {
  let server: Server;
  let baseUrl = '';

  beforeAll(async () => {
    server = createNotlyServer();
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /api/health sunucu durumunu ve $60 kredi bakiyesini dönmeli, API anahtarını ASLA sızdırmamalı', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.appName).toBe('Notly');
    expect(data.stats.remainingCreditUsd).toBeLessThanOrEqual(60);
    expect(JSON.stringify(data)).not.toContain('AIza');
  });

  it('POST /api/summarize özeti üretmeli, kotayı 3->2 düşürmeli ve log paneline kaydetmeli', async () => {
    const res = await fetch(`${baseUrl}/api/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': 'test_ogrenci_1',
      },
      body: JSON.stringify({
        title: 'Veri Yapıları - Ağaçlar (Trees)',
        language: 'tr',
        durationSeconds: 1200,
        method: 'caption',
        transcriptOrCaptionText:
          '[00:15] İkili arama ağaçlarında (Binary Search Tree) sol alt ağaç daha küçük değerleri tutar.\n[05:40] Arama karmaşıklığı ortalama O(log n) seviyesindedir.\n[12:00] Haftaya çarşamba ödev teslimi var.',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.title).toBe('Veri Yapıları - Ağaçlar (Trees)');
    expect(body.summary.quick.bullets.length).toBeGreaterThan(0);
    expect(body.summary.lecture.examQuestions.length).toBeGreaterThan(0);
    expect(body.quota.remaining).toBe(2);

    // Log panelinde bu işlem görünmeli
    const logsRes = await fetch(`${baseUrl}/api/logs`);
    const logsData = await logsRes.json();
    expect(logsData.usageHistory.length).toBeGreaterThan(0);
    expect(logsData.usageHistory[0].title).toBe('Veri Yapıları - Ağaçlar (Trees)');
  });
});
