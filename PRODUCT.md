# Product Specification: Notly

> Created in alignment with `pbakaus/impeccable` standards.

## Purpose
Notly is a focused, high-utility study and transcription tool for university students and professionals. It ingests recorded audio, WhatsApp voice messages, and in-browser lecture video streams, delivering instant, high-density structured notes (Key Takeaways, Detailed Outlines, Exam Prep Questions with answers, and Full Timestamps) without requiring end-users to provide API keys or configure complex settings.

## Target Audience
- University and college students studying for midterms/finals who have long recorded lectures on university portals (Moodle, Canvas, Blackboard) or YouTube.
- Busy professionals receiving 3-5 minute voice notes on WhatsApp/Telegram who need actionable summaries in 10 seconds.

## Primary Anti-Goals (What Notly Will NEVER Be)
- It is NOT a flashy, speculative AI toy with gratuitous purple glowing gradients, pulsing AI orbs, or chat bubbles.
- It is NOT an invasive surveillance recorder: all processing is ephemeral, audio buffers stay local until piped to the proxy, and no DRM is circumvented.
- It is NOT cluttered with confusing AI jargon (temperature, top-p, tokens): users see real utility (Minutes saved, Exam questions, WhatsApp card, PDF export).
