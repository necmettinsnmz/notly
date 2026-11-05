import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Aşama 4: Chrome Eklentisi (Manifest V3) Doğrulama Testleri', () => {
  const eklentiDir = path.resolve(process.cwd(), 'eklenti');

  it('manifest.json geçerli bir Manifest V3 yapılandırmasına sahip olmalı', () => {
    const manifestPath = path.join(eklentiDir, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toContain('tabCapture');
    expect(manifest.permissions).toContain('offscreen');
    expect(manifest.permissions).toContain('sidePanel');
    expect(manifest.background.service_worker).toBe('background.js');
    expect(manifest.side_panel.default_path).toBe('sidepanel.html');
  });

  it('Eklentinin tüm zorunlu dosyaları (background, offscreen, sidepanel) mevcut olmalı', () => {
    const dosyalar = [
      'background.js',
      'offscreen.html',
      'offscreen.js',
      'sidepanel.html',
      'sidepanel.js',
    ];

    for (const dosya of dosyalar) {
      const tamYol = path.join(eklentiDir, dosya);
      expect(fs.existsSync(tamYol)).toBe(true);
    }
  });
});
