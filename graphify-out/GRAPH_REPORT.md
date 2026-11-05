# Graph Report - notly  (2026-11-05)

## Corpus Check
- Corpus is ~11,252 words - fits in a single context window. You may not need a graph.

## Summary
- 155 nodes · 299 edges · 10 communities (8 shown, 2 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Notly Module 1
- Notly Module 2
- Notly Module 3
- Notly Module 4
- Notly Module 5
- Notly Module 6
- Notly Module 7
- Notly Module 8
- Notly Module 9

## God Nodes (most connected - your core abstractions)
1. `createNotlyServer()` - 19 edges
2. `Logger` - 15 edges
3. `compilerOptions` - 12 edges
4. `baglaOlayDinleyicileri()` - 12 edges
5. `render()` - 11 edges
6. `TasarrufYontemi` - 9 edges
7. `uretAkilliOzet()` - 9 edges
8. `DailyQuotaManager` - 9 edges
9. `calistirOzetleme()` - 8 edges
10. `APP_CONFIG` - 7 edges

## Surprising Connections (you probably didn't know these)
- `UygulamaDurumu` --references--> `SlaytKaresi`  [EXTRACTED]
  web/main.ts → ortak/ozetleyici.ts
- `atlaZamanDamgasina()` --calls--> `zamanDamgasiniSaniyeyeCevir()`  [EXTRACTED]
  web/main.ts → ortak/tasarruf.ts
- `createNotlyServer()` --calls--> `DailyQuotaManager`  [EXTRACTED]
  sunucu/server.ts → ortak/tasarruf.ts
- `configureServer()` --calls--> `createNotlyServer()`  [EXTRACTED]
  vite.config.ts → sunucu/server.ts
- `UygulamaDurumu` --references--> `DilKodu`  [EXTRACTED]
  web/main.ts → ortak/ayarlar.ts

## Import Cycles
- None detected.

## Communities (10 total, 2 thin omitted)

### Community 0 - "Notly Module 1"
Cohesion: 0.13
Nodes (24): APP_CONFIG, CeviriAnahtari, CEVIRILER, DilKodu, OzetModu, TasarrufYontemi, globalLogger, hesaplaMaliyetVeTasarruf() (+16 more)

### Community 1 - "Notly Module 2"
Cohesion: 0.19
Nodes (22): t(), formatMarkdownMetni(), formatWhatsAppMetni(), SlaytKaresi, alTarayiciKimligi(), atlaZamanDamgasina(), baglaOlayDinleyicileri(), calistirOzetleme() (+14 more)

### Community 2 - "Notly Module 3"
Cohesion: 0.15
Nodes (8): Logger, maskeleGizliBilgi(), uretAkilliOzet(), alKullaniciKimligi(), createNotlyServer(), gonderJson(), okuIstekGovdesi(), configureServer()

### Community 3 - "Notly Module 4"
Cohesion: 0.10
Nodes (25): dependencies, @google/genai@^1.0.0, description, devDependencies, tsx@^4.19.2, @types/node@^22.10.0, typescript@^5.7.2, vite@^6.0.5 (+17 more)

### Community 4 - "Notly Module 5"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+5 more)

### Community 5 - "Notly Module 6"
Cohesion: 0.17
Nodes (11): action, default_title, background, service_worker, description, manifest_version, name, permissions (+3 more)

### Community 6 - "Notly Module 7"
Cohesion: 0.26
Nodes (5): AltyaziAyiklamaSonucu, ayiklaAltyaziMetni(), DailyQuotaManager, saniyeyiZamanDamgasinaCevir(), zamanDamgasiniSaniyeyeCevir()

### Community 7 - "Notly Module 8"
Cohesion: 0.32
Nodes (5): capturedSlides, gonderSunucuya(), parseTimestampToSeconds(), renderSummaryResult(), SERVER_URLS

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@google/genai` connect `Notly Module 4` to `Notly Module 1`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `createNotlyServer()` (e.g. with `.error()` and `.getLogs()`) actually correct?**
  _`createNotlyServer()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Should `Notly Module 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1349206349206349 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Notly Module 4` to `Notly Module 1`, `Notly Module 3`, `Notly Module 7`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Should `Notly Module 4` be split into smaller, more focused modules?**
  _Cohesion score 0.09538461538461539 - nodes in this community are weakly interconnected._
- **Why does `Logger` connect `Notly Module 3` to `Notly Module 1`, `Notly Module 7`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `Notly Module 5` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._