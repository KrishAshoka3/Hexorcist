/**
 * HEXORCIST — Universal Multi-Vehicle CAN-Bus Hex Engine, Road Dyno Physics & FinTech Escrow Core
 * Supports SAE J1979 (OBD-II Mode 01/03/04) and ISO 14229 (UDS Mode 22/2F/31)
 */

export type PidKey =
  | "010C"
  | "010D"
  | "0105"
  | "0106"
  | "010E"
  | "0110"
  | "0142"
  | "015C"
  | "221140"
  | "22F40A"
  | "22E001"
  | "22D100";

export type VehicleArchitectureId =
  | "GERMAN_V6_DSG"
  | "JDM_TWIN_ROTARY"
  | "AWD_800V_EV"
  | "HEAVY_DIESEL_TOW";

export type SoulProfileId = VehicleArchitectureId | "CUSTOM_VIN_SOUL";

export interface PidDefinition {
  key: PidKey;
  requestMode: "01" | "22";
  responseMode: "41" | "62";
  pidHex: string;
  pidBytes: number[];
  byteLength: 1 | 2;
  shortName: string;
  name: string;
  unit: string;
  min: number;
  max: number;
  tolerance: number;
  warnLow: number;
  warnHigh: number;
  decimals: number;
  encode: (value: number) => number[];
  decode: (bytes: number[]) => number;
}

const clamp = (val: number, min: number, max: number): number => {
  if (!Number.isFinite(val)) return min;
  return Math.min(max, Math.max(min, val));
};

const encodeU16 = (raw: number): [number, number] => {
  const bounded = clamp(Math.round(raw), 0, 65535);
  return [(bounded >> 8) & 0xff, bounded & 0xff];
};

const encodeU8 = (raw: number): [number] => [clamp(Math.round(raw), 0, 255) & 0xff];

const decodeU16 = (bytes: number[]): number =>
  (((bytes[0] ?? 0) & 0xff) << 8) | ((bytes[1] ?? 0) & 0xff);

export const UNIVERSAL_PID_REGISTRY: Record<PidKey, PidDefinition> = {
  "010C": {
    key: "010C",
    requestMode: "01",
    responseMode: "41",
    pidHex: "0C",
    pidBytes: [0x0c],
    byteLength: 2,
    shortName: "RPM",
    name: "Engine / Motor Speed",
    unit: "RPM",
    min: 0,
    max: 16383.75,
    tolerance: 0.25,
    warnLow: 550,
    warnHigh: 7200,
    decimals: 0,
    encode: (v) => encodeU16(clamp(v, 0, 16383.75) * 4),
    decode: (b) => decodeU16(b) / 4,
  },
  "010D": {
    key: "010D",
    requestMode: "01",
    responseMode: "41",
    pidHex: "0D",
    pidBytes: [0x0d],
    byteLength: 1,
    shortName: "VSS",
    name: "Vehicle Road Speed",
    unit: "km/h",
    min: 0,
    max: 255,
    tolerance: 1.0,
    warnLow: 0,
    warnHigh: 210,
    decimals: 0,
    encode: (v) => encodeU8(clamp(v, 0, 255)),
    decode: (b) => (b[0] ?? 0) & 0xff,
  },
  "0105": {
    key: "0105",
    requestMode: "01",
    responseMode: "41",
    pidHex: "05",
    pidBytes: [0x05],
    byteLength: 1,
    shortName: "ECT",
    name: "Coolant / Stator Temp",
    unit: "°C",
    min: -40,
    max: 215,
    tolerance: 1.0,
    warnLow: -15,
    warnHigh: 108,
    decimals: 0,
    encode: (v) => encodeU8(clamp(v, -40, 215) + 40),
    decode: (b) => ((b[0] ?? 0) & 0xff) - 40,
  },
  "0106": {
    key: "0106",
    requestMode: "01",
    responseMode: "41",
    pidHex: "06",
    pidBytes: [0x06],
    byteLength: 1,
    shortName: "STFT",
    name: "Short-Term Fuel Trim B1",
    unit: "%",
    min: -100,
    max: 99.21875,
    tolerance: 0.8,
    warnLow: -12,
    warnHigh: 12,
    decimals: 1,
    encode: (v) => encodeU8((clamp(v, -100, 99.21875) * 128) / 100 + 128),
    decode: (b) => ((((b[0] ?? 0) & 0xff) - 128) * 100) / 128,
  },
  "010E": {
    key: "010E",
    requestMode: "01",
    responseMode: "41",
    pidHex: "0E",
    pidBytes: [0x0e],
    byteLength: 1,
    shortName: "SPARK",
    name: "Ignition Timing Advance",
    unit: "°BTDC",
    min: -64,
    max: 63.5,
    tolerance: 0.5,
    warnLow: -12,
    warnHigh: 45,
    decimals: 1,
    encode: (v) => encodeU8((clamp(v, -64, 63.5) + 64) * 2),
    decode: (b) => ((b[0] ?? 0) & 0xff) / 2 - 64,
  },
  "0110": {
    key: "0110",
    requestMode: "01",
    responseMode: "41",
    pidHex: "10",
    pidBytes: [0x10],
    byteLength: 2,
    shortName: "MAF",
    name: "Mass Air Flow Rate",
    unit: "g/s",
    min: 0,
    max: 655.35,
    tolerance: 0.01,
    warnLow: 1.5,
    warnHigh: 380,
    decimals: 1,
    encode: (v) => encodeU16(clamp(v, 0, 655.35) * 100),
    decode: (b) => decodeU16(b) / 100,
  },
  "0142": {
    key: "0142",
    requestMode: "01",
    responseMode: "41",
    pidHex: "42",
    pidBytes: [0x42],
    byteLength: 2,
    shortName: "VPWR",
    name: "Control Module Voltage",
    unit: "V",
    min: 0,
    max: 65.535,
    tolerance: 0.002,
    warnLow: 12.1,
    warnHigh: 15.1,
    decimals: 2,
    encode: (v) => encodeU16(clamp(v, 0, 65.535) * 1000),
    decode: (b) => decodeU16(b) / 1000,
  },
  "015C": {
    key: "015C",
    requestMode: "01",
    responseMode: "41",
    pidHex: "5C",
    pidBytes: [0x5c],
    byteLength: 1,
    shortName: "TFT",
    name: "Trans / Inverter Fluid Temp",
    unit: "°C",
    min: -40,
    max: 215,
    tolerance: 1.0,
    warnLow: -15,
    warnHigh: 112,
    decimals: 0,
    encode: (v) => encodeU8(clamp(v, -40, 215) + 40),
    decode: (b) => ((b[0] ?? 0) & 0xff) - 40,
  },
  "221140": {
    key: "221140",
    requestMode: "22",
    responseMode: "62",
    pidHex: "1140",
    pidBytes: [0x11, 0x40],
    byteLength: 2,
    shortName: "BOOST",
    name: "Manifold Boost Pressure",
    unit: "PSI",
    min: -14.7,
    max: 50.835,
    tolerance: 0.002,
    warnLow: -13.5,
    warnHigh: 26.5,
    decimals: 1,
    encode: (v) => encodeU16((clamp(v, -14.7, 50.835) + 14.7) * 1000),
    decode: (b) => decodeU16(b) / 1000 - 14.7,
  },
  "22F40A": {
    key: "22F40A",
    requestMode: "22",
    responseMode: "62",
    pidHex: "F40A",
    pidBytes: [0xf4, 0x0a],
    byteLength: 2,
    shortName: "CLUTCH_P",
    name: "DSG Clutch Solenoid Pressure",
    unit: "Bar",
    min: 0,
    max: 65.535,
    tolerance: 0.002,
    warnLow: 1.8,
    warnHigh: 16.5,
    decimals: 2,
    encode: (v) => encodeU16(clamp(v, 0, 65.535) * 1000),
    decode: (b) => decodeU16(b) / 1000,
  },
  "22E001": {
    key: "22E001",
    requestMode: "22",
    responseMode: "62",
    pidHex: "E001",
    pidBytes: [0xe0, 0x01],
    byteLength: 2,
    shortName: "CELL_DV",
    name: "EV HV Cell Voltage Delta",
    unit: "mV",
    min: 0,
    max: 655.35,
    tolerance: 0.01,
    warnLow: 0,
    warnHigh: 45,
    decimals: 1,
    encode: (v) => encodeU16(clamp(v, 0, 655.35) * 100),
    decode: (b) => decodeU16(b) / 100,
  },
  "22D100": {
    key: "22D100",
    requestMode: "22",
    responseMode: "62",
    pidHex: "D100",
    pidBytes: [0xd1, 0x00],
    byteLength: 1,
    shortName: "DPF_SOOT",
    name: "Diesel DPF Soot Load",
    unit: "%",
    min: 0,
    max: 100,
    tolerance: 0.4,
    warnLow: 0,
    warnHigh: 80,
    decimals: 1,
    encode: (v) => encodeU8((clamp(v, 0, 100) * 255) / 100),
    decode: (b) => (((b[0] ?? 0) & 0xff) * 100) / 255,
  },
};

export const ALL_PID_KEYS = Object.keys(UNIVERSAL_PID_REGISTRY) as PidKey[];

export const toHexByte = (byte: number): string =>
  (byte & 0xff).toString(16).toUpperCase().padStart(2, "0");

export const computeXorChecksum = (bytes: number[]): number =>
  bytes.reduce((acc, b) => (acc ^ (b & 0xff)) & 0xff, 0);

/**
 * Serializes a physical telemetry value into an ISO 15765-4 CAN response frame:
 * Mode 01 -> `7E8 <PCI> 41 <PID> <A> [<B>] <XOR>`
 * Mode 22 -> `7E8 <PCI> 62 <DID_HI> <DID_LO> <A> [<B>] <XOR>`
 */
export function buildCANResponseFrame(pidKey: PidKey, value: number): string {
  const def = UNIVERSAL_PID_REGISTRY[pidKey];
  if (!def) {
    throw new Error(`Unsupported PID key: ${String(pidKey)}`);
  }
  const modeByte = parseInt(def.responseMode, 16);
  const dataBytes = def.encode(value);
  const pciLength = 1 + def.pidBytes.length + dataBytes.length;
  const payload = [pciLength, modeByte, ...def.pidBytes, ...dataBytes];
  const checksum = computeXorChecksum(payload);

  return `7E8 ${payload.map(toHexByte).join(" ")} ${toHexByte(checksum)}`;
}

export interface ParsedCANFrame {
  valid: boolean;
  rawFrame: string;
  canId: string;
  pciLength: number;
  pciHex: string;
  responseModeHex: string;
  pidKey: PidKey | null;
  pidHex: string;
  dataBytes: number[];
  byteAHex: string;
  byteBHex: string | null;
  checksumHex: string;
  expectedChecksumHex: string;
  checksumValid: boolean;
  value: number | null;
  unit: string;
  shortName: string;
  name: string;
  isWarning: boolean;
  error?: string;
}

/**
 * Fuzz-safe parser for raw hexadecimal CAN frames with XOR checksum validation.
 */
export function parseRawCANFrame(rawFrame: string): ParsedCANFrame {
  const safeRaw = typeof rawFrame === "string" ? rawFrame : String(rawFrame ?? "");
  const invalid = (error: string, partial?: Partial<ParsedCANFrame>): ParsedCANFrame => ({
    valid: false,
    rawFrame: safeRaw,
    canId: "",
    pciLength: 0,
    pciHex: "--",
    responseModeHex: "--",
    pidKey: null,
    pidHex: "--",
    dataBytes: [],
    byteAHex: "--",
    byteBHex: null,
    checksumHex: "--",
    expectedChecksumHex: "--",
    checksumValid: false,
    value: null,
    unit: "",
    shortName: "ERR",
    name: "Malformed Frame",
    isWarning: false,
    error,
    ...partial,
  });

  try {
    const cleaned = safeRaw.replace(/^[>\s]+|\s+$/g, "").toUpperCase();
    if (!cleaned || cleaned.length > 512) return invalid("Empty or oversized CAN frame");

    const tokens = cleaned.split(/[\s,]+/).filter(Boolean);
    if (tokens.length < 6) return invalid("Insufficient CAN frame tokens");

    const canId = tokens[0];
    if (!/^7E[8-F]$/.test(canId)) {
      return invalid(`Unsupported CAN arbitration ID: ${canId}`, { canId });
    }

    const byteTokens = tokens.slice(1);
    for (const tok of byteTokens) {
      if (!/^[0-9A-F]{2}$/.test(tok)) {
        return invalid(`Invalid hexadecimal byte token: ${tok}`, { canId });
      }
    }

    const bytes = byteTokens.map((t) => parseInt(t, 16));
    const pciLength = bytes[0];
    const checksumByte = bytes[bytes.length - 1];
    const payloadWithoutChecksum = bytes.slice(0, -1);

    if (payloadWithoutChecksum.length !== pciLength + 1) {
      return invalid("PCI length mismatch", {
        canId,
        pciLength,
        pciHex: toHexByte(pciLength),
      });
    }

    const expectedChecksum = computeXorChecksum(payloadWithoutChecksum);
    const checksumValid = checksumByte === expectedChecksum;
    const responseMode = bytes[1];
    const responseModeHex = toHexByte(responseMode);

    if (!checksumValid) {
      return invalid("XOR checksum verification failed", {
        canId,
        pciLength,
        pciHex: toHexByte(pciLength),
        responseModeHex,
        checksumHex: toHexByte(checksumByte),
        expectedChecksumHex: toHexByte(expectedChecksum),
        checksumValid: false,
      });
    }

    let pidKey: PidKey | null = null;
    let pidHex = "";
    let dataBytes: number[] = [];

    if (responseMode === 0x41) {
      if (bytes.length < 5) return invalid("Truncated Mode 41 response", { canId });
      pidHex = toHexByte(bytes[2]);
      pidKey = `01${pidHex}` as PidKey;
      dataBytes = bytes.slice(3, -1);
    } else if (responseMode === 0x62) {
      if (bytes.length < 6) return invalid("Truncated Mode 62 UDS response", { canId });
      pidHex = `${toHexByte(bytes[2])}${toHexByte(bytes[3])}`;
      pidKey = `22${pidHex}` as PidKey;
      dataBytes = bytes.slice(4, -1);
    } else {
      return invalid(`Unsupported service: ${responseModeHex}`, { canId, responseModeHex });
    }

    const def = Object.prototype.hasOwnProperty.call(UNIVERSAL_PID_REGISTRY, pidKey)
      ? UNIVERSAL_PID_REGISTRY[pidKey]
      : undefined;

    if (!def || dataBytes.length !== def.byteLength) {
      return invalid(`Invalid or mismatched PID/DID: ${pidKey}`, { canId, pidHex });
    }

    const value = def.decode(dataBytes);
    return {
      valid: true,
      rawFrame: safeRaw,
      canId,
      pciLength,
      pciHex: toHexByte(pciLength),
      responseModeHex,
      pidKey,
      pidHex,
      dataBytes,
      byteAHex: toHexByte(dataBytes[0] ?? 0),
      byteBHex: dataBytes.length > 1 ? toHexByte(dataBytes[1] ?? 0) : null,
      checksumHex: toHexByte(checksumByte),
      expectedChecksumHex: toHexByte(expectedChecksum),
      checksumValid: true,
      value,
      unit: def.unit,
      shortName: def.shortName,
      name: def.name,
      isWarning: value < def.warnLow || value > def.warnHigh,
    };
  } catch (err) {
    return invalid(err instanceof Error ? err.message : "Unhandled frame parse error");
  }
}

const DTC_DOMAIN_PREFIXES = ["P", "C", "B", "U"] as const;
const DTC_DOMAIN_MAP: Record<string, number> = { P: 0, C: 1, B: 2, U: 3 };

/**
 * SAE J2012 2-Byte Bitmask Encoder:
 * Converts `[PCBU][0-3][0-9A-F]{3}` into `[byteA, byteB]`.
 */
export function encodeDTCString(code: string): [number, number] {
  const normalized = String(code ?? "").trim().toUpperCase();
  if (!/^[PCBU][0-3][0-9A-F]{3}$/.test(normalized)) {
    throw new Error(`Invalid SAE J2012 DTC format: "${code}"`);
  }

  const domainBits = DTC_DOMAIN_MAP[normalized[0]] & 0x03;
  const subTypeBits = parseInt(normalized[1], 10) & 0x03;
  const digit1 = parseInt(normalized[2], 16) & 0x0f;
  const digit2 = parseInt(normalized[3], 16) & 0x0f;
  const digit3 = parseInt(normalized[4], 16) & 0x0f;

  const byteA = (domainBits << 6) | (subTypeBits << 4) | digit1;
  const byteB = (digit2 << 4) | digit3;

  return [byteA & 0xff, byteB & 0xff];
}

/**
 * SAE J2012 2-Byte Bitmask Decoder:
 * Reconstructs the 5-character trouble code (`P0xxx`, `C1xxx`, `B2xxx`, `U3xxx`).
 */
export function decodeDTCBytes(byteA: number, byteB: number): string {
  const a = byteA & 0xff;
  const b = byteB & 0xff;
  const domain = DTC_DOMAIN_PREFIXES[(a >> 6) & 0x03];
  const subType = ((a >> 4) & 0x03).toString(10);
  const digit1 = (a & 0x0f).toString(16).toUpperCase();
  const digit2 = ((b >> 4) & 0x0f).toString(16).toUpperCase();
  const digit3 = (b & 0x0f).toString(16).toUpperCase();

  return `${domain}${subType}${digit1}${digit2}${digit3}`;
}

export interface DtcBitmaskBreakdown {
  code: string;
  byteA: number;
  byteB: number;
  hexPair: string;
  binary16: string;
  domainBits: string;
  domainLabel: string;
  subTypeBits: string;
  subTypeLabel: string;
  faultIndexHex: string;
}

export function inspectDTCBitmask(code: string): DtcBitmaskBreakdown {
  const [byteA, byteB] = encodeDTCString(code);
  const normalized = decodeDTCBytes(byteA, byteB);
  const domainIdx = (byteA >> 6) & 0x03;
  const subIdx = (byteA >> 4) & 0x03;
  const domainNames = [
    "Powertrain (Engine / Transmission / HV Drive)",
    "Chassis (ABS / Stability / Suspension)",
    "Body (Restraints / HVAC / Cabin)",
    "Network (CAN-Bus / FlexRay / UDS Gateway)",
  ];
  const subNames = [
    "SAE / ISO Generic Standard",
    "OEM Manufacturer Specific",
    "SAE / ISO Controlled Sub-Group",
    "Joint SAE / OEM Reserved",
  ];

  return {
    code: normalized,
    byteA,
    byteB,
    hexPair: `0x${toHexByte(byteA)} 0x${toHexByte(byteB)}`,
    binary16: `${byteA.toString(2).padStart(8, "0")} ${byteB.toString(2).padStart(8, "0")}`,
    domainBits: ((byteA >> 6) & 0x03).toString(2).padStart(2, "0"),
    domainLabel: domainNames[domainIdx],
    subTypeBits: subIdx.toString(2).padStart(2, "0"),
    subTypeLabel: subNames[subIdx],
    faultIndexHex: normalized.slice(2),
  };
}

export interface DynoPhysicsInput {
  currentSpeedKmh: number;
  prevSpeedKmh: number;
  deltaTimeSec: number;
  rpm: number;
  curbWeightKg: number;
  dragCoefficientCd: number;
  frontalAreaM2: number;
  rollingResistanceCoeff?: number;
}

export interface DynoMetricsResult {
  whp: number;
  torqueLbFt: number;
  accelerationG: number;
  tractiveForceN: number;
  aeroDragWatts: number;
}

/**
 * Computes real-time Wheel Horsepower (WHP) and Wheel Torque (lb-ft)
 * from longitudinal acceleration, mass, aerodynamic drag, and tire rolling resistance.
 */
export function calculateDynoMetrics(input: DynoPhysicsInput): DynoMetricsResult {
  const dt = Math.max(0.005, Number.isFinite(input.deltaTimeSec) ? input.deltaTimeSec : 0.04);
  const vCurrentMs = Math.max(0, (input.currentSpeedKmh || 0) / 3.6);
  const vPrevMs = Math.max(0, (input.prevSpeedKmh || 0) / 3.6);
  const accelMs2 = Math.max(0, (vCurrentMs - vPrevMs) / dt);

  const massKg = Math.max(500, input.curbWeightKg || 1650);
  const effectiveMassKg = massKg * 1.04; // 4% rotational driveline inertia factor
  const cd = clamp(input.dragCoefficientCd || 0.3, 0.15, 0.95);
  const areaM2 = clamp(input.frontalAreaM2 || 2.25, 1.2, 6.5);
  const crr = clamp(input.rollingResistanceCoeff ?? 0.012, 0.005, 0.04);

  const airDensity = 1.225; // kg/m^3 @ ISA sea level
  const gravity = 9.80665;

  const fInertial = effectiveMassKg * accelMs2;
  const fAero = 0.5 * airDensity * cd * areaM2 * vCurrentMs * vCurrentMs;
  const fRolling = vCurrentMs > 0.2 ? crr * massKg * gravity : 0;

  const tractiveForceN = Math.max(0, fInertial + fAero + fRolling);
  const wheelPowerWatts = tractiveForceN * vCurrentMs;
  const aeroDragWatts = fAero * vCurrentMs;

  const whp = Math.max(0, wheelPowerWatts / 745.699872);
  const safeRpm = Math.max(500, input.rpm || 500);
  const torqueLbFt = whp > 0 ? (whp * 5252) / safeRpm : 0;

  return {
    whp: Math.round(whp * 10) / 10,
    torqueLbFt: Math.round(torqueLbFt * 10) / 10,
    accelerationG: Math.round((accelMs2 / gravity) * 1000) / 1000,
    tractiveForceN: Math.round(tractiveForceN),
    aeroDragWatts: Math.round(aeroDragWatts),
  };
}

/**
 * Computes monotonic per-mile FinTech repair escrow withholding rate in USD cents.
 * Scales smoothly from baseline 5 cents/mi ($0.05/mi) to 250+ cents/mi ($2.50+/mi) on severe faults.
 */
export function calculateEscrowRateCents(
  anomalyScore: number,
  activeDtcCount: number = 0
): number {
  const s = clamp(Number.isFinite(anomalyScore) ? anomalyScore : 0, 0, 100);
  const dtcs = Math.max(
    0,
    Math.floor(Number.isFinite(activeDtcCount) ? activeDtcCount : 0)
  );

  return 5 + Math.floor(1.85 * s + 0.011 * s * s) + 45 * dtcs;
}

export interface MechanicalCursePreset {
  id: string;
  name: string;
  dtcCode: string;
  severityScore: number; // 0..100
  powerLossPct: number; // 0..65
  targetPid: PidKey;
  oemPartName: string;
  oemPartNumber: string;
  estimatedCostUsd: number;
  laborHours: number;
  recommendedUdsCommand: string;
  mechanicalExplanation: string;
  telemetryOverrides: Partial<Record<PidKey, number>>;
}

export interface VehicleSoulPreset {
  id: SoulProfileId;
  codename: string;
  yearMakeModel: string;
  engineSummary: string;
  defaultVin: string;
  curbWeightKg: number;
  dragCoefficientCd: number;
  frontalAreaM2: number;
  redlineRpm: number;
  peakHealthyWhp: number;
  peakHealthyTorqueLbFt: number;
  primaryPid: PidKey;
  baselineTelemetry: Record<PidKey, number>;
  curses: MechanicalCursePreset[];
}

export const VEHICLE_SOUL_PRESETS: Record<VehicleArchitectureId, VehicleSoulPreset> = {
  GERMAN_V6_DSG: {
    id: "GERMAN_V6_DSG",
    codename: "GERMAN_V6_DSG",
    yearMakeModel: "2014 Supercharged 3.0T V6 + 7-Speed DSG (0B5)",
    engineSummary: "EA837 Roots TVS1320 Supercharged V6 // DL501 Wet Dual-Clutch",
    defaultVin: "WAUDGAFL5EA049218",
    curbWeightKg: 1750,
    dragCoefficientCd: 0.28,
    frontalAreaM2: 2.21,
    redlineRpm: 7000,
    peakHealthyWhp: 338,
    peakHealthyTorqueLbFt: 325,
    primaryPid: "22F40A",
    baselineTelemetry: {
      "010C": 2350,
      "010D": 84,
      "0105": 91,
      "0106": 1.6,
      "010E": 18.5,
      "0110": 42.4,
      "0142": 14.22,
      "015C": 82,
      "221140": 11.8,
      "22F40A": 8.45,
      "22E001": 4.2,
      "22D100": 2.0,
    },
    curses: [
      {
        id: "dsg-mechatronic-solenoid",
        name: "0B5 Mechatronic K1 Solenoid Pressure Collapse",
        dtcCode: "P17D8",
        severityScore: 86,
        powerLossPct: 29,
        targetPid: "22F40A",
        oemPartName: "DL501 0B5 Mechatronic Solenoid Repair & PCB Harness Kit",
        oemPartNumber: "0B5-398-009-F",
        estimatedCostUsd: 1640,
        laborHours: 5.5,
        recommendedUdsCommand: "31 01 FF 0A (DSG Kiss-Point & Clutch Solenoid Adaptation)",
        mechanicalExplanation:
          "Printed circuit laminate delamination inside the 0B5 wet-clutch mechatronic unit starves N435/N439 pressure control valves, dropping K1 line pressure from 8.45 Bar to 2.35 Bar and spiking ATF temperature via micro-slip.",
        telemetryOverrides: {
          "22F40A": 2.35,
          "015C": 127,
          "010C": 3180,
          "010E": 6.5,
        },
      },
      {
        id: "pcv-crankcase-vacuum-breach",
        name: "Supercharger Valley PCV Diaphragm Rupture",
        dtcCode: "P0171",
        severityScore: 68,
        powerLossPct: 18,
        targetPid: "0106",
        oemPartName: "EA837 Crankcase Breather Oil Separator Assembly",
        oemPartNumber: "06E-103-547-AH",
        estimatedCostUsd: 790,
        laborHours: 4.2,
        recommendedUdsCommand: "04 (Clear Fuel Trims & Lambda Learned Offsets)",
        mechanicalExplanation:
          "Torn internal fluorosilicone PCV diaphragm under the Eaton TVS1320 blower leaks unmetered air into both cylinder banks, pegging Short-Term Fuel Trim above +26% and bleeding supercharger boost.",
        telemetryOverrides: {
          "0106": 27.3,
          "221140": 5.4,
          "0110": 29.8,
          "0105": 106,
        },
      },
    ],
  },
  JDM_TWIN_ROTARY: {
    id: "JDM_TWIN_ROTARY",
    codename: "JDM_TWIN_ROTARY",
    yearMakeModel: "1999 Sequential Twin-Turbo 13B-REW Rotary",
    engineSummary: "1.3L Twin-Rotor Wankel // Hitachi HT-12 Sequential Turbos",
    defaultVin: "JM1FD3331P0204912",
    curbWeightKg: 1280,
    dragCoefficientCd: 0.29,
    frontalAreaM2: 1.89,
    redlineRpm: 8000,
    peakHealthyWhp: 292,
    peakHealthyTorqueLbFt: 238,
    primaryPid: "221140",
    baselineTelemetry: {
      "010C": 3100,
      "010D": 92,
      "0105": 88,
      "0106": -0.8,
      "010E": 15.0,
      "0110": 48.2,
      "0142": 13.95,
      "015C": 79,
      "221140": 14.2,
      "22F40A": 5.1,
      "22E001": 2.0,
      "22D100": 4.0,
    },
    curses: [
      {
        id: "rotary-apex-seal-chatter",
        name: "Rear Rotor 2mm Apex Seal Hot-Spot Blowby",
        dtcCode: "P0302",
        severityScore: 93,
        powerLossPct: 38,
        targetPid: "221140",
        oemPartName: "Mazda 13B-REW 2mm 2-Piece Apex Seal & Corner Spring Set",
        oemPartNumber: "NF01-11-C00C",
        estimatedCostUsd: 3450,
        laborHours: 18.0,
        recommendedUdsCommand: "2F F0 10 03 FF (Command Dual Aux Cooling Fans 100% Duty)",
        mechanicalExplanation:
          "Detonation-induced apex seal warpage bridges adjacent trochoid combustion chambers on Rotor #2, collapsing manifold vacuum/boost transition at 4,500 RPM and driving coolant past 116°C.",
        telemetryOverrides: {
          "221140": 3.1,
          "0105": 118,
          "0106": 21.9,
          "010E": -3.5,
        },
      },
      {
        id: "sequential-solenoid-rack-dead",
        name: "Rats-Nest Charge Relief Solenoid Vacuum Failure",
        dtcCode: "P1248",
        severityScore: 64,
        powerLossPct: 24,
        targetPid: "221140",
        oemPartName: "Hitachi Turbo Control & Charge Relief Vacuum Solenoid Valve",
        oemPartNumber: "N3A1-18-741",
        estimatedCostUsd: 620,
        laborHours: 3.8,
        recommendedUdsCommand: "31 01 12 40 (Cycle Sequential Turbo Actuator Doors)",
        mechanicalExplanation:
          "Heat-baked Viton vacuum lines and open-circuit turbo control solenoid trap the secondary HT-12 compressor offline during the 4,500 RPM crossover valley.",
        telemetryOverrides: {
          "221140": 6.2,
          "0110": 31.4,
          "0105": 105,
        },
      },
    ],
  },
  AWD_800V_EV: {
    id: "AWD_800V_EV",
    codename: "AWD_800V_EV",
    yearMakeModel: "2025 800V Dual-Motor Performance EV Sedan",
    engineSummary: "93.4 kWh 800V SiC Inverter Architecture // 2-Speed Rear Axle",
    defaultVin: "WP0AC2Y16RSA41028",
    curbWeightKg: 2295,
    dragCoefficientCd: 0.22,
    frontalAreaM2: 2.33,
    redlineRpm: 14000,
    peakHealthyWhp: 615,
    peakHealthyTorqueLbFt: 626,
    primaryPid: "22E001",
    baselineTelemetry: {
      "010C": 5400,
      "010D": 108,
      "0105": 41,
      "0106": 0.0,
      "010E": 0.0,
      "0110": 0.0,
      "0142": 14.48,
      "015C": 46,
      "221140": 0.0,
      "22F40A": 11.2,
      "22E001": 8.5,
      "22D100": 0.0,
    },
    curses: [
      {
        id: "hv-pouch-cell-imbalance",
        name: "Module #14 HV Pouch Cell Dendrite Imbalance",
        dtcCode: "P0AA6",
        severityScore: 91,
        powerLossPct: 35,
        targetPid: "22E001",
        oemPartName: "800V Lithium-Nickel-Manganese Module #14 & Pyro-Fuse Contactor",
        oemPartNumber: "9J1-915-592-J",
        estimatedCostUsd: 4280,
        laborHours: 9.5,
        recommendedUdsCommand: "31 01 E0 01 (Active BMS Shunt Cell-Balancing & Isolation Check)",
        mechanicalExplanation:
          "Internal lithium plating in sub-pack Module #14 opens a 148.6 mV cell voltage delta under load and triggers HV isolation fault derating across the rear SiC inverter.",
        telemetryOverrides: {
          "22E001": 148.6,
          "015C": 119,
          "0142": 11.65,
          "0105": 111,
        },
      },
      {
        id: "dc-dc-low-voltage-droop",
        name: "800V-to-12V Galvanic DC/DC Converter Brownout",
        dtcCode: "U0100",
        severityScore: 72,
        powerLossPct: 21,
        targetPid: "0142",
        oemPartName: "800V HV-LV Buck Converter Control Module",
        oemPartNumber: "9J1-959-663-C",
        estimatedCostUsd: 1520,
        laborHours: 3.0,
        recommendedUdsCommand: "2F F0 10 03 FF (Engage Chiller Loop & Reset LV Bus)",
        mechanicalExplanation:
          "MOSFET gate driver fatigue drops low-voltage control rail to 11.15V, causing intermittent CAN gateway timeouts (U0100) and rear 2-speed actuator pressure loss.",
        telemetryOverrides: {
          "0142": 11.15,
          "22F40A": 1.45,
          "22E001": 62.4,
        },
      },
    ],
  },
  HEAVY_DIESEL_TOW: {
    id: "HEAVY_DIESEL_TOW",
    codename: "HEAVY_DIESEL_TOW",
    yearMakeModel: "2023 6.7L High-Output Turbo-Diesel Tow Rig",
    engineSummary: "6.7L I6 CGI Block // Holset VGT + Aisin AS69RC Heavy-Duty",
    defaultVin: "3C63R3HL9PG512840",
    curbWeightKg: 3540,
    dragCoefficientCd: 0.44,
    frontalAreaM2: 3.68,
    redlineRpm: 3400,
    peakHealthyWhp: 375,
    peakHealthyTorqueLbFt: 945,
    primaryPid: "22D100",
    baselineTelemetry: {
      "010C": 1750,
      "010D": 96,
      "0105": 94,
      "0106": 0.0,
      "010E": 8.5,
      "0110": 118.5,
      "0142": 14.35,
      "015C": 86,
      "221140": 21.4,
      "22F40A": 12.6,
      "22E001": 0.0,
      "22D100": 24.5,
    },
    curses: [
      {
        id: "dpf-soot-choke-derate",
        name: "DPF Monolith Soot Saturation & VGT Vane Seizure",
        dtcCode: "P2463",
        severityScore: 88,
        powerLossPct: 42,
        targetPid: "22D100",
        oemPartName: "Cordierite DPF Particulate Filter & Holset VGT Actuator Kit",
        oemPartNumber: "68447771AA",
        estimatedCostUsd: 2890,
        laborHours: 6.5,
        recommendedUdsCommand: "31 01 D1 00 (Stationary Active Thermal DPF Soot Exorcism)",
        mechanicalExplanation:
          "Failed 7th-injector hydrocarbon dosing packs the Diesel Particulate Filter to 96.5% soot load, choking exhaust backpressure, seizing VGT vanes, and engaging 42% torque limp derate.",
        telemetryOverrides: {
          "22D100": 96.5,
          "221140": 32.8,
          "0105": 114,
          "015C": 118,
        },
      },
      {
        id: "cp4-rail-pressure-starvation",
        name: "High-Pressure Common-Rail Metering Valve Cavitation",
        dtcCode: "P0087",
        severityScore: 82,
        powerLossPct: 33,
        targetPid: "0110",
        oemPartName: "High-Pressure Fuel Injection Pump & Rail Metering Conversion",
        oemPartNumber: "68436631AA",
        estimatedCostUsd: 3190,
        laborHours: 8.5,
        recommendedUdsCommand: "04 (Reset Rail Pressure Regulator Learned Trim Table)",
        mechanicalExplanation:
          "Aeration and metallic wear at the FCA fuel metering solenoid starve high-load injection volume under tow grade, collapsing boost to 7.9 PSI and airflow to 58 g/s.",
        telemetryOverrides: {
          "221140": 7.9,
          "0110": 58.2,
          "0142": 13.7,
        },
      },
    ],
  },
};

export const VEHICLE_SOUL_LIST: VehicleSoulPreset[] = Object.values(VEHICLE_SOUL_PRESETS);

export function generateSampleTelemetryCsv(vehicleId: VehicleArchitectureId): string {
  const soul = VEHICLE_SOUL_PRESETS[vehicleId];
  const curse = soul.curses[0];
  const rows: string[] = ["timestamp_ms,pid_key,raw_can_frame,decoded_value,unit,note"];
  const pidCycle: PidKey[] = [
    "010C",
    "010D",
    "0105",
    "0106",
    "010E",
    "0142",
    "221140",
    soul.primaryPid,
  ];

  for (let step = 0; step < 48; step++) {
    const pid = pidCycle[step % pidCycle.length];
    const def = UNIVERSAL_PID_REGISTRY[pid];
    const cursedPhase = step >= 20;
    const baseVal =
      cursedPhase && curse.telemetryOverrides[pid] !== undefined
        ? (curse.telemetryOverrides[pid] as number)
        : soul.baselineTelemetry[pid];
    const jitter = Math.sin(step * 0.65) * Math.max(def.tolerance, Math.abs(baseVal) * 0.02);
    const val = clamp(baseVal + jitter, def.min, def.max);
    const frame = buildCANResponseFrame(pid, val);
    const parsed = parseRawCANFrame(frame);
    rows.push(
      `${step * 40},${pid},"${frame}",${(parsed.value ?? val).toFixed(def.decimals)},${
        def.unit
      },${cursedPhase ? `FAULT_${curse.dtcCode}` : "NOMINAL"}`
    );
  }

  return rows.join("\n");
}


