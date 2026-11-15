"use client";

import React, { useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Gauge,
  HelpCircle,
  Play,
  Search,
  TerminalSquare,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  MechanicalCursePreset,
  PidKey,
  UNIVERSAL_PID_REGISTRY,
  VehicleSoulPreset,
} from "@/lib/obd-hex-engine";
import { PLAIN_ENGLISH_PID_TOOLTIPS } from "@/lib/obd-scanner-qol";
import {
  DEFAULT_DRIVING_SLIDERS,
  DrivingStressSlidersState,
} from "@/lib/custom-car-and-sliders";
import { InteractiveDrivingStressBar } from "./InteractiveDrivingStressBar";
import { StandardObdScannerPanel } from "@/components/StandardObdScannerModal";
import { playHexSound } from "@/lib/sound-fx";

export type CenterTabId = "OSCILLOSCOPE" | "OBD_SCANNER" | "ROAD_DYNO" | "UDS_TERMINAL";

export interface ScopeSample {
  tick: string;
  target: number;
  actual: number;
}

export interface DynoCurvePoint {
  rpm: number;
  healthyWhp: number;
  actualWhp: number;
  healthyTorque: number;
  actualTorque: number;
}

export interface UdsHandshakeEntry {
  id: string;
  timestamp: string;
  direction: "TX 7E0" | "RX 7E8";
  hex: string;
  description: string;
  status: "OK" | "WARN";
}

interface CenterDiagnosticColumnProps {
  viewMode: "FOCUSED" | "PRO";
  activeWorkflowStep?: 1 | 2 | 3;
  tourSpotlightPanel?: string | null;
  activeTab: CenterTabId;
  onSelectTab: (tab: CenterTabId) => void;
  soul: VehicleSoulPreset;
  activeCurse: MechanicalCursePreset | null;
  telemetry: Record<PidKey, number>;
  scopePid: PidKey;
  onSelectScopePid: (pid: PidKey) => void;
  scopeHistory: ScopeSample[];
  dynoCurve: DynoCurvePoint[];
  dynoRunning: boolean;
  peakActualWhp: number;
  peakActualTorque: number;
  onRunDynoPull: () => void;
  udsLogs: UdsHandshakeEntry[];
  onDispatchUdsCommand: (mode: "04" | "2F" | "31") => void;
  activeVin: string;
  scannerSweepTrigger?: number;
  onClearMode04Codes: () => void;
  onCastCurse?: (curse: MechanicalCursePreset) => void;
  onOpenMechanicSpecSheet?: () => void;
  cinemaTooltipPid?: PidKey | null;
  drivingSliders?: DrivingStressSlidersState;
  onChangeDrivingSliders?: (next: DrivingStressSlidersState) => void;
  onResetDrivingSliders?: () => void;
  escrowRateCentsPerMile?: number;
  stressWarnings?: string[];
}

const EIGHT_GAUGE_PIDS: PidKey[] = [
  "010C",
  "010D",
  "0105",
  "0106",
  "010E",
  "0142",
  "221140",
  "22F40A",
];

export function CenterDiagnosticColumn({
  viewMode,
  activeWorkflowStep,
  tourSpotlightPanel,
  activeTab,
  onSelectTab,
  soul,
  activeCurse,
  telemetry,
  scopePid,
  onSelectScopePid,
  scopeHistory,
  dynoCurve,
  dynoRunning,
  peakActualWhp,
  peakActualTorque,
  onRunDynoPull,
  udsLogs,
  onDispatchUdsCommand,
  activeVin,
  scannerSweepTrigger = 0,
  onClearMode04Codes,
  onCastCurse,
  onOpenMechanicSpecSheet,
  cinemaTooltipPid = null,
  drivingSliders = DEFAULT_DRIVING_SLIDERS,
  onChangeDrivingSliders,
  onResetDrivingSliders,
  escrowRateCentsPerMile = 5,
  stressWarnings = [],
}: CenterDiagnosticColumnProps) {
  const [showAllChannelsInFocused, setShowAllChannelsInFocused] = useState(false);
  const [pinnedTooltipPid, setPinnedTooltipPid] = useState<PidKey | null>(null);
  const [hoveredTooltipPid, setHoveredTooltipPid] = useState<PidKey | null>(null);
  const scopeDef = UNIVERSAL_PID_REGISTRY[scopePid];
  const showAllEight =
    viewMode === "PRO" || showAllChannelsInFocused || cinemaTooltipPid === "0106";
  const activeTooltipPid: PidKey | null =
    cinemaTooltipPid ?? hoveredTooltipPid ?? pinnedTooltipPid;

  const isTourTarget =
    tourSpotlightPanel === "OSCILLOSCOPE" ||
    tourSpotlightPanel === "OBD_SCANNER" ||
    tourSpotlightPanel === "UDS_EXORCISM" ||
    tourSpotlightPanel === "ROAD_DYNO";
  const isDimmed = Boolean(tourSpotlightPanel && !isTourTarget);
  const isWorkflowUdsHighlight =
    !tourSpotlightPanel && viewMode === "FOCUSED" && activeWorkflowStep === 3 && activeTab === "UDS_TERMINAL";

  return (
    <section
      data-cinema-target="CENTER_PANEL"
      className={`flex flex-col gap-4 transition-all duration-300 ${
        isTourTarget || isWorkflowUdsHighlight
          ? "rounded-2xl ring-2 ring-[#00FF9D]/70 shadow-[0_0_38px_rgba(0,255,157,0.28)] p-1"
          : ""
      } ${isDimmed ? "opacity-45" : "opacity-100"}`}
    >
      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 rounded-xl border border-white/10 bg-[#0A0D14]/90 p-1.5">
        <button
          type="button"
          onClick={() => onSelectTab("OSCILLOSCOPE")}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 font-mono text-[11px] font-bold transition cursor-pointer ${
            activeTab === "OSCILLOSCOPE"
              ? "bg-[#00FF9D]/15 text-[#00FF9D] border border-[#00FF9D]/50"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Activity className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">60fps OSCILLOSCOPE</span>
        </button>

        <button
          type="button"
          data-cinema-target="CENTER_OBD_TAB_BTN"
          onClick={() => onSelectTab("OBD_SCANNER")}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 font-mono text-[11px] font-bold transition cursor-pointer ${
            activeTab === "OBD_SCANNER"
              ? "bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/65 shadow-[0_0_16px_rgba(0,229,255,0.22)]"
              : activeCurse
              ? "text-[#FF6B81] bg-[#FF1E42]/10 border border-[#FF1E42]/35 hover:bg-[#FF1E42]/20"
              : "text-slate-300 hover:text-white"
          }`}
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">🔍 OBD-II Code Scanner (ECM / TCM / ABS / BCM)</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab("ROAD_DYNO")}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 font-mono text-[11px] font-bold transition cursor-pointer ${
            activeTab === "ROAD_DYNO"
              ? "bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/50"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Gauge className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">VIRTUAL ROAD DYNO</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab("UDS_TERMINAL")}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 font-mono text-[11px] font-bold transition cursor-pointer ${
            activeTab === "UDS_TERMINAL"
              ? "bg-[#FFB800]/15 text-[#FFB800] border border-[#FFB800]/50"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <TerminalSquare className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">UDS EXORCISM (04/2F/31)</span>
        </button>
      </div>

      {activeTab === "OBD_SCANNER" && (
        <StandardObdScannerPanel
          soul={soul}
          vin={activeVin}
          activeCurse={activeCurse}
          telemetry={telemetry}
          scanTriggerCount={scannerSweepTrigger}
          onClearMode04Codes={onClearMode04Codes}
          onInjectFaultPreset={onCastCurse}
          onOpenMechanicSpecSheet={onOpenMechanicSpecSheet}
        />
      )}

      {activeTab === "OSCILLOSCOPE" && (
        <div className="space-y-4">
          {/* Dual-Trace Phosphor Oscilloscope */}
          <div className="rounded-xl border border-[#00FF9D]/30 bg-[#0A0D14]/90 p-4 phosphor-glow">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#00FF9D]">
                  Dual-Trace Phosphor Oscilloscope // {scopeDef.name} ({scopeDef.key})
                </h2>
                <p className="font-mono text-[11px] text-slate-400">
                  Target Setpoint (#00E5FF) vs. Actual CAN Response (#00FF9D / #FF1E42)
                </p>
              </div>

              <div className="flex flex-wrap gap-1">
                {(["22F40A", "221140", "22E001", "22D100", "010C", "0106"] as PidKey[]).map(
                  (pid, idx) => (
                    <button
                      key={`${pid}-${idx}`}
                      type="button"
                      onClick={() => onSelectScopePid(pid)}
                      className={`rounded border px-2 py-1 font-mono text-[10px] font-bold transition cursor-pointer ${
                        scopePid === pid
                          ? "border-[#00FF9D] bg-[#00FF9D]/20 text-[#00FF9D]"
                          : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
                      }`}
                    >
                      {UNIVERSAL_PID_REGISTRY[pid].shortName}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scopeHistory}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="tick"
                    stroke="#64748b"
                    tick={{ fontSize: 10, fontFamily: "monospace" }}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 10, fontFamily: "monospace" }}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#06070A",
                      borderColor: "rgba(0,229,255,0.4)",
                      fontFamily: "monospace",
                      fontSize: "11px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: "11px" }} />
                  <Line
                    type="monotone"
                    dataKey="target"
                    name={`Target (${scopeDef.unit})`}
                    stroke="#00E5FF"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name={`Actual (${scopeDef.unit})`}
                    stroke={activeCurse ? "#FF1E42" : "#00FF9D"}
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {onChangeDrivingSliders && (
            <InteractiveDrivingStressBar
              sliders={drivingSliders}
              onChangeSliders={onChangeDrivingSliders}
              onResetSliders={onResetDrivingSliders}
              escrowRateCentsPerMile={escrowRateCentsPerMile}
              warnings={stressWarnings}
            />
          )}

          {/* Progressive Disclosure KPI Cards */}
          <div data-cinema-target="CENTER_KPI_GRID" className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 font-mono text-[11px]">
              <span className="text-slate-400">
                {showAllEight
                  ? "ALL 8 LIVE SAE J1979 / UDS TELEMETRY CHANNELS (CLICK ? FOR PLAIN ENGLISH)"
                  : "4 CRITICAL TELEMETRY KPIs • HOVER OR CLICK (?) FOR PLAIN-ENGLISH MEANING"}
              </span>
              {viewMode === "FOCUSED" && (
                <button
                  type="button"
                  onClick={() => setShowAllChannelsInFocused((v) => !v)}
                  className="flex items-center gap-1 rounded-md border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-2.5 py-1 text-[10px] font-bold text-[#00E5FF] hover:bg-[#00E5FF]/20 cursor-pointer"
                >
                  {showAllChannelsInFocused ? (
                    <>
                      <ChevronUp className="h-3 w-3" />
                      <span>Show 4 Critical KPIs</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      <span>Show All 8 Telemetry Channels (incl. STFT %)</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {activeTooltipPid && PLAIN_ENGLISH_PID_TOOLTIPS[activeTooltipPid] && (
              <div className="rounded-xl border border-[#00FF9D]/55 bg-[#071611] px-3.5 py-2.5 font-mono text-xs shadow-[0_0_24px_rgba(0,255,157,0.18)] space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#00FF9D]">
                    💬 PLAIN-ENGLISH SENSOR GUIDE //{" "}
                    {PLAIN_ENGLISH_PID_TOOLTIPS[activeTooltipPid].title} (0x{activeTooltipPid})
                  </span>
                  {pinnedTooltipPid && !cinemaTooltipPid && (
                    <button
                      type="button"
                      onClick={() => setPinnedTooltipPid(null)}
                      className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
                <p className="text-[11px] leading-snug text-slate-100">
                  {PLAIN_ENGLISH_PID_TOOLTIPS[activeTooltipPid].explanation}
                </p>
                <div className="text-[10px] text-[#00E5FF]">
                  Healthy Spec: {PLAIN_ENGLISH_PID_TOOLTIPS[activeTooltipPid].healthyRange}
                </div>
              </div>
            )}

            {showAllEight ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {EIGHT_GAUGE_PIDS.map((pid, idx) => {
                  const def = UNIVERSAL_PID_REGISTRY[pid];
                  const val = telemetry[pid] ?? 0;
                  const isWarn = val < def.warnLow || val > def.warnHigh;
                  const isFocused = scopePid === pid;
                  const tip = PLAIN_ENGLISH_PID_TOOLTIPS[pid];
                  const tipActive = activeTooltipPid === pid;
                  return (
                    <div
                      key={`${pid}-${idx}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectScopePid(pid)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectScopePid(pid);
                        }
                      }}
                      className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                        isWarn
                          ? "border-[#FF1E42]/70 bg-[#16070B]/90 crimson-glow"
                          : tipActive
                          ? "border-[#00FF9D] bg-[#091A14]/95 ring-1 ring-[#00FF9D]/60"
                          : isFocused
                          ? "border-[#00FF9D]/60 bg-[#0A1312]/90"
                          : "border-white/10 bg-[#0A0D14]/90 hover:border-white/25"
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="font-bold text-[#00E5FF]">
                          {pid === "0106" ? "STFT %" : pid === "0142" ? "TERM 30 VOLT" : def.shortName}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500">0x{def.key}</span>
                          <button
                            type="button"
                            aria-label={`Explain ${tip.title}`}
                            title={`${tip.title} — ${tip.explanation}`}
                            onMouseEnter={() => setHoveredTooltipPid(pid)}
                            onMouseLeave={() => setHoveredTooltipPid(null)}
                            onClick={(e) => {
                              e.stopPropagation();
                              playHexSound("CLICK");
                              setPinnedTooltipPid((prev) => (prev === pid ? null : pid));
                            }}
                            className={`inline-flex items-center justify-center rounded-full p-0.5 transition cursor-pointer ${
                              tipActive
                                ? "bg-[#00FF9D] text-[#06070A]"
                                : "text-slate-400 hover:bg-white/10 hover:text-[#00FF9D]"
                            }`}
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div
                        className={`mt-1 font-mono text-xl font-bold ${
                          isWarn ? "text-[#FF1E42]" : "text-white"
                        }`}
                      >
                        {val.toFixed(def.decimals)}
                        <span className="ml-1 text-xs font-normal text-slate-400">
                          {def.unit}
                        </span>
                      </div>
                      <div className="mt-1 truncate font-mono text-[10px] text-slate-500">
                        {def.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(["010C", "010D", soul.primaryPid, "0142"] as PidKey[]).map((pid, idx) => {
                  const def = UNIVERSAL_PID_REGISTRY[pid];
                  const val = telemetry[pid] ?? 0;
                  const targetVal = soul.baselineTelemetry[pid] ?? val;
                  const isPrimary = idx === 2;
                  const isWarn =
                    val < def.warnLow || val > def.warnHigh || (isPrimary && Boolean(activeCurse));
                  const title =
                    idx === 0
                      ? "RPM"
                      : idx === 1
                      ? "SPEED"
                      : idx === 2
                      ? pid === "22F40A"
                        ? "TARGET vs. ACTUAL PRESSURE"
                        : `${def.shortName} TARGET vs ACTUAL`
                      : "TERMINAL 30 VOLTAGE";
                  const tip = PLAIN_ENGLISH_PID_TOOLTIPS[pid];
                  const tipActive = activeTooltipPid === pid;
                  return (
                    <div
                      key={`${pid}-${idx}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectScopePid(pid)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectScopePid(pid);
                        }
                      }}
                      className={`rounded-xl border p-3.5 text-left transition cursor-pointer ${
                        isWarn
                          ? "border-[#FF1E42]/75 bg-[#16070B]/90 crimson-glow"
                          : tipActive
                          ? "border-[#00FF9D] bg-[#091A14]/95 ring-1 ring-[#00FF9D]/60"
                          : scopePid === pid
                          ? "border-[#00FF9D]/60 bg-[#0A1312]/90"
                          : "border-white/10 bg-[#0A0D14]/90 hover:border-white/25"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 font-mono text-[10px]">
                        <span className="font-bold text-[#00E5FF] truncate pr-1">{title}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-slate-500">0x{def.key}</span>
                          <button
                            type="button"
                            aria-label={`Explain ${tip.title}`}
                            title={`${tip.title} — ${tip.explanation}`}
                            onMouseEnter={() => setHoveredTooltipPid(pid)}
                            onMouseLeave={() => setHoveredTooltipPid(null)}
                            onClick={(e) => {
                              e.stopPropagation();
                              playHexSound("CLICK");
                              setPinnedTooltipPid((prev) => (prev === pid ? null : pid));
                            }}
                            className={`inline-flex items-center justify-center rounded-full p-0.5 transition cursor-pointer ${
                              tipActive
                                ? "bg-[#00FF9D] text-[#06070A]"
                                : "text-slate-400 hover:bg-white/10 hover:text-[#00FF9D]"
                            }`}
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div
                        className={`mt-1 font-mono text-xl font-bold ${
                          isWarn ? "text-[#FF1E42]" : "text-white"
                        }`}
                      >
                        {val.toFixed(def.decimals)}
                        <span className="ml-1 text-xs font-normal text-slate-400">{def.unit}</span>
                      </div>
                      <div className="mt-1 truncate font-mono text-[10px] text-slate-400">
                        {isPrimary
                          ? `Target: ${targetVal.toFixed(def.decimals)} ${def.unit}`
                          : def.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {activeTab === "ROAD_DYNO" && (
        <div className="rounded-xl border border-[#00E5FF]/35 bg-[#0A0D14]/90 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#00E5FF]">
                Virtual Road Dyno // {soul.yearMakeModel}
              </h2>
              <p className="font-mono text-[11px] text-slate-400">
                Mass {soul.curbWeightKg} kg • Cd {soul.dragCoefficientCd} • Area{" "}
                {soul.frontalAreaM2} m² • Healthy Baseline vs. Active ECU State
              </p>
            </div>

            <button
              type="button"
              disabled={dynoRunning}
              onClick={onRunDynoPull}
              className="flex items-center gap-2 rounded-lg bg-[#00E5FF] px-4 py-2 font-mono text-xs font-bold text-[#06070A] shadow hover:bg-[#00E5FF]/90 disabled:opacity-50 cursor-pointer"
            >
              <Play className="h-4 w-4" />
              <span>
                {dynoRunning
                  ? "PULLING WOT SWEEP…"
                  : "Execute WOT Dyno Pull (2,000 → 7,000 RPM)"}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5 font-mono">
            <div className="rounded-lg border border-white/10 bg-[#05070B] p-3">
              <div className="text-[10px] text-slate-400">PEAK ACTUAL WHP</div>
              <div className="text-xl font-bold text-[#00FF9D]">{peakActualWhp} WHP</div>
              <div className="text-[10px] text-slate-500">
                Healthy Spec: {soul.peakHealthyWhp} WHP
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#05070B] p-3">
              <div className="text-[10px] text-slate-400">PEAK WHEEL TORQUE</div>
              <div className="text-xl font-bold text-[#00E5FF]">
                {peakActualTorque} lb-ft
              </div>
              <div className="text-[10px] text-slate-500">
                Healthy Spec: {soul.peakHealthyTorqueLbFt} lb-ft
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#05070B] p-3">
              <div className="text-[10px] text-slate-400">CURSE PARASITIC DELTA</div>
              <div
                className={`text-xl font-bold ${
                  activeCurse ? "text-[#FF1E42]" : "text-[#00FF9D]"
                }`}
              >
                {activeCurse ? `-${activeCurse.powerLossPct}% LOSS` : "0.0% NOMINAL"}
              </div>
              <div className="text-[10px] text-slate-500">
                {activeCurse ? activeCurse.dtcCode : "Full Boost / Tractive Output"}
              </div>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dynoCurve}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="rpm"
                  stroke="#64748b"
                  tick={{ fontSize: 10, fontFamily: "monospace" }}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 10, fontFamily: "monospace" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#06070A",
                    borderColor: "rgba(0,229,255,0.4)",
                    fontFamily: "monospace",
                    fontSize: "11px",
                  }}
                />
                <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: "11px" }} />
                <Line
                  type="monotone"
                  dataKey="healthyWhp"
                  name="Healthy Baseline WHP"
                  stroke="#00E5FF"
                  strokeDasharray="5 4"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="actualWhp"
                  name="Actual Measured WHP"
                  stroke={activeCurse ? "#FF1E42" : "#00FF9D"}
                  strokeWidth={2.75}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="actualTorque"
                  name="Actual Torque (lb-ft)"
                  stroke="#FFB800"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {activeTab === "UDS_TERMINAL" && (
        <div className="rounded-xl border border-[#FFB800]/35 bg-[#0A0D14]/90 p-4 space-y-4">
          <div>
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#FFB800]">
              Bidirectional ISO 14229 UDS &amp; SAE J1979 Exorcism Terminal
            </h2>
            <p className="font-mono text-[11px] text-slate-400">
              Transmit authenticated diagnostic routines on CAN ID 0x7E0 to actively remediate ECU faults.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => onDispatchUdsCommand("04")}
              className="flex flex-col items-start rounded-lg border border-[#00FF9D]/40 bg-[#00FF9D]/10 p-3 text-left hover:bg-[#00FF9D]/20 cursor-pointer"
            >
              <span className="font-mono text-xs font-bold text-[#00FF9D]">
                Mode 04 // Clear DTCs &amp; Trims
              </span>
              <span className="mt-1 font-mono text-[10px] text-slate-300">
                TX: 7E0 01 04 05 • Purges fault memory &amp; resets STFT
              </span>
            </button>

            <button
              type="button"
              onClick={() => onDispatchUdsCommand("2F")}
              className="flex flex-col items-start rounded-lg border border-[#00E5FF]/40 bg-[#00E5FF]/10 p-3 text-left hover:bg-[#00E5FF]/20 cursor-pointer"
            >
              <span className="font-mono text-xs font-bold text-[#00E5FF]">
                Mode 2F // Max Cooling Fans
              </span>
              <span className="mt-1 font-mono text-[10px] text-slate-300">
                TX: 7E0 05 2F F0 10 03 FF • Forces 100% PWM thermal purge
              </span>
            </button>

            <button
              type="button"
              onClick={() => onDispatchUdsCommand("31")}
              className="flex flex-col items-start rounded-lg border border-[#FFB800]/40 bg-[#FFB800]/10 p-3 text-left hover:bg-[#FFB800]/20 cursor-pointer"
            >
              <span className="font-mono text-xs font-bold text-[#FFB800]">
                Mode 31 // Solenoid Adapt / DPF Regen
              </span>
              <span className="mt-1 font-mono text-[10px] text-slate-300">
                TX: 7E0 04 31 01 F4 0A • Calibrates solenoids, BMS &amp; DPF
              </span>
            </button>
          </div>

          <div className="h-64 overflow-y-auto rounded-lg border border-white/10 bg-[#050608] p-3 font-mono text-xs space-y-2">
            {udsLogs.map((log, idx) => (
              <div
                key={`${log.id}-${idx}`}
                className={`rounded border px-3 py-2 ${
                  log.direction === "TX 7E0"
                    ? "border-[#00E5FF]/30 bg-[#00E5FF]/5 text-[#00E5FF]"
                    : "border-[#00FF9D]/30 bg-[#00FF9D]/10 text-[#00FF9D]"
                }`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold">[{log.direction}] {log.hex}</span>
                  <span className="text-slate-500">{log.timestamp}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-300">{log.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
