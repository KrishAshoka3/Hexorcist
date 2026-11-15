/**
 * HEXORCIST Phase 6 — Universal "Enter Your Own Car" Builder,
 * 3 One-Click Real-World Vehicle Presets & Interactive Driving / Wear Stress Simulator
 */

import {
  ALL_PID_KEYS,
  MechanicalCursePreset,
  PidKey,
  SoulProfileId,
  UNIVERSAL_PID_REGISTRY,
  VEHICLE_SOUL_PRESETS,
  VehicleSoulPreset,
} from "./obd-hex-engine";
import { lookupUniversalDtc } from "./obd-scanner-qol";
import { validateDtcCode, validateVin } from "./work-order-validator";
import {
  formatBrandOemPartNumber,
  getValidFaultPoolForVehicle,
  normalizeVehicleDescriptor,
} from "./vehicle-fault-generator";

export type UserPowertrainType =
  | "Standard Gas"
  | "Turbo / Supercharged"
  | "Hybrid"
  | "Full Electric (EV)";

export type UserTransmissionType =
  | "Standard Automatic"
  | "Dual-Clutch (DSG / DCT)"
  | "Manual"
  | "CVT"
  | "EV Single-Speed";

export type UserSymptomOption =
  | "NONE"
  | "CHECK_ENGINE_LIGHT"
  | "ROUGH_SHIFTING"
  | "POOR_GAS_MILEAGE"
  | "BATTERY_ELECTRICAL";

export interface UserCustomCarConfig {
  yearMakeModel: string;
  powertrainType: UserPowertrainType;
  transmissionType: UserTransmissionType;
  symptomOption: UserSymptomOption;
  customObdCode: string;
  vin?: string;
}

export interface CustomCarBuildBundle {
  config: UserCustomCarConfig;
  soul: VehicleSoulPreset;
  normalizedVin: string;
  activeFaultOnLoad: boolean;
  primaryDtc: string;
  fairCostUsd: number;
  dealerQuoteUsd: number;
}

export type QuickVehiclePresetId =
  | "PRESET_2014_V6_DSG"
  | "PRESET_2024_AWD_EV"
  | "PRESET_2020_COMMUTER";

export interface QuickVehiclePresetSpec {
  id: QuickVehiclePresetId;
  emoji: string;
  shortTitle: string;
  buttonLabel: string;
  faultPairLabel: string;
  faultPlainName: string;
  costSummaryLabel: string;
  fairCostUsd: number;
  dealerQuoteUsd: number;
  primaryDtc: string;
  companionDtc: string;
  underlyingSoulId: SoulProfileId;
  soul: VehicleSoulPreset;
}

export interface DrivingStressSlidersState {
  drivingLoadRpm: number; // 800 - 6,800 RPM
  heatTempC: number; // 75 - 135 °C
  partWearPct: number; // 0 - 100 %
}

export interface DrivingStressEvaluation {
  telemetry: Record<PidKey, number>;
  scopeTarget: number;
  scopeActual: number;
  stressAnomalyScore: number;
  warnings: string[];
  isOverheating: boolean;
  isHighLoad: boolean;
  isFailingWear: boolean;
}

export const CUSTOM_CAR_STORAGE_KEY = "hexorcist_user_custom_car_v1";

export const DEFAULT_DRIVING_SLIDERS: DrivingStressSlidersState = {
  drivingLoadRpm: 2350,
  heatTempC: 90,
  partWearPct: 0,
};

export const EXAMPLE_USER_CARS: ReadonlyArray<{
  label: string;
  yearMakeModel: string;
  powertrainType: UserPowertrainType;
  transmissionType: UserTransmissionType;
  symptomOption: UserSymptomOption;
  customObdCode: string;
}> = [
  {
    label: "2019 BMW M340i",
    yearMakeModel: "2019 BMW M340i",
    powertrainType: "Turbo / Supercharged",
    transmissionType: "Standard Automatic",
    symptomOption: "CHECK_ENGINE_LIGHT",
    customObdCode: "P0300",
  },
  {
    label: "2021 Subaru WRX",
    yearMakeModel: "2021 Subaru WRX",
    powertrainType: "Turbo / Supercharged",
    transmissionType: "Manual",
    symptomOption: "POOR_GAS_MILEAGE",
    customObdCode: "P0171",
  },
  {
    label: "2018 Ford F-150",
    yearMakeModel: "2018 Ford F-150",
    powertrainType: "Turbo / Supercharged",
    transmissionType: "Standard Automatic",
    symptomOption: "ROUGH_SHIFTING",
    customObdCode: "P0750",
  },
  {
    label: "2022 Toyota RAV4",
    yearMakeModel: "2022 Toyota RAV4",
    powertrainType: "Hybrid",
    transmissionType: "CVT",
    symptomOption: "CHECK_ENGINE_LIGHT",
    customObdCode: "P0420",
  },
];

export const SYMPTOM_PICKER_OPTIONS: ReadonlyArray<{
  id: UserSymptomOption;
  label: string;
  helper: string;
}> = [
  {
    id: "NONE",
    label: "No Problem Yet (Healthy Checkup)",
    helper: "Loads 100% healthy green sensors so you can test sliders freely",
  },
  {
    id: "CHECK_ENGINE_LIGHT",
    label: "Check Engine Light On",
    helper: "Simulates combustion misfire / catalyst efficiency fault",
  },
  {
    id: "ROUGH_SHIFTING",
    label: "Rough Shifting / Jerking",
    helper: "Simulates transmission valve / clutch pressure slip (P0750)",
  },
  {
    id: "POOR_GAS_MILEAGE",
    label: "Poor Gas Mileage",
    helper: "Simulates intake vacuum leak & lean fuel trim (P0171)",
  },
  {
    id: "BATTERY_ELECTRICAL",
    label: "Battery / Electrical Warning",
    helper: "Simulates 12V charging sag or EV high-voltage contactor alert",
  },
];

const ISO_VIN_ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"; // Excludes I, O, Q per ISO 3779

const clampNum = (val: number, min: number, max: number): number => {
  if (!Number.isFinite(val)) return min;
  return Math.min(max, Math.max(min, val));
};

/**
 * Generates or normalizes a deterministic 17-character ISO 3779 compliant VIN
 * (uppercase A-Z0-9, never containing I, O, or Q) so users don't need a VIN!
 */
export function synthesizeValidIsoVin(yearMakeModel: string, candidateVin?: string): string {
  if (candidateVin) {
    const cleaned = candidateVin.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const sanitized = cleaned
      .replace(/I/g, "1")
      .replace(/O/g, "0")
      .replace(/Q/g, "9");
    if (sanitized.length === 17 && validateVin(sanitized).valid) {
      return sanitized;
    }
  }

  const lower = (yearMakeModel || "2022 Custom Driver Vehicle").toLowerCase();
  const wmi = lower.includes("bmw")
    ? "WBA"
    : lower.includes("subaru")
    ? "JF1"
    : lower.includes("ford")
    ? "1FT"
    : lower.includes("toyota") || lower.includes("lexus")
    ? "JTM"
    : lower.includes("honda") || lower.includes("acura")
    ? "1HG"
    : lower.includes("tesla")
    ? "5YJ"
    : lower.includes("audi") || lower.includes("vw") || lower.includes("volkswagen")
    ? "WAU"
    : lower.includes("chevy") || lower.includes("chevrolet") || lower.includes("gmc")
    ? "1GC"
    : lower.includes("hyundai") || lower.includes("kia")
    ? "5NM"
    : "1HX";

  let hash = 2166136261;
  const seed = (yearMakeModel || "HEXORCIST").trim().toUpperCase();
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  let body = "";
  for (let i = 0; i < 14; i++) {
    const idx = Math.abs((hash >>> (i % 16)) + i * 31 + seed.length * 7) % ISO_VIN_ALPHABET.length;
    body += ISO_VIN_ALPHABET[idx];
    hash = Math.imul(hash ^ (i + 17), 2246822519);
  }

  const result = `${wmi}${body}`.slice(0, 17);
  return validateVin(result).valid ? result : "1HGCV1F34LA019284";
}

export function resolveDefaultDtcForSymptom(
  symptom: UserSymptomOption,
  powertrain: UserPowertrainType
): string {
  const isEv = powertrain === "Full Electric (EV)";
  switch (symptom) {
    case "ROUGH_SHIFTING":
      return isEv ? "U0100" : "P0750";
    case "POOR_GAS_MILEAGE":
      return isEv ? "P0AA6" : "P0171";
    case "BATTERY_ELECTRICAL":
      return isEv || powertrain === "Hybrid" ? "P0AA6" : "P0562";
    case "CHECK_ENGINE_LIGHT":
      return isEv ? "U0100" : powertrain === "Turbo / Supercharged" ? "P0300" : "P0420";
    case "NONE":
    default:
      return isEv ? "U0100" : "P0420";
  }
}

function buildCurseForUserSelection(params: {
  yearMakeModel: string;
  vin: string;
  powertrainType: UserPowertrainType;
  transmissionType: UserTransmissionType;
  dtcCode: string;
  primaryPid: PidKey;
}): { curse: MechanicalCursePreset; dealerQuoteUsd: number } {
  const { yearMakeModel, vin, powertrainType, transmissionType, dtcCode, primaryPid } = params;
  const upperCode = validateDtcCode(dtcCode).valid
    ? dtcCode.trim().toUpperCase()
    : resolveDefaultDtcForSymptom("CHECK_ENGINE_LIGHT", powertrainType);
  const lookup = lookupUniversalDtc(upperCode);
  const tag = yearMakeModel.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "OEM";

  if (upperCode === "P0750" || upperCode === "P17D8" || upperCode.startsWith("P07")) {
    const isDct = transmissionType === "Dual-Clutch (DSG / DCT)";
    return {
      dealerQuoteUsd: isDct ? 2450 : 1790,
      curse: {
        id: `custom-${upperCode.toLowerCase()}`,
        name: `${transmissionType} Shift Solenoid & Pressure Drift (${upperCode})`,
        dtcCode: upperCode,
        severityScore: 84,
        powerLossPct: 26,
        targetPid: "22F40A",
        oemPartName: `${yearMakeModel} ${transmissionType} Solenoid & Sensor Kit`,
        oemPartNumber: `${tag}-750-${vin.slice(-4)}`,
        estimatedCostUsd: isDct ? 1480 : 960,
        laborHours: isDct ? 6.5 : 4.2,
        recommendedUdsCommand: "31 01 F4 0A (Transmission Solenoid & Clutch Adaptation Reset)",
        mechanicalExplanation: `On your ${yearMakeModel} (${transmissionType}), hydraulic shift valve pressure drops to 2.45 Bar under load, causing jerky shifts and rising fluid heat.`,
        telemetryOverrides: { "22F40A": 2.45, "015C": 122, "010C": 3100 },
      },
    };
  }

  if (upperCode === "P0AA6" || upperCode === "U0100" || powertrainType === "Full Electric (EV)") {
    return {
      dealerQuoteUsd: 2100,
      curse: {
        id: `custom-${upperCode.toLowerCase()}`,
        name: `${yearMakeModel} HV Battery Contactor Fault (${upperCode})`,
        dtcCode: upperCode,
        severityScore: 86,
        powerLossPct: 30,
        targetPid: powertrainType === "Full Electric (EV)" ? "22E001" : "0142",
        oemPartName: `${yearMakeModel} High-Voltage Contactor & Relay Assembly`,
        oemPartNumber: `${tag}-HV-${vin.slice(-4)}`,
        estimatedCostUsd: 1120,
        laborHours: 3.5,
        recommendedUdsCommand: "31 01 E0 01 (HV Contactor Continuity & BMS Balancing)",
        mechanicalExplanation: `On your ${yearMakeModel} (${powertrainType}), HV contactor resistance and 12V rail sag triggered ${upperCode} (${lookup.title}), derating peak drive output.`,
        telemetryOverrides: { "22E001": 134.0, "0142": 11.45, "015C": 112 },
      },
    };
  }

  if (upperCode === "P0171" || upperCode === "P0174") {
    const isBoosted = powertrainType === "Turbo / Supercharged";
    return {
      dealerQuoteUsd: isBoosted ? 1180 : 980,
      curse: {
        id: `custom-${upperCode.toLowerCase()}`,
        name: `${yearMakeModel} Intake Air Leak / Lean Fuel Trim (${upperCode})`,
        dtcCode: upperCode,
        severityScore: 68,
        powerLossPct: 17,
        targetPid: "0106",
        oemPartName: `${yearMakeModel} OEM PCV Valve & Intake Duct Seal Kit`,
        oemPartNumber: `${tag}-171-${vin.slice(-4)}`,
        estimatedCostUsd: isBoosted ? 540 : 420,
        laborHours: isBoosted ? 2.4 : 1.8,
        recommendedUdsCommand: "04 (Clear Learned Fuel Trims & Reset Check Engine Light)",
        mechanicalExplanation: `Unmetered air entering your ${yearMakeModel} (${powertrainType}) forces Short-Term Fuel Trim above +24.8% and hurts gas mileage.`,
        telemetryOverrides: { "0106": 24.8, "221140": isBoosted ? 5.1 : -1.5, "0105": 103 },
      },
    };
  }

  const isMisfire = upperCode.startsWith("P030");
  const fairCost = isMisfire ? 490 : upperCode === "P0562" ? 580 : upperCode === "P0420" ? 680 : 620;
  return {
    dealerQuoteUsd: isMisfire ? 1090 : upperCode === "P0562" ? 1150 : 1480,
    curse: {
      id: `custom-${upperCode.toLowerCase()}`,
      name: `${yearMakeModel} — ${lookup.title} (${upperCode})`,
      dtcCode: upperCode,
      severityScore: lookup.severity === "CRITICAL" ? 86 : lookup.severity === "MODERATE" ? 72 : 56,
      powerLossPct: lookup.severity === "CRITICAL" ? 28 : 15,
      targetPid: upperCode === "P0562" ? "0142" : primaryPid,
      oemPartName: isMisfire
        ? `${yearMakeModel} OEM Ignition Coil Pack & Iridium Plug Kit`
        : `${yearMakeModel} Verified OEM Replacement Assembly (${upperCode})`,
      oemPartNumber: `${tag}-${upperCode.slice(1)}-${vin.slice(-3)}`,
      estimatedCostUsd: fairCost,
      laborHours: 2.2,
      recommendedUdsCommand: "04 (Clear Confirmed/Pending DTCs & Reset MIL)",
      mechanicalExplanation: `[${yearMakeModel} • ${powertrainType} • ${transmissionType}] ${lookup.plainEnglish}`,
      telemetryOverrides:
        upperCode === "P0562"
          ? { "0142": 11.45, "0105": 101 }
          : { "010E": -3.5, "0106": 19.2, "0105": 109 },
    },
  };
}

export function buildUserCustomCarBundle(rawConfig: UserCustomCarConfig): CustomCarBuildBundle {
  const cleanName = (rawConfig.yearMakeModel || "2022 Toyota RAV4").trim() || "2022 Toyota RAV4";
  const isEv = rawConfig.powertrainType === "Full Electric (EV)";
  const isBoosted = rawConfig.powertrainType === "Turbo / Supercharged";
  const isHybrid = rawConfig.powertrainType === "Hybrid";
  const isDsg = rawConfig.transmissionType === "Dual-Clutch (DSG / DCT)";

  const normalizedVin = synthesizeValidIsoVin(cleanName, rawConfig.vin);
  const trimmedCustomCode = (rawConfig.customObdCode || "").trim().toUpperCase();
  const hasExplicitValidCode = validateDtcCode(trimmedCustomCode).valid;
  const activeFaultOnLoad = rawConfig.symptomOption !== "NONE" || hasExplicitValidCode;

  const primaryDtc = hasExplicitValidCode
    ? trimmedCustomCode
    : resolveDefaultDtcForSymptom(rawConfig.symptomOption, rawConfig.powertrainType);

  const primaryPid: PidKey = isEv
    ? "22E001"
    : isDsg || primaryDtc.startsWith("P07") || primaryDtc === "P17D8"
    ? "22F40A"
    : isBoosted
    ? "221140"
    : "0106";

  const peakHealthyWhp = isEv ? 410 : isBoosted ? 315 : isHybrid ? 218 : 195;
  const peakHealthyTorqueLbFt = isEv ? 445 : isBoosted ? 320 : isHybrid ? 205 : 184;
  const lowerName = cleanName.toLowerCase();
  const isTruckOrSuv =
    lowerName.includes("f-150") ||
    lowerName.includes("rav4") ||
    lowerName.includes("suv") ||
    lowerName.includes("truck") ||
    lowerName.includes("crossover");

  const baselineTelemetry: Record<PidKey, number> = {
    "010C": isEv ? 4600 : 2250,
    "010D": 86,
    "0105": isEv ? 42 : 89,
    "0106": isEv ? 0.0 : 1.1,
    "010E": isEv ? 0.0 : 16.5,
    "0110": isEv ? 0.0 : isBoosted ? 41.2 : 28.4,
    "0142": 14.25,
    "015C": isEv ? 47 : 82,
    "221140": isEv ? 0.0 : isBoosted ? 14.8 : -3.8,
    "22F40A": isDsg ? 8.45 : 7.6,
    "22E001": isEv || isHybrid ? 8.8 : 3.0,
    "22D100": 1.8,
  };

  const validPool = getValidFaultPoolForVehicle({
    yearMakeModel: cleanName,
    powertrain: rawConfig.powertrainType,
    transmission: rawConfig.transmissionType,
  });
  const normalizedVehicle = normalizeVehicleDescriptor({
    yearMakeModel: cleanName,
    powertrain: rawConfig.powertrainType,
    transmission: rawConfig.transmissionType,
  });

  let curses: MechanicalCursePreset[];
  let selectedFairCostUsd: number;
  let selectedDealerQuoteUsd: number;
  let effectivePrimaryDtc: string;

  if (hasExplicitValidCode) {
    const primaryBuilt = buildCurseForUserSelection({
      yearMakeModel: cleanName,
      vin: normalizedVin,
      powertrainType: rawConfig.powertrainType,
      transmissionType: rawConfig.transmissionType,
      dtcCode: trimmedCustomCode,
      primaryPid,
    });
    const lookupMod = lookupUniversalDtc(trimmedCustomCode).moduleId;
    const modShort =
      lookupMod === "02_TCM"
        ? "TCM"
        : lookupMod === "03_ABS"
        ? "ABS"
        : lookupMod === "09_BCM"
        ? "BCM"
        : "ECM";
    const brandedPrimary: MechanicalCursePreset = {
      ...primaryBuilt.curse,
      targetModuleId: lookupMod,
      dealerQuoteUsd: primaryBuilt.dealerQuoteUsd,
      oemPartNumber: formatBrandOemPartNumber(
        normalizedVehicle.make,
        modShort,
        trimmedCustomCode
      ),
    };
    curses = [
      brandedPrimary,
      ...validPool
        .map((f) => f.curse)
        .filter((c) => c.dtcCode.toUpperCase() !== trimmedCustomCode),
    ];
    selectedFairCostUsd = brandedPrimary.estimatedCostUsd;
    selectedDealerQuoteUsd = primaryBuilt.dealerQuoteUsd;
    effectivePrimaryDtc = trimmedCustomCode;
  } else {
    const symptomPreferred = validPool.find((f) => {
      if (rawConfig.symptomOption === "ROUGH_SHIFTING") return f.targetModule === "TCM";
      if (rawConfig.symptomOption === "BATTERY_ELECTRICAL") return f.targetModule === "BCM";
      if (rawConfig.symptomOption === "POOR_GAS_MILEAGE")
        return f.dtcCode === "P0171" || f.dtcCode === "P0128" || f.dtcCode === "P2015";
      return false;
    });
    const leadFault = symptomPreferred ?? validPool[0];
    curses = [
      leadFault.curse,
      ...validPool.filter((f) => f.id !== leadFault.id).map((f) => f.curse),
    ];
    selectedFairCostUsd = leadFault.fairCostUsd;
    selectedDealerQuoteUsd = leadFault.dealerQuoteUsd;
    effectivePrimaryDtc = leadFault.dtcCode;
  }

  const soul: VehicleSoulPreset = {
    id: "CUSTOM_VIN_SOUL",
    codename: "MY_CUSTOM_CAR",
    yearMakeModel: cleanName,
    engineSummary: `${rawConfig.powertrainType} // ${rawConfig.transmissionType}`,
    defaultVin: normalizedVin,
    curbWeightKg: isEv ? 2120 : isTruckOrSuv ? 2040 : 1580,
    dragCoefficientCd: isTruckOrSuv ? 0.34 : isEv ? 0.24 : 0.28,
    frontalAreaM2: isTruckOrSuv ? 2.78 : 2.22,
    redlineRpm: isEv ? 13500 : 6800,
    peakHealthyWhp,
    peakHealthyTorqueLbFt,
    primaryPid,
    baselineTelemetry,
    curses,
  };

  return {
    config: {
      ...rawConfig,
      yearMakeModel: cleanName,
      customObdCode: hasExplicitValidCode ? trimmedCustomCode : "",
      vin: normalizedVin,
    },
    soul,
    normalizedVin,
    activeFaultOnLoad,
    primaryDtc: effectivePrimaryDtc,
    fairCostUsd: selectedFairCostUsd,
    dealerQuoteUsd: selectedDealerQuoteUsd,
  };
}

export function saveUserCustomCarToStorage(config: UserCustomCarConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_CAR_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota or sandbox errors
  }
}

export function loadUserCustomCarFromStorage(): UserCustomCarConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CUSTOM_CAR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserCustomCarConfig>;
    if (!parsed || typeof parsed.yearMakeModel !== "string" || !parsed.yearMakeModel.trim()) {
      return null;
    }
    return {
      yearMakeModel: parsed.yearMakeModel,
      powertrainType: parsed.powertrainType ?? "Standard Gas",
      transmissionType: parsed.transmissionType ?? "Standard Automatic",
      symptomOption: parsed.symptomOption ?? "CHECK_ENGINE_LIGHT",
      customObdCode: typeof parsed.customObdCode === "string" ? parsed.customObdCode : "",
      vin: typeof parsed.vin === "string" ? parsed.vin : undefined,
    };
  } catch {
    return null;
  }
}

const EV_CROSSOVER_PRESET_SOUL: VehicleSoulPreset = {
  id: "CUSTOM_VIN_SOUL",
  codename: "EV_AWD_CROSSOVER",
  yearMakeModel: "2024 Dual-Motor AWD EV Crossover",
  engineSummary: "Dual-Motor AWD Electric Powertrain // EV Single-Speed + HV Pyro-Contactor",
  defaultVin: "5YJYGDEE4RF410829",
  curbWeightKg: 2095,
  dragCoefficientCd: 0.23,
  frontalAreaM2: 2.52,
  redlineRpm: 14000,
  peakHealthyWhp: 425,
  peakHealthyTorqueLbFt: 475,
  primaryPid: "22E001",
  baselineTelemetry: {
    "010C": 4650,
    "010D": 94,
    "0105": 40,
    "0106": 0.0,
    "010E": 0.0,
    "0110": 0.0,
    "0142": 14.42,
    "015C": 45,
    "221140": 0.0,
    "22F40A": 9.4,
    "22E001": 8.4,
    "22D100": 0.0,
  },
  curses: [
    {
      id: "ev-crossover-hv-contactor-u0100",
      name: "High-Voltage Battery Contactor Chatter & Gateway Timeout (U0100 / P0AA6)",
      dtcCode: "U0100",
      severityScore: 87,
      powerLossPct: 32,
      targetPid: "22E001",
      oemPartName: "HV Battery Main Contactor & Pyro-Fuse Relay Assembly",
      oemPartNumber: "1089334-00-J",
      estimatedCostUsd: 1120,
      laborHours: 3.5,
      recommendedUdsCommand: "31 01 E0 01 (HV Contactor Continuity & BMS Isolation Reset)",
      mechanicalExplanation:
        "Pitted contacts inside the High-Voltage Battery Contactor trigger CAN gateway timeouts (U0100) and HV isolation alerts (P0AA6), spiking pack cell delta to 136.5 mV.",
      telemetryOverrides: { "22E001": 136.5, "0142": 11.35, "015C": 114 },
    },
    {
      id: "ev-crossover-hv-isolation-p0aa6",
      name: "HV Battery Isolation Resistance Breach (P0AA6)",
      dtcCode: "P0AA6",
      severityScore: 90,
      powerLossPct: 35,
      targetPid: "22E001",
      oemPartName: "HV Battery Main Contactor & Seal Kit",
      oemPartNumber: "1089334-00-J",
      estimatedCostUsd: 1120,
      laborHours: 3.5,
      recommendedUdsCommand: "31 01 E0 01 (Active BMS Isolation & Cell-Balance Check)",
      mechanicalExplanation:
        "HV contactor resistance drift trips P0AA6 isolation protection and limits propulsion output.",
      telemetryOverrides: { "22E001": 144.2, "0142": 11.5, "015C": 117 },
    },
  ],
};

const DAILY_COMMUTER_PRESET_SOUL: VehicleSoulPreset = {
  id: "CUSTOM_VIN_SOUL",
  codename: "DAILY_COMMUTER_20L",
  yearMakeModel: "2020 2.0L Daily Commuter Sedan",
  engineSummary: "2.0L DOHC I4 Standard Gas // Automatic Commuter Drivetrain",
  defaultVin: "1HGCV1F34LA019284",
  curbWeightKg: 1415,
  dragCoefficientCd: 0.27,
  frontalAreaM2: 2.18,
  redlineRpm: 6700,
  peakHealthyWhp: 168,
  peakHealthyTorqueLbFt: 154,
  primaryPid: "0106",
  baselineTelemetry: {
    "010C": 2150,
    "010D": 82,
    "0105": 89,
    "0106": 1.2,
    "010E": 16.0,
    "0110": 24.6,
    "0142": 14.2,
    "015C": 81,
    "221140": -4.6,
    "22F40A": 7.2,
    "22E001": 2.5,
    "22D100": 1.0,
  },
  curses: [
    {
      id: "commuter-intake-leak-p0171",
      name: "Intake Boot Air Leak / Lean Fuel Trim (P0171 / P0420)",
      dtcCode: "P0171",
      severityScore: 66,
      powerLossPct: 16,
      targetPid: "0106",
      oemPartName: "OEM Mass Airflow Intake Boot & PCV Breather Valve Kit",
      oemPartNumber: "17228-5BA-A01",
      estimatedCostUsd: 420,
      laborHours: 1.8,
      recommendedUdsCommand: "04 (Clear Learned Fuel Trim Offsets & Turn Off MIL)",
      mechanicalExplanation:
        "Split rubber pleat in the air intake boot leaks unmeasured air into Bank 1, pegging Short-Term Fuel Trim (STFT %) to +25.4% and hurting fuel economy.",
      telemetryOverrides: { "0106": 25.4, "0110": 17.8, "0105": 102 },
    },
    {
      id: "commuter-catalyst-p0420",
      name: "Catalyst Efficiency Below Threshold (P0420)",
      dtcCode: "P0420",
      severityScore: 58,
      powerLossPct: 10,
      targetPid: "0106",
      oemPartName: "Direct-Fit Catalytic Converter & Rear O2 Sensor",
      oemPartNumber: "18160-5BA-A00",
      estimatedCostUsd: 690,
      laborHours: 2.2,
      recommendedUdsCommand: "04 (Reset Catalyst Monitor & Clear DTCs)",
      mechanicalExplanation:
        "Prolonged lean fuel trim stressed Bank 1 catalyst efficiency below threshold.",
      telemetryOverrides: { "0106": 14.6, "0105": 101 },
    },
  ],
};

export const REAL_WORLD_VEHICLE_PRESETS: readonly QuickVehiclePresetSpec[] = [
  {
    id: "PRESET_2014_V6_DSG",
    emoji: "🏎️",
    shortTitle: "2014 3.0T Supercharged V6 (7-Speed DSG)",
    buttonLabel: "🏎️ 2014 3.0T Supercharged V6 (7-Speed DSG)",
    faultPairLabel: "P0750 / P17D8",
    faultPlainName: "Transmission Clutch Solenoid",
    costSummaryLabel: "Fair Cost: $1,480 vs. $2,450 Dealer Quote",
    fairCostUsd: 1480,
    dealerQuoteUsd: 2450,
    primaryDtc: "P0750",
    companionDtc: "P17D8",
    underlyingSoulId: "GERMAN_V6_DSG",
    soul: VEHICLE_SOUL_PRESETS.GERMAN_V6_DSG,
  },
  {
    id: "PRESET_2024_AWD_EV",
    emoji: "⚡",
    shortTitle: "2024 Dual-Motor AWD EV Crossover",
    buttonLabel: "⚡ 2024 Dual-Motor AWD EV Crossover",
    faultPairLabel: "U0100 / P0AA6",
    faultPlainName: "High-Voltage Battery Contactor",
    costSummaryLabel: "Fair Cost: $1,120 vs. $2,100 Dealer Quote",
    fairCostUsd: 1120,
    dealerQuoteUsd: 2100,
    primaryDtc: "U0100",
    companionDtc: "P0AA6",
    underlyingSoulId: "CUSTOM_VIN_SOUL",
    soul: EV_CROSSOVER_PRESET_SOUL,
  },
  {
    id: "PRESET_2020_COMMUTER",
    emoji: "🚗",
    shortTitle: "2020 2.0L Daily Commuter Sedan",
    buttonLabel: "🚗 2020 2.0L Daily Commuter Sedan",
    faultPairLabel: "P0171 / P0420",
    faultPlainName: "Intake Air Leak / Lean Fuel Trim",
    costSummaryLabel: "Fair Cost: $420 vs. $980 Dealer Quote",
    fairCostUsd: 420,
    dealerQuoteUsd: 980,
    primaryDtc: "P0171",
    companionDtc: "P0420",
    underlyingSoulId: "CUSTOM_VIN_SOUL",
    soul: DAILY_COMMUTER_PRESET_SOUL,
  },
] as const;

export function evaluateDrivingStressSliders(
  soul: VehicleSoulPreset,
  activeCurse: MechanicalCursePreset | null,
  sliders: DrivingStressSlidersState,
  scopePid: PidKey
): DrivingStressEvaluation {
  const rpm = clampNum(sliders.drivingLoadRpm, 800, 6800);
  const heatC = clampNum(sliders.heatTempC, 75, 135);
  const wearPct = clampNum(sliders.partWearPct, 0, 100);

  const loadNorm = (rpm - 800) / 6000;
  const heatExcessNorm = clampNum((heatC - 95) / 40, 0, 1);
  const wearNorm = wearPct / 100;
  const effectiveWear = activeCurse ? Math.max(wearNorm, 0.82) : wearNorm;

  const base = soul.baselineTelemetry;
  const primaryCurse = activeCurse ?? soul.curses[0];
  const nextTelemetry: Record<PidKey, number> = { ...base };

  nextTelemetry["010C"] = Math.round(rpm);
  nextTelemetry["010D"] = Math.round(clampNum(28 + loadNorm * 138, 0, 225));
  if (base["0110"] > 0) {
    nextTelemetry["0110"] = Number((12 + loadNorm * 95 * (1 - effectiveWear * 0.22)).toFixed(1));
  }
  if (base["221140"] > 0) {
    const commandedBoost = 3.5 + loadNorm * 15.5;
    nextTelemetry["221140"] = Number((commandedBoost * (1 - effectiveWear * 0.58)).toFixed(1));
  }

  nextTelemetry["0105"] = Math.round(heatC);
  nextTelemetry["015C"] = Math.round(
    clampNum(heatC - 4 + effectiveWear * 18 + loadNorm * 8, 45, 148)
  );

  for (const pid of ALL_PID_KEYS) {
    if (pid === "010C" || pid === "010D" || pid === "0105" || pid === "015C") continue;
    const healthyVal = base[pid];
    const faultOverride = primaryCurse?.telemetryOverrides[pid];
    if (faultOverride !== undefined) {
      const loadAmplifier = 1 + loadNorm * 0.16 + heatExcessNorm * 0.14;
      const blended =
        healthyVal + (faultOverride - healthyVal) * clampNum(effectiveWear * loadAmplifier, 0, 1.12);
      const def = UNIVERSAL_PID_REGISTRY[pid];
      nextTelemetry[pid] = Number(clampNum(blended, def.min, def.max).toFixed(def.decimals));
    }
  }

  const primaryDef = UNIVERSAL_PID_REGISTRY[scopePid];
  let scopeTarget = base[scopePid];
  if (scopePid === "010C") {
    scopeTarget = rpm;
  } else if (scopePid === "221140" && base["221140"] > 0) {
    scopeTarget = Number((3.5 + loadNorm * 15.5).toFixed(1));
  } else if (scopePid === "22F40A") {
    scopeTarget = Number((base["22F40A"] + loadNorm * 1.4).toFixed(2));
  }

  let scopeActual = nextTelemetry[scopePid];
  if (scopePid === "22F40A") {
    const dropRatio = clampNum(
      effectiveWear * (0.68 + loadNorm * 0.22 + heatExcessNorm * 0.15),
      0,
      0.82
    );
    scopeActual = Number(
      clampNum(scopeTarget * (1 - dropRatio), primaryDef.min, primaryDef.max).toFixed(2)
    );
    nextTelemetry["22F40A"] = scopeActual;
  } else if (scopePid === "0106") {
    scopeTarget = 0;
    const leanDrift = base["0106"] + effectiveWear * (24.5 + loadNorm * 5.0);
    scopeActual = Number(clampNum(leanDrift, primaryDef.min, primaryDef.max).toFixed(1));
    nextTelemetry["0106"] = scopeActual;
  } else if (scopePid === "22E001") {
    const cellDelta =
      base["22E001"] + effectiveWear * (128 + loadNorm * 24 + heatExcessNorm * 18);
    scopeActual = Number(clampNum(cellDelta, primaryDef.min, primaryDef.max).toFixed(1));
    nextTelemetry["22E001"] = scopeActual;
  }

  const isHighLoad = rpm >= 5400;
  const isOverheating = heatC >= 109;
  const isFailingWear = wearPct >= 65 || Boolean(activeCurse);

  const warnings: string[] = [];
  if (wearPct >= 65) {
    warnings.push(
      `⚙️ Failing Part Wear (${wearPct}%): Severe target-vs-actual sensor drift detected!`
    );
  } else if (wearPct >= 35) {
    warnings.push(
      `⚙️ Moderate Part Wear (${wearPct}%): Early wear detected — Auto-Savings rate increasing.`
    );
  }
  if (isOverheating) {
    warnings.push(
      `🌡️ Overheating Warning (${heatC}°C): Exceeds 108°C safe coolant/fluid threshold!`
    );
  }
  if (isHighLoad) {
    warnings.push(
      `⛰️ Steep Hill / Hard Acceleration (${rpm.toLocaleString()} RPM): High mechanical load.`
    );
  }

  const wearContribution = wearPct * 0.72;
  const heatContribution = heatC > 96 ? (heatC - 96) * 1.15 : 0;
  const loadContribution = rpm > 3600 ? ((rpm - 3600) / 3200) * 18 : 0;
  const rawStressScore = Math.round(
    clampNum(wearContribution + heatContribution + loadContribution, 0, 100)
  );
  const stressAnomalyScore = activeCurse
    ? Math.max(activeCurse.severityScore, rawStressScore)
    : rawStressScore;

  return {
    telemetry: nextTelemetry,
    scopeTarget,
    scopeActual,
    stressAnomalyScore,
    warnings,
    isOverheating,
    isHighLoad,
    isFailingWear,
  };
}

export type WorkspaceTabId =
  | "LIVE_HEALTH"
  | "SCANNER_AI"
  | "REPAIR_VAULT"
  | "ENGINEER_KIRO";

export type FrankensteinStageId =
  | "STAGE_01_INGEST"
  | "STAGE_02_XRAY"
  | "STAGE_03_VERTEX_AI"
  | "STAGE_04_ESCROW_KIRO";

export interface FrankensteinStageSpec {
  id: FrankensteinStageId;
  stepNum: "01" | "02" | "03" | "04";
  icon: string;
  title: string;
  subtitle: string;
  targetTab: WorkspaceTabId;
  bentoAnchorId: string;
}

export const FRANKENSTEIN_PIPELINE_STAGES: ReadonlyArray<FrankensteinStageSpec> = [
  {
    id: "STAGE_01_INGEST",
    stepNum: "01",
    icon: "🔌",
    title: "01. HARDWARE & TELEMETRY INGEST",
    subtitle: "OBD-II WebSerial / CSV Log / Custom Car + 60fps Oscilloscope",
    targetTab: "LIVE_HEALTH",
    bentoAnchorId: "cockpit-stage-01",
  },
  {
    id: "STAGE_02_XRAY",
    stepNum: "02",
    icon: "🔍",
    title: "02. MULTI-ECU X-RAY & SAFETY TRIAGE",
    subtitle: "Interactive SVG Car Chassis + ECM/TCM/ABS/BCM Scanner + Mode $04 Reset",
    targetTab: "SCANNER_AI",
    bentoAnchorId: "cockpit-stage-02",
  },
  {
    id: "STAGE_03_VERTEX_AI",
    stepNum: "03",
    icon: "🧠",
    title: "03. VERTEX AI MECHANIC & QUOTE AUDIT",
    subtitle: "Plain-English Autopsy + OEM Part Lookup + Ripoff Detector",
    targetTab: "SCANNER_AI",
    bentoAnchorId: "cockpit-stage-03",
  },
  {
    id: "STAGE_04_ESCROW_KIRO",
    stepNum: "04",
    icon: "🏦",
    title: "04. FINTECH ESCROW & KIRO PROOFS",
    subtitle: "Save-Per-Mile Vault + Kiro Work Order + 64-Bit CAN / Dyno / PBTs",
    targetTab: "REPAIR_VAULT",
    bentoAnchorId: "cockpit-stage-04",
  },
];

export const WORKSPACE_TABS: ReadonlyArray<{
  id: WorkspaceTabId;
  label: string;
}> = [
  { id: "LIVE_HEALTH", label: "🩺 Live Health & X-Ray" },
  { id: "SCANNER_AI", label: "🔍 Scanner & Vertex AI" },
  { id: "REPAIR_VAULT", label: "🏦 FinTech Escrow Vault" },
  { id: "ENGINEER_KIRO", label: "🔬 Engineer Pro & Kiro" },
];

export type CinemaSceneIdx = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export function getWorkspaceTabForScene(sceneNumber: CinemaSceneIdx): WorkspaceTabId {
  if (sceneNumber === 1 || sceneNumber === 2 || sceneNumber === 3) return "LIVE_HEALTH";
  if (sceneNumber === 4 || sceneNumber === 5) return "SCANNER_AI";
  if (sceneNumber === 6) return "REPAIR_VAULT";
  if (sceneNumber === 7) return "SCANNER_AI";
  return "ENGINEER_KIRO";
}

