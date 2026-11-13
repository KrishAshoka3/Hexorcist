---
inclusion: always
---
# Technical Stack & Standards

- **Framework:** Next.js (App Router), TypeScript (Strict Mode), Tailwind CSS, Framer Motion, Recharts, Lucide React
- **AI Backend:** Google Cloud Vertex AI (`@google/genai` with `vertexai: true`, project `project-6cb8b3e0-9ee1-4093-b53`)
- **Hardware Protocols:** Browser WebSerial API (`navigator.serial`), CSV Telemetry Log Replay, and 25Hz Virtual ECU Fault Injector
- **Verification:** Vitest + `fast-check` for Property-Based Testing (PBT) of hexadecimal encoders, decoders, SAE J2012 DTC bitmasks, and FinTech ledger invariants.
