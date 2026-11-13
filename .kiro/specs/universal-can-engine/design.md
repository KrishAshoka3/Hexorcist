# Technical Design: Universal CAN-Bus Hex Engine, Dyno Physics & FinTech Escrow

## 1. System Topology

```
[WebSerial ELM327 | CSV Replay | 25Hz Virtual ECU + Curse Injector]
                               |
                               v
         +-------------------------------------------+
         |   src/lib/obd-hex-engine.ts               |
         |  - UNIVERSAL_PID_REGISTRY (12 PIDs/DIDs)  |
         |  - ISO 15765-4 Frame Builder & XOR Parser |
         |  - SAE J2012 16-bit DTC Bitmask Codec     |
         |  - Road Dyno Physics & Escrow Rate Math   |
         +-------------------------------------------+
            |                  |                   |
            v                  v                   v
  [60fps Oscilloscope   [Vertex AI Autopsy   [FinTech Repair
   & UDS Terminal]       /api/diagnose]       Escrow Ledger]
```

---

## 2. ISO 15765-4 CAN Frame Format (`7E8`)

All ECU positive responses are serialized as space-delimited uppercase hexadecimal frames:

- **Mode `01` (SAE J1979 Current Data) Response (`41`):**
  `7E8 <PCI> 41 <PID_1B> <DATA_A> [<DATA_B>] <XOR_CHECKSUM>`
- **Mode `22` (ISO 14229 UDS ReadDataByIdentifier) Response (`62`):**
  `7E8 <PCI> 62 <DID_HI> <DID_LO> <DATA_A> [<DATA_B>] <XOR_CHECKSUM>`

Where:
- `PCI` = count of protocol payload bytes (`Mode + PID/DID + Data`), excluding `7E8` and `XOR_CHECKSUM`.
- `XOR_CHECKSUM` = `PCI ^ Mode ^ PID_bytes... ^ Data_bytes...` (`0x00`–`0xFF`).

---

## 3. Exact Byte-Level Formulas for All 12 `UNIVERSAL_PID_REGISTRY` Entries

Let `u16(A, B) = (A << 8) | B` (`0..65535`). All `encode` functions clamp inputs to `[min, max]` and round to nearest integer quantization step.

| Key | Protocol | Name | Bytes | Range (`min`..`max`) | Decode Formula (`bytes -> value`) | Encode Formula (`value -> bytes`) | Tolerance |
|---|---|---|---|---|---|---|---|
| `010C` | SAE J1979 Mode 01 | Engine / Motor Speed | 2 | `0` .. `16383.75` RPM | `((256*A) + B) / 4` | `raw = round(v * 4)` -> `[raw >> 8, raw & 0xFF]` | `0.25` |
| `010D` | SAE J1979 Mode 01 | Vehicle Road Speed | 1 | `0` .. `255` km/h | `A` | `[round(v)]` | `1.0` |
| `0105` | SAE J1979 Mode 01 | Coolant / Stator Temp | 1 | `-40` .. `215` °C | `A - 40` | `[round(v + 40)]` | `1.0` |
| `0106` | SAE J1979 Mode 01 | Short-Term Fuel Trim B1 | 1 | `-100` .. `99.22` % | `((A - 128) * 100) / 128` | `[round((v * 128) / 100 + 128)]` | `0.8` |
| `010E` | SAE J1979 Mode 01 | Ignition Timing Advance | 1 | `-64` .. `63.5` °BTDC | `(A / 2) - 64` | `[round((v + 64) * 2)]` | `0.5` |
| `0110` | SAE J1979 Mode 01 | Mass Air Flow (MAF) | 2 | `0` .. `655.35` g/s | `((256*A) + B) / 100` | `raw = round(v * 100)` -> `[raw >> 8, raw & 0xFF]` | `0.01` |
| `0142` | SAE J1979 Mode 01 | Control Module Voltage | 2 | `0` .. `65.535` V | `((256*A) + B) / 1000` | `raw = round(v * 1000)` -> `[raw >> 8, raw & 0xFF]` | `0.001` |
| `015C` | SAE J1979 Mode 01 | Transmission / Inverter Temp | 1 | `-40` .. `215` °C | `A - 40` | `[round(v + 40)]` | `1.0` |
| `221140` | ISO 14229 UDS 22 | Manifold Gauge Boost | 2 | `-14.7` .. `50.835` PSI | `(((256*A) + B) / 1000) - 14.7` | `raw = round((v + 14.7) * 1000)` -> `[raw >> 8, raw & 0xFF]` | `0.002` |
| `22F40A` | ISO 14229 UDS 22 | DSG / Line Solenoid Pressure | 2 | `0` .. `65.535` Bar | `((256*A) + B) / 1000` | `raw = round(v * 1000)` -> `[raw >> 8, raw & 0xFF]` | `0.002` |
| `22E001` | ISO 14229 UDS 22 | EV HV Cell Voltage Delta | 2 | `0` .. `655.35` mV | `((256*A) + B) / 100` | `raw = round(v * 100)` -> `[raw >> 8, raw & 0xFF]` | `0.01` |
| `22D100` | ISO 14229 UDS 22 | Diesel DPF Soot Load | 1 | `0` .. `100` % | `(A * 100) / 255` | `[round((v * 255) / 100)]` | `0.4` |

---

## 4. SAE J2012 2-Byte DTC Bitmask Layout

```
Byte A:  [ D1  D0 | S1  S0 | H3  H2  H1  H0 ]
           7   6    5   4    3   2   1   0
Byte B:  [ M3  M2  M1  M0 | L3  L2  L1  L0 ]
           7   6   5   4     3   2   1   0
```

- `D1..D0`: `00 = P` (Powertrain), `01 = C` (Chassis), `10 = B` (Body), `11 = U` (Network/UART)
- `S1..S0`: `0`–`3` (SAE generic `0`/`2`/`3` vs OEM-specific `1`)
- `H3..H0`: First hex digit (`0`–`F`)
- `M3..M0`: Second hex digit (`0`–`F`)
- `L3..L0`: Third hex digit (`0`–`F`)

---

## 5. Virtual Road Dyno Physics Equations

Given speed $v_1, v_2$ in km/h over $\Delta t$ seconds, curb mass $m$ (kg), drag coefficient $C_d$, frontal area $A$ ($m^2$), air density $\rho = 1.225\text{ kg/m}^3$, rolling resistance $C_{rr} = 0.012$, and gravity $g = 9.80665\text{ m/s}^2$:

1. Convert velocity to m/s: $v = v_2 / 3.6$, $v_{\text{prev}} = v_1 / 3.6$
2. Longitudinal acceleration: $a = \max(0, (v - v_{\text{prev}}) / \Delta t)$
3. Inertial force: $F_{\text{inertial}} = m_{\text{eff}} \cdot a$, where $m_{\text{eff}} = 1.04 \cdot m$ accounts for rotational drivetrain inertia
4. Aerodynamic drag force: $F_{\text{aero}} = \frac{1}{2} \rho C_d A v^2$
5. Rolling resistance force: $F_{\text{roll}} = C_{rr} m g$
6. Total wheel power: $P_{\text{wheel}} = (F_{\text{inertial}} + F_{\text{aero}} + F_{\text{roll}}) \cdot v$ (Watts)
7. Wheel Horsepower: $\text{WHP} = P_{\text{wheel}} / 745.699872$
8. Wheel Torque (lb-ft): $\tau_{\text{lb-ft}} = (\text{WHP} \times 5252) / \max(\text{RPM}, 500)$

---

## 6. FinTech Repair Escrow Withholding Function

Let normalized anomaly score $s = \text{clamp}(\text{anomalyScore}, 0, 100)$ and active fault count $k = \max(0, \lfloor \text{activeDtcCount} \rfloor)$:

$$\text{rateCents}(s, k) = 5 + \lfloor 1.85 \cdot s + 0.011 \cdot s^2 \rfloor + 45 \cdot k$$

- At healthy baseline ($s = 0, k = 0$): `5` cents/mi (`$0.05/mi`).
- At severe mechanical fault ($s = 85, k = 1$): `5 + 236 + 45 = 286` cents/mi (`$2.86/mi`).
- Strictly monotonic in both $s \ge 0$ and $k \ge 0$, deterministic, integer-valued, and strictly positive (`>= 5`).
