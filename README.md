# HEXORCIST // Universal Automotive CAN-Bus, Vertex AI & FinTech Repair Escrow Chimera

> **Cars speak raw hexadecimal bytes. Mechanics speak OEM part numbers. Banks speak dollars. HEXORCIST unifies all three in real time.**

**HEXORCIST** is an open-source (MIT) cyber-diagnostic telemetry platform built for **Kiroween 2026**. It stitches together low-level **SAE J1979 (OBD-II)** & **ISO 14229 (Unified Diagnostic Services)** hexadecimal CAN-Bus telemetry, **OpenDBC 64-bit signal bit-packing**, **US DOT NHTSA vPIC 17-digit VIN physics synthesis**, **Google Cloud Vertex AI** root-cause autopsies, and an **Autonomous FinTech Repair Sinking-Fund Escrow Ledger** — all mathematically verified with **`fast-check` Property-Based Testing (PBT)** and governed end-to-end with **Kiro**.

---

## Quick Start & Commands

```bash
# 1. Install dependencies
npm install

# 2. Run the Vitest + fast-check Property-Based Testing suite
npx vitest run

# 3. Start the local development server (http://localhost:3000)
npm run dev

# 4. Verify production build & TypeScript strict compilation
npm run build
```

Optional environment variables (`.env.local` — deterministic vehicle-aware diagnostic fallback is built in if omitted or offline):

```env
GOOGLE_CLOUD_PROJECT=project-6cb8b3e0-9ee1-4093-b53
GOOGLE_CLOUD_LOCATION=us-central1
```

---

## Judge Testing Guide (Zero Hardware Required)

### 1. Watch or Record the Self-Running 2-Minute Visual Cinema Pitch (`DemoVideoDirector.tsx`)
Click **"🎬 Launch 2-Min Cinema Pitch"** in the Top Command Bar to open the Cinema Pitch Launcher:
- **▶ Play Visual Cinema Pitch (Auto-Pilot):** Runs a caption-driven, zero-voiceover 7-scene (~1:58) choreography across the live application featuring full-screen Kiroween title cards, high-contrast glassmorphic story cards, animated `"LIVE ACTION"` target callout rings, and subtle procedural WebAudio tactile cues.
- **🔴 Record Tab & Run Cinema Pitch (Exports `.webm`):** Captures the browser tab at **60fps** via `navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60 }, audio: true })` + `MediaRecorder` (`video/webm;codecs=vp9`) and automatically downloads `hexorcist-kiroween-2026-demo.webm` the instant Scene 7 completes.

### 2. Interactive 3-Step Core Diagnostic & FinTech Loop (`Focused Mode`)
1. **Inject a Mechanical Fault (Left Panel — *Cast Mechanical Curse*):**
   - Switch between 4 trademark-clean powertrain architectures (`GERMAN_V6_DSG`, `JDM_TWIN_ROTARY`, `AWD_800V_EV`, `HEAVY_DIESEL_TOW`) or bind any 17-digit VIN.
   - Inject `P0750` (0B5 Solenoid / Line Pressure Drift) and watch the **60fps Dual-Trace Oscilloscope** diverge in Blood Crimson (`#FF1E42`) as actual clutch pressure drops from `8.45 Bar` below target to `2.35 Bar`.
2. **Run Live Vertex AI Autopsy (Right Panel — *AI Necromancer*):**
   - Inspect the unpacked **16-bit SAE J2012 bitmask** (`0000 0111 0101 0000` / `0x07 0x50`) and click **"RUN LIVE VERTEX AI AUTOPSY"** (`/api/autopsy` & `/api/diagnose`).
   - Decodes the raw `0x7E8` CAN freeze-frame into mechanical root cause, OEM part number (`0B5-398-009-F`), labor hours (`5.5 hrs`), and repair quote (`$1,480`).
3. **Autonomous FinTech Escrow & Bidirectional UDS Exorcism:**
   - Observe the **Repair Escrow Sinking-Fund Vault** dynamically scale per-mile withholding from `$0.05/mi` nominal baseline up to `$2.50+/mi` based on live ECU anomaly severity.
   - Click **"Simulate 25-Mile Commute"** to lock funds into the double-entry sandbox ledger, or **"Release Mechanic Payout"** to settle a repair invoice.
   - Open the **Exorcism Terminal** (Center Tab 3) and fire **Mode `31`** (`TX: 7E0 04 31 01 F4 0A` -> `RX: 7E8 04 71 01 F4 0A`) to recalibrate solenoids, clear `P0750`, restore `100%` vehicle health, and return the oscilloscope to Phosphor Green (`#00FF9D`).

### 3. Deep Protocol & Hardware Engineering (`Engineer Pro Mode`)
- **Flip `Focused Mode` -> `Engineer Pro Mode`** in the header to unfold the **25Hz Raw CAN Hex Matrix**, interactive **ISO 15765-4 Byte & XOR Checksum Inspector**, bottom **OpenDBC 64-Bit Dock**, and **ELM327 AT / ISO-TP Terminal**.
- **64-Bit `.DBC` Bit-Packing Inspector:** Click **`.DBC 64-Bit`** to inspect `BO_` / `SG_` syntax across `0B5_TCM`, `FD3S_ECU`, `BMS_HV_Status`, and `J1939_EEC1`, hover signals across Bytes `0–7`, or manually flip individual bits in the 8×8 payload grid.
- **ISO 15765-4 / SAE J1979 CSV Telemetry Replay:** Click **`CSV Studio`** to load a 100-row WOT log with mid-pull fault injection (or drag-and-drop any multi-PID OBD CSV export) and scrub at `1x`, `2x`, or `5x` speed.
- **WebSerial OBD-II Hardware & Virtual Loopback COM4:** Pair a physical USB/Bluetooth ELM327 / CANable adapter @ `38,400` baud via `navigator.serial`, or activate the zero-hardware **Virtual Loopback COM4 Transceiver** (`ATZ`, `ATSP6`, `01 0C`, `03`, `04`, `22 F4 0A`, `09 02`).
- **Live US DOT NHTSA 17-Digit VIN Decoder & Virtual Road Dyno:** Click **`VIN: ... NHTSA`** to decode any ISO 3779 17-character VIN against `vpic.nhtsa.dot.gov`, bind it as a calibrated `CUSTOM_VIN_SOUL`, and execute a `2,000 -> 7,000 RPM` WOT pull on the **Virtual Road Dyno**.
---

## System Architecture Overview

```text
[WebSerial ELM327 Hardware | ISO 15765-4 CSV Scrubber | 25Hz Virtual ECU + Curse Injector]
                                        │
                                        ▼
               ┌─────────────────────────────────────────────────┐
               │  src/lib/obd-hex-engine.ts & log-and-dbc-engine │
               │  • UNIVERSAL_PID_REGISTRY (12 Mode 01/22 PIDs)  │
               │  • ISO 15765-4 0x7E8 Frame Codec & XOR Parity   │
               │  • SAE J2012 16-Bit Trouble Code Bitmask Codec  │
               │  • OpenDBC 64-Bit Intel LE / Motorola BE Matrix │
               │  • Tractive Road Dyno & Monotonic Escrow Math   │
               └──────────────┬─────────────────┬────────────────┘
                              │                 │
         ┌────────────────────┘                 └────────────────────┐
         ▼                                                           ▼
[60fps Dual-Trace Oscilloscope,               [Vertex AI Autopsy (/api/autopsy)
 Virtual Road Dyno & UDS 0x7E0 Terminal]       & Autonomous FinTech Escrow Vault]
```

### Key Subsystems
- **`src/lib/obd-hex-engine.ts`:** Table-driven `UNIVERSAL_PID_REGISTRY` spanning 12 SAE J1979 Mode `01` PIDs and ISO 14229 UDS Mode `22` DIDs, `buildCANResponseFrame`, fuzz-resilient `parseRawCANFrame` with XOR checksum validation, bijective 16-bit SAE J2012 `encodeDTCString`/`decodeDTCBytes`, longitudinal Road Dyno physics (`calculateDynoMetrics`), and monotonic FinTech per-mile withholding (`calculateEscrowRateCents`).
- **`src/lib/log-and-dbc-engine.ts`:** Non-overlapping 64-bit OpenDBC signal definitions (`0B5_TCM`, `FD3S_ECU`, `BMS_HV_Status`, `J1939_EEC1`), Intel Little-Endian & Motorola Big-Endian bit extractors, universal multi-PID CSV parser, NHTSA VIN soul synthesizer (`buildCustomVinSoul`), and Virtual ELM327 v2.3 transceiver.
- **`src/app/api/autopsy/route.ts` & `src/app/api/diagnose/route.ts`:** Structured JSON diagnostic endpoints powered by `@google/genai` on Google Cloud Vertex AI with resilient deterministic vehicle-aware offline fallback.
- **`src/components/DemoVideoDirector.tsx`:** Self-running 7-scene visual product pitch director with glassmorphic Story HUD, DOM-tracked `"LIVE ACTION"` callout ring, procedural WebAudio synthesizer (`src/lib/sound-fx.ts`), and 60fps VP9 `.webm` tab recorder.
---

## How Kiro Built & Governs HEXORCIST (Full Kiro Feature Write-Up)

HEXORCIST uses every pillar of the **Kiro** agentic engineering workflow — inspectable both in `.kiro/` and inside the running app via the **"Kiro Architecture & PBT Proofs"** drawer:

### 1. Spec-Driven Development (`.kiro/specs/universal-can-engine/`)
- **`requirements.md` (EARS Syntax):** Formalizes 6 strict *Easy Approach to Requirements Syntax* (`WHEN ... THE SYSTEM SHALL ...`) requirements covering 12-PID quantization, fuzz-safe `0x7E8` XOR frame parsing, bijective 16-bit SAE J2012 trouble code bitmasks, tractive Road Dyno physics, monotonic FinTech sinking-fund math, and bidirectional UDS remediation.
- **`design.md`:** Documents exact byte-level encoding/decoding formulas, tolerances, SAE J2012 bit layouts (`[D1 D0 | S1 S0 | H3..H0][M3..M0 | L3..L0]`), longitudinal aerodynamic/inertial equations, and the escrow rate curve $\text{rateCents}(s, k) = 5 + \lfloor 1.85s + 0.011s^2 \rfloor + 45k$.
- **`tasks.md`:** Tracks implementation milestones (`Tasks 1–5 [x]`), leaving `Task 6 [ ]` (*CAN Frame XOR Parity Batch Audit helper + `fast-check` proof*) staged ready for live native execution inside Kiro IDE.

### 2. Always-On Steering Guardrails (`.kiro/steering/`)
- **`product.md` & `tech.md` (`inclusion: always`):** Enforce trademark-clean multi-vehicle powertrain descriptors, strict TypeScript compilation, structured Vertex AI JSON schemas, and non-negative monotonic FinTech ledger invariants across every agent turn.

### 3. Automated Lifecycle Hooks (`.kiro/hooks/pbt-hex-verification.json`)
- Configured with `trigger: "PostFileSave"` matching `src/lib/.*\.(ts|tsx)$` to automatically run `npx vitest run src/lib/obd-hex.test.ts` every time core hex serialization or escrow math is saved — catching byte quantization drift or checksum regressions immediately.

### 4. Custom Kiro Verifier Agent (`.kiro/agents/hexorcist-verifier.json`)
- Pre-loaded with `.kiro/steering/*`, `.kiro/specs/universal-can-engine/*`, and `@nhtsa-vin-decoder/decode_vin` MCP permissions to audit `0x7E8` XOR parity, verify all 65,536 SAE J2012 2-byte bitmasks, and run the `fast-check` suite.

### 5. Standalone US DOT NHTSA MCP Server (`mcp-nhtsa-server/index.mjs` & `.kiro/settings/mcp.json`)
- Zero-dependency Node.js **Model Context Protocol (MCP)** server over JSON-RPC 2.0 `stdio` exposing the `decode_vin` tool (`autoApprove: ["decode_vin"]`) against the live US DOT NHTSA vPIC API (`vpic.nhtsa.dot.gov`) so Kiro agents and developers can synthesize calibrated vehicle profiles from any 17-digit ISO 3779 VIN.

### 6. `fast-check` Property-Based Testing Suite (`src/lib/obd-hex.test.ts` & `src/lib/log-and-dbc.test.ts`)
Run `npx vitest run` to execute all **10 test suites** (4,000+ randomized property runs):
- **Property 1 (12-PID Round-Trip Serialization):** $\forall x \in [\text{min}, \text{max}], |\text{decode}(\text{encode}(x)) - x| \le \text{tolerance}$ with valid `0x7E8` XOR checksums.
- **Property 2 (SAE J2012 16-Bit Bijective Symmetry):** $\forall (A, B) \in [0..255]^2, \text{encodeDTCString}(\text{decodeDTCBytes}(A, B)) = [A, B]$ across `P`, `C`, `B`, and `U` domains.
- **Property 3 (Arbitrary String Fuzzing Resilience):** `parseRawCANFrame` and `parseTelemetryCSV` survive 1,300+ `fc.string()` fuzz vectors and single-byte XOR bit-flip attacks with zero unhandled exceptions.
- **Property 4 (FinTech Escrow Monotonicity):** Strictly monotonic per-mile withholding scaling from `5` cents/mi (`$0.05/mi`) at healthy baseline to `>= 250` cents/mi (`$2.50+/mi`) under critical faults.

---

## License

Released under the [MIT License](./LICENSE).

