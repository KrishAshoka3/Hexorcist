# Requirements Document: Universal CAN-Bus & FinTech Escrow Engine

## Introduction
HEXORCIST unifies low-level automotive telemetry protocols (SAE J1979 OBD-II and ISO 14229 Unified Diagnostic Services) with real-time Virtual Road Dyno physics, Google Cloud Vertex AI diagnostics, and an autonomous FinTech Repair Sinking-Fund Ledger. Every requirement follows Easy Approach to Requirements Syntax (EARS).

## Requirement 1: Universal Multi-Vehicle PID Registry & Serialization
**User Story:** As an automotive diagnostic engineer, I want deterministic byte-level encoding and decoding across SAE J1979 Mode `01` PIDs and ISO 14229 UDS Mode `22` DIDs so ICE, Rotary, EV, and Heavy Diesel powertrains share one verified telemetry pipeline.

### Acceptance Criteria
1. WHEN a physical telemetry value within `[min, max]` is passed to `UNIVERSAL_PID_REGISTRY[pid].encode(value)`, THE SYSTEM SHALL quantize and clamp the value into unsigned 8-bit integers (`0x00`–`0xFF`) matching the exact byte length (`1` or `2` bytes) of that PID.
2. WHEN raw payload bytes `[A]` or `[A, B]` are passed to `UNIVERSAL_PID_REGISTRY[pid].decode(bytes)`, THE SYSTEM SHALL reconstruct the physical telemetry value within the defined quantization `tolerance`.
3. WHEN `buildCANResponseFrame(pidKey, value)` is invoked for a Mode `01` PID, THE SYSTEM SHALL emit an ISO 15765-4 CAN response frame on identifier `7E8` using positive response byte `41`, the 1-byte PID, encoded data bytes, and a trailing bitwise XOR checksum byte.
4. WHEN `buildCANResponseFrame(pidKey, value)` is invoked for a Mode `22` UDS DID, THE SYSTEM SHALL emit an ISO 15765-4 CAN response frame on identifier `7E8` using positive response byte `62`, the 2-byte DID, encoded data bytes, and a trailing bitwise XOR checksum byte.

## Requirement 2: Fuzz-Safe CAN Frame Parsing & Integrity Validation
**User Story:** As a hardware developer streaming noisy ELM327 WebSerial or CSV bus traffic, I want malformed frames, truncated hex tokens, and corrupted checksums rejected gracefully without uncaught exceptions.

### Acceptance Criteria
1. WHEN `parseRawCANFrame(rawFrame)` receives any arbitrary or malformed string input, THE SYSTEM SHALL never throw an unhandled runtime exception and SHALL return a structured result with `valid: false` and an `error` message.
2. WHEN `parseRawCANFrame(rawFrame)` receives a `7E8` frame whose trailing XOR byte does not match `[PCI ^ Mode ^ ...PID ^ ...Data]`, THE SYSTEM SHALL return `checksumValid: false` and `valid: false`.
3. WHEN `parseRawCANFrame(rawFrame)` receives a valid `7E8` response frame for any registered PID, THE SYSTEM SHALL return `valid: true`, decoded physical value, byte-level annotations, and warning threshold status.

## Requirement 3: SAE J2012 Trouble Code 2-Byte Bitmask Symmetry
**User Story:** As a diagnostic technician inspecting ECU fault memory, I want bijective conversion between 5-character trouble codes (`P`, `C`, `B`, `U`) and their raw 16-bit SAE J2012 hexadecimal bitmasks.

### Acceptance Criteria
1. WHEN `encodeDTCString(code)` is called with a valid SAE J2012 code matching `/^[PCBU][0-3][0-9A-F]{3}$/i`, THE SYSTEM SHALL pack bits `[15:14]` as domain (`P=00`, `C=01`, `B=10`, `U=11`), bits `[13:12]` as subtype (`0`–`3`), and bits `[11:0]` as the three hex digits across `[byteA, byteB]`.
2. WHEN `decodeDTCBytes(byteA, byteB)` is called with any unsigned byte pair `(0..255, 0..255)`, THE SYSTEM SHALL reconstruct the exact 5-character uppercase trouble code such that `decodeDTCBytes(...encodeDTCString(code)) === code`.

## Requirement 4: Virtual Road Dyno Physics Engine
**User Story:** As a performance tuner, I want real-time Wheel Horsepower (WHP) and Torque (lb-ft) derived from acceleration, vehicle mass, aerodynamic drag ($C_d$), and frontal area.

### Acceptance Criteria
1. WHEN `calculateDynoMetrics` receives current speed, previous speed, $\Delta t > 0$, RPM, curb weight, $C_d$, and frontal area, THE SYSTEM SHALL compute total tractive force from inertial acceleration, aerodynamic drag, and tire rolling resistance.
2. WHEN tractive power is positive and RPM $> 0$, THE SYSTEM SHALL output non-negative `whp` and `torqueLbFt = (whp * 5252) / rpm`.

## Requirement 5: Autonomous FinTech Repair Sinking-Fund Invariants
**User Story:** As a vehicle owner, I want per-mile repair escrow withholding to scale deterministically and monotonically with live ECU anomaly severity.

### Acceptance Criteria
1. WHEN `calculateEscrowRateCents(0, 0)` is evaluated on a healthy vehicle, THE SYSTEM SHALL return the baseline rate of `5` cents/mile (`$0.05/mi`).
2. WHEN `anomalyScore` or `activeDtcCount` increases, THE SYSTEM SHALL monotonically increase the per-mile rate, reaching `>= 250` cents/mile (`$2.50+/mi`) on critical faults while keeping vault balances strictly non-negative.

## Requirement 6: Vertex AI Diagnostic Necromancer & Bidirectional UDS Exorcism
**User Story:** As a technician diagnosing cursed vehicles, I want live Vertex AI (`gemini-2.5-flash`) autopsies paired with bidirectional UDS Mode `04`, `2F`, and `31` routines.

### Acceptance Criteria
1. WHEN `/api/diagnose` receives VIN, raw CAN hex frame, and DTC context, THE SYSTEM SHALL query Google Cloud Vertex AI (`gemini-2.5-flash`) and return structured OEM part, cost, labor, and UDS remediation JSON (with deterministic offline fallback).
2. WHEN a UDS Mode `04`, `2F`, or `31` actuator command is dispatched, THE SYSTEM SHALL log authentic `7E0`/`7E8` hex handshakes and clear/remediate active ECU curses.
