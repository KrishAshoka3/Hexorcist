"use client";

import React, { useState } from "react";
import {
  Activity,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  HelpCircle,
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
import {
  PLAIN_ENGLISH_PID_TOOLTIPS,
  ObdModuleId,
  evaluateRoadSafetyTriage,
} from "@/lib/obd-scanner-qol";
import { DrivingStressSlidersState } from "@/lib/custom-car-and-sliders";
import { InteractiveDrivingStressBar } from "./InteractiveDrivingStressBar";
import { VehicleXRayChassis } from "@/components/VehicleXRayChassis";
import type { DiagnoseResponsePayload } from "@/app/api/diagnose/route";
import type { ScopeSample } from "./CenterDiagnosticColumn";
import { playHexSound } from "@/lib/sound-fx";

export interface LiveHealthTabProps {
  soul: VehicleSoulPreset;
  vin?: string;
  activeCurse: MechanicalCursePreset | null;
  activeDtc: string;
  telemetry: Record<PidKey, number>;
  scopePid: PidKey;
  onSelectScopePid: (pid: PidKey) => void;
  scopeHistory: ScopeSample[];
  cinemaTooltipPid?: PidKey | null;
  drivingSliders: DrivingStressSlidersState;
  onChangeDrivingSliders: (next: DrivingStressSlidersState) => void;
  onResetDrivingSliders: () => void;
  escrowRateCentsPerMile: number;
  stressWarnings: string[];
  onOpenScannerTab: () => void;
  selectedXRayModuleId?: ObdModuleId;
  onSelectXRayModuleId?: (id: ObdModuleId) => void;
  onClearMode04Codes?: () => void;
  onInjectPrimaryFault?: () => void;
  onRollRandomFault?: () => void;
  simulatorLockedReason?: string | null;
  autopsyResult?: DiagnoseResponsePayload | null;
}

const SCOPE_PIDS: PidKey[] = ["22F40A", "221140", "22E001", "22D100", "010C", "0106"];

export function LiveHealthTab({
  soul,
  vin,
  activeCurse,
  activeDtc,
  telemetry,
  scopePid,
  onSelectScopePid,
  scopeHistory,
  cinemaTooltipPid = null,
  drivingSliders,
  onChangeDrivingSliders,
  onResetDrivingSliders,
  escrowRateCentsPerMile,
  stressWarnings,
  onOpenScannerTab,
  selectedXRayModuleId,
  onSelectXRayModuleId,
  onClearMode04Codes,
  onInjectPrimaryFault,
  onRollRandomFault,
  simulatorLockedReason = null,
  autopsyResult,
}: LiveHealthTabProps) {
  const [bannerClickedOpen, setBannerClickedOpen] = useState(false);
  const [activeTipPid, setActiveTipPid] = useState<PidKey | null>(null);

  const hasFault = Boolean(activeCurse);
  const isOverheating = telemetry["0105"] >= 109;
  const triage =
    hasFault || isOverheating
      ? evaluateRoadSafetyTriage(activeDtc, activeCurse, telemetry)
      : null;

  const isExpanded = hasFault || isOverheating || bannerClickedOpen;
  const scopeDef = UNIVERSAL_PID_REGISTRY[scopePid];
  const displayedTipPid = cinemaTooltipPid ?? activeTipPid;
  const displayedTip = displayedTipPid ? PLAIN_ENGLISH_PID_TOOLTIPS[displayedTipPid] : null;

  const latestSample = scopeHistory[scopeHistory.length - 1];
  const actualTraceVal = latestSample ? latestSample.actual : telemetry[scopePid];
  const targetTraceVal = latestSample ? latestSample.target : soul.baselineTelemetry[scopePid];

  const heroMetrics: Array<{
    pid: PidKey;
    label: string;
    value: string;
    unit: string;
    sub: string;
    warn: boolean;
  }> = [
    {
      pid: "010C",
      label: "Engine Speed",
      value: Math.round(telemetry["010C"]).toLocaleString(),
      unit: "RPM",
      sub: telemetry["010C"] >= 5400 ? "High Engine Load" : "Smooth Operating Range",
      warn: telemetry["010C"] >= 6200,
    },
    {
      pid: "0105",
      label: "Coolant Temp",
      value: `${Math.round(telemetry["0105"])}`,
      unit: "°C",
      sub: `${Math.round((telemetry["0105"] * 9) / 5 + 32)}°F • Normal 80–105°C`,
      warn: telemetry["0105"] >= 109,
    },
    {
      pid: "0142",
      label: "System Voltage",
      value: telemetry["0142"].toFixed(2),
      unit: "V",
      sub: telemetry["0142"] < 12.4 ? "Low Alternator Output" : "Charging System Healthy",
      warn: telemetry["0142"] < 12.2 || telemetry["0142"] > 15.1,
    },
  ];

  const bannerToneClass = triage
    ? triage.level === "STOP"
      ? "border-rose-500/35 bg-rose-950/30 text-rose-200"
      : "border-amber-500/35 bg-amber-950/25 text-amber-200"
    : "border-emerald-500/20 bg-zinc-900/60 text-zinc-200";

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Centerpiece Split: Interactive SVG Vehicle X-Ray Chassis + 60fps Heart Monitor */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-6">
          <VehicleXRayChassis
            soul={soul}
            vin={vin ?? soul.defaultVin}
            activeCurse={activeCurse}
            activeDtc={activeDtc}
            telemetry={telemetry}
            drivingSliders={drivingSliders}
            selectedModuleId={selectedXRayModuleId}
            onSelectModuleId={onSelectXRayModuleId}
            onSelectScopePid={onSelectScopePid}
            onOpenScannerAndAi={() => onOpenScannerTab()}
            onClearMode04Codes={onClearMode04Codes}
            onInjectPrimaryFault={onInjectPrimaryFault}
            onRollRandomFault={onRollRandomFault}
            simulatorLockedReason={simulatorLockedReason}
            autopsyResult={autopsyResult}
          />
        </div>

        {/* Right Half: Hero KPI Strip + 60fps Oscilloscope */}
        <section
          data-cinema-target="CENTER_PANEL"
          className="xl:col-span-6 obsidian-panel rounded-2xl p-5 sm:p-6 space-y-5"
        >
          <div
            data-cinema-target="CENTER_KPI_GRID"
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            {heroMetrics.map((m) => (
              <div
                key={m.pid}
                className={`rounded-xl border p-3.5 transition ${
                  m.warn
                    ? "border-rose-500/35 bg-rose-950/20"
                    : "obsidian-subcard"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-zinc-400">{m.label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      playHexSound("CLICK");
                      setActiveTipPid((prev) => (prev === m.pid ? null : m.pid));
                    }}
                    aria-label={`Explain ${m.label}`}
                    className="text-zinc-500 hover:text-zinc-200 transition cursor-pointer"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span
                    className={`font-mono text-2xl font-semibold tracking-tight tabular-nums ${
                      m.warn ? "text-rose-400" : "text-white"
                    }`}
                  >
                    {m.value}
                  </span>
                  <span className="text-xs font-medium text-zinc-400">{m.unit}</span>
                </div>
                <div className="mt-1 text-[11px] text-zinc-500 truncate">{m.sub}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-5">
            <div>
              <div className="flex items-center gap-2">
                <Activity
                  className={`h-4 w-4 ${hasFault ? "text-rose-400" : "text-emerald-400"}`}
                />
                <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                  60fps Heart Monitor — {scopeDef.name}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    playHexSound("CLICK");
                    setActiveTipPid((prev) => (prev === scopePid ? null : scopePid));
                  }}
                  aria-label="Explain active waveform sensor"
                  className="text-zinc-500 hover:text-zinc-200 transition cursor-pointer"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 tabular-nums">
                Target{" "}
                <strong className="font-mono text-zinc-200">
                  {targetTraceVal.toFixed(scopeDef.decimals)} {scopeDef.unit}
                </strong>{" "}
                / Actual{" "}
                <strong
                  className={`font-mono ${
                    hasFault ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {actualTraceVal.toFixed(scopeDef.decimals)} {scopeDef.unit}
                </strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {SCOPE_PIDS.map((pid) => {
                const selected = scopePid === pid;
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => onSelectScopePid(pid)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                      selected
                        ? "border-white/20 bg-white/[0.1] text-white"
                        : "border-white/[0.06] bg-zinc-950/60 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {UNIVERSAL_PID_REGISTRY[pid].shortName}
                  </button>
                );
              })}
            </div>
          </div>

        {displayedTip && (
          <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.08] px-4 py-3 text-xs text-zinc-200">
            <span className="font-semibold text-violet-300">{displayedTip.title}: </span>
            <span>{displayedTip.explanation}</span>
            <span className="ml-2 text-zinc-400">({displayedTip.healthyRange})</span>
          </div>
        )}

        <div className="h-[296px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={scopeHistory}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              <XAxis
                dataKey="tick"
                stroke="#71717a"
                tick={{ fontSize: 11, fontFamily: "monospace" }}
              />
              <YAxis
                stroke="#71717a"
                tick={{ fontSize: 11, fontFamily: "monospace" }}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0c0f17",
                  borderColor: "rgba(255,255,255,0.12)",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line
                type="monotone"
                dataKey="target"
                name={`Target Setpoint (${scopeDef.unit})`}
                stroke="#818cf8"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="actual"
                name={`Actual Sensor (${scopeDef.unit})`}
                stroke={hasFault ? "#f43f5e" : "#10b981"}
                strokeWidth={2.75}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      </div>

      {/* 2. Live Driving Stress & Wear Simulator */}
      <InteractiveDrivingStressBar
        sliders={drivingSliders}
        onChangeSliders={onChangeDrivingSliders}
        onResetSliders={onResetDrivingSliders}
        escrowRateCentsPerMile={escrowRateCentsPerMile}
        warnings={stressWarnings}
      />

      {/* 3. Unmistakable "Can I Drive This?" Safety Triage Banner */}
      <div
        data-cinema-target="SAFETY_TRIAGE_BANNER"
        className={`rounded-2xl border px-6 py-4 shadow-xl transition-all ${bannerToneClass}`}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            playHexSound("CLICK");
            setBannerClickedOpen((prev) => !prev);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setBannerClickedOpen((prev) => !prev);
            }
          }}
          className="flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-300 shrink-0">
              CAN I DRIVE THIS?
            </span>
            <span className="h-3.5 w-px bg-white/15 hidden sm:inline-block" />
            <span className="text-sm font-semibold truncate">
              {triage
                ? triage.badgeText
                : "🟢 Safe to Drive — All 4 Control Modules Nominal"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>{isExpanded ? "Hide guidance" : "Details"}</span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-3 text-xs">
            <p className="text-zinc-300 max-w-3xl leading-relaxed">
              {triage
                ? triage.guidance
                : "Engine, transmission, ABS, and battery gateway sensors are operating within factory tolerances."}
            </p>
            <button
              type="button"
              onClick={() => {
                playHexSound("CLICK");
                onOpenScannerTab();
              }}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2 text-xs font-medium text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            >
              <span>Inspect in 4-ECU Scanner &amp; Vertex AI</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

