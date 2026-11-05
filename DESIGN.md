# Design System: Notly

> Architectural standard based on `pbakaus/impeccable` and `VoltAgent/awesome-design-md`.
> Aesthetic Direction: **Tactile Swiss Editorial / Precision Workspace** (Linear + Notion + iA Writer feel).

## 1. Personality & Principles
- **Quiet Confidence:** No neon purple gradients, no floating glowing cards, no decorative gradient text. Solid, authoritative typographic contrast.
- **Editorial Density:** Information is structured cleanly like a technical textbook or high-end legal paper.
- **Micro-Precision:** Monospace timestamps, hairline borders (`1px solid rgba(255,255,255,0.08)`), crisp focus rings, and tangible toggle feedback.

## 2. Color Palette & Semantic Tokens

### Dark Mode (Default)
- **Canvas / Void:** `#090a0d` (Deep warm obsidian)
- **Surface / Card:** `#111318` (Subtle matte slate)
- **Surface Hover / Active:** `#181b22`
- **Surface Inset / Well:** `#0d0f13`
- **Hairline Border:** `rgba(255, 255, 255, 0.08)`
- **Border Strong:** `rgba(255, 255, 255, 0.16)`
- **Text Primary:** `#f4f4f5` (Crisp bone white)
- **Text Muted:** `#8c919d` (Calibrated neutral)
- **Text Faint:** `#555964`
- **Accent (Cobalt Ink):** `#3b82f6` (High contrast, confident)
- **Accent Soft:** `rgba(59, 130, 246, 0.12)`
- **Success (Emerald Ink):** `#10b981`
- **Success Soft:** `rgba(16, 185, 129, 0.12)`
- **Warning (Warm Amber):** `#f59e0b`
- **Danger (Signal Red):** `#ef4444`

### Light Mode
- **Canvas / Paper:** `#fbfbfa` (Warm Nordic book paper)
- **Surface / Card:** `#ffffff` (Pure white)
- **Surface Inset:** `#f3f3f0`
- **Hairline Border:** `rgba(0, 0, 0, 0.08)`
- **Text Primary:** `#121316` (Deep carbon ink)
- **Text Muted:** `#5d626d`
- **Accent (Deep Cobalt):** `#2563eb`

## 3. Typography
- **Primary Interface:** `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif`
- **Technical & Numeric Data:** `ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace`
- **Rules:**
  - Zero gradient text (`background-clip: text` is strictly forbidden).
  - Headings use solid carbon/bone text with tight tracking (`letter-spacing: -0.025em`).
  - Numbers, token counts, costs, and timestamps are always rendered in monospace.

## 4. Anti-Pattern Rules (Enforced)
1. **NO Cards-inside-cards:** Use clean border dividers or background contrast instead of infinite nested rectangles.
2. **NO Decorative Gimmicks:** Every element must serve immediate comprehension.
3. **NO Overused Generic Fonts:** Avoid generic unstyled Inter/Roboto drops.
4. **Readable Hierarchy:** Minimum body text 14px (0.875rem), minimum label 12px (0.75rem).
