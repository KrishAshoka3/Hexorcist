/**
 * HEXORCIST Phase 8.6 — Vehicle-Accurate Randomized Fault Engine
 *
 * Pure, deterministic-ready TypeScript engine that inspects the user's inputted
 * year, make, model, powertrain, and transmission, enforcing strict mechanical
 * invariants (e.g. EVs never roll combustion/multi-gear faults; Manuals never roll
 * TCM solenoid/torque converter faults), stamping brand-authentic OEM part numbers,
 * and randomly rolling from a deep pool without ever repeating the previous fault.
 */

import {
  CurseSafetyTriageLevel,
  CurseTargetModuleId,
  MechanicalCursePreset,
  PidKey,
} from "./obd-hex-engine";

export type TargetEcuShortCode = "ECM" | "TCM" | "ABS" | "BCM";

export type NormalizedPowertrainPool =
  | "EV"
  | "MANUAL"
  | "DCT"
  | "HYBRID_CVT"
  | "STANDARD_AUTOMATIC";

export interface VehicleFaultInput {
  year?: string | number;
  make?: string;
  model?: string;
  yearMakeModel?: string;
  powertrain?: string;
  transmission?: string;
}

export interface NormalizedVehicleDescriptor {
  year: string;
  make: string;
  model: string;
  displayMakeModel: string;
  fullLabel: string;
  powertrainLabel: string;
  transmissionLabel: string;
  poolCategory: NormalizedPowertrainPool;
  isEv: boolean;
  isManual: boolean;
  isHybrid: boolean;
}

export interface GeneratedVehicleFault {
  id: string;
  dtcCode: string;
  companionDtcCode: string;
  codeDisplayLabel: string;
  targetModule: TargetEcuShortCode;
  targetModuleId: CurseTargetModuleId;
  focusPid: PidKey;
  title: string;
  symptomSummary: string;
  mechanicalExplanation: string;
  oemPartName: string;
  oemPartNumber: string;
  fairCostUsd: number;
  dealerQuoteUsd: number;
  laborHours: number;
  safetyTriageLevel: CurseSafetyTriageLevel;
  powerLossPct: number;
  severityScore: number;
  recommendedUdsCommand: string;
  telemetryOverrides: Partial<Record<PidKey, number>>;
  vehicle: NormalizedVehicleDescriptor;
  curse: MechanicalCursePreset;
}

interface FaultTemplate {
  id: string;
  dtcCode: string;
  companionDtcCode: string;
  codeDisplayLabel: string;
  targetModule: TargetEcuShortCode;
  targetModuleId: CurseTargetModuleId;
  focusPid: PidKey;
  title: string;
  symptomSummary: string;
  mechanicalExplanation: string;
  oemPartName: string;
  fairCostUsd: number;
  dealerQuoteUsd: number;
  laborHours: number;
  safetyTriageLevel: CurseSafetyTriageLevel;
  powerLossPct: number;
  severityScore: number;
  recommendedUdsCommand: string;
  telemetryOverrides: Partial<Record<PidKey, number>>;
}

const KNOWN_EV_NAME_REGEX =
  /\b(tesla|rivian|lucid|polestar|taycan|mach[- ]?e|ioniq\s*[56]|ev6|ev9|bolt\s*ev|leaf|id\.?4|dual[- ]motor\s*ev|800v.*ev|awd\s*ev)\b/i;

const KNOWN_BRANDS: ReadonlyArray<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\baudi\b/i, canonical: "Audi" },
  { pattern: /\b(volkswagen|vw)\b/i, canonical: "Volkswagen" },
  { pattern: /\bporsche\b/i, canonical: "Porsche" },
  { pattern: /\bford\b/i, canonical: "Ford" },
  { pattern: /\blincoln\b/i, canonical: "Lincoln" },
  { pattern: /\bbmw\b/i, canonical: "BMW" },
  { pattern: /\bmini\b/i, canonical: "Mini" },
  { pattern: /\btoyota\b/i, canonical: "Toyota" },
  { pattern: /\blexus\b/i, canonical: "Lexus" },
  { pattern: /\bhonda\b/i, canonical: "Honda" },
  { pattern: /\bacura\b/i, canonical: "Acura" },
  { pattern: /\btesla\b/i, canonical: "Tesla" },
  { pattern: /\brivian\b/i, canonical: "Rivian" },
  { pattern: /\blucid\b/i, canonical: "Lucid" },
  { pattern: /\b(chevrolet|chevy)\b/i, canonical: "Chevrolet" },
  { pattern: /\bgmc\b/i, canonical: "GMC" },
  { pattern: /\bcadillac\b/i, canonical: "Cadillac" },
  { pattern: /\b(mercedes|amg)\b/i, canonical: "Mercedes-Benz" },
  { pattern: /\bsubaru\b/i, canonical: "Subaru" },
  { pattern: /\bnissan\b/i, canonical: "Nissan" },
  { pattern: /\binfiniti\b/i, canonical: "Infiniti" },
  { pattern: /\bhyundai\b/i, canonical: "Hyundai" },
  { pattern: /\bkia\b/i, canonical: "Kia" },
  { pattern: /\bgenesis\b/i, canonical: "Genesis" },
  { pattern: /\bmazda\b/i, canonical: "Mazda" },
  { pattern: /\b(dodge|ram|jeep|chrysler)\b/i, canonical: "Ram/Dodge" },
  { pattern: /\b(volvo|polestar)\b/i, canonical: "Volvo" },
];

const EV_FAULT_POOL: readonly FaultTemplate[] = [
  {
    id: "EV_BCM_HV_CONTACTOR",
    dtcCode: "U0100",
    companionDtcCode: "U0140",
    codeDisplayLabel: "U0100 / BMS_a062",
    targetModule: "BCM",
    targetModuleId: "09_BCM",
    focusPid: "0142",
    title: "High-Voltage Pyrotechnic Contactor Isolation Fault",
    symptomSummary: "HV battery contactor open-circuit alert & 12V low-voltage bus sag to 11.8V.",
    mechanicalExplanation:
      "Battery Management Gateway detected High-Voltage Pyrotechnic Contactor coil resistance drift (BMS_a062) paired with 12V control rail sag (11.8V), opening HV isolation interlock.",
    oemPartName: "HV Pyrotechnic Contactor & Isolation Sense Assembly",
    fairCostUsd: 1180,
    dealerQuoteUsd: 2290,
    laborHours: 3.5,
    safetyTriageLevel: "DO NOT DRIVE",
    powerLossPct: 48,
    severityScore: 93,
    recommendedUdsCommand: "7E0 04 31 01 E0 01",
    telemetryOverrides: { "0142": 11.8, "22E001": 148, "0106": 0, "010C": 3200 },
  },
  {
    id: "EV_ECM_SIC_INVERTER",
    dtcCode: "P0A78",
    companionDtcCode: "P0A94",
    codeDisplayLabel: "P0A78",
    targetModule: "ECM",
    targetModuleId: "01_ECM",
    focusPid: "0105",
    title: "Rear Drive Unit SiC Inverter Phase-U Thermal Derating",
    symptomSummary: "Reduced propulsion power & drive-inverter coolant spike to 116°C.",
    mechanicalExplanation:
      "Rear Drive Unit Silicon-Carbide (SiC) 3-Phase Inverter Phase-U power stage suffered TIM thermal paste pump-out, spiking stator/inverter loop temperature to 116°C and derating motor torque.",
    oemPartName: "Rear Drive Unit SiC 3-Phase Propulsion Inverter",
    fairCostUsd: 1640,
    dealerQuoteUsd: 3180,
    laborHours: 4.2,
    safetyTriageLevel: "CAUTION",
    powerLossPct: 36,
    severityScore: 84,
    recommendedUdsCommand: "7E0 04 31 01 E0 01",
    telemetryOverrides: { "0105": 116, "015C": 118, "010C": 4650, "0106": 0 },
  },
  {
    id: "EV_BCM_CHILLER_VALVE",
    dtcCode: "P0AA6",
    companionDtcCode: "U0100",
    codeDisplayLabel: "P0AA6",
    targetModule: "BCM",
    targetModuleId: "09_BCM",
    focusPid: "22E001",
    title: "HV Battery Thermal Chiller Valve Actuator Stuck",
    symptomSummary: "HV battery chiller refrigerant valve stuck closed; cell delta rising to 164 mV.",
    mechanicalExplanation:
      "High-voltage thermal management 4-way chiller valve stepper seized at 12% opening, starving pack cooling plates and causing 164 mV cell imbalance.",
    oemPartName: "HV Pack Refrigerant Thermal Chiller Proportional Valve",
    fairCostUsd: 940,
    dealerQuoteUsd: 1920,
    laborHours: 2.8,
    safetyTriageLevel: "DO NOT DRIVE",
    powerLossPct: 42,
    severityScore: 91,
    recommendedUdsCommand: "7E0 05 2F E0 01 03 00",
    telemetryOverrides: { "0105": 115, "22E001": 164, "0142": 12.1, "0106": 0 },
  },
  {
    id: "EV_ABS_REGEN_TRANSDUCER",
    dtcCode: "C0031",
    companionDtcCode: "C0035",
    codeDisplayLabel: "C0031",
    targetModule: "ABS",
    targetModuleId: "03_ABS",
    focusPid: "010D",
    title: "Regenerative Blending Brake Pressure Transducer Drift",
    symptomSummary: "Regen braking disabled; electro-hydraulic master cylinder pressure drift.",
    mechanicalExplanation:
      "ABS / Stability Electro-Hydraulic Booster secondary pressure transducer drifted +0.85 Bar off zero baseline, disabling one-pedal regenerative blending while preserving friction brakes.",
    oemPartName: "Electro-Hydraulic Regenerative Brake Pressure Sensor",
    fairCostUsd: 620,
    dealerQuoteUsd: 1340,
    laborHours: 2.0,
    safetyTriageLevel: "CAUTION",
    powerLossPct: 14,
    severityScore: 68,
    recommendedUdsCommand: "7E0 04 31 01 00 31",
    telemetryOverrides: { "010D": 32, "010C": 4820, "0142": 12.5, "0106": 0 },
  },
  {
    id: "EV_BCM_DCDC_CONVERTER",
    dtcCode: "P0A94",
    companionDtcCode: "U0100",
    codeDisplayLabel: "P0A94",
    targetModule: "BCM",
    targetModuleId: "09_BCM",
    focusPid: "0142",
    title: "HV-to-12V DC/DC Converter Bus Voltage Sag",
    symptomSummary: "12V low-voltage rail dropped to 11.7V due to HV DC/DC regulation fault.",
    mechanicalExplanation:
      "Onboard HV-to-12V DC/DC buck converter secondary rectifier MOSFET degraded, allowing the 12V accessory & ECU bus to sag to 11.7V.",
    oemPartName: "Integrated HV-to-12V DC/DC Converter Assembly",
    fairCostUsd: 890,
    dealerQuoteUsd: 1840,
    laborHours: 2.6,
    safetyTriageLevel: "CAUTION",
    powerLossPct: 20,
    severityScore: 76,
    recommendedUdsCommand: "7E0 04 31 01 E0 01",
    telemetryOverrides: { "0142": 11.7, "22E001": 88, "0106": 0 },
  },
];

const MANUAL_FAULT_POOL: readonly FaultTemplate[] = [
  {
    id: "MANUAL_ECM_COIL_MISFIRE",
    dtcCode: "P0302",
    companionDtcCode: "P0300",
    codeDisplayLabel: "P0302",
    targetModule: "ECM",
    targetModuleId: "01_ECM",
    focusPid: "010C",
    title: "Cylinder 2 Ignition Coil Pack Misfire",
    symptomSummary: "RPM misfire oscillation under manual-gear pull & flashing CEL.",
    mechanicalExplanation:
      "Cylinder 2 direct-fire ignition coil secondary epoxy cracked under thermal load, causing spark blowout, RPM oscillation, and unburned O2 lean spike.",
    oemPartName: "Cylinder 2 Direct-Fire Ignition Coil Pack & Iridium Plug",
    fairCostUsd: 340,
    dealerQuoteUsd: 790,
    laborHours: 1.2,
    safetyTriageLevel: "DO NOT DRIVE",
    powerLossPct: 28,
    severityScore: 89,
    recommendedUdsCommand: "7E0 04 31 01 03 02",
    telemetryOverrides: { "010C": 3180, "010E": -3.5, "0106": 19.4 },
  },
  {
    id: "MANUAL_ECM_BOOST_LEAK",
    dtcCode: "P0299",
    companionDtcCode: "P0171",
    codeDisplayLabel: "P0299",
    targetModule: "ECM",
    targetModuleId: "01_ECM",
    focusPid: "221140",
    title: "Wastegate / Intake Charge Pipe Boost Leak",
    symptomSummary: "Manifold boost pressure collapsed to 5.1 PSI under wide-open throttle.",
    mechanicalExplanation:
      "Split intercooler silicone charge-pipe coupler & wastegate actuator diaphragm leak bled off boost pressure, forcing +16.8% positive short-term fuel trim.",
    oemPartName: "Electronic Wastegate Solenoid & Charge Pipe Seal Kit",
    fairCostUsd: 520,
    dealerQuoteUsd: 1190,
    laborHours: 2.2,
    safetyTriageLevel: "CAUTION",
    powerLossPct: 31,
    severityScore: 74,
    recommendedUdsCommand: "7E0 05 2F 11 40 03 00",
    telemetryOverrides: { "221140": 5.1, "010C": 4150, "0106": 16.8 },
  },
  {
    id: "MANUAL_ABS_WHEEL_SPEED",
    dtcCode: "C0040",
    companionDtcCode: "C0035",
    codeDisplayLabel: "C0040",
    targetModule: "ABS",
    targetModuleId: "03_ABS",
    focusPid: "010D",
    title: "ABS Wheel Speed Sensor Air Gap Fault",
    symptomSummary: "Erratic wheel speed signal dropout & ABS / stability control lamp.",
    mechanicalExplanation:
      "Front-right hub magnetic tone-ring corrosion widened Hall-effect sensor air gap beyond 1.6 mm, causing intermittent speed signal dropouts on CAN 0x7EA.",
    oemPartName: "Front Right Hall-Effect ABS Wheel Speed Sensor",
    fairCostUsd: 290,
    dealerQuoteUsd: 680,
    laborHours: 1.1,
    safetyTriageLevel: "CAUTION",
    powerLossPct: 6,
    severityScore: 58,
    recommendedUdsCommand: "7E0 04 31 01 00 40",
    telemetryOverrides: { "010D": 18, "010C": 3080, "0142": 13.8 },
  },
  {
    id: "MANUAL_ECM_THERMOSTAT",
    dtcCode: "P0128",
    companionDtcCode: "P0171",
    codeDisplayLabel: "P0128",
    targetModule: "ECM",
    targetModuleId: "01_ECM",
    focusPid: "0105",
    title: "Thermostat Coolant Regulating Valve Stuck Open",
    symptomSummary: "Coolant stuck overcooled at 66°C (or spiking under load) & rich warm-up trim.",
    mechanicalExplanation:
      "Wax-pellet map-controlled coolant thermostat jammed partially open, keeping engine block below closed-loop thermal target and enriching fuel trim.",
    oemPartName: "Map-Controlled Engine Coolant Thermostat Housing",
    fairCostUsd: 460,
    dealerQuoteUsd: 1020,
    laborHours: 2.0,
    safetyTriageLevel: "SAFE",
    powerLossPct: 9,
    severityScore: 42,
    recommendedUdsCommand: "7E0 04 31 01 01 28",
    telemetryOverrides: { "0105": 66, "0106": 11.4, "010C": 2450 },
  },
  {
    id: "MANUAL_BCM_VOLTAGE_SAG",
    dtcCode: "B1318",
    companionDtcCode: "U0100",
    codeDisplayLabel: "B1318",
    targetModule: "BCM",
    targetModuleId: "09_BCM",
    focusPid: "0142",
    title: "12V Smart Alternator LIN-Bus Voltage Regulator Sag",
    symptomSummary: "Terminal 30 system voltage dropped to 11.8V on Body Control Module.",
    mechanicalExplanation:
      "Alternator LIN-bus brush & voltage regulator wear dropped charging rail output to 11.8V under headlights/HVAC load, logging low-voltage BCM fault.",
    oemPartName: "LIN-Controlled Alternator Voltage Regulator Assembly",
    fairCostUsd: 440,
    dealerQuoteUsd: 960,
    laborHours: 1.8,
    safetyTriageLevel: "CAUTION",
    powerLossPct: 8,
    severityScore: 66,
    recommendedUdsCommand: "7E0 04 31 01 13 18",
    telemetryOverrides: { "0142": 11.8, "010C": 2380 },
  },
];

const DCT_FAULT_POOL: readonly FaultTemplate[] = [
  {
    id: "DCT_TCM_MECHATRONIC",
    dtcCode: "P17D8",
    companionDtcCode: "P0750",
    codeDisplayLabel: "P17D8 / P0750",
    targetModule: "TCM",
    targetModuleId: "02_TCM",
    focusPid: "22F40A",
    title: "Dual-Clutch Mechatronic Pressure Solenoid 1 & Thermal Torque Limit",
    symptomSummary: "Hydraulic clutch pressure collapsed to 2.35 Bar; wet-clutch temp at 116°C.",
    mechanicalExplanation:
      "Dual-Clutch Mechatronic Solenoid N215/N435 suffered internal PCB ribbon oxidation and valve bore stiction, dropping odd-gear clamping pressure to 2.35 Bar (target 8.45 Bar).",
    oemPartName: "Dual-Clutch Mechatronic Pressure Solenoid & Sub-Harness Kit",
    fairCostUsd: 1480,
    dealerQuoteUsd: 2450,
    laborHours: 5.5,
    safetyTriageLevel: "CAUTION",
    powerLossPct: 38,
    severityScore: 86,
    recommendedUdsCommand: "7E0 04 31 01 F4 0A",
    telemetryOverrides: { "22F40A": 2.35, "015C": 116, "0105": 106, "010C": 4280 },
  },
  {
    id: "DCT_ECM_BOOST_BYPASS",
    dtcCode: "P0299",
    companionDtcCode: "P10A4",
    codeDisplayLabel: "P0299 / P10A4",
    targetModule: "ECM",
    targetModuleId: "01_ECM",
    focusPid: "221140",
    title: "Supercharger Bypass / Turbocharger Boost Control Flap Malfunction",
    symptomSummary: "Forced-induction boost bled down to 4.6 PSI; EPC torque reduction active.",
    mechanicalExplanation:
      "Forced-induction air regulation bypass flap return spring fatigued (P10A4), venting charge pressure back to intake side and triggering P0299 underboost.",
    oemPartName: "Forced-Induction Boost Regulating Bypass Flap Actuator",
    fairCostUsd: 680,
    dealerQuoteUsd: 1490,
    laborHours: 2.6,
    safetyTriageLevel: "CAUTION",
    powerLossPct: 32,
    severityScore: 75,
    recommendedUdsCommand: "7E0 05 2F 11 40 03 00",
    telemetryOverrides: { "221140": 4.6, "010C": 3950, "0106": 14.8 },
  },
  {
    id: "DCT_ECM_INTAKE_RUNNER",
    dtcCode: "P2015",
    companionDtcCode: "P0171",
    codeDisplayLabel: "P2015",
    targetModule: "ECM",
    targetModuleId: "01_ECM",
    focusPid: "0106",
    title: "Intake Manifold Runner Flap Position Sensor Bank 1",
    symptomSummary: "Bank 1 tumble-flap potentiometer out of range; +17.2% lean fuel trim.",
    mechanicalExplanation:
      "Bank 1 variable intake manifold runner vacuum actuator arm wore past its mechanical stop, skewing Hall sensor feedback and disturbing low-RPM tumble airflow.",
    oemPartName: "Bank 1 Intake Manifold Runner Flap Actuator & Sensor",
    fairCostUsd: 590,
    dealerQuoteUsd: 1340,
    laborHours: 2.8,
    safetyTriageLevel: "SAFE",
    powerLossPct: 12,
    severityScore: 44,
    recommendedUdsCommand: "7E0 04 31 01 20 15",
    telemetryOverrides: { "0106": 17.2, "010E": 2.5, "010C": 2920 },
  },
  {
    id: "DCT_ABS_TORQUE_VECTOR_PUMP",
    dtcCode: "C102D",
    companionDtcCode: "C0035",
    codeDisplayLabel: "C102D",
    targetModule: "ABS",
    targetModuleId: "03_ABS",
    focusPid: "0142",
    title: "Active Torque-Vectoring Rear Differential Hydraulic Pump",
    symptomSummary: "Rear torque-vectoring pump high current draw sagging bus to 11.8V.",
    mechanicalExplanation:
      "Active rear sport-differential hydraulic axial-piston pump commutator wear spiked current draw, sagging chassis 12V rail to 11.8V and reverting to open differential.",
    oemPartName: "Active Torque-Vectoring Rear Differential Hydraulic Pump",
    fairCostUsd: 920,
    dealerQuoteUsd: 2150,
    laborHours: 3.2,
    safetyTriageLevel: "CAUTION",
    powerLossPct: 15,
    severityScore: 69,
    recommendedUdsCommand: "7E0 04 31 01 10 2D",
    telemetryOverrides: { "0142": 11.8, "015C": 112, "010D": 68 },
  },
];

const STANDARD_AUTO_FAULT_POOL: readonly FaultTemplate[] = [
  {
    id: "AUTO_TCM_TCC_SHUDDER",
    dtcCode: "P0741",
    companionDtcCode: "P0750",
    codeDisplayLabel: "P0741",
    targetModule: "TCM",
    targetModuleId: "02_TCM",
    focusPid: "22F40A",
    title: "Torque Converter Clutch Solenoid Circuit Performance / Shudder",
    symptomSummary: "Highway converter lockup slip, RPM oscillation & 116°C ATF heat spike.",
    mechanicalExplanation:
      "Torque Converter Clutch (TCC) PWM pressure control solenoid valve bore wear prevented full lockup engagement, dropping line pressure to 3.1 Bar and spiking ATF to 116°C.",
    oemPartName: "Torque Converter Lock-Up PWM Solenoid & Valve Body Kit",
    fairCostUsd: 890,
    dealerQuoteUsd: 1980,
    laborHours: 3.8,
    safetyTriageLevel: "CAUTION",
    powerLossPct: 26,
    severityScore: 81,
    recommendedUdsCommand: "7E0 04 31 01 F4 0A",
    telemetryOverrides: { "22F40A": 3.1, "015C": 116, "0105": 107, "010C": 3420 },
  },
  {
    id: "AUTO_ECM_VVT_CORRELATION",
    dtcCode: "P0016",
    companionDtcCode: "P0300",
    codeDisplayLabel: "P0016",
    targetModule: "ECM",
    targetModuleId: "01_ECM",
    focusPid: "010E",
    title: "Crankshaft-to-Camshaft Variable Valve Timing VVT Solenoid Correlation",
    symptomSummary: "Cam phaser stuck 6.5° retarded; rough RPM oscillation & oil temp rise.",
    mechanicalExplanation:
      "Intake camshaft Variable Valve Timing (VVT) oil control spool valve jammed with varnished oil debris, retarding cam timing -6.5° relative to crankshaft CKP index.",
    oemPartName: "Intake Camshaft Phaser VVT Oil Control Solenoid Valve",
    fairCostUsd: 480,
    dealerQuoteUsd: 1160,
    laborHours: 2.1,
    safetyTriageLevel: "DO NOT DRIVE",
    powerLossPct: 30,
    severityScore: 90,
    recommendedUdsCommand: "7E0 04 31 01 00 16",
    telemetryOverrides: { "010E": -6.5, "010C": 2680, "015C": 112 },
  },
  {
    id: "AUTO_ECM_LEAN_VACUUM",
    dtcCode: "P0171",
    companionDtcCode: "P0300",
    codeDisplayLabel: "P0171",
    targetModule: "ECM",
    targetModuleId: "01_ECM",
    focusPid: "0106",
    title: "Mass Air Flow / Intake Manifold Vacuum Leak — System Too Lean Bank 1",
    symptomSummary: "Short-term fuel trim pegged at +24.2% with un-metered intake air leak.",
    mechanicalExplanation:
      "Cracked upper intake plenum PCV breather hose & contaminated hot-film MAF element admitted un-metered air downstream of MAF, pegging Bank 1 STFT to +24.2%.",
    oemPartName: "Hot-Film Mass Air Flow (MAF) Sensor & Plenum Seal Kit",
    fairCostUsd: 380,
    dealerQuoteUsd: 890,
    laborHours: 1.4,
    safetyTriageLevel: "CAUTION",
    powerLossPct: 16,
    severityScore: 67,
    recommendedUdsCommand: "7E0 04 31 01 01 71",
    telemetryOverrides: { "0106": 24.2, "0110": 14.5, "010C": 2540 },
  },
  {
    id: "AUTO_ECM_CATALYST",
    dtcCode: "P0420",
    companionDtcCode: "P0171",
    codeDisplayLabel: "P0420",
    targetModule: "ECM",
    targetModuleId: "01_ECM",
    focusPid: "0106",
    title: "Bank 1 Catalytic Converter Oxygen Storage Efficiency Below Threshold",
    symptomSummary: "Downstream O2 switching mirrors upstream O2; emissions MIL illuminated.",
    mechanicalExplanation:
      "Bank 1 three-way catalytic converter cerium-zirconia washcoat lost oxygen-storage capacity, causing downstream O2 waveform to match upstream switching frequency.",
    oemPartName: "Direct-Fit Bank 1 Three-Way Catalytic Converter & O2 Kit",
    fairCostUsd: 1120,
    dealerQuoteUsd: 2380,
    laborHours: 2.9,
    safetyTriageLevel: "SAFE",
    powerLossPct: 7,
    severityScore: 41,
    recommendedUdsCommand: "7E0 04 31 01 04 20",
    telemetryOverrides: { "0106": 14.1, "0105": 103, "010C": 2750 },
  },
  {
    id: "AUTO_ABS_FL_SENSOR",
    dtcCode: "C0035",
    companionDtcCode: "C0040",
    codeDisplayLabel: "C0035",
    targetModule: "ABS",
    targetModuleId: "03_ABS",
    focusPid: "010D",
    title: "Front Left ABS Wheel Speed Sensor Plausibility Error",
    symptomSummary: "Front-left wheel speed dropouts to 14 km/h & ABS / traction warning.",
    mechanicalExplanation:
      "Front-left wheel bearing magneto-resistive encoder harness suffered flex fatigue inside the strut loop, dropping wheel speed pulses on CAN 0x7EA.",
    oemPartName: "Front Left Active Magneto-Resistive ABS Wheel Speed Sensor",
    fairCostUsd: 310,
    dealerQuoteUsd: 720,
    laborHours: 1.2,
    safetyTriageLevel: "CAUTION",
    powerLossPct: 5,
    severityScore: 57,
    recommendedUdsCommand: "7E0 04 31 01 00 35",
    telemetryOverrides: { "010D": 14, "010C": 2950, "0142": 13.9 },
  },
];

const HYBRID_CVT_FAULT_POOL: readonly FaultTemplate[] = [
  {
    id: "HYBRID_BCM_BATTERY_IMBALANCE",
    dtcCode: "P0A80",
    companionDtcCode: "P0AA6",
    codeDisplayLabel: "P0A80",
    targetModule: "BCM",
    targetModuleId: "09_BCM",
    focusPid: "22E001",
    title: "Hybrid Battery Pack Weak Cell Block Delta-V Imbalance",
    symptomSummary: "Traction battery cell block delta jumped to 184 mV & 12V bus sagged to 11.8V.",
    mechanicalExplanation:
      "Hybrid Battery Management Gateway logged >180 mV voltage sag across inner NiMH/Li-Ion cell block #7 under acceleration load, paired with 11.8V aux bus drop.",
    oemPartName: "Hybrid Traction Battery Module Block & Copper Busbar Kit",
    fairCostUsd: 1580,
    dealerQuoteUsd: 3450,
    laborHours: 4.0,
    safetyTriageLevel: "DO NOT DRIVE",
    powerLossPct: 38,
    severityScore: 91,
    recommendedUdsCommand: "7E0 04 31 01 E0 01",
    telemetryOverrides: { "22E001": 184, "0142": 11.8, "010C": 3350 },
  },
  {
    id: "HYBRID_ECM_COOLANT_PUMP",
    dtcCode: "P261B",
    companionDtcCode: "P0128",
    codeDisplayLabel: "P261B",
    targetModule: "ECM",
    targetModuleId: "01_ECM",
    focusPid: "0105",
    title: "Electric Engine Coolant Pump B Actuator RPM Drop",
    symptomSummary: "Brushless coolant water pump RPM drop; engine coolant spiked to 116°C.",
    mechanicalExplanation:
      "Brushless 12V electric engine coolant pump wet-rotor impeller swelled from silicate deposits, stalling below 900 RPM and spiking coolant temperature to 116°C.",
    oemPartName: "Brushless 12V Electric Engine Coolant Water Pump Assembly",
    fairCostUsd: 640,
    dealerQuoteUsd: 1390,
    laborHours: 2.3,
    safetyTriageLevel: "DO NOT DRIVE",
    powerLossPct: 34,
    severityScore: 92,
    recommendedUdsCommand: "7E0 04 31 01 26 1B",
    telemetryOverrides: { "0105": 116, "015C": 114, "010C": 2980 },
  },
  {
    id: "HYBRID_TCM_ECVT_PRESSURE",
    dtcCode: "P0841",
    companionDtcCode: "P0741",
    codeDisplayLabel: "P0841",
    targetModule: "TCM",
    targetModuleId: "02_TCM",
    focusPid: "22F40A",
    title: "eCVT / CVT Secondary Pulley Hydraulic Pressure Sensor Range",
    symptomSummary: "Variator clamping pressure dropped to 2.6 Bar with RPM flare.",
    mechanicalExplanation:
      "eCVT / CVT secondary pulley hydraulic pressure transducer piezo diaphragm drifted out of range, reducing clamping pressure to 2.6 Bar and causing variator slip.",
    oemPartName: "eCVT / CVT Secondary Pulley Hydraulic Pressure Sensor",
    fairCostUsd: 720,
    dealerQuoteUsd: 1680,
    laborHours: 2.8,
    safetyTriageLevel: "CAUTION",
    powerLossPct: 24,
    severityScore: 79,
    recommendedUdsCommand: "7E0 04 31 01 F4 0A",
    telemetryOverrides: { "22F40A": 2.6, "015C": 113, "010C": 3880 },
  },
  {
    id: "HYBRID_ABS_REGEN_BLENDING",
    dtcCode: "C0031",
    companionDtcCode: "C0035",
    codeDisplayLabel: "C0031",
    targetModule: "ABS",
    targetModuleId: "03_ABS",
    focusPid: "010D",
    title: "Regenerative Blending Brake Pressure Transducer Drift",
    symptomSummary: "Cooperative regen-to-friction brake stroke pressure sensor drift.",
    mechanicalExplanation:
      "ABS cooperative regenerative brake simulator pressure transducer drifted out of plausibility window, reverting braking to pure hydraulic friction.",
    oemPartName: "Cooperative Regenerative Brake Stroke Pressure Sensor",
    fairCostUsd: 540,
    dealerQuoteUsd: 1210,
    laborHours: 1.9,
    safetyTriageLevel: "CAUTION",
    powerLossPct: 10,
    severityScore: 64,
    recommendedUdsCommand: "7E0 04 31 01 00 31",
    telemetryOverrides: { "010D": 26, "0142": 12.6, "010C": 2740 },
  },
];

function numericHash(seed: string, digits: number): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const mod = Math.pow(10, digits);
  return String(Math.abs(h) % mod).padStart(digits, "0");
}

export function formatBrandOemPartNumber(
  makeInput: string,
  targetModule: TargetEcuShortCode,
  dtcCode: string
): string {
  const cleanMake = (makeInput || "").trim();
  const seed = `${cleanMake.toUpperCase()}:${targetModule}:${dtcCode.toUpperCase()}`;
  const d3 = numericHash(seed, 3);
  const d4 = numericHash(seed, 4);
  const revChar = "ABCDEFGHJKLMNPRSTUVWXYZ"[Number(d3) % 23];

  if (/audi|volkswagen|\bvw\b|porsche|bentley|lamborghini/i.test(cleanMake)) {
    return targetModule === "TCM" || targetModule === "ABS"
      ? `0B5-398-${d3}-${revChar}`
      : `06E-145-${d3}-${revChar}`;
  }
  if (/ford|lincoln/i.test(cleanMake)) {
    const subGroup =
      targetModule === "TCM"
        ? "7G383"
        : targetModule === "ABS"
        ? "2C204"
        : targetModule === "BCM"
        ? "10B759"
        : "6M280";
    return `JL3Z-${subGroup}-${revChar}`;
  }
  if (/bmw|mini/i.test(cleanMake)) {
    return `11-65-7-${d3}-${d4.slice(0, 3)}`;
  }
  if (/toyota|lexus|scion/i.test(cleanMake)) {
    return `89467-${d4}0`;
  }
  if (/honda|acura/i.test(cleanMake)) {
    return `37980-5BA-${revChar}${d3.slice(0, 2)}`;
  }
  if (/tesla/i.test(cleanMake)) {
    return `1089334-0${Number(d3) % 9}-${revChar}`;
  }
  if (/chevrolet|chevy|gmc|cadillac|buick/i.test(cleanMake)) {
    return `1268${d4}-${revChar}C`;
  }
  if (/mercedes|amg/i.test(cleanMake)) {
    return `A276-150-${d3.slice(0, 2)}-00`;
  }
  if (/subaru/i.test(cleanMake)) {
    return `22641-AA${d3}`;
  }
  if (/nissan|infiniti/i.test(cleanMake)) {
    return `23731-JA${d3}`;
  }
  if (/hyundai|kia|genesis/i.test(cleanMake)) {
    return `39210-2G${d3}`;
  }
  if (/mazda/i.test(cleanMake)) {
    return `PE01-18-${d3}${revChar}`;
  }
  if (/dodge|ram|jeep|chrysler/i.test(cleanMake)) {
    return `6825${d4}-AA`;
  }
  if (/rivian/i.test(cleanMake)) {
    return `PT000${d3}-${revChar}`;
  }
  if (/lucid/i.test(cleanMake)) {
    return `P21-HV${d3}-${revChar}`;
  }
  if (/volvo|polestar/i.test(cleanMake)) {
    return `3145${d4}-${revChar}`;
  }

  const alphaPrefix = cleanMake.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 3);
  const stamp = alphaPrefix.length >= 2 ? alphaPrefix.padEnd(3, "X") : "OEM";
  const modCode =
    targetModule === "ECM"
      ? "01"
      : targetModule === "TCM"
      ? "02"
      : targetModule === "ABS"
      ? "03"
      : "09";
  return `${stamp}-${modCode}-${d4}-${revChar}`;
}

export function formatVehicleShortMakeModel(rawLabel: string): string {
  const cleaned = (rawLabel || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "Your Vehicle";
  const tokens = cleaned.split(" ");
  const hasLeadingYear = /^(19|20)\d{2}$/.test(tokens[0] ?? "");
  const sliceCount = hasLeadingYear ? 3 : 2;
  const candidate = tokens.slice(0, Math.min(tokens.length, sliceCount + 1)).join(" ");
  return candidate.length > 26 ? tokens.slice(0, sliceCount).join(" ") : candidate;
}

export function normalizeVehicleDescriptor(
  input: VehicleFaultInput
): NormalizedVehicleDescriptor {
  const explicitYear = input.year !== undefined ? String(input.year).trim() : "";
  const explicitMake = (input.make || "").trim();
  const explicitModel = (input.model || "").trim();
  const rawYmm = (input.yearMakeModel || "").trim();

  const combinedName =
    rawYmm ||
    [explicitYear, explicitMake, explicitModel].filter(Boolean).join(" ").trim() ||
    "2022 Ford F-150";

  const tokens = combinedName.split(/\s+/).filter(Boolean);
  const parsedYearMatch = combinedName.match(/\b(19\d{2}|20\d{2})\b/);
  const year = explicitYear || parsedYearMatch?.[1] || "2022";

  let detectedMake = explicitMake;
  if (!detectedMake) {
    for (const entry of KNOWN_BRANDS) {
      if (entry.pattern.test(combinedName)) {
        detectedMake = entry.canonical;
        break;
      }
    }
  }
  if (!detectedMake) {
    const nonYearTokens = tokens.filter((t) => !/^(19|20)\d{2}$/.test(t));
    detectedMake = nonYearTokens[0] || "OEM";
  }

  let detectedModel = explicitModel;
  if (!detectedModel) {
    const withoutYear = tokens.filter((t) => t !== year);
    const makeLower = detectedMake.toLowerCase();
    const afterMake = withoutYear.filter((t, idx) =>
      idx === 0 && t.toLowerCase() === makeLower ? false : true
    );
    detectedModel = afterMake.join(" ") || "Series";
  }

  const pt = (input.powertrain || "").trim();
  const tr = (input.transmission || "").trim();
  const fullContext = `${combinedName} ${explicitMake} ${explicitModel}`.trim();

  const explicitEv =
    (/\bfull\s*electric\b|\bev\b|\belectric\b|\bbev\b|\b800v\b/i.test(pt) &&
      !/hybrid|phev/i.test(pt)) ||
    /\bev\s*single|\bsingle[- ]?speed\s*ev|\bdirect[- ]?drive\s*ev/i.test(tr);

  const explicitNonEv =
    /\bgas\b|\bturbo\b|\bsupercharged\b|\bhybrid\b|\bdiesel\b|\bice\b|\brotary\b/i.test(pt);

  const explicitManual = /\bmanual\b|\b6mt\b|\b5mt\b|\bstick\b/i.test(tr);
  const explicitDct = /\bdct\b|\bdsg\b|\bpdk\b|\bdual[- ]?clutch\b|\bs[- ]?tronic\b/i.test(tr);
  const explicitCvt = /\bcvt\b|\becvt\b/i.test(tr);

  const isEv =
    explicitEv ||
    (!explicitNonEv && !explicitManual && !explicitDct && !explicitCvt && KNOWN_EV_NAME_REGEX.test(fullContext));

  const isManual =
    !isEv &&
    (explicitManual ||
      (!tr && /\b(manual|6mt|5mt|6[- ]speed\s*manual|type[- ]r|sti)\b/i.test(fullContext)));

  const isDct =
    !isEv &&
    !isManual &&
    (explicitDct || (!tr && /\b(dsg|dct|pdk|dual[- ]?clutch|s[- ]?tronic)\b/i.test(fullContext)));

  const isHybrid =
    !isEv &&
    (/hybrid|phev/i.test(pt) ||
      (!pt && /\b(hybrid|prius|phev|powerboost|ecvt)\b/i.test(fullContext)));

  const isCvt =
    !isEv &&
    !isManual &&
    !isDct &&
    (explicitCvt || (!tr && /\b(cvt|ecvt)\b/i.test(fullContext)));

  const poolCategory: NormalizedPowertrainPool = isEv
    ? "EV"
    : isManual
    ? "MANUAL"
    : isDct
    ? "DCT"
    : isHybrid || isCvt
    ? "HYBRID_CVT"
    : "STANDARD_AUTOMATIC";

  const powertrainLabel = isEv
    ? "Full Electric (EV)"
    : isHybrid
    ? "Hybrid"
    : pt || "Standard Gas";

  const transmissionLabel = isEv
    ? "EV Single-Speed"
    : isManual
    ? "Manual"
    : isDct
    ? "Dual-Clutch (DSG / DCT)"
    : isCvt
    ? "CVT"
    : tr || "Standard Automatic";

  const fullLabel = rawYmm || `${year} ${detectedMake} ${detectedModel}`.trim();

  return {
    year,
    make: detectedMake,
    model: detectedModel,
    displayMakeModel: formatVehicleShortMakeModel(fullLabel),
    fullLabel,
    powertrainLabel,
    transmissionLabel,
    poolCategory,
    isEv,
    isManual,
    isHybrid,
  };
}

const COMBUSTION_ONLY_DTCS = new Set<string>([
  "P0171",
  "P0174",
  "P0300",
  "P0301",
  "P0302",
  "P0303",
  "P0304",
  "P0420",
  "P0430",
  "P0016",
  "P0011",
  "P0128",
  "P0299",
  "P10A4",
  "P2015",
  "P261B",
]);

export function isCombustionFaultDtc(dtcCode: string): boolean {
  const upper = (dtcCode || "").trim().toUpperCase();
  if (COMBUSTION_ONLY_DTCS.has(upper)) return true;
  return /^P0[1234][0-9A-F]{2}$/.test(upper);
}

export function isMultiGearOrAutoTransFaultDtc(dtcCode: string): boolean {
  const upper = (dtcCode || "").trim().toUpperCase();
  return /^P[012][78][0-9A-F]{2}$/.test(upper);
}

function materializeGeneratedFault(
  template: FaultTemplate,
  vehicle: NormalizedVehicleDescriptor
): GeneratedVehicleFault {
  const oemPartNumber = formatBrandOemPartNumber(
    vehicle.make,
    template.targetModule,
    template.dtcCode
  );
  const fullExplanation = `[${vehicle.fullLabel} • ${vehicle.powertrainLabel} • ${vehicle.transmissionLabel}] ${template.mechanicalExplanation}`;
  const curseName = `[${template.targetModule}] ${template.title} (${template.codeDisplayLabel})`;

  const curse: MechanicalCursePreset = {
    id: `${template.id.toLowerCase()}-${vehicle.make.toLowerCase().replace(/[^a-z0-9]/g, "") || "oem"}`,
    name: curseName,
    dtcCode: template.dtcCode,
    companionDtcCode: template.companionDtcCode,
    codeDisplayLabel: template.codeDisplayLabel,
    targetModuleId: template.targetModuleId,
    dealerQuoteUsd: template.dealerQuoteUsd,
    safetyTriageLevel: template.safetyTriageLevel,
    symptomSummary: template.symptomSummary,
    severityScore: template.severityScore,
    powerLossPct: template.powerLossPct,
    targetPid: template.focusPid,
    oemPartName: `${vehicle.make} ${template.oemPartName}`,
    oemPartNumber,
    estimatedCostUsd: template.fairCostUsd,
    laborHours: template.laborHours,
    recommendedUdsCommand: template.recommendedUdsCommand,
    mechanicalExplanation: fullExplanation,
    telemetryOverrides: { ...template.telemetryOverrides },
  };

  return {
    id: template.id,
    dtcCode: template.dtcCode,
    companionDtcCode: template.companionDtcCode,
    codeDisplayLabel: template.codeDisplayLabel,
    targetModule: template.targetModule,
    targetModuleId: template.targetModuleId,
    focusPid: template.focusPid,
    title: template.title,
    symptomSummary: template.symptomSummary,
    mechanicalExplanation: fullExplanation,
    oemPartName: curse.oemPartName,
    oemPartNumber,
    fairCostUsd: template.fairCostUsd,
    dealerQuoteUsd: template.dealerQuoteUsd,
    laborHours: template.laborHours,
    safetyTriageLevel: template.safetyTriageLevel,
    powerLossPct: template.powerLossPct,
    severityScore: template.severityScore,
    recommendedUdsCommand: template.recommendedUdsCommand,
    telemetryOverrides: { ...template.telemetryOverrides },
    vehicle,
    curse,
  };
}

export function getValidFaultPoolForVehicle(
  input: VehicleFaultInput
): GeneratedVehicleFault[] {
  const vehicle = normalizeVehicleDescriptor(input);

  let templates: readonly FaultTemplate[];
  switch (vehicle.poolCategory) {
    case "EV":
      templates = EV_FAULT_POOL;
      break;
    case "MANUAL":
      templates = MANUAL_FAULT_POOL;
      break;
    case "DCT":
      templates = DCT_FAULT_POOL;
      break;
    case "HYBRID_CVT":
      templates = vehicle.isHybrid
        ? HYBRID_CVT_FAULT_POOL
        : [
            STANDARD_AUTO_FAULT_POOL[2],
            HYBRID_CVT_FAULT_POOL[1],
            HYBRID_CVT_FAULT_POOL[2],
            HYBRID_CVT_FAULT_POOL[3],
          ];
      break;
    case "STANDARD_AUTOMATIC":
    default:
      templates = STANDARD_AUTO_FAULT_POOL;
      break;
  }

  return templates.map((tpl) => materializeGeneratedFault(tpl, vehicle));
}

export interface RollRandomFaultOptions {
  previousFaultId?: string | null;
  previousDtcCode?: string | null;
  rng?: () => number;
}

export function rollRandomVehicleFault(
  input: VehicleFaultInput,
  options?: RollRandomFaultOptions
): GeneratedVehicleFault {
  const pool = getValidFaultPoolForVehicle(input);
  const prevId = options?.previousFaultId?.trim() || null;
  const prevDtc = options?.previousDtcCode?.trim().toUpperCase() || null;

  const nonRepeating = pool.filter((candidate) => {
    if (prevId && (candidate.id === prevId || candidate.curse.id === prevId)) {
      return false;
    }
    if (prevDtc && candidate.dtcCode.toUpperCase() === prevDtc) {
      return false;
    }
    return true;
  });

  const activePool = nonRepeating.length > 0 ? nonRepeating : pool;
  const rawRand = options?.rng ? options.rng() : Math.random();
  const safeRand = Number.isFinite(rawRand)
    ? Math.min(0.999999999, Math.max(0, rawRand - Math.floor(rawRand)))
    : 0;
  const chosenIndex = Math.min(
    activePool.length - 1,
    Math.floor(safeRand * activePool.length)
  );
  return activePool[chosenIndex];
}








