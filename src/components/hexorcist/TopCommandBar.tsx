"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Clapperboard,
  Cpu,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  CheckCircle2,
  Loader2,
  Zap,
} from "lucide-react";
import {
  SoulProfileId,
  VEHICLE_SOUL_LIST,
  VEHICLE_SOUL_PRESETS,
  VehicleArchitectureId,
  VehicleSoulPreset,
} from "@/lib/obd-hex-engine";
import {
  QuickVehiclePresetId,
  REAL_WORLD_VEHICLE_PRESETS,
  UserCustomCarConfig,
  WORKSPACE_TABS,
  WorkspaceTabId,
} from "@/lib/custom-car-and-sliders";
import { formatVehicleShortMakeModel } from "@/lib/vehicle-fault-generator";
import { EnterYourOwnCarModal } from "./EnterYourOwnCarModal";

export { WORKSPACE_TABS };
export type { WorkspaceTabId };
export type ConnectionMode = "VIRTUAL ECU 25Hz" | "WEBSERIAL ELM327" | "CSV REPLAY";
export type WorkspaceViewMode = "FOCUSED" | "PRO";
export type HeaderHealthStatus = "HEALTHY" | "CAUTION" | "FAULT";

export interface DecodedNhtsaVin {
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

interface TopCommandBarProps {
  activeWorkspaceTab: WorkspaceTabId;
  onSelectWorkspaceTab: (tab: WorkspaceTabId) => void;
  healthStatus: HeaderHealthStatus;
  hasActiveFault: boolean;
  onToggleInjectOrResetFault: () => void;
  onRollRandomFault?: () => void;
  simulatorLockedReason?: string | null;
  vehicleMakeModelLabel?: string;
  activeVehicleId: SoulProfileId;
  onSelectVehicle: (id: SoulProfileId) => void;
  customVinSoul: VehicleSoulPreset | null;
  onBindCustomVinSoul: (decoded: DecodedNhtsaVin) => void;
  onToggleCinemaLauncher: () => void;
  cinemaLauncherOpen: boolean;
  cinemaRunning: boolean;
  cinemaRecording: boolean;
  cinemaVehiclePopoverOpen?: boolean;
  onCloseCinemaVehiclePopover?: () => void;
  cinemaVinModalOpen?: boolean;
  onCloseCinemaVinModal?: () => void;
  soundMuted: boolean;
  onToggleSoundMuted: () => void;
  activeVin: string;
  decodedVinInfo: DecodedNhtsaVin | null;
  onApplyVin: (vin: string, decoded: DecodedNhtsaVin | null) => void;
  activeQuickPresetId?: QuickVehiclePresetId | null;
  onSelectQuickPreset?: (presetId: QuickVehiclePresetId) => void;
  savedUserCarConfig?: UserCustomCarConfig | null;
  onSaveUserCustomCar?: (config: UserCustomCarConfig) => void;
  cinemaOwnCarModalOpen?: boolean;
  onCloseCinemaOwnCarModal?: () => void;
}

export function TopCommandBar({
  activeWorkspaceTab,
  onSelectWorkspaceTab,
  healthStatus,
  hasActiveFault,
  onToggleInjectOrResetFault,
  onRollRandomFault,
  simulatorLockedReason = null,
  vehicleMakeModelLabel,
  activeVehicleId,
  onSelectVehicle,
  customVinSoul,
  onBindCustomVinSoul,
  onToggleCinemaLauncher,
  cinemaLauncherOpen,
  cinemaRunning,
  cinemaRecording,
  cinemaVehiclePopoverOpen = false,
  onCloseCinemaVehiclePopover,
  cinemaVinModalOpen = false,
  onCloseCinemaVinModal,
  soundMuted,
  onToggleSoundMuted,
  activeVin,
  decodedVinInfo,
  onApplyVin,
  activeQuickPresetId = "PRESET_2014_V6_DSG",
  onSelectQuickPreset,
  savedUserCarConfig = null,
  onSaveUserCustomCar,
  cinemaOwnCarModalOpen = false,
  onCloseCinemaOwnCarModal,
}: TopCommandBarProps) {
  const [vehiclePopoverOpen, setVehiclePopoverOpen] = useState(false);
  const [ownCarModalOpen, setOwnCarModalOpen] = useState(false);
  const [vinInput, setVinInput] = useState(activeVin);
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState<string | null>(null);
  const [modalDecoded, setModalDecoded] = useState<DecodedNhtsaVin | null>(decodedVinInfo);

  const openPopover = () => {
    setVinInput(activeVin);
    setModalDecoded(decodedVinInfo);
    setVinError(null);
    setVehiclePopoverOpen(true);
  };

  const closeModal = () => {
    setVehiclePopoverOpen(false);
    onCloseCinemaVehiclePopover?.();
    onCloseCinemaVinModal?.();
  };

  const isPopoverOpen =
    vehiclePopoverOpen || Boolean(cinemaVehiclePopoverOpen) || Boolean(cinemaVinModalOpen);
  const displayedDecoded = cinemaVinModalOpen ? decodedVinInfo : modalDecoded;
  const displayedVinInput = cinemaVinModalOpen ? activeVin : vinInput;

  const handleDecodeVin = async (targetVin?: string) => {
    const cleanVin = (targetVin ?? vinInput).trim().toUpperCase();
    setVinInput(cleanVin);
    if (cleanVin.length !== 17) {
      setVinError("Enter a valid 17-character ISO 3779 VIN.");
      return;
    }

    setVinLoading(true);
    setVinError(null);
    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(
          cleanVin
        )}?format=json`
      );
      if (!res.ok) throw new Error(`NHTSA HTTP ${res.status}`);
      const data = await res.json();
      const row = data?.Results?.[0];
      if (!row) throw new Error("No NHTSA vPIC record returned.");

      const parsed: DecodedNhtsaVin = {
        vin: cleanVin,
        make: row.Make || "OEM",
        model: row.Model || "CHASSIS",
        modelYear: row.ModelYear || "2025",
        bodyClass: row.BodyClass || "Performance Chassis",
        engineInfo:
          [
            row.DisplacementL ? `${row.DisplacementL}L` : "",
            row.EngineCylinders ? `${row.EngineCylinders}-Cyl` : "",
            row.EngineHP ? `${row.EngineHP} HP` : "",
          ]
            .filter(Boolean)
            .join(" ") || "High-Output Powertrain",
        fuelType: row.FuelTypePrimary || "Gasoline",
        driveType: row.DriveType || "AWD / RWD",
        plantInfo:
          [row.PlantCity, row.PlantCountry].filter(Boolean).join(", ") || "Global Assembly",
        displacementL: row.DisplacementL || "",
        cylinders: row.EngineCylinders || "",
        horsepower: row.EngineHP || "",
      };
      setModalDecoded(parsed);
      onApplyVin(cleanVin, parsed);
    } catch {
      // Offline resilient WMI fallback so air-gapped testing can still decode & bind Custom VIN Souls
      const wmi = cleanVin.slice(0, 3);
      const fallbackMake =
        wmi.startsWith("1FA") || wmi.startsWith("1FT")
          ? "NA V8 POWERTRAIN"
          : wmi.startsWith("1HG") || wmi.startsWith("JHM")
          ? "JDM TURBO CHASSIS"
          : wmi.startsWith("5YJ")
          ? "800V EV ARCHITECTURE"
          : wmi.startsWith("WAU")
          ? "EURO SUPERCHARGED CHASSIS"
          : wmi.startsWith("WBA") || wmi.startsWith("WBS")
          ? "EURO PERFORMANCE CHASSIS"
          : "ISO 3779 OEM CHASSIS";
      const isEvFallback = wmi.startsWith("5YJ");
      const fallbackParsed: DecodedNhtsaVin = {
        vin: cleanVin,
        make: fallbackMake,
        model: isEvFallback ? "Dual-Motor Sedan" : "GT Touring",
        modelYear: "2023",
        bodyClass: "Sedan / Coupe",
        engineInfo: isEvFallback ? "Dual Motor Electric 450 HP" : "3.5L 6-Cyl 340 HP",
        fuelType: isEvFallback ? "Electric" : "Gasoline",
        driveType: "AWD",
        plantInfo: "ISO 3779 WMI Offline Synthesis",
        displacementL: isEvFallback ? "0" : "3.5",
        cylinders: isEvFallback ? "0" : "6",
        horsepower: isEvFallback ? "450" : "340",
      };
      setModalDecoded(fallbackParsed);
      onApplyVin(cleanVin, fallbackParsed);
    } finally {
      setVinLoading(false);
    }
  };

  const displayedSouls: VehicleSoulPreset[] = customVinSoul
    ? [...VEHICLE_SOUL_LIST, customVinSoul]
    : VEHICLE_SOUL_LIST;

  const activePreset = REAL_WORLD_VEHICLE_PRESETS.find((p) => p.id === activeQuickPresetId);
  const activeSoul =
    activeVehicleId === "CUSTOM_VIN_SOUL" && customVinSoul
      ? customVinSoul
      : VEHICLE_SOUL_PRESETS[activeVehicleId as VehicleArchitectureId] ??
        VEHICLE_SOUL_PRESETS.GERMAN_V6_DSG;

  const activePillLabel = activePreset
    ? `${activePreset.emoji} ${activePreset.shortTitle}`
    : activeVehicleId === "CUSTOM_VIN_SOUL" && customVinSoul
    ? `🚗 ${customVinSoul.yearMakeModel}`
    : `🏎️ ${activeSoul.codename}`;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#06070a]/92 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.65)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3">
          {/* Left: Obsidian Brand Mark + Active Vehicle Pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl border bg-zinc-950 transition ${
                  healthStatus === "FAULT"
                    ? "border-rose-500/45 text-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.28)]"
                    : healthStatus === "CAUTION"
                    ? "border-amber-500/45 text-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.22)]"
                    : "border-emerald-500/35 text-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.2)]"
                }`}
              >
                <Cpu className="h-4 w-4" />
              </div>
              <div>
                <div className="font-mono text-sm font-bold tracking-[0.14em] text-white leading-none">
                  HEXORCIST
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500 mt-0.5">
                  OBSIDIAN AUTOMOTIVE OS
                </div>
              </div>
            </div>

            <button
              type="button"
              data-cinema-target="TOP_VEHICLE_BAR"
              onClick={() => (isPopoverOpen ? closeModal() : openPopover())}
              className="flex items-center gap-2 rounded-full border border-white/[0.1] bg-[#0c0f17] px-3.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-white/20 hover:text-white transition cursor-pointer"
            >
              <span className="max-w-[200px] truncate">{activePillLabel}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${
                  isPopoverOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>

          {/* Center: Clean 4-Tab Segmented Workspace Switcher */}
          <nav
            aria-label="Workspace Navigation"
            className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.08] bg-[#0b0d14]/90 p-1"
          >
            {WORKSPACE_TABS.map((tab) => {
              const active = activeWorkspaceTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectWorkspaceTab(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    active
                      ? "bg-white/[0.09] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14)] border border-white/15"
                      : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Right: Status Badge + Inject/Reset Toggle + Cinema Pitch */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 font-mono text-xs font-semibold ${
                healthStatus === "FAULT"
                  ? "border-rose-500/35 bg-rose-500/12 text-rose-300"
                  : healthStatus === "CAUTION"
                  ? "border-amber-500/35 bg-amber-500/12 text-amber-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {healthStatus === "FAULT"
                ? "🔴 Active Fault"
                : healthStatus === "CAUTION"
                ? "🟡 Caution"
                : "🟢 Healthy"}
            </span>

            {simulatorLockedReason ? (
              <button
                type="button"
                disabled
                title={`Random Simulator overridden by ${simulatorLockedReason}`}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-700/80 bg-zinc-900/70 px-3 py-1.5 text-xs font-medium text-zinc-500 cursor-not-allowed"
              >
                <span>🔒 {simulatorLockedReason}</span>
              </button>
            ) : hasActiveFault ? (
              <div className="flex items-center gap-1.5">
                {onRollRandomFault && (
                  <button
                    type="button"
                    onClick={onRollRandomFault}
                    className="flex items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/12 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 transition cursor-pointer"
                  >
                    <span>🎲 Re-Roll Another Issue</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleInjectOrResetFault}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/12 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Reset Mode $04</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onRollRandomFault ?? onToggleInjectOrResetFault}
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/12 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:border-amber-400/60 hover:bg-amber-500/20 transition cursor-pointer"
              >
                <span>
                  🎲 Simulate Random Issue for{" "}
                  {vehicleMakeModelLabel ||
                    formatVehicleShortMakeModel(
                      customVinSoul?.yearMakeModel ??
                        VEHICLE_SOUL_PRESETS[activeVehicleId as VehicleArchitectureId]
                          ?.yearMakeModel ??
                        "Vehicle"
                    )}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleCinemaLauncher}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                cinemaRecording
                  ? "border-rose-500 bg-rose-500 text-white animate-pulse"
                  : cinemaRunning || cinemaLauncherOpen
                  ? "border-violet-400/50 bg-violet-500 text-white"
                  : "border-violet-500/35 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25"
              }`}
            >
              <Clapperboard className="h-3.5 w-3.5 shrink-0" />
              <span>
                {cinemaRecording
                  ? "Recording…"
                  : cinemaRunning
                  ? "Cinema Running"
                  : "Cinema Pitch (2:45)"}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleSoundMuted}
              aria-label={soundMuted ? "Unmute audio" : "Mute audio"}
              title={soundMuted ? "Unmute audio" : "Mute audio"}
              className="rounded-xl border border-white/[0.08] bg-[#0c0f17] p-2 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              {soundMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </header>
      <AnimatePresence>
        {isPopoverOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-20 pb-8 backdrop-blur-sm overflow-y-auto"
          >
            <motion.div
              data-cinema-target="VEHICLE_SELECTOR_POPOVER"
              initial={{ scale: 0.97, opacity: 0, y: -8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: -8 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-2xl border border-white/[0.1] bg-zinc-900 p-6 text-zinc-100 shadow-2xl space-y-5"
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] pb-4">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-white">
                    Select Active Vehicle
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Pick a quick preset, enter your own car by name, or decode a 17-digit US DOT VIN.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-white/[0.08] bg-zinc-800/60 p-2 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* 1. Three Quick Real-World Presets */}
              <div className="space-y-2.5">
                <div className="text-xs font-medium text-zinc-400">Quick Vehicle Presets</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {REAL_WORLD_VEHICLE_PRESETS.map((preset) => {
                    const isSelected = activeQuickPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          if (onSelectQuickPreset) {
                            onSelectQuickPreset(preset.id);
                          } else {
                            onSelectVehicle(preset.underlyingSoulId);
                          }
                          closeModal();
                        }}
                        className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition cursor-pointer ${
                          isSelected
                            ? "border-emerald-500/45 bg-emerald-500/10"
                            : "border-white/[0.07] bg-zinc-950/60 hover:border-white/20"
                        }`}
                      >
                        <div className="text-xs font-semibold text-white">
                          {preset.emoji} {preset.shortTitle}
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-400 line-clamp-1">
                          {preset.faultPlainName}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-emerald-400">
                          Fair ${preset.fairCostUsd.toLocaleString()}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-zinc-500">ECU Souls:</span>
                  {displayedSouls.map((s) => {
                    const active = activeQuickPresetId === null && s.id === activeVehicleId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          onSelectVehicle(s.id);
                          closeModal();
                        }}
                        className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] transition cursor-pointer ${
                          active
                            ? "border-violet-500/45 bg-violet-500/15 text-violet-200"
                            : "border-white/[0.07] bg-zinc-950/60 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {s.codename}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Enter Your Own Car Builder CTA */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
                <div>
                  <div className="text-xs font-semibold text-white">
                    🚗 Drive Something Else? Enter Your Own Car
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Type any Year, Make &amp; Model — zero VIN needed.
                  </div>
                </div>
                <button
                  type="button"
                  data-cinema-target="ENTER_OWN_CAR_BTN"
                  onClick={() => {
                    closeModal();
                    setOwnCarModalOpen(true);
                  }}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition cursor-pointer shrink-0"
                >
                  🚗 Enter Your Own Car
                </button>
              </div>

              {/* 3. 17-Digit US DOT NHTSA VIN Lookup */}
              <div
                data-cinema-target="VIN_MODAL_CARD"
                className="rounded-xl border border-white/[0.07] bg-zinc-950/70 p-4 space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-200">
                    17-Digit US DOT NHTSA VIN Lookup
                  </span>
                  <span className="text-[11px] text-zinc-500">Live vPIC Decoder</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    maxLength={17}
                    value={displayedVinInput}
                    onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                    placeholder="Enter 17-character VIN (e.g. WAUDGAFL5EA049218)"
                    className="flex-1 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 font-mono text-xs uppercase text-white outline-none focus:border-violet-400"
                  />
                  <button
                    type="button"
                    disabled={vinLoading}
                    onClick={() => void handleDecodeVin()}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-400 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {vinLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    <span>Lookup VIN</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "5.0L V8 Coupe", vin: "1FA6P8CF5L5109284" },
                    { label: "2.0L Turbo Sedan", vin: "1HGCV2F34NA012481" },
                    ...VEHICLE_SOUL_LIST.slice(0, 2).map((p) => ({
                      label: p.codename,
                      vin: p.defaultVin,
                    })),
                  ].map((item, idx) => (
                    <button
                      key={`${item.vin}-${idx}`}
                      type="button"
                      onClick={() => void handleDecodeVin(item.vin)}
                      className="rounded-lg border border-white/[0.08] bg-zinc-900 px-2.5 py-1 font-mono text-[11px] text-zinc-300 hover:border-violet-400/40 hover:text-white cursor-pointer"
                    >
                      {item.label}: {item.vin.slice(0, 8)}…
                    </button>
                  ))}
                </div>

                {vinError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                    {vinError}
                  </div>
                )}

                {displayedDecoded && (
                  <div className="rounded-xl border border-emerald-500/25 bg-zinc-900/80 p-3.5 text-xs space-y-2.5">
                    <div className="flex items-center justify-between text-emerald-300">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="h-4 w-4" />
                        {displayedDecoded.modelYear} {displayedDecoded.make} {displayedDecoded.model}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400">
                        {displayedDecoded.vin}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-300">
                      <div>
                        <span className="text-zinc-500">Engine:</span> {displayedDecoded.engineInfo}
                      </div>
                      <div>
                        <span className="text-zinc-500">Fuel:</span> {displayedDecoded.fuelType}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onBindCustomVinSoul(displayedDecoded);
                        closeModal();
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Bind Decoded VIN as Active Vehicle</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <EnterYourOwnCarModal
        key={`${savedUserCarConfig?.yearMakeModel ?? "default"}-${ownCarModalOpen || cinemaOwnCarModalOpen ? "open" : "closed"}`}
        open={ownCarModalOpen || Boolean(cinemaOwnCarModalOpen)}
        onClose={() => {
          setOwnCarModalOpen(false);
          onCloseCinemaOwnCarModal?.();
        }}
        initialConfig={savedUserCarConfig}
        onSaveCustomCar={(cfg) => {
          onSaveUserCustomCar?.(cfg);
          setOwnCarModalOpen(false);
          onCloseCinemaOwnCarModal?.();
        }}
      />
    </>
  );
}
