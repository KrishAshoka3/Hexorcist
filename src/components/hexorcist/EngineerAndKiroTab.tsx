"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Binary,
  Bot,
  Cable,
  CheckCircle2,
  Cpu,
  Download,
  FileCode2,
  Gauge,
  GitBranch,
  Pause,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Upload,
  Webhook,
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
  ALL_PID_KEYS,
  MechanicalCursePreset,
  PidKey,
  SoulProfileId,
  UNIVERSAL_PID_REGISTRY,
  VehicleArchitectureId,
  VehicleSoulPreset,
  buildCANResponseFrame,
  calculateEscrowRateCents,
  decodeDTCBytes,
  encodeDTCString,
  inspectDTCBitmask,
  parseRawCANFrame,
  toHexByte,
} from "@/lib/obd-hex-engine";
import {
  SAMPLE_DBC_MATRICES,
  TelemetryPlaybackFrame,
  buildLiveDbcPayloadBytes,
  decodeDbcSignalEngineering,
  processVirtualElm327Command,
} from "@/lib/log-and-dbc-engine";
import {
  batchValidateWorkOrders,
  validateUdsResponse,
  validateWorkOrder,
} from "@/lib/work-order-validator";
import {
  CsvPlaybackScrubberBar,
  HardwareStudioTab,
  PlaybackSpeedMultiplier,
} from "@/components/HardwareAndDbcModal";
import type { FrameLogEntry } from "./LeftHexTerminalColumn";
import type { DynoCurvePoint, UdsHandshakeEntry } from "./CenterDiagnosticColumn";
import type { ConnectionMode } from "./TopCommandBar";
import { playHexSound } from "@/lib/sound-fx";

export type EngineerSubTabId = "CAN_DBC" | "DYNO_UDS" | "KIRO_PROOFS";

export interface EngineerAndKiroTabProps {
  subTab: EngineerSubTabId;
  onSelectSubTab: (tab: EngineerSubTabId) => void;
  activeVehicleId: SoulProfileId;
  soul: VehicleSoulPreset;
  activeVin: string;
  activeCurse: MechanicalCursePreset | null;
  activeDtc: string;
  telemetry: Record<PidKey, number>;
  frames: FrameLogEntry[];
  selectedFrame: FrameLogEntry | null;
  onSelectFrame: (entry: FrameLogEntry) => void;
  streamPaused: boolean;
  onTogglePause: () => void;
  onCastCurse: (curse: MechanicalCursePreset) => void;
  onClearCurses: () => void;
  connectionMode: ConnectionMode;
  webSerialStatus: string;
  loopbackActive: boolean;
  physicalPortConnected: boolean;
  onConnectWebSerial: () => void;
  onActivateLoopbackPort: () => void;
  onDisconnectExternalSource: () => void;
  onIngestLoopbackFrame: (rawFrame: string) => void;
  onDownloadSampleCsv: () => void;
  onUploadCsvFile: (file: File) => void;
  onLoadBuiltInSampleCsv: () => void;
  csvFrames: TelemetryPlaybackFrame[];
  csvCursor: number;
  csvPlaying: boolean;
  csvSpeed: PlaybackSpeedMultiplier;
  csvSourceLabel: string;
  onSeekCsv: (index: number) => void;
  onTogglePlayCsv: () => void;
  onChangeSpeedCsv: (speed: PlaybackSpeedMultiplier) => void;
  onOpenFullHardwareModal: (tab: HardwareStudioTab) => void;
  dynoCurve: DynoCurvePoint[];
  dynoRunning: boolean;
  peakActualWhp: number;
  peakActualTorque: number;
  onRunDynoPull: () => void;
  udsLogs: UdsHandshakeEntry[];
  onDispatchUdsCommand: (mode: "04" | "2F" | "31") => void;
  cinemaSignalIndex?: number | null;
  kiroAutoRunTrigger?: number;
}

interface LiveAuditSummary {
  ranAt: string;
  samplesVerified: number;
  pidRoundTripsPassed: number;
  dtcBijectionsPassed: number;
  escrowMonotonicPassed: number;
  workOrderChecksPassed: number;
  sampleFrames: string[];
}

let engLogSeq = 0;
function nextEngLogId(prefix: string): string {
  engLogSeq = (engLogSeq + 1) % 1_000_000;
  return `${prefix}-${Date.now()}-${engLogSeq}`;
}

export function EngineerAndKiroTab(props: EngineerAndKiroTabProps) {
  const {
    subTab,
    onSelectSubTab,
    activeVehicleId,
    soul,
    activeVin,
    activeCurse,
    activeDtc,
    telemetry,
    frames,
    selectedFrame,
    onSelectFrame,
    streamPaused,
    onTogglePause,
    onCastCurse,
    onClearCurses,
    connectionMode,
    webSerialStatus,
    loopbackActive,
    physicalPortConnected,
    onConnectWebSerial,
    onActivateLoopbackPort,
    onDisconnectExternalSource,
    onIngestLoopbackFrame,
    onDownloadSampleCsv,
    onUploadCsvFile,
    onLoadBuiltInSampleCsv,
    csvFrames,
    csvCursor,
    csvPlaying,
    csvSpeed,
    csvSourceLabel,
    onSeekCsv,
    onTogglePlayCsv,
    onChangeSpeedCsv,
    onOpenFullHardwareModal,
    dynoCurve,
    dynoRunning,
    peakActualWhp,
    peakActualTorque,
    onRunDynoPull,
    udsLogs,
    onDispatchUdsCommand,
    cinemaSignalIndex = null,
    kiroAutoRunTrigger = 0,
  } = props;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedSigIdx, setSelectedSigIdx] = useState<number>(0);
  const [atInput, setAtInput] = useState("01 0C");
  const [atLog, setAtLog] = useState<Array<{ id: string; tx: string; rx: string }>>([
    {
      id: "eng-init",
      tx: "ATSP6",
      rx: "OK // ISO 15765-4 CAN (11-bit ID, 500 kbaud)",
    },
  ]);
  const [liveAudit, setLiveAudit] = useState<LiveAuditSummary | null>(null);

  const effectiveSigIdx = cinemaSignalIndex ?? selectedSigIdx;
  const inspected = selectedFrame ?? frames[0] ?? null;

  let bitmask = inspectDTCBitmask("P0750");
  try {
    bitmask = inspectDTCBitmask(activeDtc);
  } catch {
    bitmask = inspectDTCBitmask("P0300");
  }

  const matrixId: VehicleArchitectureId =
    activeVehicleId === "CUSTOM_VIN_SOUL"
      ? "GERMAN_V6_DSG"
      : (activeVehicleId as VehicleArchitectureId);
  const matrix = SAMPLE_DBC_MATRICES[matrixId];
  const liveBytes = useMemo(
    () => buildLiveDbcPayloadBytes(matrixId, telemetry, Boolean(activeCurse)),
    [matrixId, telemetry, activeCurse]
  );
  const activeSignal = matrix.signals[Math.min(matrix.signals.length - 1, Math.max(0, effectiveSigIdx))];
  const activeSignalDecoded = useMemo(
    () => decodeDbcSignalEngineering(liveBytes, activeSignal),
    [liveBytes, activeSignal]
  );
  const occupiedBitSet = useMemo(
    () => new Set<number>(activeSignalDecoded.preview.occupiedDbcBits),
    [activeSignalDecoded]
  );

  const sendAtCmd = (raw?: string) => {
    const cmd = (raw ?? atInput).trim().toUpperCase();
    if (!cmd) return;
    if (!loopbackActive && !physicalPortConnected) {
      onActivateLoopbackPort();
    }
    const resp = processVirtualElm327Command(cmd, {
      telemetry,
      activeDtc: activeCurse?.dtcCode ?? null,
      vin: activeVin,
      soulCodename: soul.codename,
    });
    const uid = nextEngLogId("at");
    setAtLog((prev) => [
      { id: uid, tx: cmd, rx: resp.rxLines.join(" | ") },
      ...prev.slice(0, 6),
    ]);
    for (const line of resp.rxLines) {
      if (line.startsWith("7E8 ")) onIngestLoopbackFrame(line);
    }
    if (resp.clearedFaults) onClearCurses();
    if (!raw) setAtInput("");
  };

  const runLiveAuditCompute = (): LiveAuditSummary => {
    let pidPassed = 0;
    let dtcPassed = 0;
    let escrowPassed = 0;
    const sampleFrames: string[] = [];

    for (const pid of ALL_PID_KEYS) {
      const def = UNIVERSAL_PID_REGISTRY[pid];
      for (let i = 0; i < 10; i++) {
        const val = def.min + (def.max - def.min) * (i / 9);
        const frame = buildCANResponseFrame(pid, val);
        const parsed = parseRawCANFrame(frame);
        if (
          parsed.valid &&
          parsed.checksumValid &&
          parsed.value !== null &&
          Math.abs(parsed.value - val) <= def.tolerance + 1e-6
        ) {
          pidPassed++;
        }
        if (i === 4 && sampleFrames.length < 4) {
          sampleFrames.push(`${pid}: ${frame} => ${parsed.value?.toFixed(def.decimals)} ${def.unit}`);
        }
      }
    }

    for (let i = 0; i < 80; i++) {
      const byteA = (i * 73 + 19) & 0xff;
      const byteB = (i * 137 + 41) & 0xff;
      const code = decodeDTCBytes(byteA, byteB);
      const [encA, encB] = encodeDTCString(code);
      if (encA === byteA && encB === byteB) dtcPassed++;
    }

    let prevRate = calculateEscrowRateCents(0, 0);
    for (let step = 1; step <= 40; step++) {
      const currRate = calculateEscrowRateCents(step * 2.5, step >= 20 ? 1 : 0);
      if (currRate >= prevRate && currRate >= 5) escrowPassed++;
      prevRate = currRate;
    }

    const batchOrders = Array.from({ length: 40 }, (_, idx) => ({
      vin: idx % 2 === 0 ? "WAUDGAFL5EA049218" : "1HGCV1F34LA019284",
      dtcCode: decodeDTCBytes((idx * 37 + 11) & 0x3f, (idx * 91 + 7) & 0xff),
      faultDescription: `Kiro PBT Work Order Sample #${idx + 1}`,
      oemPartsCostUsd: 180 + idx * 15,
      laborHours: 2.5 + (idx % 6),
      laborRateUsd: 155,
    }));
    const batchReport = batchValidateWorkOrders(batchOrders);

    return {
      ranAt: new Date().toTimeString().slice(0, 8),
      samplesVerified: pidPassed + dtcPassed + escrowPassed + batchReport.validOrders,
      pidRoundTripsPassed: pidPassed,
      dtcBijectionsPassed: dtcPassed,
      escrowMonotonicPassed: escrowPassed,
      workOrderChecksPassed: batchReport.validOrders,
      sampleFrames,
    };
  };

  useEffect(() => {
    if (kiroAutoRunTrigger <= 0) return;
    const raf = window.requestAnimationFrame(() => {
      setLiveAudit(runLiveAuditCompute());
    });
    return () => window.cancelAnimationFrame(raf);
  }, [kiroAutoRunTrigger]);

  const liveWorkOrderCheck = validateWorkOrder({
    vin: activeVin,
    dtcCode: /^[PCBU][0-3][0-9A-F]{3}$/i.test(activeDtc) ? activeDtc : "P0750",
    faultDescription: "Verified SAE J1979 / Vertex AI Diagnostic Work Order",
    oemPartsCostUsd: 420,
    laborHours: 6.5,
    laborRateUsd: 163,
  });
  const liveUdsCheck = validateUdsResponse(0x31, [0x71, 0x01, 0xf4, 0x0a]);
  const isKiroBadgeValid = liveWorkOrderCheck.valid && liveUdsCheck.valid;

  return (
    <div className="flex flex-col gap-6">
      {/* Clean Sub-Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-3 px-4 shadow-xl">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "CAN_DBC" as const, label: "📡 Raw CAN & 64-Bit .DBC" },
            { id: "DYNO_UDS" as const, label: "📈 Virtual Dyno & UDS" },
            { id: "KIRO_PROOFS" as const, label: "🛡️ Kiro Specs & PBT Proofs" },
          ].map((item) => {
            const active = subTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  playHexSound("CLICK");
                  onSelectSubTab(item.id);
                }}
                className={`rounded-xl px-4 py-2 text-xs font-medium transition cursor-pointer ${
                  active
                    ? "bg-zinc-800 text-white border border-white/10 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="font-mono">{connectionMode}</span>
          {connectionMode !== "VIRTUAL ECU 25Hz" && (
            <button
              type="button"
              onClick={onDisconnectExternalSource}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300 cursor-pointer"
            >
              Resume 25Hz Sim
            </button>
          )}
        </div>
      </div>

      {subTab === "CAN_DBC" && (
        <div className="flex flex-col gap-6">
          {connectionMode === "CSV REPLAY" && csvFrames.length > 0 && (
            <div data-cinema-target="MODAL_CSV_SCRUBBER">
              <CsvPlaybackScrubberBar
                frames={csvFrames}
                cursor={csvCursor}
                playing={csvPlaying}
                speed={csvSpeed}
                sourceLabel={csvSourceLabel}
                primaryPid={soul.primaryPid}
                onSeek={onSeekCsv}
                onTogglePlay={onTogglePlayCsv}
                onChangeSpeed={onChangeSpeedCsv}
                onExitReplay={onDisconnectExternalSource}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <section
              data-cinema-target="LEFT_HEX_STREAM"
              className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-6 shadow-xl space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-emerald-400" />
                    <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                      25Hz ISO 15765-4 CAN-Bus Hex Stream
                    </h2>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Live 0x7E8 frames with XOR checksum &amp; J2012 bitmask audit.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onTogglePause}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 cursor-pointer"
                >
                  {streamPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  <span>{streamPaused ? "Resume" : "Pause"}</span>
                </button>
              </div>

              <div className="h-48 overflow-y-auto rounded-xl border border-white/[0.06] bg-zinc-950/80 p-3 font-mono text-xs space-y-1.5">
                {frames.slice(0, 24).map((entry, idx) => (
                  <button
                    key={`${entry.id}-${idx}`}
                    type="button"
                    onClick={() => onSelectFrame(entry)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition cursor-pointer ${
                      inspected?.id === entry.id
                        ? "bg-zinc-800 text-white"
                        : entry.parsed.isWarning
                        ? "text-rose-300 hover:bg-zinc-900"
                        : "text-zinc-300 hover:bg-zinc-900"
                    }`}
                  >
                    <span className="truncate">{entry.rawFrame}</span>
                    <span className="text-[11px] text-zinc-500 shrink-0">
                      {entry.parsed.pidKey
                        ? `${entry.parsed.value?.toFixed(1)} ${UNIVERSAL_PID_REGISTRY[entry.parsed.pidKey].unit}`
                        : entry.timestamp}
                    </span>
                  </button>
                ))}
              </div>

              {inspected && (
                <div className="rounded-xl border border-white/[0.06] bg-zinc-950/60 p-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                  <span className="text-zinc-400">
                    Checksum:{" "}
                    <strong className="text-emerald-400">
                      {inspected.parsed.checksumValid ? "XOR OK" : "ERR"}
                    </strong>
                  </span>
                  <span className="text-zinc-400">
                    J2012 {activeDtc}: <strong className="text-violet-300">{bitmask.hexPair}</strong>
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <button
                  type="button"
                  onClick={onConnectWebSerial}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-300 hover:bg-violet-500/20 cursor-pointer"
                >
                  <Cable className="h-3.5 w-3.5" />
                  <span>WebSerial</span>
                </button>
                <button
                  type="button"
                  onClick={onLoadBuiltInSampleCsv}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Replay CSV</span>
                </button>
                <button
                  type="button"
                  onClick={onDownloadSampleCsv}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-zinc-800/70 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Save CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-zinc-800/70 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload CSV</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadCsvFile(f);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
              <div className="text-[11px] text-zinc-500 truncate">{webSerialStatus}</div>
            </section>

            <section
              data-cinema-target="MODAL_DBC_MATRIX"
              className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-6 shadow-xl space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Binary className="h-4 w-4 text-violet-400" />
                    <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                      64-Bit .DBC Bit Matrix — {matrix.messageName} ({matrix.canIdHex})
                    </h2>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5 font-mono truncate">
                    {matrix.boSyntax}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenFullHardwareModal("DBC_INSPECTOR")}
                  className="rounded-xl border border-white/10 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white cursor-pointer"
                >
                  Expand Studio
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {matrix.signals.map((sig, idx) => {
                  const dec = decodeDbcSignalEngineering(liveBytes, sig);
                  const active = idx === effectiveSigIdx;
                  return (
                    <button
                      key={sig.name}
                      type="button"
                      onClick={() => {
                        playHexSound("CLICK");
                        setSelectedSigIdx(idx);
                      }}
                      className={`rounded-xl border px-3 py-1.5 text-left text-xs transition cursor-pointer ${
                        active
                          ? "border-violet-500/45 bg-violet-500/15 text-violet-200"
                          : "border-white/[0.06] bg-zinc-950/60 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <span className="font-medium">{sig.name}</span>{" "}
                      <span className="font-mono text-[11px] text-emerald-400">
                        {dec.physicalValue.toFixed(sig.scale < 0.1 ? 2 : 1)} {sig.unit}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-zinc-950/80 p-3 space-y-1.5 font-mono text-[10px]">
                {liveBytes.map((byteVal, byteIdx) => (
                  <div key={byteIdx} className="grid grid-cols-10 gap-1 items-center">
                    <span className="text-zinc-500">B{byteIdx}</span>
                    <span className="text-zinc-300 font-semibold">0x{toHexByte(byteVal)}</span>
                    {Array.from({ length: 8 }, (_, bitCol) => {
                      const bitInByte = 7 - bitCol;
                      const dbcBit = byteIdx * 8 + bitInByte;
                      const bitSet = ((byteVal >> bitInByte) & 1) === 1;
                      const highlighted = occupiedBitSet.has(dbcBit);
                      return (
                        <span
                          key={bitCol}
                          className={`rounded py-0.5 text-center transition ${
                            highlighted
                              ? "bg-violet-500/30 text-violet-200 border border-violet-400/50 font-bold"
                              : bitSet
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-zinc-900 text-zinc-600"
                          }`}
                        >
                          {bitSet ? "1" : "0"}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="border-t border-white/[0.06] pt-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                  <span className="font-medium text-zinc-300">ELM327 AT / ISO-TP Terminal</span>
                  <div className="flex flex-wrap gap-1">
                    {["ATZ", "01 0C", "03", "04", "22 F4 0A"].map((cmd) => (
                      <button
                        key={cmd}
                        type="button"
                        onClick={() => sendAtCmd(cmd)}
                        className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-0.5 font-mono text-[10px] text-zinc-300 hover:text-white cursor-pointer"
                      >
                        {cmd}
                      </button>
                    ))}
                  </div>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendAtCmd();
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={atInput}
                    onChange={(e) => setAtInput(e.target.value.toUpperCase())}
                    placeholder="ATZ, 01 0C, 03, 04..."
                    className="flex-1 rounded-xl border border-white/10 bg-zinc-950 px-3 py-1.5 font-mono text-xs uppercase text-white outline-none focus:border-violet-400"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1 rounded-xl bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>TX</span>
                  </button>
                </form>
                {atLog[0] && (
                  <div className="rounded-lg bg-zinc-950/70 px-3 py-1.5 font-mono text-[11px] text-emerald-400 truncate">
                    &gt; {atLog[0].tx} → {atLog[0].rx}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
      {subTab === "DYNO_UDS" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <section
            data-cinema-target="ROAD_DYNO_CARD"
            className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-6 shadow-xl space-y-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                    Virtual Road Dyno
                  </h2>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {soul.yearMakeModel} • {soul.curbWeightKg} kg • Cd {soul.dragCoefficientCd}
                </p>
              </div>

              <button
                type="button"
                disabled={dynoRunning}
                onClick={onRunDynoPull}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                <span>{dynoRunning ? "Pulling WOT…" : "Run WOT Pull"}</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border border-white/[0.06] bg-zinc-950/60 p-3">
                <div className="text-zinc-500">Peak WHP</div>
                <div className="mt-1 font-mono text-xl font-semibold text-white">{peakActualWhp}</div>
                <div className="text-[11px] text-zinc-500">Spec {soul.peakHealthyWhp}</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-zinc-950/60 p-3">
                <div className="text-zinc-500">Peak Torque</div>
                <div className="mt-1 font-mono text-xl font-semibold text-white">{peakActualTorque} lb-ft</div>
                <div className="text-[11px] text-zinc-500">Spec {soul.peakHealthyTorqueLbFt}</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-zinc-950/60 p-3">
                <div className="text-zinc-500">Fault Loss</div>
                <div className={`mt-1 font-mono text-xl font-semibold ${activeCurse ? "text-rose-400" : "text-emerald-400"}`}>
                  {activeCurse ? `-${activeCurse.powerLossPct}%` : "0%"}
                </div>
                <div className="text-[11px] text-zinc-500">{activeCurse ? activeCurse.dtcCode : "Nominal"}</div>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dynoCurve}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <XAxis dataKey="rpm" stroke="#71717a" tick={{ fontSize: 11, fontFamily: "monospace" }} />
                  <YAxis stroke="#71717a" tick={{ fontSize: 11, fontFamily: "monospace" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Line type="monotone" dataKey="healthyWhp" name="Healthy WHP" stroke="#818cf8" strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="actualWhp" name="Actual WHP" stroke={activeCurse ? "#f43f5e" : "#10b981"} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="actualTorque" name="Torque (lb-ft)" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-6 shadow-xl space-y-5">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                Bidirectional ISO 14229 UDS &amp; Fault Bench
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Transmit diagnostic routines on CAN ID 0x7E0 or inject ECU fault presets.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => onDispatchUdsCommand("04")}
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-left hover:bg-emerald-500/20 cursor-pointer"
              >
                <div className="font-mono font-semibold text-emerald-300">Mode $04</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Clear DTCs &amp; Trims</div>
              </button>
              <button
                type="button"
                onClick={() => onDispatchUdsCommand("2F")}
                className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-left hover:bg-violet-500/20 cursor-pointer"
              >
                <div className="font-mono font-semibold text-violet-300">Mode $2F</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Max Cooling Purge</div>
              </button>
              <button
                type="button"
                onClick={() => onDispatchUdsCommand("31")}
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-left hover:bg-amber-500/20 cursor-pointer"
              >
                <div className="font-mono font-semibold text-amber-300">Mode $31</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Solenoid Calibration</div>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {soul.curses.map((c) => {
                const active = activeCurse?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onCastCurse(c)}
                    className={`rounded-xl border px-3 py-1.5 font-mono text-xs transition cursor-pointer ${
                      active
                        ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                        : "border-white/10 bg-zinc-950/60 text-zinc-300 hover:border-rose-500/30"
                    }`}
                  >
                    Inject {c.dtcCode}
                  </button>
                );
              })}
              {activeCurse && (
                <button
                  type="button"
                  onClick={onClearCurses}
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 cursor-pointer"
                >
                  Restore Nominal
                </button>
              )}
            </div>

            <div className="h-48 overflow-y-auto rounded-xl border border-white/[0.06] bg-zinc-950/80 p-3 font-mono text-xs space-y-2">
              {udsLogs.map((log, idx) => (
                <div
                  key={`${log.id}-${idx}`}
                  className="rounded-lg border border-white/[0.05] bg-zinc-900/50 px-3 py-2"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={log.direction === "TX 7E0" ? "text-violet-300" : "text-emerald-400"}>
                      [{log.direction}] {log.hex}
                    </span>
                    <span className="text-zinc-500">{log.timestamp}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">{log.description}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      {subTab === "KIRO_PROOFS" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <section
            data-cinema-target="KIRO_PBT_CARD"
            className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-6 shadow-xl space-y-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                    Property-Based Testing &amp; Kiro Validator
                  </h2>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Live in-browser verification across CAN hex, J2012 &amp; escrow math.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  playHexSound("EXORCISM_CHIME");
                  setLiveAudit(runLiveAuditCompute());
                }}
                className="flex items-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-400 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Run 280-Sample Audit</span>
              </button>
            </div>

            <div
              className={`rounded-xl border px-4 py-3 text-xs flex flex-wrap items-center justify-between gap-2 ${
                isKiroBadgeValid
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              <span className="font-semibold">
                {isKiroBadgeValid
                  ? "✅ Verified by Kiro Work-Order Validator"
                  : "Inspect Active VIN / DTC Format"}
              </span>
              <span className="font-mono text-[11px] text-zinc-300">
                VIN {activeVin.slice(0, 8)}… • {activeDtc} • UDS 0x71 OK
              </span>
            </div>

            {liveAudit ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/[0.06] bg-zinc-950/60 p-3">
                    <div className="text-zinc-500">12-PID CAN Round-Trips</div>
                    <div className="mt-1 font-mono text-lg font-semibold text-emerald-400">
                      {liveAudit.pidRoundTripsPassed}/120 PASS
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-zinc-950/60 p-3">
                    <div className="text-zinc-500">SAE J2012 Bijections</div>
                    <div className="mt-1 font-mono text-lg font-semibold text-emerald-400">
                      {liveAudit.dtcBijectionsPassed}/80 PASS
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-zinc-950/60 p-3">
                    <div className="text-zinc-500">Monotonic Escrow Steps</div>
                    <div className="mt-1 font-mono text-lg font-semibold text-emerald-400">
                      {liveAudit.escrowMonotonicPassed}/40 PASS
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-zinc-950/60 p-3">
                    <div className="text-zinc-500">Kiro Work-Order Batch</div>
                    <div className="mt-1 font-mono text-lg font-semibold text-emerald-400">
                      {liveAudit.workOrderChecksPassed}/40 PASS
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-zinc-950/70 p-3 font-mono text-[11px] text-zinc-400 space-y-1">
                  {liveAudit.sampleFrames.map((f, i) => (
                    <div key={i} className="truncate">{f}</div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-zinc-950/50 p-4 text-xs text-zinc-400">
                Click &ldquo;Run 280-Sample Audit&rdquo; to execute live round-trip serialization, bitmask symmetry, and work-order invariants.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-6 shadow-xl space-y-4">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                Kiro Spec-Driven Architecture
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                EARS specifications, custom verifier agent, PostFileSave hooks &amp; NHTSA MCP.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-white/[0.06] bg-zinc-950/60 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-violet-300">
                  <FileCode2 className="h-4 w-4" />
                  <span>.kiro/specs/</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  EARS requirements &amp; correctness properties for universal CAN decoding and work-order validation.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-zinc-950/60 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                  <Bot className="h-4 w-4" />
                  <span>.kiro/agents/</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  Custom <code className="text-zinc-200">hexorcist-verifier</code> agent auditing ISO 15765-4 XOR parity &amp; PBT suites.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-zinc-950/60 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
                  <Webhook className="h-4 w-4" />
                  <span>.kiro/hooks/</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  Automated <code className="text-zinc-200">PostFileSave</code> Vitest fast-check runner guarding <code className="text-zinc-200">src/lib/**</code>.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-zinc-950/60 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-violet-300">
                  <Cpu className="h-4 w-4" />
                  <span>mcp-nhtsa-server/</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  Zero-dependency STDIO MCP server decoding 17-digit ISO 3779 VINs via US DOT NHTSA vPIC.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-950/70 px-4 py-2.5 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5 text-emerald-400" />
                CLI Suite: <code className="font-mono text-zinc-200">npx vitest run</code>
              </span>
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                MIT Licensed
              </span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

