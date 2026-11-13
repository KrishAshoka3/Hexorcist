/**
 * HEXORCIST Phase 2 — Universal CSV Log Replay, OpenDBC Signal Bit-Packing Inspector,
 * Dynamic Custom NHTSA VIN Soul Synthesizer & Virtual ELM327 Loopback Responder
 */

import {
  ALL_PID_KEYS,
  MechanicalCursePreset,
  PidKey,
  SoulProfileId,
  UNIVERSAL_PID_REGISTRY,
  VEHICLE_SOUL_PRESETS,
  VehicleArchitectureId,
  VehicleSoulPreset,
  buildCANResponseFrame,
  computeXorChecksum,
  encodeDTCString,
  parseRawCANFrame,
  toHexByte,
} from "./obd-hex-engine";

const clamp = (val: number, min: number, max: number): number => {
  if (!Number.isFinite(val)) return min;
  return Math.min(max, Math.max(min, val));
};

// ============================================================================
// 1. DYNAMIC CUSTOM VIN SOUL SYNTHESIZER (NHTSA vPIC -> LIVE 5TH VEHICLE SOUL)
// ============================================================================

export interface NhtsaDecodedVinProfile {
  vin: string;
  make: string;
  model: string;
  modelYear: string;
  bodyClass: string;
  engineInfo: string;
  fuelType: string;
  driveType: string;
  plantInfo: string;
  displacementL?: string;
  cylinders?: string;
  horsepower?: string;
}

export function buildCustomVinSoul(decoded: NhtsaDecodedVinProfile): VehicleSoulPreset {
  const cleanVin = (decoded.vin || "1HGCV1F34LA019284").trim().toUpperCase();
  const year = decoded.modelYear || "2024";
  const make = decoded.make || "OEM";
  const model = decoded.model || "CHASSIS";
  const fuelLower = (decoded.fuelType || "").toLowerCase();
  const bodyLower = (decoded.bodyClass || "").toLowerCase();
  const engineLower = (decoded.engineInfo || "").toLowerCase();

  const dispParsed = parseFloat(decoded.displacementL || "");
  const cylParsed = parseInt(decoded.cylinders || "", 10);
  const hpParsed = parseFloat(decoded.horsepower || "");

  const isEv =
    fuelLower.includes("electric") &&
    !fuelLower.includes("hybrid") &&
    (!Number.isFinite(cylParsed) || cylParsed === 0);
  const isDiesel = fuelLower.includes("diesel");
  const isTruckOrSuv =
    bodyLower.includes("truck") ||
    bodyLower.includes("pickup") ||
    bodyLower.includes("suv") ||
    bodyLower.includes("multipurpose");

  const displacementL =
    Number.isFinite(dispParsed) && dispParsed > 0
      ? dispParsed
      : isEv
      ? 0
      : isDiesel
      ? 6.6
      : 2.4;
  const cylinders =
    Number.isFinite(cylParsed) && cylParsed > 0
      ? cylParsed
      : isEv
      ? 0
      : displacementL >= 4.5
      ? 8
      : displacementL >= 2.8
      ? 6
      : 4;

  const estimatedHp =
    Number.isFinite(hpParsed) && hpParsed > 60
      ? Math.round(hpParsed)
      : isEv
      ? 455
      : isDiesel
      ? 385
      : Math.round(clamp(displacementL * 92 + cylinders * 8, 165, 580));

  const peakHealthyWhp = Math.round(estimatedHp * (isEv ? 0.92 : 0.86));
  const peakHealthyTorqueLbFt = isEv
    ? Math.round(peakHealthyWhp * 1.12)
    : isDiesel
    ? Math.round(peakHealthyWhp * 2.25)
    : Math.round(peakHealthyWhp * (displacementL >= 3.5 ? 1.04 : 0.94));

  const curbWeightKg = isEv
    ? 2160
    : isTruckOrSuv
    ? 2480
    : Math.round(clamp(1380 + cylinders * 55, 1340, 2150));
  const dragCoefficientCd = isTruckOrSuv ? 0.38 : isEv ? 0.24 : 0.29;
  const frontalAreaM2 = isTruckOrSuv ? 3.12 : 2.24;
  const redlineRpm = isEv ? 13500 : isDiesel ? 3600 : cylinders >= 8 ? 6600 : 6800;

  const isBoosted =
    engineLower.includes("turbo") ||
    engineLower.includes("supercharg") ||
    isDiesel ||
    (displacementL > 0 && displacementL <= 2.2 && estimatedHp >= 210);

  const primaryPid: PidKey = isEv
    ? "22E001"
    : isDiesel
    ? "22D100"
    : isBoosted
    ? "221140"
    : "0106";

  const engineDescriptor = isEv
    ? `HV Electric Traction Powertrain // ${estimatedHp} HP (${decoded.driveType || "AWD"})`
    : `${displacementL.toFixed(1)}L ${cylinders}-Cylinder (${decoded.fuelType || "Gasoline"}) // ${estimatedHp} HP • ${decoded.driveType || "FWD/AWD"}`;

  const baselineTelemetry: Record<PidKey, number> = {
    "010C": isEv ? 4800 : isDiesel ? 1800 : 2450,
    "010D": 88,
    "0105": isEv ? 43 : 90,
    "0106": isEv ? 0.0 : 1.2,
    "010E": isEv ? 0.0 : isDiesel ? 9.0 : 17.5,
    "0110": isEv ? 0.0 : Number((displacementL * 14.5).toFixed(1)),
    "0142": 14.28,
    "015C": isEv ? 48 : 83,
    "221140": isEv ? 0.0 : isBoosted ? 14.6 : -4.2,
    "22F40A": 7.85,
    "22E001": isEv ? 9.2 : 3.5,
    "22D100": isDiesel ? 22.0 : 1.5,
  };
  const curses = buildCustomVinCurses({
    cleanVin,
    year,
    make,
    model,
    displacementL,
    cylinders,
    isEv,
    isDiesel,
    isBoosted,
  });

  return {
    id: "CUSTOM_VIN_SOUL",
    codename: "CUSTOM_VIN_SOUL",
    yearMakeModel: `${year} ${make} ${model}`.trim(),
    engineSummary: engineDescriptor,
    defaultVin: cleanVin,
    curbWeightKg,
    dragCoefficientCd,
    frontalAreaM2,
    redlineRpm,
    peakHealthyWhp,
    peakHealthyTorqueLbFt,
    primaryPid,
    baselineTelemetry,
    curses,
  };
}

function buildCustomVinCurses(params: {
  cleanVin: string;
  year: string;
  make: string;
  model: string;
  displacementL: number;
  cylinders: number;
  isEv: boolean;
  isDiesel: boolean;
  isBoosted: boolean;
}): MechanicalCursePreset[] {
  const { cleanVin, year, make, model, displacementL, cylinders, isEv, isDiesel, isBoosted } =
    params;
  const tag = make.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "OEM";

  if (isEv) {
    return [
      {
        id: "custom-vin-hv-cell-drift",
        name: `${year} ${make} HV Pack Cell Imbalance & Contactor Derate`,
        dtcCode: "P0AA6",
        severityScore: 89,
        powerLossPct: 34,
        targetPid: "22E001",
        oemPartName: `${make} ${model} HV Battery Sub-Module & Isolation Sensor`,
        oemPartNumber: `${tag}-HV-${cleanVin.slice(-4)}`,
        estimatedCostUsd: 3650,
        laborHours: 7.5,
        recommendedUdsCommand: "31 01 E0 01 (Active BMS Shunt Cell-Balancing Routine)",
        mechanicalExplanation: `High-voltage cell group imbalance on ${year} ${make} ${model} (VIN ${cleanVin}) opens a 138.4 mV delta under load and triggers inverter torque derate.`,
        telemetryOverrides: { "22E001": 138.4, "015C": 116, "0142": 11.75 },
      },
      {
        id: "custom-vin-lv-converter-sag",
        name: `${make} DC-DC 12V Control Bus Voltage Sag`,
        dtcCode: "P0562",
        severityScore: 68,
        powerLossPct: 18,
        targetPid: "0142",
        oemPartName: `${make} Galvanic HV-to-12V Buck Converter Unit`,
        oemPartNumber: `${tag}-DC-${cleanVin.slice(9, 13)}`,
        estimatedCostUsd: 1290,
        laborHours: 2.8,
        recommendedUdsCommand: "2F F0 10 03 FF (Command Thermal Chiller Loop 100% PWM)",
        mechanicalExplanation: `Low-voltage auxiliary rail sag on ${year} ${make} ${model} drops module supply to 11.30V, inducing gateway brownout warnings.`,
        telemetryOverrides: { "0142": 11.3, "0105": 109 },
      },
    ];
  }

  if (isDiesel) {
    return [
      {
        id: "custom-vin-diesel-dpf",
        name: `${displacementL.toFixed(1)}L Diesel DPF Soot Restriction & Boost Leak`,
        dtcCode: "P2463",
        severityScore: 87,
        powerLossPct: 39,
        targetPid: "22D100",
        oemPartName: `${make} ${model} Particulate Monolith & Differential Pressure Sensor`,
        oemPartNumber: `${tag}-DPF-${cleanVin.slice(-4)}`,
        estimatedCostUsd: 2680,
        laborHours: 6.0,
        recommendedUdsCommand: "31 01 D1 00 (Stationary Active Thermal DPF Soot Exorcism)",
        mechanicalExplanation: `Excessive soot accumulation (95.2%) across the ${displacementL.toFixed(1)}L ${cylinders}-cyl exhaust aftertreatment chokes turbine enthalpy on ${year} ${make} ${model}.`,
        telemetryOverrides: { "22D100": 95.2, "221140": 6.4, "0105": 113 },
      },
      {
        id: "custom-vin-rail-starvation",
        name: `${displacementL.toFixed(1)}L Common-Rail High-Pressure Fuel Starvation`,
        dtcCode: "P0087",
        severityScore: 79,
        powerLossPct: 30,
        targetPid: "0110",
        oemPartName: `${make} High-Pressure Fuel Metering Solenoid & Rail Kit`,
        oemPartNumber: `${tag}-FPR-${cleanVin.slice(9, 13)}`,
        estimatedCostUsd: 2140,
        laborHours: 5.4,
        recommendedUdsCommand: "04 (Clear Fuel Rail Pressure Learned Trim Offsets)",
        mechanicalExplanation: `Fuel volume regulator cavitation starves the ${cylinders}-cylinder common rail under WOT grade load, cutting mass airflow and boost.`,
        telemetryOverrides: { "0110": 41.5, "221140": 7.8, "0142": 13.55 },
      },
    ];
  }

  return [
    {
      id: "custom-vin-j1979-lean-trim",
      name: `${displacementL.toFixed(1)}L ${cylinders}-Cyl Unmetered Vacuum Breach & Lean Spike`,
      dtcCode: "P0171",
      severityScore: 78,
      powerLossPct: 24,
      targetPid: isBoosted ? "221140" : "0106",
      oemPartName: `${make} ${model} ${displacementL.toFixed(1)}L PCV Breather & Intake Gasket Kit`,
      oemPartNumber: `${tag}-171-${cleanVin.slice(-4)}`,
      estimatedCostUsd: 685,
      laborHours: 3.4,
      recommendedUdsCommand: "04 (SAE J1979 Mode 04 Purge DTCs & Reset STFT/LTFT Fuel Trims)",
      mechanicalExplanation: `Ruptured crankcase breather elastomer on ${year} ${make} ${model} (${displacementL.toFixed(1)}L ${cylinders}-Cyl, VIN ${cleanVin}) draws unmetered air downstream of the MAF, pegging Bank 1 Short-Term Fuel Trim to +26.4%${isBoosted ? " and bleeding manifold boost pressure" : ""}.`,
      telemetryOverrides: {
        "0106": 26.4,
        "221140": isBoosted ? 4.2 : 0.8,
        "0105": 109,
        "010E": 3.5,
      },
    },
    {
      id: "custom-vin-ignition-misfire",
      name: `${cylinders}-Cyl Direct-Injection Coil Breakdown & Knock Retard`,
      dtcCode: "P0301",
      severityScore: 84,
      powerLossPct: 31,
      targetPid: "010E",
      oemPartName: `${make} OEM Ignition Coil Pack Set (${cylinders}x) & Iridium Spark Plugs`,
      oemPartNumber: `${tag}-301-${cleanVin.slice(9, 13)}`,
      estimatedCostUsd: 540,
      laborHours: 2.2,
      recommendedUdsCommand: "31 01 FF 0A (Reset Crankshaft Misfire Profile & Knock Table)",
      mechanicalExplanation: `Secondary winding insulation breakdown on Cylinder #1 of the ${year} ${make} ${model} (${displacementL.toFixed(1)}L) induces WOT misfire under load, pulling ignition timing to -4.5° BTDC.`,
      telemetryOverrides: {
        "010E": -4.5,
        "0106": 18.8,
        "0105": 114,
        "0142": 13.42,
      },
    },
  ];
}
// 2. SAMPLE MULTI-CAR TELEMETRY CSV GENERATOR (100 ROWS, WOT + FAULT ANOMALY)

export const CSV_HEADER_COLUMNS =
  "Timestamp_ms,CAN_ID,Raw_Hex_Frame,RPM,Speed_kmh,Coolant_C,STFT_Pct,Primary_Sensor_Actual,Primary_Sensor_Target,Voltage_V,Active_DTC";

export function resolveSoulForLog(
  soulId: SoulProfileId,
  customSoulOverride?: VehicleSoulPreset | null
): VehicleSoulPreset {
  if (soulId === "CUSTOM_VIN_SOUL" && customSoulOverride) return customSoulOverride;
  if (soulId in VEHICLE_SOUL_PRESETS) {
    return VEHICLE_SOUL_PRESETS[soulId as VehicleArchitectureId];
  }
  return customSoulOverride ?? VEHICLE_SOUL_PRESETS.GERMAN_V6_DSG;
}

export function generateSampleCSV(
  soulId: SoulProfileId,
  customSoulOverride?: VehicleSoulPreset | null
): string {
  const soul = resolveSoulForLog(soulId, customSoulOverride);
  const curse = soul.curses[0];
  const primaryPid = soul.primaryPid;
  const primaryDef = UNIVERSAL_PID_REGISTRY[primaryPid];
  const rows: string[] = [CSV_HEADER_COLUMNS];

  const idleRpm = Math.max(750, Math.round(soul.baselineTelemetry["010C"] * 0.62));
  const peakPullRpm = Math.round(soul.redlineRpm * 0.94);
  const baseSpeed = Math.max(42, Math.round(soul.baselineTelemetry["010D"] * 0.55));
  const baseCoolant = soul.baselineTelemetry["0105"];
  const baseStft = soul.baselineTelemetry["0106"];
  const baseVoltage = soul.baselineTelemetry["0142"];
  const nominalPrimary = soul.baselineTelemetry[primaryPid];
  const faultPrimary =
    curse.telemetryOverrides[primaryPid] !== undefined
      ? (curse.telemetryOverrides[primaryPid] as number)
      : nominalPrimary * 0.35;

  const pidCycle: PidKey[] = ["010C", primaryPid, "010D", primaryPid, "0105", "0106", "0142", primaryPid];
  let currentSpeed = baseSpeed;

  for (let i = 0; i < 100; i++) {
    const timestampMs = i * 100;
    let rpm: number;
    let loadFactor: number;

    if (i < 18) {
      const p = i / 17;
      rpm = idleRpm + (soul.baselineTelemetry["010C"] - idleRpm) * p;
      currentSpeed = baseSpeed + p * 12;
      loadFactor = 0.25 + 0.15 * p;
    } else if (i < 48) {
      const p = (i - 18) / 30;
      rpm = soul.baselineTelemetry["010C"] + (peakPullRpm * 0.74 - soul.baselineTelemetry["010C"]) * p;
      currentSpeed += 2.15 + 0.85 * Math.sin(p * Math.PI * 0.7);
      loadFactor = 0.88 + 0.12 * p;
    } else if (i < 82) {
      const p = (i - 48) / 33;
      const hesitation = Math.sin(i * 1.35) * (soul.redlineRpm * 0.014);
      rpm = peakPullRpm * 0.74 + (peakPullRpm * 0.93 - peakPullRpm * 0.74) * p + hesitation;
      currentSpeed += 0.95 * (1 - 0.35 * p);
      loadFactor = 1.0;
    } else {
      const p = (i - 82) / 17;
      rpm = peakPullRpm * 0.93 - (peakPullRpm * 0.93 - soul.baselineTelemetry["010C"] * 0.82) * p;
      currentSpeed = Math.max(48, currentSpeed - 2.35);
      loadFactor = 0.2 * (1 - p);
    }

    rpm = clamp(rpm, 600, UNIVERSAL_PID_REGISTRY["010C"].max);
    const speedKmh = clamp(currentSpeed, 0, 254);

    let primaryTarget = nominalPrimary;
    if (primaryPid === "221140") {
      primaryTarget = i < 18 || i >= 82 ? -2.4 + loadFactor * 8 : nominalPrimary + 3.2 * loadFactor;
    } else if (primaryPid === "22F40A") {
      primaryTarget = 3.8 + (nominalPrimary + 2.4 - 3.8) * loadFactor;
    } else if (primaryPid === "22E001") {
      primaryTarget = 6.5 + 3.5 * loadFactor;
    } else if (primaryPid === "0106") {
      primaryTarget = 0.0;
    }
    primaryTarget = clamp(primaryTarget, primaryDef.min, primaryDef.max);

    const faultActive = i >= 48;
    const blend = clamp((i - 47) / 5, 0, 1);
    const primaryActual = !faultActive
      ? clamp(
          primaryTarget + Math.sin(i * 0.55) * Math.max(primaryDef.tolerance, Math.abs(primaryTarget) * 0.015),
          primaryDef.min,
          primaryDef.max
        )
      : clamp(
          primaryTarget * (1 - blend) +
            (faultPrimary + Math.cos(i * 0.9) * Math.max(primaryDef.tolerance * 2, Math.abs(faultPrimary) * 0.03)) *
              blend,
          primaryDef.min,
          primaryDef.max
        );

    const faultCoolant = (curse.telemetryOverrides["0105"] as number | undefined) ?? baseCoolant + 16;
    const coolantC = clamp(
      faultActive
        ? baseCoolant + (faultCoolant - baseCoolant) * clamp((i - 47) / 28, 0, 1)
        : baseCoolant + (i / 48) * 3.2,
      -40,
      215
    );

    const faultStft =
      (curse.telemetryOverrides["0106"] as number | undefined) ?? (baseStft >= 0 ? baseStft + 14.5 : -16.2);
    const stftPct = clamp(
      faultActive
        ? baseStft + (faultStft - baseStft) * clamp((i - 47) / 8, 0, 1) + Math.sin(i * 0.8) * 0.9
        : baseStft + Math.sin(i * 0.45) * 1.1,
      -99,
      99
    );

    const faultVolt = (curse.telemetryOverrides["0142"] as number | undefined) ?? baseVoltage - 0.65;
    const voltageV = clamp(
      faultActive
        ? baseVoltage + (faultVolt - baseVoltage) * clamp((i - 47) / 10, 0, 1)
        : baseVoltage - loadFactor * 0.14 + Math.cos(i * 0.5) * 0.03,
      9.0,
      16.2
    );

    const activeDtc = faultActive ? curse.dtcCode : "NONE";
    const pidForRow = faultActive && i % 2 === 1 ? primaryPid : pidCycle[i % pidCycle.length];
    const valueMap: Partial<Record<PidKey, number>> = {
      "010C": rpm,
      "010D": speedKmh,
      "0105": coolantC,
      "0106": stftPct,
      "0142": voltageV,
      [primaryPid]: primaryActual,
    };
    const rawHexFrame = buildCANResponseFrame(pidForRow, valueMap[pidForRow] ?? primaryActual);

    rows.push(
      [
        timestampMs,
        "7E8",
        rawHexFrame,
        Math.round(rpm),
        Math.round(speedKmh),
        Math.round(coolantC),
        stftPct.toFixed(1),
        primaryActual.toFixed(primaryDef.decimals),
        primaryTarget.toFixed(primaryDef.decimals),
        voltageV.toFixed(2),
        activeDtc,
      ].join(",")
    );
  }

  return rows.join("\n");
}
// 3. UNIVERSAL CSV TELEMETRY PARSER (OBDeleven / VCDS / Torque Pro / HEXORCIST)

export interface TelemetryPlaybackFrame {
  index: number;
  timestampMs: number;
  canId: string;
  rawHexFrame: string;
  rpm: number;
  speedKmh: number;
  coolantC: number;
  stftPct: number;
  primarySensorActual: number;
  primarySensorTarget: number;
  voltageV: number;
  activeDtc: string;
  pidKey: PidKey;
}

function splitCsvRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseFiniteNumber(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const cleaned = raw.replace(/[^0-9eE.+\-]/g, "");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : fallback;
}

export function parseTelemetryCSV(csvText: string): TelemetryPlaybackFrame[] {
  if (typeof csvText !== "string" || !csvText.trim()) return [];

  const cleanText = csvText.replace(/^\uFEFF/, "");
  const lines = cleanText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const delimiter = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const firstCells = splitCsvRow(firstLine, delimiter);
  const looksLikeHeader = firstCells.some(
    (c) => /[A-Za-z_]/.test(c) && !/^7E[8-F]\b/i.test(c)
  );

  const headers = looksLikeHeader
    ? firstCells.map((h) => h.toLowerCase().replace(/\s+/g, "_"))
    : [];
  const dataLines = looksLikeHeader ? lines.slice(1) : lines;

  const findCol = (patterns: RegExp[]): number => {
    for (const pat of patterns) {
      const idx = headers.findIndex((h) => pat.test(h));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const colTs = findCol([/^timestamp/, /^time/, /^stamp/, /device_time/, /gps_time/]);
  const colCanId = findCol([/^can_id$/, /^arbitration/, /^id$/]);
  const colHex = findCol([/raw_hex/, /raw_can/, /hex_frame/, /can_frame/, /^frame$/]);
  const colRpm = findCol([/^rpm/, /engine_rpm/, /engine_speed/, /010c/]);
  const colSpeed = findCol([/^speed/, /vehicle_speed/, /vss/, /kmh/, /km\/h/]);
  const colCoolant = findCol([/coolant/, /^ect/, /water_temp/, /0105/]);
  const colStft = findCol([/stft/, /short_term.*trim/, /fuel_trim/]);
  const colActual = findCol([/primary_sensor_actual/, /boost.*actual/, /decoded_value/, /actual/]);
  const colTarget = findCol([/primary_sensor_target/, /boost.*target/, /specified/, /target/]);
  const colVolt = findCol([/voltage/, /vpwr/, /battery_v/, /0142/]);
  const colDtc = findCol([/active_dtc/, /^dtc/, /fault/, /trouble_code/, /^note$/]);
  const colPidKey = findCol([/^pid_key$/, /^pid$/]);
  const frames: TelemetryPlaybackFrame[] = [];
  let prevTimestampMs = -100;
  let carryRpm = 2200;
  let carrySpeed = 75;
  let carryCoolant = 90;
  let carryStft = 0.8;
  let carryActual = 8.4;
  let carryTarget = 8.4;
  let carryVolt = 14.2;

  for (let rowIdx = 0; rowIdx < dataLines.length; rowIdx++) {
    const rawLine = dataLines[rowIdx];
    const cells = splitCsvRow(rawLine, delimiter);
    if (cells.length === 0) continue;

    let tsMs = prevTimestampMs + 100;
    if (colTs >= 0 && cells[colTs] !== undefined) {
      const rawTs = parseFiniteNumber(cells[colTs], NaN);
      if (Number.isFinite(rawTs)) {
        const isSecondsFormat = cells[colTs].includes(".") && rawTs < 3600;
        tsMs = isSecondsFormat ? Math.round(rawTs * 1000) : Math.round(rawTs);
      }
    }
    if (tsMs <= prevTimestampMs && rowIdx > 0) tsMs = prevTimestampMs + 40;
    prevTimestampMs = tsMs;

    let rawHexFrame = colHex >= 0 ? (cells[colHex] ?? "").replace(/^"|"$/g, "").trim() : "";
    if (!rawHexFrame) {
      const match = rawLine.match(/7E[8-F]\s+[0-9A-Fa-f]{2}(?:\s+[0-9A-Fa-f]{2}){4,7}/i);
      if (match) rawHexFrame = match[0].toUpperCase();
    }

    const parsedCan = rawHexFrame ? parseRawCANFrame(rawHexFrame) : null;

    if (colRpm >= 0 && cells[colRpm] !== undefined) carryRpm = parseFiniteNumber(cells[colRpm], carryRpm);
    else if (parsedCan?.valid && parsedCan.pidKey === "010C" && parsedCan.value !== null) carryRpm = parsedCan.value;

    if (colSpeed >= 0 && cells[colSpeed] !== undefined) carrySpeed = parseFiniteNumber(cells[colSpeed], carrySpeed);
    else if (parsedCan?.valid && parsedCan.pidKey === "010D" && parsedCan.value !== null) carrySpeed = parsedCan.value;

    if (colCoolant >= 0 && cells[colCoolant] !== undefined) carryCoolant = parseFiniteNumber(cells[colCoolant], carryCoolant);
    else if (parsedCan?.valid && parsedCan.pidKey === "0105" && parsedCan.value !== null) carryCoolant = parsedCan.value;

    if (colStft >= 0 && cells[colStft] !== undefined) carryStft = parseFiniteNumber(cells[colStft], carryStft);
    else if (parsedCan?.valid && parsedCan.pidKey === "0106" && parsedCan.value !== null) carryStft = parsedCan.value;

    if (colActual >= 0 && cells[colActual] !== undefined) carryActual = parseFiniteNumber(cells[colActual], carryActual);
    else if (parsedCan?.valid && parsedCan.value !== null) carryActual = parsedCan.value;

    if (colTarget >= 0 && cells[colTarget] !== undefined) carryTarget = parseFiniteNumber(cells[colTarget], carryActual);
    else if (colTarget === -1) carryTarget = carryActual;

    if (colVolt >= 0 && cells[colVolt] !== undefined) carryVolt = parseFiniteNumber(cells[colVolt], carryVolt);
    else if (parsedCan?.valid && parsedCan.pidKey === "0142" && parsedCan.value !== null) carryVolt = parsedCan.value;

    let activeDtc = "NONE";
    if (colDtc >= 0 && cells[colDtc]) {
      const rawDtc = cells[colDtc].toUpperCase().trim();
      const dtcMatch = rawDtc.match(/[PCBU][0-3][0-9A-F]{3}/);
      if (dtcMatch) activeDtc = dtcMatch[0];
      else if (!["NONE", "NOMINAL", "0", "-"].includes(rawDtc)) activeDtc = rawDtc.slice(0, 12);
    }

    let pidKey: PidKey = parsedCan?.valid && parsedCan.pidKey ? parsedCan.pidKey : "010C";
    if (colPidKey >= 0 && cells[colPidKey]) {
      const candidate = cells[colPidKey].toUpperCase().trim() as PidKey;
      if (ALL_PID_KEYS.includes(candidate)) pidKey = candidate;
    }

    if (!parsedCan?.valid) {
      const cycle: Array<[PidKey, number]> = [
        ["010C", carryRpm],
        ["010D", carrySpeed],
        ["0105", carryCoolant],
        ["0106", carryStft],
        ["0142", carryVolt],
      ];
      const [synthPid, synthVal] = cycle[frames.length % cycle.length];
      pidKey = synthPid;
      rawHexFrame = buildCANResponseFrame(synthPid, synthVal);
    }

    const canId = colCanId >= 0 && cells[colCanId] ? cells[colCanId].toUpperCase() : parsedCan?.canId || "7E8";
    frames.push({
      index: frames.length,
      timestampMs: Math.max(0, tsMs),
      canId,
      rawHexFrame: rawHexFrame.toUpperCase(),
      rpm: clamp(carryRpm, 0, 16383),
      speedKmh: clamp(carrySpeed, 0, 255),
      coolantC: clamp(carryCoolant, -40, 215),
      stftPct: clamp(carryStft, -100, 99.2),
      primarySensorActual: carryActual,
      primarySensorTarget: carryTarget,
      voltageV: clamp(carryVolt, 0, 65.5),
      activeDtc,
      pidKey,
    });
  }

  return frames;
}
// 4. OPENDBC (.DBC) SIGNAL BIT-PACKING MATRICES & 64-BIT INSPECTOR ENGINE

export type DbcByteOrder = "INTEL_LE" | "MOTOROLA_BE";

export interface DbcSignalDefinition {
  name: string;
  startBit: number;
  length: number;
  byteOrder: DbcByteOrder;
  isSigned: boolean;
  scale: number;
  offset: number;
  min: number;
  max: number;
  unit: string;
  receiver: string;
  description: string;
  sgSyntax: string;
}

export interface DbcMessageMatrix {
  soulId: VehicleArchitectureId;
  dbcKey: "0B5_TCM" | "FD3S_ECU" | "BMS_HV_Status" | "J1939_EEC1";
  messageName: string;
  canIdDecimal: number;
  canIdHex: string;
  dlcBytes: 8;
  transmitterNode: string;
  protocolStandard: string;
  boSyntax: string;
  rawDbcText: string;
  defaultPayloadBytes: [number, number, number, number, number, number, number, number];
  signals: DbcSignalDefinition[];
}

export interface BitCellCoordinate {
  seqIndex: number;
  dbcBit: number;
  byteIndex: number;
  bitInByte: number;
  bitValue: 0 | 1;
}

export interface BitsExtractionPreview {
  startBit: number;
  length: number;
  byteOrder: DbcByteOrder;
  occupiedDbcBits: number[];
  cells: BitCellCoordinate[];
  binaryString: string;
  rawUnsigned: number;
  hexValue: string;
}

export function extractBitsPreview(
  byteArray: number[],
  startBit: number,
  length: number,
  byteOrder: DbcByteOrder = "INTEL_LE"
): BitsExtractionPreview {
  const safeBytes = Array.from({ length: 8 }, (_, idx) => (byteArray[idx] ?? 0) & 0xff);
  const safeStart = Math.max(0, Math.min(63, Math.floor(startBit)));
  const safeLen = Math.max(1, Math.min(64, Math.floor(length)));

  const cells: BitCellCoordinate[] = [];
  const occupiedDbcBits: number[] = [];

  if (byteOrder === "INTEL_LE") {
    let rawUnsigned = 0;
    for (let i = 0; i < safeLen; i++) {
      const dbcBit = safeStart + i;
      if (dbcBit > 63) break;
      const byteIndex = Math.floor(dbcBit / 8);
      const bitInByte = dbcBit % 8;
      const bitValue = ((safeBytes[byteIndex] >> bitInByte) & 1) as 0 | 1;
      occupiedDbcBits.push(dbcBit);
      cells.push({ seqIndex: i, dbcBit, byteIndex, bitInByte, bitValue });
      rawUnsigned += bitValue * Math.pow(2, i);
    }
    const msbToLsb = [...cells]
      .reverse()
      .map((c) => String(c.bitValue))
      .join("");
    const hexWidth = Math.max(1, Math.ceil(cells.length / 4));
    return {
      startBit: safeStart,
      length: cells.length,
      byteOrder,
      occupiedDbcBits,
      cells,
      binaryString: msbToLsb || "0",
      rawUnsigned,
      hexValue: "0x" + Math.trunc(rawUnsigned).toString(16).toUpperCase().padStart(hexWidth, "0"),
    };
  }

  let currBit = safeStart;
  let rawUnsigned = 0;
  for (let i = 0; i < safeLen; i++) {
    if (currBit < 0 || currBit > 63) break;
    const byteIndex = Math.floor(currBit / 8);
    const bitInByte = currBit % 8;
    const bitValue = ((safeBytes[byteIndex] >> bitInByte) & 1) as 0 | 1;
    occupiedDbcBits.push(currBit);
    cells.push({ seqIndex: i, dbcBit: currBit, byteIndex, bitInByte, bitValue });
    rawUnsigned = rawUnsigned * 2 + bitValue;
    currBit = bitInByte === 0 ? (byteIndex + 1) * 8 + 7 : currBit - 1;
  }
  const msbToLsb = cells.map((c) => String(c.bitValue)).join("");
  const hexWidth = Math.max(1, Math.ceil(cells.length / 4));
  return {
    startBit: safeStart,
    length: cells.length,
    byteOrder,
    occupiedDbcBits,
    cells,
    binaryString: msbToLsb || "0",
    rawUnsigned,
    hexValue: "0x" + Math.trunc(rawUnsigned).toString(16).toUpperCase().padStart(hexWidth, "0"),
  };
}

export function decodeDbcSignalEngineering(
  byteArray: number[],
  signal: DbcSignalDefinition
): {
  preview: BitsExtractionPreview;
  signedRaw: number;
  physicalValue: number;
  formattedPhysical: string;
} {
  const preview = extractBitsPreview(byteArray, signal.startBit, signal.length, signal.byteOrder);
  let signedRaw = preview.rawUnsigned;
  if (signal.isSigned && preview.length > 1) {
    const signBit = Math.pow(2, preview.length - 1);
    if (signedRaw >= signBit) signedRaw -= Math.pow(2, preview.length);
  }
  const physicalValue = signedRaw * signal.scale + signal.offset;
  const decimals = signal.scale < 0.01 ? 3 : signal.scale < 0.1 ? 2 : signal.scale < 1 ? 1 : 0;
  return {
    preview,
    signedRaw,
    physicalValue,
    formattedPhysical: `${physicalValue.toFixed(decimals)}${signal.unit ? ` ${signal.unit}` : ""}`,
  };
}

function buildRawDbcBlock(boSyntax: string, signals: DbcSignalDefinition[]): string {
  return [boSyntax, ...signals.map((s) => ` ${s.sgSyntax}`)].join("\n");
}
const DSG_SIGNALS: DbcSignalDefinition[] = [
  {
    name: "K1_Clutch_Actual_Bar",
    startBit: 0,
    length: 16,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 0.001,
    offset: 0,
    min: 0,
    max: 65.535,
    unit: "Bar",
    receiver: "Gateway_J533",
    description: "DL501 Wet-Clutch K1 Sub-Transmission Line Pressure Sensor G193",
    sgSyntax: 'SG_ K1_Clutch_Actual_Bar : 0|16@1+ (0.001,0) [0|65.535] "Bar" Gateway_J533',
  },
  {
    name: "K1_Clutch_Target_Bar",
    startBit: 16,
    length: 16,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 0.001,
    offset: 0,
    min: 0,
    max: 65.535,
    unit: "Bar",
    receiver: "Gateway_J533",
    description: "Mechatronic Solenoid N435 Commanded K1 Pressure Setpoint",
    sgSyntax: 'SG_ K1_Clutch_Target_Bar : 16|16@1+ (0.001,0) [0|65.535] "Bar" Gateway_J533',
  },
  {
    name: "Input_Shaft_Speed_RPM",
    startBit: 39,
    length: 16,
    byteOrder: "MOTOROLA_BE",
    isSigned: false,
    scale: 0.25,
    offset: 0,
    min: 0,
    max: 16383.75,
    unit: "RPM",
    receiver: "ECM_EA837",
    description: "0B5 Dual-Clutch Primary Input Shaft Hall Speed G501 (Motorola BE)",
    sgSyntax: 'SG_ Input_Shaft_Speed_RPM : 39|16@0+ (0.25,0) [0|16383.75] "RPM" ECM_EA837',
  },
  {
    name: "Mechatronic_ATF_Temp_C",
    startBit: 48,
    length: 8,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 1,
    offset: -40,
    min: -40,
    max: 215,
    unit: "degC",
    receiver: "Cluster_J285",
    description: "Mechatronic PCB & Wet-Clutch Sump Fluid Temperature G509",
    sgSyntax: 'SG_ Mechatronic_ATF_Temp_C : 48|8@1+ (1,-40) [-40|215] "degC" Cluster_J285',
  },
  {
    name: "Active_Gear_Selected",
    startBit: 56,
    length: 4,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 1,
    offset: 0,
    min: 0,
    max: 7,
    unit: "gear",
    receiver: "Cluster_J285",
    description: "Engaged DL501 Forward Gear Ratio (1..7, 0=Neutral)",
    sgSyntax: 'SG_ Active_Gear_Selected : 56|4@1+ (1,0) [0|7] "gear" Cluster_J285',
  },
  {
    name: "KissPoint_Adapt_State",
    startBit: 60,
    length: 2,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 1,
    offset: 0,
    min: 0,
    max: 3,
    unit: "state",
    receiver: "ECM_EA837",
    description: "Clutch Kiss-Point Adaptation Status (0=Locked, 2=SlipWarn)",
    sgSyntax: 'SG_ KissPoint_Adapt_State : 60|2@1+ (1,0) [0|3] "state" ECM_EA837',
  },
  {
    name: "Solenoid_Limp_Fault",
    startBit: 62,
    length: 2,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 1,
    offset: 0,
    min: 0,
    max: 3,
    unit: "flag",
    receiver: "Gateway_J533",
    description: "P17D8 Torque Limitation & Solenoid Valve Malfunction Latch",
    sgSyntax: 'SG_ Solenoid_Limp_Fault : 62|2@1+ (1,0) [0|3] "flag" Gateway_J533',
  },
];

const FD3S_SIGNALS: DbcSignalDefinition[] = [
  {
    name: "Eccentric_Shaft_RPM",
    startBit: 7,
    length: 16,
    byteOrder: "MOTOROLA_BE",
    isSigned: false,
    scale: 0.25,
    offset: 0,
    min: 0,
    max: 10000,
    unit: "RPM",
    receiver: "Dash_FD3S",
    description: "13B-REW Ne Crank Angle Sensor Eccentric Shaft Speed (Motorola BE)",
    sgSyntax: 'SG_ Eccentric_Shaft_RPM : 7|16@0+ (0.25,0) [0|10000] "RPM" Dash_FD3S',
  },
  {
    name: "Manifold_Boost_PSI",
    startBit: 16,
    length: 16,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 0.001,
    offset: -14.7,
    min: -14.7,
    max: 50.8,
    unit: "PSI",
    receiver: "Apexi_Logger",
    description: "Sequential Hitachi HT-12 Intake Plenum Gauge Pressure",
    sgSyntax: 'SG_ Manifold_Boost_PSI : 16|16@1+ (0.001,-14.7) [-14.7|50.8] "PSI" Apexi_Logger',
  },
  {
    name: "Rotor_Housing_Coolant_C",
    startBit: 32,
    length: 8,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 1,
    offset: -40,
    min: -40,
    max: 215,
    unit: "degC",
    receiver: "Dash_FD3S",
    description: "Water Pump Housing Thermosensor Coolant Temperature",
    sgSyntax: 'SG_ Rotor_Housing_Coolant_C : 32|8@1+ (1,-40) [-40|215] "degC" Dash_FD3S',
  },
  {
    name: "Leading_Spark_Adv_Deg",
    startBit: 40,
    length: 8,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 0.5,
    offset: -64,
    min: -64,
    max: 63.5,
    unit: "degBTDC",
    receiver: "Igniter_13B",
    description: "Leading Plug Coil Timing Advance (L1/L2 Split Reference)",
    sgSyntax: 'SG_ Leading_Spark_Adv_Deg : 40|8@1+ (0.5,-64) [-64|63.5] "degBTDC" Igniter_13B',
  },
  {
    name: "Rotor2_Apex_Knock_Idx",
    startBit: 48,
    length: 8,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 0.4,
    offset: 0,
    min: 0,
    max: 102,
    unit: "%",
    receiver: "PCM_13BREW",
    description: "Rear Rotor Piezo Acoustic Detonation & Apex Chatter Index",
    sgSyntax: 'SG_ Rotor2_Apex_Knock_Idx : 48|8@1+ (0.4,0) [0|102] "%" PCM_13BREW',
  },
  {
    name: "Seq_Turbo_Solenoid_Mask",
    startBit: 56,
    length: 4,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 1,
    offset: 0,
    min: 0,
    max: 15,
    unit: "mask",
    receiver: "RatsNest_IO",
    description: "Charge Control / Charge Relief / Pre-Control Solenoid Bitmask",
    sgSyntax: 'SG_ Seq_Turbo_Solenoid_Mask : 56|4@1+ (1,0) [0|15] "mask" RatsNest_IO',
  },
  {
    name: "OMP_Oil_Metering_Duty",
    startBit: 60,
    length: 4,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 6.667,
    offset: 0,
    min: 0,
    max: 100,
    unit: "%",
    receiver: "OMP_Stepper",
    description: "Trochoid Chamber Apex Seal Oil Metering Pump Stepper Command",
    sgSyntax: 'SG_ OMP_Oil_Metering_Duty : 60|4@1+ (6.667,0) [0|100] "%" OMP_Stepper',
  },
];
const BMS_HV_SIGNALS: DbcSignalDefinition[] = [
  {
    name: "HV_Pack_Bus_Voltage",
    startBit: 7,
    length: 16,
    byteOrder: "MOTOROLA_BE",
    isSigned: false,
    scale: 0.02,
    offset: 0,
    min: 0,
    max: 1000,
    unit: "V",
    receiver: "VCU_Master",
    description: "800V Traction Bus Main Contactor Link Voltage (Motorola BE)",
    sgSyntax: 'SG_ HV_Pack_Bus_Voltage : 7|16@0+ (0.02,0) [0|1000] "V" VCU_Master',
  },
  {
    name: "Module14_Cell_Delta_mV",
    startBit: 23,
    length: 16,
    byteOrder: "MOTOROLA_BE",
    isSigned: false,
    scale: 0.01,
    offset: 0,
    min: 0,
    max: 655.35,
    unit: "mV",
    receiver: "VCU_Master",
    description: "Peak-to-Min Pouch Cell Voltage Imbalance Across Sub-Pack #14",
    sgSyntax: 'SG_ Module14_Cell_Delta_mV : 23|16@0+ (0.01,0) [0|655.35] "mV" VCU_Master',
  },
  {
    name: "Rear_SiC_Phase_Current",
    startBit: 32,
    length: 16,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 0.1,
    offset: -1000,
    min: -1000,
    max: 5553.5,
    unit: "A",
    receiver: "Inv_Rear_SiC",
    description: "Rear Silicon-Carbide Inverter DC Link Current (+Disch / -Regen)",
    sgSyntax: 'SG_ Rear_SiC_Phase_Current : 32|16@1+ (0.1,-1000) [-1000|5553.5] "A" Inv_Rear_SiC',
  },
  {
    name: "Inverter_Stator_Temp_C",
    startBit: 48,
    length: 8,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 1,
    offset: -40,
    min: -40,
    max: 215,
    unit: "degC",
    receiver: "Chiller_Thermal",
    description: "Rear Hairpin Stator & SiC Power Stage Coolant Outlet Temp",
    sgSyntax: 'SG_ Inverter_Stator_Temp_C : 48|8@1+ (1,-40) [-40|215] "degC" Chiller_Thermal',
  },
  {
    name: "LV_DCDC_Rail_Volts",
    startBit: 56,
    length: 6,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 0.1,
    offset: 9.5,
    min: 9.5,
    max: 15.8,
    unit: "V",
    receiver: "Body_Gateway",
    description: "Galvanic 800V-to-12V Buck Converter Output Bus Voltage",
    sgSyntax: 'SG_ LV_DCDC_Rail_Volts : 56|6@1+ (0.1,9.5) [9.5|15.8] "V" Body_Gateway',
  },
  {
    name: "PyroFuse_Contactor_Closed",
    startBit: 62,
    length: 1,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 1,
    offset: 0,
    min: 0,
    max: 1,
    unit: "bool",
    receiver: "Safety_BMS",
    description: "HV Main Positive/Negative Contactor & Pyro-Disconnect Continuity",
    sgSyntax: 'SG_ PyroFuse_Contactor_Closed : 62|1@1+ (1,0) [0|1] "bool" Safety_BMS',
  },
  {
    name: "HV_Isolation_Fault_Latch",
    startBit: 63,
    length: 1,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 1,
    offset: 0,
    min: 0,
    max: 1,
    unit: "flag",
    receiver: "Safety_BMS",
    description: "P0AA6 High-Voltage Chassis Isolation Resistance Breach (<500 Ohm/V)",
    sgSyntax: 'SG_ HV_Isolation_Fault_Latch : 63|1@1+ (1,0) [0|1] "flag" Safety_BMS',
  },
];
const J1939_EEC1_SIGNALS: DbcSignalDefinition[] = [
  {
    name: "EngTorqueMode_SPN899",
    startBit: 0,
    length: 4,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 1,
    offset: 0,
    min: 0,
    max: 15,
    unit: "mode",
    receiver: "TCM_AS69RC",
    description: "SAE J1939 SPN 899 Engine Torque Governor Mode (3=Cruise, 14=Derate)",
    sgSyntax: 'SG_ EngTorqueMode_SPN899 : 0|4@1+ (1,0) [0|15] "mode" TCM_AS69RC',
  },
  {
    name: "Torque_Derate_Limp_Stat",
    startBit: 4,
    length: 4,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 1,
    offset: 0,
    min: 0,
    max: 15,
    unit: "stat",
    receiver: "Cab_Cluster",
    description: "Aftertreatment Soot / Rail Starvation Torque Derate Severity",
    sgSyntax: 'SG_ Torque_Derate_Limp_Stat : 4|4@1+ (1,0) [0|15] "stat" Cab_Cluster',
  },
  {
    name: "DriverDemandPctTrq_SPN512",
    startBit: 8,
    length: 8,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 1,
    offset: -125,
    min: -125,
    max: 130,
    unit: "%",
    receiver: "TCM_AS69RC",
    description: "SAE J1939 SPN 512 Pedal Requested Percent Torque",
    sgSyntax: 'SG_ DriverDemandPctTrq_SPN512 : 8|8@1+ (1,-125) [-125|130] "%" TCM_AS69RC',
  },
  {
    name: "ActualEngPctTorque_SPN513",
    startBit: 16,
    length: 8,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 1,
    offset: -125,
    min: -125,
    max: 130,
    unit: "%",
    receiver: "TCM_AS69RC",
    description: "SAE J1939 SPN 513 Net Crankshaft Delivered Percent Torque",
    sgSyntax: 'SG_ ActualEngPctTorque_SPN513 : 16|8@1+ (1,-125) [-125|130] "%" TCM_AS69RC',
  },
  {
    name: "EngSpeed_SPN190",
    startBit: 24,
    length: 16,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 0.125,
    offset: 0,
    min: 0,
    max: 8031.875,
    unit: "RPM",
    receiver: "TCM_AS69RC",
    description: "SAE J1939 SPN 190 6.7L Cummins Crankshaft Speed (0.125 RPM/bit)",
    sgSyntax: 'SG_ EngSpeed_SPN190 : 24|16@1+ (0.125,0) [0|8031.875] "RPM" TCM_AS69RC',
  },
  {
    name: "DPF_Monolith_Soot_Pct",
    startBit: 40,
    length: 8,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 0.392157,
    offset: 0,
    min: 0,
    max: 100,
    unit: "%",
    receiver: "Aftertreatment",
    description: "Cordierite Diesel Particulate Filter Soot Mass Loading Ratio",
    sgSyntax: 'SG_ DPF_Monolith_Soot_Pct : 40|8@1+ (0.392157,0) [0|100] "%" Aftertreatment',
  },
  {
    name: "Holset_VGT_Vane_Pos_Pct",
    startBit: 48,
    length: 8,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 0.4,
    offset: 0,
    min: 0,
    max: 102,
    unit: "%",
    receiver: "VGT_SmartAct",
    description: "Variable Geometry Turbocharger Sliding Nozzle Position",
    sgSyntax: 'SG_ Holset_VGT_Vane_Pos_Pct : 48|8@1+ (0.4,0) [0|102] "%" VGT_SmartAct',
  },
  {
    name: "Exhaust_Backpressure_PSI",
    startBit: 56,
    length: 8,
    byteOrder: "INTEL_LE",
    isSigned: false,
    scale: 0.25,
    offset: 0,
    min: 0,
    max: 63.75,
    unit: "PSI",
    receiver: "Aftertreatment",
    description: "Pre-Turbine / Pre-DPF Exhaust Manifold Gauge Backpressure",
    sgSyntax: 'SG_ Exhaust_Backpressure_PSI : 56|8@1+ (0.25,0) [0|63.75] "PSI" Aftertreatment',
  },
];
export const SAMPLE_DBC_MATRICES: Record<VehicleArchitectureId, DbcMessageMatrix> = {
  GERMAN_V6_DSG: {
    soulId: "GERMAN_V6_DSG",
    dbcKey: "0B5_TCM",
    messageName: "0B5_TCM",
    canIdDecimal: 1088,
    canIdHex: "0x440",
    dlcBytes: 8,
    transmitterNode: "TCU_DL501",
    protocolStandard: "VAG Antriebs-CAN 500kbps (11-bit)",
    boSyntax: "BO_ 1088 0B5_TCM: 8 TCU_DL501",
    rawDbcText: buildRawDbcBlock("BO_ 1088 0B5_TCM: 8 TCU_DL501", DSG_SIGNALS),
    defaultPayloadBytes: [0x2e, 0x09, 0x02, 0x21, 0x31, 0xb0, 0xa7, 0xe4],
    signals: DSG_SIGNALS,
  },
  JDM_TWIN_ROTARY: {
    soulId: "JDM_TWIN_ROTARY",
    dbcKey: "FD3S_ECU",
    messageName: "FD3S_ECU",
    canIdDecimal: 784,
    canIdHex: "0x310",
    dlcBytes: 8,
    transmitterNode: "PCM_13BREW",
    protocolStandard: "JDM Motorsport CAN Bridge 500kbps (11-bit)",
    boSyntax: "BO_ 784 FD3S_ECU: 8 PCM_13BREW",
    rawDbcText: buildRawDbcBlock("BO_ 784 FD3S_ECU: 8 PCM_13BREW", FD3S_SIGNALS),
    defaultPayloadBytes: [0x46, 0x50, 0x88, 0x45, 0x9e, 0x79, 0xcd, 0xc9],
    signals: FD3S_SIGNALS,
  },
  AWD_800V_EV: {
    soulId: "AWD_800V_EV",
    dbcKey: "BMS_HV_Status",
    messageName: "BMS_HV_Status",
    canIdDecimal: 658,
    canIdHex: "0x292",
    dlcBytes: 8,
    transmitterNode: "BMS_800V",
    protocolStandard: "ISO 11898-2 High-Voltage Powertrain CAN 500kbps",
    boSyntax: "BO_ 658 BMS_HV_Status: 8 BMS_800V",
    rawDbcText: buildRawDbcBlock("BO_ 658 BMS_HV_Status: 8 BMS_800V", BMS_HV_SIGNALS),
    defaultPayloadBytes: [0x9a, 0xc4, 0x3a, 0x0c, 0xaa, 0x37, 0x9f, 0xd6],
    signals: BMS_HV_SIGNALS,
  },
  HEAVY_DIESEL_TOW: {
    soulId: "HEAVY_DIESEL_TOW",
    dbcKey: "J1939_EEC1",
    messageName: "J1939_EEC1",
    canIdDecimal: 217056256,
    canIdHex: "0x0CF00400",
    dlcBytes: 8,
    transmitterNode: "ECM_67HO",
    protocolStandard: "SAE J1939-71 29-Bit Extended CAN (PGN 61444) 250kbps",
    boSyntax: "BO_ 217056256 J1939_EEC1: 8 ECM_67HO",
    rawDbcText: buildRawDbcBlock("BO_ 217056256 J1939_EEC1: 8 ECM_67HO", J1939_EEC1_SIGNALS),
    defaultPayloadBytes: [0x9e, 0xdc, 0xb5, 0x30, 0x43, 0xf6, 0xdc, 0xa8],
    signals: J1939_EEC1_SIGNALS,
  },
};

const writeU16LE = (val: number): [number, number] => {
  const v = clamp(Math.round(val), 0, 65535);
  return [v & 0xff, (v >> 8) & 0xff];
};

const writeU16BE = (val: number): [number, number] => {
  const v = clamp(Math.round(val), 0, 65535);
  return [(v >> 8) & 0xff, v & 0xff];
};

export function buildLiveDbcPayloadBytes(
  matrixId: VehicleArchitectureId,
  telemetry: Record<PidKey, number>,
  hasActiveFault: boolean
): [number, number, number, number, number, number, number, number] {
  const rpm = telemetry["010C"] ?? 2400;
  const ect = telemetry["0105"] ?? 90;
  const spark = telemetry["010E"] ?? 14;
  const vpwr = telemetry["0142"] ?? 14.2;
  const tft = telemetry["015C"] ?? 84;
  const boost = telemetry["221140"] ?? 11.5;
  const clutchBar = telemetry["22F40A"] ?? 8.45;
  const cellDv = telemetry["22E001"] ?? 8.5;
  const sootPct = telemetry["22D100"] ?? 24.0;

  if (matrixId === "GERMAN_V6_DSG") {
    const [k1Lo, k1Hi] = writeU16LE(clutchBar * 1000);
    const [tLo, tHi] = writeU16LE(8.45 * 1000);
    const [rpmHi, rpmLo] = writeU16BE(rpm * 4);
    const atfByte = clamp(Math.round(tft + 40), 0, 255);
    const gear = clamp(Math.floor(rpm / 1050) + 2, 1, 7) & 0x0f;
    const kiss = hasActiveFault ? 2 : 1;
    const limp = hasActiveFault ? 3 : 0;
    return [k1Lo, k1Hi, tLo, tHi, rpmHi, rpmLo, atfByte, (gear | (kiss << 4) | (limp << 6)) & 0xff];
  }

  if (matrixId === "JDM_TWIN_ROTARY") {
    const [rpmHi, rpmLo] = writeU16BE(rpm * 4);
    const [bLo, bHi] = writeU16LE((boost + 14.7) * 1000);
    const ectByte = clamp(Math.round(ect + 40), 0, 255);
    const sparkByte = clamp(Math.round((spark + 64) * 2), 0, 255);
    const knockByte = clamp(Math.round((hasActiveFault ? 82 : 14) / 0.4), 0, 255);
    const mask = hasActiveFault ? 0x09 : 0x0f;
    const omp = clamp(Math.round((rpm / 8000) * 15), 2, 15) & 0x0f;
    return [rpmHi, rpmLo, bLo, bHi, ectByte, sparkByte, knockByte, (mask | (omp << 4)) & 0xff];
  }

  if (matrixId === "AWD_800V_EV") {
    const packVolts = hasActiveFault ? 774.2 : 806.4;
    const [vHi, vLo] = writeU16BE(packVolts / 0.02);
    const [dvHi, dvLo] = writeU16BE(cellDv * 100);
    const currentA = hasActiveFault ? 285.0 : 440.0;
    const [iLo, iHi] = writeU16LE((currentA + 1000) * 10);
    const invTempByte = clamp(Math.round(tft + 40), 0, 255);
    const lvRaw = clamp(Math.round((vpwr - 9.5) / 0.1), 0, 63) & 0x3f;
    const b7 = lvRaw | (1 << 6) | ((hasActiveFault ? 1 : 0) << 7);
    return [vHi, vLo, dvHi, dvLo, iLo, iHi, invTempByte, b7 & 0xff];
  }

  const mode = hasActiveFault ? 14 : 3;
  const derate = hasActiveFault ? 9 : 0;
  const b0 = (mode & 0x0f) | ((derate & 0x0f) << 4);
  const demandByte = clamp(Math.round(92 + 125), 0, 255);
  const actualByte = clamp(Math.round((hasActiveFault ? 54 : 89) + 125), 0, 255);
  const [rpmLo, rpmHi] = writeU16LE(rpm * 8);
  const sootByte = clamp(Math.round((sootPct * 255) / 100), 0, 255);
  const vgtByte = clamp(Math.round((hasActiveFault ? 92 : 56) / 0.4), 0, 255);
  const backPByte = clamp(Math.round((hasActiveFault ? 43.5 : 16.0) / 0.25), 0, 255);
  return [b0, demandByte, actualByte, rpmLo, rpmHi, sootByte, vgtByte, backPByte];
}
// 5. VIRTUAL LOOPBACK COM PORT ELM327 AT & HEX COMMAND RESPONDER

export interface Elm327CommandContext {
  telemetry: Record<PidKey, number>;
  activeDtc: string | null;
  vin: string;
  soulCodename: string;
}

export interface Elm327CommandResult {
  txCommand: string;
  rxLines: string[];
  annotation: string;
  ingestedCanFrame?: string;
  clearedFaults?: boolean;
}

export const ELM327_HANDSHAKE_STEPS: Array<{
  cmd: string;
  rx: string;
  desc: string;
}> = [
  { cmd: "ATZ", rx: "ELM327 v2.3 [HEXORCIST ISO-TP BRIDGE]", desc: "Cold Reset ELM327 Transceiver UART" },
  { cmd: "ATE0", rx: "OK", desc: "Disable Host Serial Character Echo" },
  { cmd: "ATL0", rx: "OK", desc: "Suppress Extra Linefeeds for High-Speed Framing" },
  { cmd: "ATH1", rx: "OK", desc: "Enable 11-Bit / 29-Bit CAN Arbitration Headers (7E8)" },
  { cmd: "ATSP6", rx: "OK", desc: "Lock Protocol 6 -> ISO 15765-4 CAN (11-bit ID, 500 kbaud)" },
];

export function processVirtualElm327Command(
  rawInput: string,
  ctx: Elm327CommandContext
): Elm327CommandResult {
  const txCommand = rawInput.trim().toUpperCase();
  const compact = txCommand.replace(/\s+/g, "");

  if (!compact) {
    return { txCommand: "", rxLines: [">"], annotation: "Ready prompt" };
  }
  if (compact === "ATZ") {
    return {
      txCommand,
      rxLines: ["ELM327 v2.3 [HEXORCIST VIRTUAL LOOPBACK]"],
      annotation: "Transceiver reset complete @ 38,400 baud",
    };
  }
  if (compact === "ATI") {
    return {
      txCommand,
      rxLines: ["ELM327 v2.3 // STN2120 CAN-FD Ready"],
      annotation: "Adapter silicon identification",
    };
  }
  if (compact === "ATRV") {
    const volts = (ctx.telemetry["0142"] ?? 14.2).toFixed(2);
    return {
      txCommand,
      rxLines: [`${volts}V`],
      annotation: "OBD-II Pin 16 Battery Supply Voltage",
    };
  }
  if (compact === "ATDP" || compact === "ATDPN") {
    return {
      txCommand,
      rxLines: [compact === "ATDPN" ? "A6" : "AUTO, ISO 15765-4 (CAN 11/500)"],
      annotation: "Active OBD-II physical layer protocol",
    };
  }
  if (/^AT(E0|E1|L0|L1|H0|H1|S0|S1|SP[0-9A-C]|AL|CAF0|CAF1)$/.test(compact)) {
    return {
      txCommand,
      rxLines: ["OK"],
      annotation: `ELM327 configuration register ${compact} acknowledged`,
    };
  }
  if (compact === "03") {
    if (!ctx.activeDtc || ctx.activeDtc === "NONE") {
      const payload = [0x02, 0x43, 0x00];
      return {
        txCommand,
        rxLines: [`7E8 02 43 00 ${toHexByte(computeXorChecksum(payload))}`],
        annotation: "Mode 03 -> 0 Stored Emission/Powertrain DTCs (Nominal)",
      };
    }
    try {
      const [bA, bB] = encodeDTCString(ctx.activeDtc);
      const payload = [0x04, 0x43, 0x01, bA, bB];
      return {
        txCommand,
        rxLines: [
          `7E8 04 43 01 ${toHexByte(bA)} ${toHexByte(bB)} ${toHexByte(computeXorChecksum(payload))}`,
        ],
        annotation: `Mode 03 -> 1 Active DTC Decoded: ${ctx.activeDtc} (SAE J2012 [0x${toHexByte(bA)}, 0x${toHexByte(bB)}])`,
      };
    } catch {
      return { txCommand, rxLines: ["7E8 02 43 00 41"], annotation: "Mode 03 -> Stored DTC table read" };
    }
  }
  if (compact === "04") {
    return {
      txCommand,
      rxLines: ["7E8 01 44 45"],
      annotation: "Mode 04 Positive Response (0x44) -> Fault memory & fuel trims purged!",
      clearedFaults: true,
    };
  }
  if (compact === "0902") {
    const vinBytes = ctx.vin
      .padEnd(17, "0")
      .slice(0, 17)
      .split("")
      .map((c) => toHexByte(c.charCodeAt(0)));
    return {
      txCommand,
      rxLines: [
        `7E8 10 14 49 02 01 ${vinBytes.slice(0, 3).join(" ")}`,
        `7E8 21 ${vinBytes.slice(3, 10).join(" ")}`,
        `7E8 22 ${vinBytes.slice(10, 17).join(" ")}`,
      ],
      annotation: `Mode 09 PID 02 ISO-TP Multi-Frame VIN -> ${ctx.vin} (${ctx.soulCodename})`,
    };
  }
  if (ALL_PID_KEYS.includes(compact as PidKey)) {
    const pidKey = compact as PidKey;
    const def = UNIVERSAL_PID_REGISTRY[pidKey];
    const currentVal = ctx.telemetry[pidKey] ?? (def.min + def.max) / 2;
    const canFrame = buildCANResponseFrame(pidKey, currentVal);
    return {
      txCommand,
      rxLines: [canFrame],
      annotation: `${def.name} (${pidKey}) => ${currentVal.toFixed(def.decimals)} ${def.unit}`,
      ingestedCanFrame: canFrame,
    };
  }
  if (compact === "0100") {
    return {
      txCommand,
      rxLines: ["7E8 06 41 00 BE 3F A8 13 C9"],
      annotation: "Mode 01 PID 00 -> Supported SAE J1979 PIDs [01..20] Bitmask",
    };
  }
  if (compact === "1003") {
    return {
      txCommand,
      rxLines: ["7E8 06 50 03 00 32 01 F4 9A"],
      annotation: "ISO 14229 DiagnosticSessionControl -> ExtendedSession (0x03) Unlocked",
    };
  }

  const sidHex = /^[0-9A-F]{2}/.test(compact) ? compact.slice(0, 2) : "01";
  return {
    txCommand,
    rxLines: [`7E8 03 7F ${sidHex} 12`],
    annotation: `ISO 14229 NRC 0x12 (Sub-Function / PID Not Supported for '${txCommand}')`,
  };
}

