"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Binary,
  Cable,
  Clapperboard,
  Cpu,
  FileSpreadsheet,
  Layers,
  Monitor,
  Play,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  SoulProfileId,
  VEHICLE_SOUL_LIST,
  VehicleSoulPreset,
} from "@/lib/obd-hex-engine";
import type { HardwareStudioTab } from "@/components/HardwareAndDbcModal";

export type ConnectionMode = "VIRTUAL ECU 25Hz" | "WEBSERIAL ELM327" | "CSV REPLAY";
export type WorkspaceViewMode = "FOCUSED" | "PRO";

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
  viewMode: WorkspaceViewMode;
  onChangeViewMode: (mode: WorkspaceViewMode) => void;
  activeVehicleId: SoulProfileId;
  onSelectVehicle: (id: SoulProfileId) => void;
  customVinSoul: VehicleSoulPreset | null;
  onBindCustomVinSoul: (decoded: DecodedNhtsaVin) => void;
  onOpenHardwareStudio: (tab: HardwareStudioTab) => void;
  onToggleCinemaLauncher: () => void;
  cinemaLauncherOpen: boolean;
  cinemaRunning: boolean;
  cinemaRecording: boolean;
  cinemaVinModalOpen?: boolean;
  onCloseCinemaVinModal?: () => void;
  onStartGuidedTour: () => void;
  guidedTourStep: number | null;
  onOpenKiroDrawer: () => void;
  soundMuted: boolean;
  onToggleSoundMuted: () => void;
  connectionMode: ConnectionMode;
  crtEnabled: boolean;
  onToggleCrt: () => void;
  activeVin: string;
  decodedVinInfo: DecodedNhtsaVin | null;
  onApplyVin: (vin: string, decoded: DecodedNhtsaVin | null) => void;
  hasActiveFault: boolean;
  onOpenObdScannerModal: () => void;
}

export function TopCommandBar({
  viewMode,
  onChangeViewMode,
  activeVehicleId,
  onSelectVehicle,
  customVinSoul,
  onBindCustomVinSoul,
  onOpenHardwareStudio,
  onToggleCinemaLauncher,
  cinemaLauncherOpen,
  cinemaRunning,
  cinemaRecording,
  cinemaVinModalOpen,
  onCloseCinemaVinModal,
  onStartGuidedTour,
  guidedTourStep,
  onOpenKiroDrawer,
  soundMuted,
  onToggleSoundMuted,
  connectionMode,
  crtEnabled,
  onToggleCrt,
  activeVin,
  decodedVinInfo,
  onApplyVin,
  hasActiveFault,
  onOpenObdScannerModal,
}: TopCommandBarProps) {
  const [vinModalOpen, setVinModalOpen] = useState(false);
  const [vinInput, setVinInput] = useState(activeVin);
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState<string | null>(null);
  const [modalDecoded, setModalDecoded] = useState<DecodedNhtsaVin | null>(decodedVinInfo);

  const openModal = () => {
    setVinInput(activeVin);
    setModalDecoded(decodedVinInfo);
    setVinError(null);
    setVinModalOpen(true);
  };

  const closeModal = () => {
    setVinModalOpen(false);
    onCloseCinemaVinModal?.();
  };

  const isVinModalOpen = vinModalOpen || Boolean(cinemaVinModalOpen);
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

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#06070A]/92 backdrop-blur-xl">
        <div className="mx-auto max-w-[1840px] px-4 py-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ scale: hasActiveFault ? [1, 1.06, 1] : [1, 1.02, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                  hasActiveFault
                    ? "border-[#FF1E42]/70 bg-[#FF1E42]/15 text-[#FF1E42] crimson-glow"
                    : "border-[#00FF9D]/50 bg-[#00FF9D]/10 text-[#00FF9D] phosphor-glow"
                }`}
              >
                {hasActiveFault ? <ShieldAlert className="h-5 w-5" /> : <Cpu className="h-5 w-5" />}
              </motion.div>

              <div>
                <motion.h1
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-mono text-sm sm:text-base font-bold tracking-wider text-white"
                >
                  HEXORCIST <span className="text-[#00FF9D]">{"//"}</span>{" "}
                  <span className="text-[#00E5FF]">UNIVERSAL CAN-BUS &amp; FINTECH CHIMERA</span>
                </motion.h1>
                <p className="font-mono text-[11px] text-slate-400">
                  SAE J1979 OBD-II + ISO 14229 UDS • VERTEX AI NECROMANCER • REPAIR ESCROW LEDGER
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Live Telemetry Data Source Indicator Badge */}
              <div
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] font-bold shadow-sm ${
                  connectionMode === "WEBSERIAL ELM327"
                    ? "border-purple-400/60 bg-purple-500/15 text-purple-200"
                    : connectionMode === "CSV REPLAY"
                    ? "border-sky-400/60 bg-sky-500/15 text-sky-300"
                    : "border-[#00FF9D]/55 bg-[#00FF9D]/12 text-[#00FF9D]"
                }`}
              >
                <span aria-hidden="true">
                  {connectionMode === "WEBSERIAL ELM327"
                    ? "🟣"
                    : connectionMode === "CSV REPLAY"
                    ? "🔵"
                    : "🟢"}
                </span>
                <span>
                  {connectionMode === "WEBSERIAL ELM327"
                    ? "[SOURCE: WEBSERIAL LIVE OBD-II HARDWARE]"
                    : connectionMode === "CSV REPLAY"
                    ? "[SOURCE: ISO 15765-4 CSV LOG REPLAY]"
                    : activeVehicleId === "CUSTOM_VIN_SOUL" || decodedVinInfo
                    ? "[SOURCE: NHTSA VIN-CALIBRATED 25Hz SIM]"
                    : "[SOURCE: 25Hz SYNTHETIC ECU PHYSICS SIM]"}
                </span>
              </div>

              {/* Focused Mode vs. Engineer Pro Mode Segmented Control */}
              <div
                data-cinema-target="TOP_MODE_TOGGLE"
                className="flex items-center rounded-lg border border-white/15 bg-[#0A0D14] p-0.5 font-mono text-[11px]"
              >
                <button
                  type="button"
                  onClick={() => onChangeViewMode("FOCUSED")}
                  className={`rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
                    viewMode === "FOCUSED"
                      ? "bg-[#00FF9D] text-[#06070A] shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Focused Mode (Default)
                </button>
                <button
                  type="button"
                  onClick={() => onChangeViewMode("PRO")}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
                    viewMode === "PRO"
                      ? "bg-[#00E5FF] text-[#06070A] shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Layers className="h-3 w-3" />
                  <span>Engineer Pro Mode</span>
                </button>
              </div>

              {/* Prominent Standard OBD-II Multi-Module Code Scanner Button */}
              <button
                type="button"
                data-cinema-target="TOP_OBD_SCANNER_BTN"
                onClick={onOpenObdScannerModal}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition cursor-pointer ${
                  hasActiveFault
                    ? "border-[#FF1E42]/80 bg-[#FF1E42]/18 text-[#FF6B81] shadow-[0_0_20px_rgba(255,30,66,0.3)] hover:bg-[#FF1E42]/28"
                    : "border-[#00E5FF]/70 bg-[#00E5FF]/14 text-[#00E5FF] shadow-[0_0_16px_rgba(0,229,255,0.2)] hover:bg-[#00E5FF]/24"
                }`}
              >
                <span>🔍 OBD-II Code Scanner (ECM / TCM)</span>
                {hasActiveFault && (
                  <span className="rounded bg-[#FF1E42] px-1.5 py-0.5 text-[9px] font-black text-white">
                    MIL ON
                  </span>
                )}
              </button>

              {/* Prominent 2-Min Visual Cinema Pitch Director Launcher */}
              <button
                type="button"
                onClick={onToggleCinemaLauncher}
                className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 font-mono text-xs font-bold transition cursor-pointer ${
                  cinemaRecording
                    ? "border-[#FF1E42] bg-[#FF1E42] text-white shadow-[0_0_24px_rgba(255,30,66,0.55)] animate-pulse"
                    : cinemaRunning || cinemaLauncherOpen
                    ? "border-[#00FF9D] bg-[#00FF9D] text-[#06070A] shadow-[0_0_24px_rgba(0,255,157,0.42)]"
                    : "border-[#00FF9D]/80 bg-gradient-to-r from-[#00FF9D]/20 via-[#00E5FF]/20 to-[#00FF9D]/20 text-[#00FF9D] shadow-[0_0_18px_rgba(0,255,157,0.22)] hover:border-[#00FF9D] hover:bg-[#00FF9D]/25"
                }`}
              >
                <Clapperboard className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {cinemaRecording
                    ? "🔴 Recording 2-Min Cinema (.webm)"
                    : cinemaRunning
                    ? "🎬 Cinema Pitch Running"
                    : "🎬 Launch 2-Min Cinema Pitch"}
                </span>
              </button>

              {/* 30-Second Judge Auto-Pilot Tour Trigger */}
              <button
                type="button"
                onClick={onStartGuidedTour}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition cursor-pointer ${
                  guidedTourStep
                    ? "border-[#00FF9D] bg-[#00FF9D] text-[#06070A] shadow-[0_0_20px_rgba(0,255,157,0.35)]"
                    : "border-[#FFB800]/65 bg-[#FFB800]/15 text-[#FFB800] hover:bg-[#FFB800]/25"
                }`}
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>
                  {guidedTourStep
                    ? `Tour Step ${guidedTourStep}/5`
                    : "▶ Run 30s Guided Demo"}
                </span>
              </button>

              {/* Kiro Architecture & PBT Proofs Drawer Button */}
              <button
                type="button"
                onClick={onOpenKiroDrawer}
                className="flex items-center gap-1.5 rounded-lg border border-[#00FF9D]/40 bg-[#0B0E14] px-2.5 py-1.5 font-mono text-xs text-[#00FF9D] transition hover:border-[#00FF9D] hover:bg-[#00FF9D]/10 cursor-pointer"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Kiro Architecture &amp; PBT Proofs</span>
              </button>

              {viewMode === "PRO" && (
                <>
                  <button
                    type="button"
                    onClick={() => onOpenHardwareStudio("DBC_INSPECTOR")}
                    className="flex items-center gap-1.5 rounded-md border border-[#00E5FF]/40 bg-[#0B0E14] px-2.5 py-1.5 font-mono text-xs text-[#00E5FF] transition hover:border-[#00E5FF] hover:bg-[#00E5FF]/10 cursor-pointer"
                  >
                    <Binary className="h-3.5 w-3.5" />
                    <span>.DBC 64-Bit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenHardwareStudio("WEBSERIAL_DRAWER")}
                    className="flex items-center gap-1.5 rounded-md border border-purple-400/45 bg-[#0B0E14] px-2.5 py-1.5 font-mono text-xs text-purple-300 transition hover:border-purple-400 hover:bg-purple-500/10 cursor-pointer"
                  >
                    <Cable className="h-3.5 w-3.5" />
                    <span>OBD-II USB/BT</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => onOpenHardwareStudio("CSV_REPLAY")}
                className="flex items-center gap-1.5 rounded-md border border-[#FFB800]/40 bg-[#0B0E14] px-2.5 py-1.5 font-mono text-xs text-[#FFB800] transition hover:border-[#FFB800] hover:bg-[#FFB800]/10 cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>CSV Studio</span>
              </button>

              <button
                type="button"
                onClick={openModal}
                className="flex items-center gap-1.5 rounded-md border border-[#00E5FF]/40 bg-[#0B0E14] px-2.5 py-1.5 font-mono text-xs text-[#00E5FF] transition hover:border-[#00E5FF] hover:bg-[#00E5FF]/10 cursor-pointer"
              >
                <Search className="h-3.5 w-3.5" />
                <span>VIN: {activeVin.slice(0, 8)}…</span>
                <span className="rounded bg-[#00E5FF]/15 px-1.5 py-0.5 text-[10px]">NHTSA</span>
              </button>

              {/* WebAudio Mute/Unmute Icon Toggle */}
              <button
                type="button"
                onClick={onToggleSoundMuted}
                aria-label={soundMuted ? "Unmute tactile audio" : "Mute tactile audio"}
                title={soundMuted ? "Unmute WebAudio Synthesizer" : "Mute WebAudio Synthesizer"}
                className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 font-mono text-xs transition cursor-pointer ${
                  soundMuted
                    ? "border-white/15 bg-[#0B0E14] text-slate-400 hover:text-white"
                    : "border-[#00E5FF]/50 bg-[#00E5FF]/12 text-[#00E5FF]"
                }`}
              >
                {soundMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>

              <button
                type="button"
                onClick={onToggleCrt}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-xs transition cursor-pointer ${
                  crtEnabled
                    ? "border-[#00FF9D]/60 bg-[#00FF9D]/15 text-[#00FF9D]"
                    : "border-white/15 bg-[#0B0E14] text-slate-400 hover:text-white"
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                <span>CRT {crtEnabled ? "ON" : "OFF"}</span>
              </button>
            </div>
          </div>

          {/* Vehicle Soul Switcher (4 Static Souls + Dynamic 5th CUSTOM_VIN_SOUL) */}
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 ${
              displayedSouls.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"
            } gap-2 pt-1`}
          >
            {displayedSouls.map((soul, idx) => {
              const active = soul.id === activeVehicleId;
              const isCustom = soul.id === "CUSTOM_VIN_SOUL";
              return (
                <button
                  key={`${soul.id}-${idx}`}
                  type="button"
                  onClick={() => onSelectVehicle(soul.id)}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition cursor-pointer ${
                    active
                      ? "border-[#00FF9D]/70 bg-[#00FF9D]/10 phosphor-glow"
                      : isCustom
                      ? "border-[#00E5FF]/45 bg-[#00E5FF]/10 hover:border-[#00E5FF]"
                      : "border-white/10 bg-[#0B0E14]/80 hover:border-white/25 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex w-full items-center justify-between font-mono text-xs font-bold">
                    <span className={active ? "text-[#00FF9D]" : isCustom ? "text-[#00E5FF]" : "text-white"}>
                      {soul.codename}
                    </span>
                    <span className="text-[10px] text-[#00E5FF]">PID {soul.primaryPid}</span>
                  </div>
                  <span className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
                    {soul.yearMakeModel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>
      <AnimatePresence>
        {isVinModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          >
            <motion.div
              data-cinema-target="VIN_MODAL_CARD"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl rounded-xl border border-[#00E5FF]/40 bg-[#0A0D14] p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 font-mono text-sm font-bold text-[#00E5FF]">
                  <Sparkles className="h-4 w-4" />
                  <span>LIVE US DOT NHTSA vPIC 17-DIGIT VIN DECODER</span>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={17}
                    value={displayedVinInput}
                    onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                    placeholder="Enter 17-character VIN (e.g. WAUDGAFL5EA049218)"
                    className="flex-1 rounded-lg border border-white/15 bg-[#050608] px-3 py-2 font-mono text-sm uppercase text-white outline-none focus:border-[#00E5FF]"
                  />
                  <button
                    type="button"
                    disabled={vinLoading}
                    onClick={() => handleDecodeVin()}
                    className="flex items-center gap-2 rounded-lg bg-[#00E5FF] px-4 py-2 font-mono text-xs font-bold text-[#06070A] hover:bg-[#00E5FF]/90 disabled:opacity-50 cursor-pointer"
                  >
                    {vinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    <span>DECODE LIVE</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "NA 5.0L V8 Coupe Sample", vin: "1FA6P8CF5L5109284" },
                    { label: "2.0L Turbo Sedan Sample", vin: "1HGCV2F34NA012481" },
                    ...VEHICLE_SOUL_LIST.map((p) => ({
                      label: p.codename,
                      vin: p.defaultVin,
                    })),
                  ].map((item, idx) => (
                    <button
                      key={`${item.vin}-${idx}`}
                      type="button"
                      onClick={() => void handleDecodeVin(item.vin)}
                      className="rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-slate-300 hover:border-[#00FF9D]/50 hover:text-[#00FF9D] cursor-pointer"
                    >
                      {item.label}: {item.vin}
                    </button>
                  ))}
                </div>

                {vinError && (
                  <div className="rounded-lg border border-[#FF1E42]/40 bg-[#FF1E42]/10 p-2.5 font-mono text-xs text-[#FF6B81]">
                    {vinError}
                  </div>
                )}

                {displayedDecoded && (
                  <div className="rounded-lg border border-[#00FF9D]/30 bg-[#05070B] p-3.5 font-mono text-xs space-y-3">
                    <div className="flex items-center justify-between text-[#00FF9D]">
                      <span className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="h-4 w-4" />
                        {displayedDecoded.modelYear} {displayedDecoded.make} {displayedDecoded.model}
                      </span>
                      <span className="text-[10px] text-slate-400">{displayedDecoded.vin}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                      <div>
                        <span className="text-slate-500">BODY:</span> {displayedDecoded.bodyClass}
                      </div>
                      <div>
                        <span className="text-slate-500">ENGINE:</span> {displayedDecoded.engineInfo}
                      </div>
                      <div>
                        <span className="text-slate-500">FUEL:</span> {displayedDecoded.fuelType}
                      </div>
                      <div>
                        <span className="text-slate-500">PLANT:</span> {displayedDecoded.plantInfo}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onBindCustomVinSoul(displayedDecoded);
                        closeModal();
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00FF9D] px-4 py-2.5 font-mono text-xs font-bold text-[#06070A] shadow-[0_0_20px_rgba(0,255,157,0.3)] hover:bg-[#00FF9D]/90 cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Bind Decoded VIN as Active Vehicle Soul</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
