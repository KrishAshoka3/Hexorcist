# Implementation Plan: Universal CAN-Bus & FinTech Escrow Chimera

- [x] 1. Initialize Project, Kiro Governance & Open-Source Licensing
  - [x] 1.1 Bootstrap Next.js App Router TypeScript workspace with Tailwind CSS, Framer Motion, Recharts, Lucide React, and `@google/genai`
  - [x] 1.2 Create MIT `LICENSE` and protect `.kiro/` + `LICENSE` in `.gitignore`
  - [x] 1.3 Configure `.kiro/steering/product.md`, `.kiro/steering/tech.md`, and `.kiro/hooks/pbt-hex-verification.json`
  - [x] 1.4 Implement standalone NHTSA vPIC VIN Decoder MCP server (`mcp-nhtsa-server/index.mjs` & `.kiro/settings/mcp.json`)

- [x] 2. Build Universal Hex Engine (`src/lib/obd-hex-engine.ts`)
  - [x] 2.1 Implement `UNIVERSAL_PID_REGISTRY` for all 12 SAE J1979 Mode `01` and ISO 14229 UDS Mode `22` PIDs
  - [x] 2.2 Implement `buildCANResponseFrame` and fuzz-resilient `parseRawCANFrame` with XOR checksum verification
  - [x] 2.3 Implement bijective SAE J2012 16-bit bitmask encoder/decoder (`encodeDTCString`, `decodeDTCBytes`)
  - [x] 2.4 Implement `calculateDynoMetrics` physics calculator and `calculateEscrowRateCents` monotonic FinTech withholding model
  - [x] 2.5 Define `VEHICLE_SOUL_PRESETS` for `GERMAN_V6_DSG`, `JDM_TWIN_ROTARY`, `AWD_800V_EV`, and `HEAVY_DIESEL_TOW`

- [x] 3. Verify Mathematical & Financial Invariants (`src/lib/obd-hex.test.ts`)
  - [x] 3.1 Property 1: Universal PID round-trip serialization (`decode(encode(x)) ≈ x`) across all 12 PIDs
  - [x] 3.2 Property 2: SAE J2012 2-byte DTC bitmask bijective symmetry across `P`, `C`, `B`, `U` domains
  - [x] 3.3 Property 3: Arbitrary string fuzzing resilience on `parseRawCANFrame`
  - [x] 3.4 Property 4: FinTech per-mile escrow monotonicity & baseline/critical bounds

- [x] 4. Integrate Google Cloud Vertex AI Necromancer (`src/app/api/diagnose/route.ts`)
  - [x] 4.1 Connect `@google/genai` (`vertexai: true`, `gemini-2.5-flash`) with structured JSON response schema
  - [x] 4.2 Provide deterministic vehicle-aware offline diagnostic fallback

- [x] 5. Build Haunting Cyber-Diagnostic Dashboard (`src/app/page.tsx`)
  - [x] 5.1 Top Command Bar with CRT scanline toggle, Vehicle Soul Switcher, connection badge, and live NHTSA VIN Decoder modal
  - [x] 5.2 Left Column with 25Hz scrolling CAN Hex Terminal, interactive byte inspector, Mechanical Curse Injector, WebSerial connector, and CSV telemetry log replay/export
  - [x] 5.3 Center Column with 60fps Dual-Trace Target vs. Actual Oscilloscope + 8 PID gauges, Virtual Road Dyno WOT simulator, and Bidirectional UDS Exorcism Terminal (`04`/`2F`/`31`)
  - [x] 5.4 Right Column with SAE J2012 bitmask visualizer, Live Vertex AI Autopsy trigger, and Autonomous FinTech Escrow Sandbox Ledger commute/release modals

- [ ] 6. Add CAN Frame XOR Parity Batch Audit helper function to src/lib/obd-hex-engine.ts and verify with fast-check
