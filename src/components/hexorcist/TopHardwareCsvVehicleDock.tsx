"use client";

import React, { useRef, useState } from "react";
import {
  Cable,
  Car,
  Download,
  FileSpreadsheet,
  Plus,
  Radio,
  Search,
  Upload,
  Zap,
} from "lucide-react";
import { MechanicalCursePreset, PidKey, VehicleSoulPreset } from "@/lib/obd-hex-engine";
import { TelemetryPlaybackFrame } from "@/lib/log-and-dbc-engine";
import {
  QuickVehiclePresetId,
  REAL_WORLD_VEHICLE_PRESETS,
  UserPowertrainType,
  UserTransmissionType,
} from "@/lib/custom-car-and-sliders";
import { lookupUniversalDtc } from "@/lib/obd-scanner-qol";
import { formatVehicleShortMakeModel } from "@/lib/vehicle-fault-generator";
import {
  CsvPlaybackScrubberBar,
  PlaybackSpeedMultiplier,
} from "@/components/HardwareAndDbcModal";
import type { ConnectionMode } from "./TopCommandBar";
import { playHexSound } from "@/lib/sound-fx";

export type SerialBaudRate = 38400 | 115200 | 500000;

export interface InlineVehicleSpecUpdate {
  yearMakeModel: string;
  powertrainType: UserPowertrainType;
  transmissionType: UserTransmissionType;
}

export interface TopHardwareCsvVehicleDockProps {
  // Module 1: Live OBD-II Scanner (WebSerial USB / Bluetooth)
  connectionMode: ConnectionMode;
  physicalPortConnected: boolean;
  loopbackActive: boolean;
  webSerialStatus: string;
  baudRate: SerialBaudRate;
  onChangeBaudRate: (baud: SerialBaudRate) => void;
  onConnectObdHardware: (baud: SerialBaudRate) => void;
  onActivateLoopback: () => void;
  onDisconnectHardware: () => void;
  onScanCodesNow: () => void;
  // Module 2: Instant CSV Dropzone & Sample Loader + Timeline Scrubber
  csvFrames: TelemetryPlaybackFrame[];
  csvCursor: number;
  csvPlaying: boolean;
  csvSpeed: PlaybackSpeedMultiplier;
  csvSourceLabel: string;
  primaryPid: PidKey;
  onUploadCsvFile: (file: File) => void;
  onLoadSampleAudiCsv: () => void;
  onExportCsv: () => void;
  onSeekCsv: (index: number) => void;
  onTogglePlayCsv: () => void;
  onChangeSpeedCsv: (speed: PlaybackSpeedMultiplier) => void;
  onExitCsvReplay: () => void;
  // Module 3: Vehicle Garage + Inline Vehicle Input & Judge Sandbox Engine
  soul: VehicleSoulPreset;
  activeVin: string;
  activeQuickPresetId: QuickVehiclePresetId | null;
  onSelectQuickPreset: (presetId: QuickVehiclePresetId) => void;
  onOpenEnterOwnCarModal: () => void;
  onOpenRawVinDecoderModal: () => void;
  activePowertrain?: UserPowertrainType;
  activeTransmission?: UserTransmissionType;
  activeCurse?: MechanicalCursePreset | null;
  onApplyInlineVehicle?: (spec: InlineVehicleSpecUpdate) => void;
  onRollRandomFault?: () => void;
  onClearMode04Codes?: () => void;
}

const BAUD_OPTIONS: ReadonlyArray<{ value: SerialBaudRate; label: string }> = [
  { value: 38400, label: "38400" },
  { value: 115200, label: "115200" },
  { value: 500000, label: "500kbps" },
];

const INLINE_POWERTRAIN_OPTIONS: readonly UserPowertrainType[] = [
  "Standard Gas",
  "Turbo / Supercharged",
  "Hybrid",
  "Full Electric (EV)",
];

const INLINE_TRANSMISSION_OPTIONS: readonly UserTransmissionType[] = [
  "Standard Automatic",
  "Dual-Clutch (DSG / DCT)",
  "Manual",
  "CVT",
  "EV Single-Speed",
];

const QUICK_SHOWCASE_VEHICLES: ReadonlyArray<InlineVehicleSpecUpdate & { chip: string }> = [
  {
    chip: "14 Audi S4 DSG",
    yearMakeModel: "2014 Audi S4 3.0T DSG",
    powertrainType: "Turbo / Supercharged",
    transmissionType: "Dual-Clutch (DSG / DCT)",
  },
  {
    chip: "22 Ford F-150 Auto",
    yearMakeModel: "2022 Ford F-150 5.0L Automatic",
    powertrainType: "Standard Gas",
    transmissionType: "Standard Automatic",
  },
  {
    chip: "24 Dual-Motor EV",
    yearMakeModel: "2024 Dual-Motor AWD EV",
    powertrainType: "Full Electric (EV)",
    transmissionType: "EV Single-Speed",
  },
  {
    chip: "23 Civic Type R Manual",
    yearMakeModel: "2023 Honda Civic Type R",
    powertrainType: "Turbo / Supercharged",
    transmissionType: "Manual",
  },
];

export function TopHardwareCsvVehicleDock({
  connectionMode,
  physicalPortConnected,
  loopbackActive,
  webSerialStatus,
  baudRate,
  onChangeBaudRate,
  onConnectObdHardware,
  onActivateLoopback,
  onDisconnectHardware,
  onScanCodesNow,
  csvFrames,
  csvCursor,
  csvPlaying,
  csvSpeed,
  csvSourceLabel,
  primaryPid,
  onUploadCsvFile,
  onLoadSampleAudiCsv,
  onExportCsv,
  onSeekCsv,
  onTogglePlayCsv,
  onChangeSpeedCsv,
  onExitCsvReplay,
  soul,
  activeVin,
  activeQuickPresetId,
  onSelectQuickPreset,
  onOpenEnterOwnCarModal,
  onOpenRawVinDecoderModal,
  activePowertrain = "Turbo / Supercharged",
  activeTransmission = "Dual-Clutch (DSG / DCT)",
  activeCurse = null,
  onApplyInlineVehicle,
  onRollRandomFault,
  onClearMode04Codes,
}: TopHardwareCsvVehicleDockProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [draftYmm, setDraftYmm] = useState<string | null>(null);

  const isHardwareLive = physicalPortConnected || loopbackActive;
  const isCsvActive = connectionMode === "CSV REPLAY" && csvFrames.length > 0;
  const isSimulatorLocked = isHardwareLive || isCsvActive;
  const displayedYmm = draftYmm !== null ? draftYmm : soul.yearMakeModel;
  const shortMakeModel = formatVehicleShortMakeModel(soul.yearMakeModel);
  const activeFaultModuleShort = activeCurse
    ? activeCurse.targetModuleId === "02_TCM"
      ? "TCM"
      : activeCurse.targetModuleId === "03_ABS"
      ? "ABS"
      : activeCurse.targetModuleId === "09_BCM"
      ? "BCM"
      : activeCurse.targetModuleId === "01_ECM"
      ? "ECM"
      : lookupUniversalDtc(activeCurse.dtcCode).moduleId === "02_TCM"
      ? "TCM"
      : lookupUniversalDtc(activeCurse.dtcCode).moduleId === "03_ABS"
      ? "ABS"
      : lookupUniversalDtc(activeCurse.dtcCode).moduleId === "09_BCM"
      ? "BCM"
      : "ECM"
    : null;

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      playHexSound("CLICK");
      onUploadCsvFile(file);
    }
  };

  return (
    <section
      data-cinema-target="TOP_HARDWARE_DOCK"
      className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 space-y-3"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* MODULE 1: Live OBD-II Scanner (WebSerial USB / Bluetooth) */}
        <div
          data-cinema-target="DOCK_OBD_HARDWARE"
          className="obsidian-panel rounded-2xl p-4 flex flex-col justify-between gap-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <Cable className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300">
                  🔌 LIVE OBD-II SCANNER (WEBSERIAL)
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400 line-clamp-1" title={webSerialStatus}>
                {webSerialStatus}
              </p>
            </div>

            {/* Live Packet Pulse LED + Baud Selector */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>{isHardwareLive ? "LINKED" : isCsvActive ? "REPLAY" : "25Hz RX"}</span>
              </span>

              <select
                aria-label="OBD-II Baud Rate Selector"
                value={baudRate}
                onChange={(e) => {
                  playHexSound("CLICK");
                  onChangeBaudRate(Number(e.target.value) as SerialBaudRate);
                }}
                className="rounded-lg border border-white/[0.1] bg-zinc-950 px-2 py-1 font-mono text-[10px] text-zinc-200 outline-none focus:border-emerald-400 cursor-pointer"
              >
                {BAUD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isHardwareLive ? (
              <button
                type="button"
                onClick={() => {
                  playHexSound("CLICK");
                  onDisconnectHardware();
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition cursor-pointer"
              >
                <Radio className="h-3.5 w-3.5" />
                <span>Disconnect Port</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  playHexSound("CLICK");
                  onConnectObdHardware(baudRate);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 transition cursor-pointer"
              >
                <Cable className="h-3.5 w-3.5 text-emerald-400" />
                <span>Connect OBD-II Hardware</span>
              </button>
            )}

            <button
              type="button"
              onClick={onScanCodesNow}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Scan Codes Now</span>
            </button>

            {!isHardwareLive && (
              <button
                type="button"
                onClick={onActivateLoopback}
                title="Activate Virtual ELM327 COM4 Loopback"
                className="rounded-xl border border-white/[0.08] bg-zinc-900/80 px-2.5 py-2 font-mono text-[10px] text-zinc-400 hover:border-white/[0.18] hover:text-zinc-200 transition cursor-pointer"
              >
                COM4 Sim
              </button>
            )}
          </div>
        </div>

        {/* MODULE 2: Instant CSV Telemetry Dropzone & Sample Loader */}
        <div
          data-cinema-target="DOCK_CSV_DROPZONE"
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`obsidian-panel rounded-2xl p-4 flex flex-col justify-between gap-3 transition ${
            dragActive ? "border-cyan-400/60 bg-cyan-950/25" : ""
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                playHexSound("CLICK");
                onUploadCsvFile(f);
              }
              e.target.value = "";
            }}
          />

          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5 text-cyan-400" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300">
                  📂 INSTANT CSV TELEMETRY DROPZONE
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400 line-clamp-1">
                {isCsvActive
                  ? `Active: ${csvSourceLabel} (${csvFrames.length} rows)`
                  : "Drag & drop any .CSV drive log or load track sample"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-white/[0.18] bg-zinc-950/80 px-2.5 py-1 text-[10px] font-medium text-zinc-300 hover:border-cyan-400/50 hover:text-white transition cursor-pointer shrink-0"
            >
              <Upload className="h-3 w-3 text-cyan-400" />
              <span>Upload .CSV</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-cinema-target="DOCK_LOAD_SAMPLE_CSV"
              onClick={() => {
                playHexSound("CLICK");
                onLoadSampleAudiCsv();
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/35 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 transition cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5 text-cyan-300" />
              <span>⚡ Load Sample Audi S4 Track CSV</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playHexSound("CLICK");
                onExportCsv();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-zinc-900/80 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-white/[0.2] hover:text-white transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-zinc-400" />
              <span>📥 Export CSV</span>
            </button>
          </div>
        </div>

        {/* MODULE 3: Vehicle Garage (Enter Your Own Car + Live NHTSA VIN + 3 Presets) */}
        <div
          data-cinema-target="DOCK_VEHICLE_GARAGE"
          className="obsidian-panel rounded-2xl p-4 flex flex-col justify-between gap-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300 truncate">
                  🏎️ VEHICLE GARAGE &amp; NHTSA VIN
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 truncate">
                <span className="text-xs font-semibold text-white truncate">
                  {soul.yearMakeModel}
                </span>
                <button
                  type="button"
                  onClick={onOpenRawVinDecoderModal}
                  className="font-mono text-[10px] text-violet-300 hover:text-violet-200 underline decoration-dotted cursor-pointer shrink-0"
                  title="Decode 17-Digit US DOT NHTSA VIN"
                >
                  VIN: {activeVin.slice(0, 9)}…
                </button>
              </div>
            </div>

            <button
              type="button"
              data-cinema-target="ENTER_OWN_CAR_BTN"
              onClick={() => {
                playHexSound("CLICK");
                onOpenEnterOwnCarModal();
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-violet-400/45 bg-violet-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-violet-100 shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:bg-violet-500/30 transition cursor-pointer shrink-0"
            >
              <Plus className="h-3.5 w-3.5 text-violet-300" />
              <span>Enter My Own Car / VIN</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {REAL_WORLD_VEHICLE_PRESETS.map((preset) => {
              const selected = activeQuickPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    playHexSound("CLICK");
                    onSelectQuickPreset(preset.id);
                  }}
                  className={`rounded-xl border px-2 py-1.5 text-center text-[10px] font-semibold transition cursor-pointer truncate ${
                    selected
                      ? "border-emerald-500/45 bg-emerald-500/15 text-emerald-200"
                      : "border-white/[0.08] bg-zinc-950/75 text-zinc-400 hover:border-white/[0.18] hover:text-zinc-200"
                  }`}
                  title={preset.shortTitle}
                >
                  {preset.emoji}{" "}
                  {preset.id === "PRESET_2014_V6_DSG"
                    ? "14 V6 DSG"
                    : preset.id === "PRESET_2024_AWD_EV"
                    ? "24 AWD EV"
                    : "20 Sedan"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Inline Vehicle Input Bar + Judge Sandbox Randomized Fault Engine Strip */}
      <div
        data-cinema-target="SANDBOX_CONTROL_BAR"
        className="rounded-xl border border-white/[0.08] bg-zinc-950/75 px-3.5 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3"
      >
        <form
          data-cinema-target="VEHICLE_INPUT_BAR"
          onSubmit={(e) => {
            e.preventDefault();
            if (!onApplyInlineVehicle) return;
            playHexSound("EXORCISM_CHIME");
            const nextName = displayedYmm.trim() || soul.yearMakeModel;
            setDraftYmm(null);
            onApplyInlineVehicle({
              yearMakeModel: nextName,
              powertrainType: activePowertrain,
              transmissionType: activeTransmission,
            });
          }}
          className="flex flex-wrap items-center gap-2 flex-1 min-w-0"
        >
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-violet-300 shrink-0">
            🚗 VEHICLE INPUT:
          </span>

          <input
            type="text"
            aria-label="Vehicle Year Make Model Input"
            value={displayedYmm}
            onChange={(e) => setDraftYmm(e.target.value)}
            placeholder="e.g. 2022 Ford F-150 5.0L"
            className="w-44 sm:w-52 rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white outline-none focus:border-violet-400/60"
          />

          <select
            aria-label="Vehicle Powertrain Selector"
            value={activePowertrain}
            onChange={(e) => {
              const nextPt = e.target.value as UserPowertrainType;
              const nextTr: UserTransmissionType =
                nextPt === "Full Electric (EV)"
                  ? "EV Single-Speed"
                  : activeTransmission === "EV Single-Speed"
                  ? "Standard Automatic"
                  : activeTransmission;
              playHexSound("CLICK");
              const nextName = displayedYmm.trim() || soul.yearMakeModel;
              setDraftYmm(null);
              onApplyInlineVehicle?.({
                yearMakeModel: nextName,
                powertrainType: nextPt,
                transmissionType: nextTr,
              });
            }}
            className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-violet-400/60 cursor-pointer"
          >
            {INLINE_POWERTRAIN_OPTIONS.map((pt) => (
              <option key={pt} value={pt}>
                {pt}
              </option>
            ))}
          </select>

          <select
            aria-label="Vehicle Transmission Selector"
            value={activeTransmission}
            onChange={(e) => {
              const nextTr = e.target.value as UserTransmissionType;
              const nextPt: UserPowertrainType =
                nextTr === "EV Single-Speed"
                  ? "Full Electric (EV)"
                  : activePowertrain === "Full Electric (EV)"
                  ? "Standard Gas"
                  : activePowertrain;
              playHexSound("CLICK");
              const nextName = displayedYmm.trim() || soul.yearMakeModel;
              setDraftYmm(null);
              onApplyInlineVehicle?.({
                yearMakeModel: nextName,
                powertrainType: nextPt,
                transmissionType: nextTr,
              });
            }}
            className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-violet-400/60 cursor-pointer"
          >
            {INLINE_TRANSMISSION_OPTIONS.map((tr) => (
              <option key={tr} value={tr}>
                {tr}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/25 transition cursor-pointer shrink-0"
          >
            Apply Car
          </button>
          <div className="hidden 2xl:flex items-center gap-1 pl-1">
            {QUICK_SHOWCASE_VEHICLES.map((item) => (
              <button
                key={item.chip}
                type="button"
                onClick={() => {
                  playHexSound("CLICK");
                  setDraftYmm(null);
                  onApplyInlineVehicle?.({
                    yearMakeModel: item.yearMakeModel,
                    powertrainType: item.powertrainType,
                    transmissionType: item.transmissionType,
                  });
                }}
                className="rounded-md border border-white/[0.07] bg-zinc-900/90 px-2 py-1 text-[10px] font-medium text-zinc-400 hover:border-violet-400/40 hover:text-zinc-100 cursor-pointer"
              >
                {item.chip}
              </button>
            ))}
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isSimulatorLocked ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 font-mono text-[11px] font-semibold text-amber-200">
                🔒 {isHardwareLive ? "Live OBD-II Override Active" : "CSV File Override Active"} — Simulator Locked
              </span>
              {isCsvActive && (
                <button
                  type="button"
                  onClick={() => {
                    playHexSound("CLICK");
                    onExitCsvReplay();
                  }}
                  className="rounded-lg border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                >
                  Return to Sandbox
                </button>
              )}
            </>
          ) : activeCurse ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/12 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-rose-200">
                [{activeFaultModuleShort}] {activeCurse.codeDisplayLabel ?? activeCurse.dtcCode} •{" "}
                {activeCurse.oemPartNumber}
              </span>
              <button
                type="button"
                data-cinema-target="REROLL_RANDOM_FAULT_BTN"
                onClick={() => {
                  onRollRandomFault?.();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.18)] hover:bg-amber-500/25 transition cursor-pointer"
              >
                <span>🎲 Re-Roll Another Issue</span>
              </button>
              {onClearMode04Codes && (
                <button
                  type="button"
                  onClick={onClearMode04Codes}
                  className="rounded-xl border border-emerald-500/35 bg-emerald-500/12 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
                >
                  Clear ($04)
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              data-cinema-target="SIMULATE_RANDOM_FAULT_BTN"
              onClick={() => {
                onRollRandomFault?.();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold text-amber-100 shadow-[0_0_16px_rgba(245,158,11,0.2)] hover:bg-amber-500/25 transition cursor-pointer"
            >
              <span>🎲 Simulate Random Issue for {shortMakeModel}</span>
            </button>
          )}
        </div>
      </div>

      {isCsvActive && (
        <div data-cinema-target="DOCK_CSV_SCRUBBER">
          <CsvPlaybackScrubberBar
            frames={csvFrames}
            cursor={csvCursor}
            playing={csvPlaying}
            speed={csvSpeed}
            sourceLabel={csvSourceLabel}
            primaryPid={primaryPid}
            onSeek={onSeekCsv}
            onTogglePlay={onTogglePlayCsv}
            onChangeSpeed={onChangeSpeedCsv}
            onExitReplay={onExitCsvReplay}
          />
        </div>
      )}
    </section>
  );
}



