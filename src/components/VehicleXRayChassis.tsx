"use client";

import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  MechanicalCursePreset,
  PidKey,
  UNIVERSAL_PID_REGISTRY,
  VehicleSoulPreset,
} from "@/lib/obd-hex-engine";
import {
  OBD_CONTROL_MODULES,
  ObdModuleId,
  buildFreezeFrameSnapshot,
  buildMultiModuleScanReport,
  lookupUniversalDtc,
} from "@/lib/obd-scanner-qol";
import { DrivingStressSlidersState } from "@/lib/custom-car-and-sliders";
import { formatVehicleShortMakeModel } from "@/lib/vehicle-fault-generator";
import type { DiagnoseResponsePayload } from "@/app/api/diagnose/route";
import { playHexSound } from "@/lib/sound-fx";

export type XRayNodeHealth = "HEALTHY" | "WARNING" | "FAULT";

export interface VehicleXRayChassisProps {
  soul: VehicleSoulPreset;
  vin: string;
  activeCurse: MechanicalCursePreset | null;
  activeDtc: string;
  telemetry: Record<PidKey, number>;
  drivingSliders: DrivingStressSlidersState;
  selectedModuleId?: ObdModuleId;
  onSelectModuleId?: (moduleId: ObdModuleId) => void;
  onSelectScopePid?: (pid: PidKey) => void;
  onOpenScannerAndAi?: (moduleId: ObdModuleId) => void;
  onClearMode04Codes?: () => void;
  onInjectPrimaryFault?: () => void;
  onRollRandomFault?: () => void;
  simulatorLockedReason?: string | null;
  autopsyResult?: DiagnoseResponsePayload | null;
}

interface ChassisNodeLayout {
  id: ObdModuleId;
  codeTag: "[ECM]" | "[TCM]" | "[ABS]" | "[BCM]";
  organTitle: string;
  organSubtitle: string;
  cx: number;
  cy: number;
  labelX: number;
  labelY: number;
  focusPid: PidKey;
  pidList: readonly PidKey[];
}

const CHASSIS_NODE_LAYOUTS: readonly ChassisNodeLayout[] = [
  {
    id: "01_ECM",
    codeTag: "[ECM]",
    organTitle: "Front Powertrain / Engine Bay",
    organSubtitle: "CAN 0x7E8 • Fuel, Boost & Thermal Control",
    cx: 152,
    cy: 158,
    labelX: 146,
    labelY: 256,
    focusPid: "010C",
    pidList: ["010C", "0105", "0106", "221140"],
  },
  {
    id: "02_TCM",
    codeTag: "[TCM]",
    organTitle: "Center Tunnel / Dual-Clutch & Mechatronics",
    organSubtitle: "CAN 0x7E9 • Solenoid Hydraulic Pressure & Clutches",
    cx: 288,
    cy: 158,
    labelX: 288,
    labelY: 256,
    focusPid: "22F40A",
    pidList: ["22F40A", "015C", "010C", "010D"],
  },
  {
    id: "03_ABS",
    codeTag: "[ABS]",
    organTitle: "Corner Wheel Speed & Brake Hydraulics",
    organSubtitle: "CAN 0x7EA • 4-Channel Wheel Sensors & Stability",
    cx: 222,
    cy: 76,
    labelX: 222,
    labelY: 32,
    focusPid: "010D",
    pidList: ["010D", "0142", "010E", "0110"],
  },
  {
    id: "09_BCM",
    codeTag: "[BCM]",
    organTitle: "High-Voltage Pack / Body Control Bus",
    organSubtitle: "CAN 0x7EB • HV Isolation, Cell Balance & 12V Bus",
    cx: 434,
    cy: 158,
    labelX: 436,
    labelY: 256,
    focusPid: "0142",
    pidList: ["0142", "22E001", "22D100", "0105"],
  },
];

function resolvePrimaryWearModule(soul: VehicleSoulPreset): ObdModuleId {
  const defaultCode = soul.curses[0]?.dtcCode ?? "P0750";
  return lookupUniversalDtc(defaultCode).moduleId;
}

export function VehicleXRayChassis({
  soul,
  vin,
  activeCurse,
  activeDtc,
  telemetry,
  drivingSliders,
  selectedModuleId,
  onSelectModuleId,
  onSelectScopePid,
  onOpenScannerAndAi,
  onClearMode04Codes,
  onInjectPrimaryFault,
  onRollRandomFault,
  simulatorLockedReason = null,
  autopsyResult,
}: VehicleXRayChassisProps) {
  const [internalModuleId, setInternalModuleId] = useState<ObdModuleId>("02_TCM");

  const report = useMemo(
    () => buildMultiModuleScanReport(soul, activeCurse, telemetry),
    [soul, activeCurse, telemetry]
  );

  const freezeFrame = useMemo(
    () => buildFreezeFrameSnapshot(telemetry, soul, Boolean(activeCurse)),
    [telemetry, soul, activeCurse]
  );

  const primaryWearModule = useMemo(() => resolvePrimaryWearModule(soul), [soul]);

  const faultedModuleId = useMemo(() => {
    const faulted = report.modules.find((m) => m.status === "FAULT");
    return faulted?.module.id ?? null;
  }, [report.modules]);

  const activeModuleId: ObdModuleId =
    selectedModuleId ?? faultedModuleId ?? internalModuleId;

  const handleClickNode = (layout: ChassisNodeLayout) => {
    playHexSound("CLICK");
    setInternalModuleId(layout.id);
    onSelectModuleId?.(layout.id);
    onSelectScopePid?.(layout.focusPid);
  };

  const getNodeHealth = (moduleId: ObdModuleId): XRayNodeHealth => {
    const modStatus = report.modules.find((m) => m.module.id === moduleId);
    if (modStatus?.status === "FAULT") return "FAULT";
    if (drivingSliders.partWearPct >= 35 && moduleId === primaryWearModule) {
      return "WARNING";
    }
    if (
      drivingSliders.heatTempC >= 109 &&
      (moduleId === "01_ECM" || moduleId === "02_TCM")
    ) {
      return "WARNING";
    }
    if (drivingSliders.drivingLoadRpm >= 5600 && moduleId === "01_ECM") {
      return "WARNING";
    }
    return "HEALTHY";
  };

  const getMicroCallout = (moduleId: ObdModuleId): string => {
    switch (moduleId) {
      case "01_ECM":
        return `${Math.round(telemetry["010C"]).toLocaleString()} RPM • ${Math.round(
          telemetry["0105"]
        )}°C`;
      case "02_TCM":
        return `${telemetry["22F40A"].toFixed(2)} Bar • ${Math.round(
          telemetry["015C"]
        )}°C`;
      case "03_ABS":
        return `${Math.round(telemetry["010D"])} km/h • 4-CH OK`;
      case "09_BCM":
        return `${telemetry["0142"].toFixed(2)}V • ${Math.round(
          telemetry["22E001"]
        )}mV Δ`;
    }
  };

  const overallChassisState: XRayNodeHealth = useMemo(() => {
    if (activeCurse || report.totalFaults > 0) return "FAULT";
    if (
      drivingSliders.partWearPct >= 35 ||
      drivingSliders.heatTempC >= 109 ||
      drivingSliders.drivingLoadRpm >= 5600
    ) {
      return "WARNING";
    }
    return "HEALTHY";
  }, [activeCurse, report.totalFaults, drivingSliders]);

  const selectedLayout =
    CHASSIS_NODE_LAYOUTS.find((n) => n.id === activeModuleId) ??
    CHASSIS_NODE_LAYOUTS[1];
  const selectedScanStatus = report.modules.find(
    (m) => m.module.id === activeModuleId
  );
  const selectedNodeHealth = getNodeHealth(activeModuleId);
  const selectedModuleDtcCards = report.dtcCards.filter(
    (c) => c.moduleId === activeModuleId
  );

  const fallbackCurse = activeCurse ?? soul.curses[0];
  const repairCostUsd =
    autopsyResult?.estimatedCostUsd ?? fallbackCurse?.estimatedCostUsd ?? 1480;
  const repairPartNum =
    autopsyResult?.oemPartNumber ?? fallbackCurse?.oemPartNumber ?? "OEM-SPEC";
  const repairPartName =
    autopsyResult?.oemPartName ?? fallbackCurse?.oemPartName ?? "OEM Assembly";
  const repairExplanation =
    autopsyResult?.rootCause ??
    fallbackCurse?.mechanicalExplanation ??
    "All telemetry parameters locked within factory tolerances.";

  const harnessStroke =
    overallChassisState === "FAULT"
      ? "#f43f5e"
      : overallChassisState === "WARNING"
      ? "#f59e0b"
      : "#10b981";

  return (
    <section
      data-cinema-target="XRAY_CHASSIS"
      className="obsidian-panel rounded-2xl p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              INTERACTIVE X-RAY CHASSIS // ISO 15765-4 4-ECU TOPOLOGY
            </span>
          </div>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-white">
            {soul.yearMakeModel}{" "}
            <span className="font-mono text-xs font-normal text-zinc-400">
              ({vin.slice(0, 11)}…)
            </span>
          </h2>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tabular-nums ${
            overallChassisState === "FAULT"
              ? "border-rose-500/40 bg-rose-500/15 text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.2)]"
              : overallChassisState === "WARNING"
              ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
              : "border-emerald-500/35 bg-emerald-500/12 text-emerald-300"
          }`}
        >
          {overallChassisState === "FAULT" ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
              <span>FAULT: {activeCurse?.dtcCode ?? activeDtc}</span>
            </>
          ) : overallChassisState === "WARNING" ? (
            <>
              <Activity className="h-3.5 w-3.5 text-amber-400" />
              <span>STRESS / WEAR WARNING</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>4/4 ECUs PASS</span>
            </>
          )}
        </span>
      </div>

      {/* SVG Top-Down Automotive X-Ray Blueprint */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#05070b] p-2 sm:p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              overallChassisState === "FAULT"
                ? "radial-gradient(circle at 50% 50%, rgba(244,63,94,0.14), transparent 68%)"
                : overallChassisState === "WARNING"
                ? "radial-gradient(circle at 50% 50%, rgba(245,158,11,0.12), transparent 68%)"
                : "radial-gradient(circle at 50% 50%, rgba(16,185,129,0.10), transparent 68%)",
          }}
        />

        <svg
          viewBox="0 0 580 296"
          className="relative z-10 h-auto w-full select-none"
          role="img"
          aria-label="Interactive Top-Down Automotive X-Ray Blueprint with ECM, TCM, ABS, and BCM nodes"
        >
          <defs>
            <pattern id="xrayGrid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path
                d="M 24 0 L 0 0 0 24"
                fill="none"
                stroke="rgba(255,255,255,0.035)"
                strokeWidth="0.8"
              />
            </pattern>
            <linearGradient id="chassisBodyFill" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(30,41,59,0.34)" />
              <stop offset="50%" stopColor="rgba(15,23,42,0.52)" />
              <stop offset="100%" stopColor="rgba(30,41,59,0.34)" />
            </linearGradient>
            <linearGradient id="chassisRimStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
              <stop offset="50%" stopColor="rgba(148,163,184,0.18)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.26)" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width="580" height="296" fill="url(#xrayGrid)" />
          <text
            x="14"
            y="16"
            fill="rgba(161,161,170,0.65)"
            fontSize="8"
            fontFamily="monospace"
            letterSpacing="1.2"
          >
            FRONT AXLE // CAN-FD 500KBPS
          </text>
          <text
            x="566"
            y="16"
            textAnchor="end"
            fill="rgba(161,161,170,0.65)"
            fontSize="8"
            fontFamily="monospace"
            letterSpacing="1.2"
          >
            REAR SUBFRAME // HV &amp; GATEWAY
          </text>
          <line
            x1="36"
            y1="158"
            x2="548"
            y2="158"
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="4 4"
          />

          {/* 4 Forged Wheels + Brake Calipers */}
          {[
            { x: 126, y: 54, tag: "FL" },
            { x: 126, y: 230, tag: "FR" },
            { x: 424, y: 54, tag: "RL" },
            { x: 424, y: 230, tag: "RR" },
          ].map((wheel) => (
            <g key={wheel.tag}>
              <rect
                x={wheel.x}
                y={wheel.y}
                width="64"
                height="32"
                rx="8"
                fill="rgba(15,23,42,0.88)"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1.2"
              />
              <rect
                x={wheel.x + 24}
                y={wheel.y + 11}
                width="16"
                height="10"
                rx="2.5"
                fill="rgba(34,211,238,0.18)"
                stroke="rgba(34,211,238,0.55)"
                strokeWidth="0.9"
              />
            </g>
          ))}

          {/* Sculpted Top-Down Translucent Body Silhouette */}
          <path
            d="M 52 158 C 52 114, 78 86, 118 80 L 196 74 C 232 68, 344 68, 396 74 L 484 82 C 516 88, 534 116, 534 158 C 534 200, 516 228, 484 234 L 396 242 C 344 248, 232 248, 196 242 L 118 236 C 78 230, 52 202, 52 158 Z"
            fill="url(#chassisBodyFill)"
            stroke="url(#chassisRimStroke)"
            strokeWidth="1.6"
          />
          <path
            d="M 196 96 C 238 88, 342 88, 392 98 L 418 118 L 418 198 L 392 218 C 342 228, 238 228, 196 220 L 176 196 L 176 120 Z"
            fill="rgba(6,7,10,0.48)"
            stroke="rgba(255,255,255,0.11)"
            strokeWidth="1.1"
          />
          <path
            d="M 62 116 Q 55 158 62 200"
            fill="none"
            stroke="rgba(34,211,238,0.5)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 526 108 Q 532 158 526 208"
            fill="none"
            stroke={overallChassisState === "FAULT" ? "#f43f5e" : "rgba(244,63,94,0.55)"}
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Internal X-Ray Powertrain, Transmission Tunnel & HV Pack */}
          <rect
            x="114"
            y="128"
            width="76"
            height="60"
            rx="10"
            fill="rgba(16,185,129,0.06)"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="1.1"
          />
          <rect
            x="190"
            y="142"
            width="196"
            height="32"
            rx="8"
            fill="rgba(139,92,246,0.08)"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="1.1"
          />
          <rect
            x="388"
            y="118"
            width="86"
            height="80"
            rx="10"
            fill="rgba(34,211,238,0.06)"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="1.1"
          />

          {/* ABS Brake Hydraulic Lines & CAN-Bus Neural Stitches */}
          <g stroke="rgba(34,211,238,0.28)" strokeWidth="1.1" strokeDasharray="3 3" fill="none">
            <path d="M 222 76 L 158 70" />
            <path d="M 222 76 L 456 70" />
            <path d="M 222 76 L 158 246" />
            <path d="M 222 76 L 456 246" />
          </g>
          <g fill="none" stroke={harnessStroke} strokeWidth="1.8" opacity="0.85">
            <path d="M 152 158 L 288 158 L 434 158" className="animate-chimera-stitch" />
            <path d="M 222 76 L 288 158" className="animate-chimera-stitch" />
            <path d="M 152 158 L 222 76" className="animate-chimera-stitch" />
          </g>

          {/* 4 Interactive Pulsing Hardware Nodes */}
          {CHASSIS_NODE_LAYOUTS.map((node) => {
            const nodeHealth = getNodeHealth(node.id);
            const isSelected = activeModuleId === node.id;
            const modScan = report.modules.find((m) => m.module.id === node.id);
            const colorHex =
              nodeHealth === "FAULT"
                ? "#f43f5e"
                : nodeHealth === "WARNING"
                ? "#f59e0b"
                : "#10b981";
            const calloutText = getMicroCallout(node.id);
            const shortTag = node.id.split("_")[1];

            return (
              <g
                key={node.id}
                data-cinema-target={`XRAY_NODE_${shortTag}`}
                onClick={() => handleClickNode(node)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClickNode(node);
                  }
                }}
                role="button"
                tabIndex={0}
                className="cursor-pointer"
              >
                {(nodeHealth === "FAULT" || nodeHealth === "WARNING") && (
                  <>
                    <circle
                      cx={node.cx}
                      cy={node.cy}
                      r={18}
                      fill="none"
                      stroke={colorHex}
                      strokeWidth="2"
                      className="animate-xray-sonar"
                    />
                    <circle
                      cx={node.cx}
                      cy={node.cy}
                      r={24}
                      fill="none"
                      stroke={colorHex}
                      strokeWidth="1.2"
                      opacity="0.55"
                      className="animate-xray-sonar"
                    />
                  </>
                )}

                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={isSelected ? 21 : 16}
                  fill={colorHex}
                  opacity={nodeHealth === "FAULT" ? 0.28 : 0.16}
                />

                {isSelected && (
                  <circle
                    cx={node.cx}
                    cy={node.cy}
                    r={20}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.4"
                    strokeDasharray="3 2"
                  />
                )}

                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={13}
                  fill="#090b10"
                  stroke={colorHex}
                  strokeWidth="2.4"
                />
                <text
                  x={node.cx}
                  y={node.cy + 3.5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="8.5"
                  fontWeight="700"
                  fontFamily="monospace"
                >
                  {shortTag}
                </text>

                <line
                  x1={node.cx}
                  y1={node.cy + (node.labelY < node.cy ? -15 : 15)}
                  x2={node.labelX}
                  y2={node.labelY + (node.labelY < node.cy ? 14 : -14)}
                  stroke={colorHex}
                  strokeWidth="1"
                  opacity="0.65"
                />
                <g transform={`translate(${node.labelX - 66}, ${node.labelY - 12})`}>
                  <rect
                    width="132"
                    height="24"
                    rx="6"
                    fill="rgba(9,11,17,0.92)"
                    stroke={isSelected ? "rgba(255,255,255,0.38)" : `${colorHex}66`}
                    strokeWidth="1"
                  />
                  <text
                    x="66"
                    y="10"
                    textAnchor="middle"
                    fill={colorHex}
                    fontSize="8"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {node.codeTag}{" "}
                    {modScan?.status === "FAULT"
                      ? `FAULT ${modScan.dtcCodes[0] ?? ""}`
                      : nodeHealth === "WARNING"
                      ? "STRESS WARN"
                      : "NOMINAL"}
                  </text>
                  <text
                    x="66"
                    y="19.5"
                    textAnchor="middle"
                    fill="#e4e4e7"
                    fontSize="7.8"
                    fontFamily="monospace"
                  >
                    {calloutText}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 4-Node Tactile Selector Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {CHASSIS_NODE_LAYOUTS.map((node) => {
          const modSpec = OBD_CONTROL_MODULES.find((m) => m.id === node.id);
          const health = getNodeHealth(node.id);
          const selected = activeModuleId === node.id;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => handleClickNode(node)}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition cursor-pointer ${
                selected
                  ? "border-white/25 bg-white/[0.08] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14)]"
                  : "border-white/[0.07] bg-[#07090e]/80 text-zinc-400 hover:border-white/[0.16] hover:text-zinc-200"
              }`}
            >
              <div>
                <div className="font-mono text-[11px] font-bold text-white">
                  {node.codeTag}
                </div>
                <div className="text-[10px] text-zinc-400 truncate">
                  {modSpec?.originLabel ?? "ECU"}
                </div>
              </div>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  health === "FAULT"
                    ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                    : health === "WARNING"
                    ? "bg-amber-400 shadow-[0_0_8px_#f59e0b]"
                    : "bg-emerald-400 shadow-[0_0_8px_#10b981]"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Clicked ECU Module Live Telemetry + Freeze-Frame + AI Repair Inspector */}
      <div className="obsidian-subcard rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-2.5">
          <div className="flex items-center gap-2">
            <Cpu
              className={`h-4 w-4 ${
                selectedNodeHealth === "FAULT"
                  ? "text-rose-400"
                  : selectedNodeHealth === "WARNING"
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            />
            <div>
              <div className="text-xs font-semibold text-white">
                {selectedLayout.codeTag} {selectedLayout.organTitle}
              </div>
              <div className="font-mono text-[10px] text-zinc-400">
                {selectedLayout.organSubtitle}
              </div>
            </div>
          </div>

          <span
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
              selectedNodeHealth === "FAULT"
                ? "border-rose-500/35 bg-rose-500/15 text-rose-300"
                : selectedNodeHealth === "WARNING"
                ? "border-amber-500/35 bg-amber-500/15 text-amber-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {selectedScanStatus?.status === "FAULT"
              ? `🔴 ${selectedScanStatus.dtcCodes.join(" / ")}`
              : selectedNodeHealth === "WARNING"
              ? "🟡 DRIFT / THERMAL WARN"
              : "🟢 PASS (0 DTCs)"}
          </span>
        </div>

        {/* Live Module PIDs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {selectedLayout.pidList.map((pid) => {
            const def = UNIVERSAL_PID_REGISTRY[pid];
            const val = telemetry[pid];
            const outOfBounds = val < def.warnLow || val > def.warnHigh;
            return (
              <button
                key={pid}
                type="button"
                onClick={() => {
                  playHexSound("CLICK");
                  onSelectScopePid?.(pid);
                }}
                className="rounded-lg border border-white/[0.06] bg-zinc-950/80 px-2.5 py-2 text-left hover:border-white/[0.16] transition cursor-pointer"
              >
                <div className="font-mono text-[10px] text-zinc-500 truncate">
                  {def.shortName} ({pid})
                </div>
                <div
                  className={`mt-0.5 font-mono text-xs font-semibold tabular-nums ${
                    outOfBounds ? "text-rose-400" : "text-zinc-100"
                  }`}
                >
                  {val.toFixed(def.decimals)} {def.unit}
                </div>
              </button>
            );
          })}
        </div>

        {/* Freeze-Frame & AI Repair Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-zinc-950/60 px-3 py-2 text-[11px]">
          <span className="font-mono text-zinc-400 tabular-nums">
            <strong className="text-zinc-200">Mode $02 Freeze:</strong>{" "}
            {freezeFrame.rpm} RPM • {freezeFrame.speedKmh} km/h •{" "}
            {freezeFrame.coolantTempC}°C • Load {freezeFrame.calculatedLoadPct}% •{" "}
            {freezeFrame.voltageV}V
          </span>

          {selectedModuleDtcCards.length > 0 || activeCurse ? (
            <span className="font-mono text-xs font-semibold text-amber-300 tabular-nums">
              AI Fair Fix: ${repairCostUsd.toLocaleString()} ({repairPartNum})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Telemetry Nominal
            </span>
          )}
        </div>

        <p className="text-xs leading-relaxed text-zinc-300 line-clamp-2">
          {selectedModuleDtcCards.length > 0 ? (
            <>
              <strong className="text-rose-300">
                {selectedModuleDtcCards[0].code} ({repairPartName}):{" "}
              </strong>
              {repairExplanation}
            </>
          ) : activeCurse ? (
            <>
              <strong className="text-amber-300">
                Active Fault on {lookupUniversalDtc(activeCurse.dtcCode).moduleOrigin}:{" "}
              </strong>
              Click the glowing faulted node on the X-Ray chassis above or inspect in Multi-ECU Scanner.
            </>
          ) : (
            "Click any [ECM], [TCM], [ABS], or [BCM] node on the blueprint to inspect live ECU channels, Freeze-Frame snapshots, and Vertex AI repair triage."
          )}
        </p>

        {/* Action Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            {simulatorLockedReason ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900/90 px-3 py-1.5 font-mono text-[11px] font-medium text-zinc-400">
                🔒 Simulator Locked ({simulatorLockedReason})
              </span>
            ) : activeCurse ? (
              <>
                {(onRollRandomFault || onInjectPrimaryFault) && (
                  <button
                    type="button"
                    data-cinema-target="XRAY_REROLL_BTN"
                    onClick={onRollRandomFault ?? onInjectPrimaryFault}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/12 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/22 transition cursor-pointer"
                  >
                    <span>🎲 Re-Roll Another Issue</span>
                  </button>
                )}
                {onClearMode04Codes && (
                  <button
                    type="button"
                    onClick={onClearMode04Codes}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Clear Codes (Mode $04)</span>
                  </button>
                )}
              </>
            ) : (
              (onRollRandomFault || onInjectPrimaryFault) && (
                <button
                  type="button"
                  onClick={onRollRandomFault ?? onInjectPrimaryFault}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>
                    🎲 Simulate Random Issue for {formatVehicleShortMakeModel(soul.yearMakeModel)}
                  </span>
                </button>
              )
            )}
          </div>

          {onOpenScannerAndAi && (
            <button
              type="button"
              onClick={() => onOpenScannerAndAi(activeModuleId)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/35 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/25 transition cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              <span>Open ECU Scanner &amp; Vertex AI</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}





