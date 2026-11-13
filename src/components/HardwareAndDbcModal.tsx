"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Binary,
  Cable,
  CheckCircle2,
  Cpu,
  Download,
  FastForward,
  FileSpreadsheet,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Send,
  Sparkles,
  Terminal,
  Upload,
  X,
  Zap,
} from "lucide-react";
import {
  PidKey,
  SoulProfileId,
  UNIVERSAL_PID_REGISTRY,
  VehicleArchitectureId,
  VehicleSoulPreset,
  toHexByte,
} from "@/lib/obd-hex-engine";
import {
  DbcSignalDefinition,
  ELM327_HANDSHAKE_STEPS,
  SAMPLE_DBC_MATRICES,
  TelemetryPlaybackFrame,
  buildLiveDbcPayloadBytes,
  decodeDbcSignalEngineering,
  processVirtualElm327Command,
} from "@/lib/log-and-dbc-engine";

export type HardwareStudioTab = "CSV_REPLAY" | "DBC_INSPECTOR" | "WEBSERIAL_DRAWER";
export type PlaybackSpeedMultiplier = 1 | 2 | 5;

export interface ElmTerminalLogLine {
  id: string;
  timestamp: string;
  kind: "TX" | "RX" | "SYS";
  text: string;
  annotation?: string;
}

interface CsvPlaybackScrubberBarProps {
  frames: TelemetryPlaybackFrame[];
  cursor: number;
  playing: boolean;
  speed: PlaybackSpeedMultiplier;
  sourceLabel: string;
  primaryPid: PidKey;
  onSeek: (index: number) => void;
  onTogglePlay: () => void;
  onChangeSpeed: (speed: PlaybackSpeedMultiplier) => void;
  onExitReplay?: () => void;
}

let modalLogCounter = 0;
const nextModalLogId = (prefix: string): string => {
  modalLogCounter = (modalLogCounter + 1) % 1_000_000;
  return `${prefix}-${Date.now()}-${modalLogCounter}-${Math.random().toString(36).slice(2, 7)}`;
};

export function CsvPlaybackScrubberBar({
  frames,
  cursor,
  playing,
  speed,
  sourceLabel,
  primaryPid,
  onSeek,
  onTogglePlay,
  onChangeSpeed,
  onExitReplay,
}: CsvPlaybackScrubberBarProps) {
  if (frames.length === 0) return null;
  const safeIdx = Math.min(frames.length - 1, Math.max(0, cursor));
  const current = frames[safeIdx];
  const primaryDef = UNIVERSAL_PID_REGISTRY[primaryPid];
  const firstFaultIdx = frames.findIndex((f) => f.activeDtc !== "NONE");
  const hasFaultNow = current.activeDtc !== "NONE";

  return (
    <div className="rounded-xl border border-[#FFB800]/45 bg-[#0A0D14]/95 p-3.5 font-mono shadow-2xl space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-[#FFB800]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#FFB800]">
            CSV Telemetry Timeline Scrubber
          </span>
          <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
            {sourceLabel} ({frames.length} frames)
          </span>
          {hasFaultNow ? (
            <span className="rounded border border-[#FF1E42]/60 bg-[#FF1E42]/15 px-2 py-0.5 text-[10px] font-bold text-[#FF6B81]">
              ACTIVE DTC: {current.activeDtc}
            </span>
          ) : (
            <span className="rounded border border-[#00FF9D]/40 bg-[#00FF9D]/10 px-2 py-0.5 text-[10px] text-[#00FF9D]">
              DTC: NONE (NOMINAL)
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex items-center gap-1 rounded-md bg-[#00FF9D] px-2.5 py-1 text-[11px] font-bold text-[#06070A] hover:bg-[#00FF9D]/90 cursor-pointer"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{playing ? "PAUSE" : "PLAY"}</span>
          </button>

          <button
            type="button"
            onClick={() => onSeek(0)}
            className="rounded-md border border-white/15 bg-white/5 p-1 text-slate-300 hover:text-white cursor-pointer"
            title="Restart Log"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {([1, 2, 5] as PlaybackSpeedMultiplier[]).map((mult, idx) => (
            <button
              key={`${mult}-${idx}`}
              type="button"
              onClick={() => onChangeSpeed(mult)}
              className={`rounded-md border px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                speed === mult
                  ? "border-[#00E5FF] bg-[#00E5FF]/20 text-[#00E5FF]"
                  : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {mult}x
            </button>
          ))}

          {firstFaultIdx >= 0 && (
            <button
              type="button"
              onClick={() => onSeek(firstFaultIdx)}
              className="flex items-center gap-1 rounded-md border border-[#FF1E42]/50 bg-[#FF1E42]/15 px-2 py-1 text-[10px] font-bold text-[#FF6B81] hover:bg-[#FF1E42]/25 cursor-pointer"
            >
              <FastForward className="h-3 w-3" />
              <span>Jump Fault @ {(frames[firstFaultIdx].timestampMs / 1000).toFixed(1)}s</span>
            </button>
          )}

          {onExitReplay && (
            <button
              type="button"
              onClick={onExitReplay}
              className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:border-[#00FF9D]/50 hover:text-[#00FF9D] cursor-pointer"
            >
              Exit CSV -&gt; 25Hz Sim
            </button>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <input
          type="range"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={safeIdx}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full accent-[#00E5FF] cursor-pointer"
        />
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[11px] text-slate-300">
          <div className="rounded bg-[#050608] px-2 py-1">
            <span className="text-slate-500">TIME:</span>{" "}
            <span className="text-white">{(current.timestampMs / 1000).toFixed(2)}s</span>{" "}
            <span className="text-[10px] text-slate-500">
              (#{safeIdx + 1}/{frames.length})
            </span>
          </div>
          <div className="rounded bg-[#050608] px-2 py-1 truncate sm:col-span-2">
            <span className="text-slate-500">HEX:</span>{" "}
            <span className="text-[#00E5FF]">{current.rawHexFrame}</span>
          </div>
          <div className="rounded bg-[#050608] px-2 py-1">
            <span className="text-slate-500">RPM / SPD:</span>{" "}
            <span className="text-[#00FF9D]">{Math.round(current.rpm)}</span> /{" "}
            <span>{Math.round(current.speedKmh)} km/h</span>
          </div>
          <div className="rounded bg-[#050608] px-2 py-1">
            <span className="text-slate-500">{primaryDef.shortName}:</span>{" "}
            <span className={hasFaultNow ? "text-[#FF6B81] font-bold" : "text-[#00FF9D]"}>
              {current.primarySensorActual.toFixed(primaryDef.decimals)}
            </span>{" "}
            <span className="text-[10px] text-slate-500">
              (tgt {current.primarySensorTarget.toFixed(primaryDef.decimals)})
            </span>
          </div>
          <div className="rounded bg-[#050608] px-2 py-1">
            <span className="text-slate-500">STFT / ECT:</span>{" "}
            <span>{current.stftPct.toFixed(1)}%</span> /{" "}
            <span>{Math.round(current.coolantC)}°C</span>
          </div>
        </div>
      </div>
    </div>
  );
}
interface HardwareAndDbcModalProps {
  open: boolean;
  activeTab: HardwareStudioTab;
  onChangeTab: (tab: HardwareStudioTab) => void;
  onClose: () => void;
  activeVehicleId: SoulProfileId;
  soul: VehicleSoulPreset;
  telemetry: Record<PidKey, number>;
  activeDtc: string | null;
  activeVin: string;
  // CSV Replay props
  csvFrames: TelemetryPlaybackFrame[];
  csvCursor: number;
  csvPlaying: boolean;
  csvSpeed: PlaybackSpeedMultiplier;
  csvSourceLabel: string;
  onSeekCsv: (index: number) => void;
  onTogglePlayCsv: () => void;
  onChangeSpeedCsv: (speed: PlaybackSpeedMultiplier) => void;
  onLoadBuiltInSampleCsv: () => void;
  onDownloadSampleCsv: () => void;
  onUploadCsvFile: (file: File) => void;
  // WebSerial & Virtual Loopback props
  physicalPortConnected: boolean;
  loopbackActive: boolean;
  webSerialStatus: string;
  onConnectPhysicalSerial: () => Promise<boolean>;
  onActivateLoopbackPort: () => void;
  onSendPhysicalSerialCommand: (cmd: string) => Promise<boolean>;
  onIngestLoopbackFrame: (rawFrame: string) => void;
  onClearFaultsFromTerminal: () => void;
}

const nowTerminalClock = (): string => {
  const d = new Date();
  return d.toTimeString().slice(0, 8) + "." + String(d.getMilliseconds()).padStart(3, "0");
};

export function HardwareAndDbcModal(props: HardwareAndDbcModalProps) {
  const {
    open,
    activeTab,
    onChangeTab,
    onClose,
    activeVehicleId,
    soul,
    telemetry,
    activeDtc,
    activeVin,
    csvFrames,
    csvCursor,
    csvPlaying,
    csvSpeed,
    csvSourceLabel,
    onSeekCsv,
    onTogglePlayCsv,
    onChangeSpeedCsv,
    onLoadBuiltInSampleCsv,
    onDownloadSampleCsv,
    onUploadCsvFile,
    physicalPortConnected,
    loopbackActive,
    webSerialStatus,
    onConnectPhysicalSerial,
    onActivateLoopbackPort,
    onSendPhysicalSerialCommand,
    onIngestLoopbackFrame,
    onClearFaultsFromTerminal,
  } = props;

  const [dragOver, setDragOver] = useState(false);
  const fileDropRef = useRef<HTMLInputElement | null>(null);

  // DBC 64-Bit Matrix State
  const defaultMatrixId: VehicleArchitectureId =
    activeVehicleId !== "CUSTOM_VIN_SOUL" ? activeVehicleId : "GERMAN_V6_DSG";
  const [matrixOverride, setMatrixOverride] =
    useState<VehicleArchitectureId | null>(null);
  const selectedMatrixId: VehicleArchitectureId = matrixOverride ?? defaultMatrixId;
  const [liveSyncBytes, setLiveSyncBytes] = useState<boolean>(true);
  const [manualBytes, setManualBytes] = useState<number[]>(() => [
    ...SAMPLE_DBC_MATRICES[defaultMatrixId].defaultPayloadBytes,
  ]);
  const [hoveredSignalName, setHoveredSignalName] = useState<string | null>(null);

  const activeMatrix = SAMPLE_DBC_MATRICES[selectedMatrixId];
  const payloadBytes = useMemo(() => {
    if (!liveSyncBytes) return manualBytes;
    return buildLiveDbcPayloadBytes(selectedMatrixId, telemetry, Boolean(activeDtc));
  }, [liveSyncBytes, manualBytes, selectedMatrixId, telemetry, activeDtc]);

  const activeSignal: DbcSignalDefinition = useMemo(() => {
    return (
      activeMatrix.signals.find((s) => s.name === hoveredSignalName) ??
      activeMatrix.signals[0]
    );
  }, [activeMatrix, hoveredSignalName]);

  const activeSignalDecoded = useMemo(
    () => decodeDbcSignalEngineering(payloadBytes, activeSignal),
    [payloadBytes, activeSignal]
  );

  const highlightedBitSet = useMemo(
    () => new Set<number>(activeSignalDecoded.preview.occupiedDbcBits),
    [activeSignalDecoded]
  );

  // WebSerial & Virtual Loopback Terminal State
  const [handshakeStepIdx, setHandshakeStepIdx] = useState<number>(
    ELM327_HANDSHAKE_STEPS.length
  );
  const [terminalInput, setTerminalInput] = useState<string>("01 0C");
  const [terminalLines, setTerminalLines] = useState<ElmTerminalLogLine[]>(() => [
    {
      id: "sys-boot-initial",
      timestamp: "00:00:00.010",
      kind: "SYS",
      text: "ELM327 Handshake Ready — Pair Physical USB/BT COM Port or Activate Virtual Loopback COM4",
    },
    ...ELM327_HANDSHAKE_STEPS.flatMap((step, idx) => [
      {
        id: `tx-seed-${idx}`,
        timestamp: `00:00:00.${110 + idx * 45}`,
        kind: "TX" as const,
        text: `> ${step.cmd}`,
      },
      {
        id: `rx-seed-${idx}`,
        timestamp: `00:00:00.${130 + idx * 45}`,
        kind: "RX" as const,
        text: step.rx,
        annotation: step.desc,
      },
    ]),
  ]);
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);

  const runAnimatedAtHandshake = (modeTitle: string) => {
    setHandshakeStepIdx(0);
    setTerminalLines([
      {
        id: nextModalLogId("sys-boot"),
        timestamp: nowTerminalClock(),
        kind: "SYS",
        text: `Opening UART Bridge -> ${modeTitle} @ 38,400 baud (8N1)...`,
      },
    ]);

    ELM327_HANDSHAKE_STEPS.forEach((step, idx) => {
      setTimeout(() => {
        setHandshakeStepIdx(idx + 1);
        setTerminalLines((prev) => [
          ...prev,
          {
            id: nextModalLogId(`tx-init-${idx}`),
            timestamp: nowTerminalClock(),
            kind: "TX",
            text: `> ${step.cmd}`,
          },
          {
            id: nextModalLogId(`rx-init-${idx}`),
            timestamp: nowTerminalClock(),
            kind: "RX",
            text: step.rx,
            annotation: step.desc,
          },
        ]);
      }, (idx + 1) * 160);
    });
  };

  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLines]);

  const handleSwitchToVirtualLoopback = () => {
    onActivateLoopbackPort();
    runAnimatedAtHandshake("VIRTUAL LOOPBACK COM4 (ISO 15765-4 CAN 11-bit 500kbaud)");
  };

  const handlePairPhysicalAdapter = async () => {
    const ok = await onConnectPhysicalSerial();
    if (ok) {
      runAnimatedAtHandshake("PHYSICAL WEBSERIAL USB/BT ELM327 ADAPTER");
    } else {
      setTerminalLines((prev) => [
        ...prev,
        {
          id: nextModalLogId("sys-warn"),
          timestamp: nowTerminalClock(),
          kind: "SYS",
          text: "No physical COM port paired — click 'Virtual Loopback COM Port' to test interactive AT/Hex commands.",
        },
      ]);
    }
  };

  const handleDispatchTerminalCommand = async (overrideCmd?: string) => {
    const cmd = (overrideCmd ?? terminalInput).trim().toUpperCase();
    if (!cmd) return;
    if (!overrideCmd) setTerminalInput("");

    setTerminalLines((prev) => [
      ...prev,
      {
        id: nextModalLogId("tx"),
        timestamp: nowTerminalClock(),
        kind: "TX",
        text: `> ${cmd}`,
      },
    ]);

    if (physicalPortConnected) {
      const sent = await onSendPhysicalSerialCommand(cmd);
      if (sent) {
        setTerminalLines((prev) => [
          ...prev,
          {
            id: nextModalLogId("sys-tx"),
            timestamp: nowTerminalClock(),
            kind: "SYS",
            text: `Dispatched '${cmd}\\r' over physical WebSerial UART`,
          },
        ]);
        return;
      }
    }

    if (!loopbackActive) {
      onActivateLoopbackPort();
    }

    const result = processVirtualElm327Command(cmd, {
      telemetry,
      activeDtc,
      vin: activeVin,
      soulCodename: soul.codename,
    });

    if (result.ingestedCanFrame) {
      onIngestLoopbackFrame(result.ingestedCanFrame);
    }
    if (result.clearedFaults) {
      onClearFaultsFromTerminal();
    }

    setTerminalLines((prev) => [
      ...prev,
      ...result.rxLines.map((line, i) => ({
        id: nextModalLogId(`rx-${i}`),
        timestamp: nowTerminalClock(),
        kind: "RX" as const,
        text: line,
        annotation: i === result.rxLines.length - 1 ? result.annotation : undefined,
      })),
    ]);
  };

  const flipManualBit = (byteIdx: number, bitInByte: number) => {
    const base = liveSyncBytes ? [...payloadBytes] : [...manualBytes];
    base[byteIdx] = (base[byteIdx] ^ (1 << bitInByte)) & 0xff;
    setLiveSyncBytes(false);
    setManualBytes(base);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#00E5FF]/45 bg-[#080B11] font-mono shadow-[0_0_55px_rgba(0,229,255,0.18)]"
          >
            {/* Header & Mode Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#05070B] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <Cpu className="h-5 w-5 text-[#00E5FF]" />
                <div>
                  <h2 className="text-sm font-bold tracking-wider text-white">
                    HEXORCIST HARDWARE BUS, UNIVERSAL CSV REPLAY &amp; .DBC 64-BIT MATRIX
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Active Soul: <span className="text-[#00FF9D]">{soul.codename}</span> (
                    {soul.yearMakeModel}) • VIN {activeVin}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChangeTab("CSV_REPLAY")}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    activeTab === "CSV_REPLAY"
                      ? "border-[#FFB800] bg-[#FFB800]/15 text-[#FFB800]"
                      : "border-white/10 bg-white/5 text-slate-300 hover:text-white"
                  }`}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>CSV Log Replay</span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangeTab("DBC_INSPECTOR")}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    activeTab === "DBC_INSPECTOR"
                      ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#00E5FF]"
                      : "border-white/10 bg-white/5 text-slate-300 hover:text-white"
                  }`}
                >
                  <Binary className="h-3.5 w-3.5" />
                  <span>.DBC 64-Bit Matrix</span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangeTab("WEBSERIAL_DRAWER")}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    activeTab === "WEBSERIAL_DRAWER"
                      ? "border-[#00FF9D] bg-[#00FF9D]/15 text-[#00FF9D]"
                      : "border-white/10 bg-white/5 text-slate-300 hover:text-white"
                  }`}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  <span>WebSerial ELM327 Terminal</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {activeTab === "CSV_REPLAY" && (
                <div className="space-y-4">
                  {/* Drag-and-Drop CSV Studio */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) onUploadCsvFile(f);
                    }}
                    className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
                      dragOver
                        ? "border-[#00FF9D] bg-[#00FF9D]/10"
                        : "border-white/20 bg-[#05070B]"
                    }`}
                  >
                    <Upload className="mx-auto h-8 w-8 text-[#FFB800]" />
                    <h3 className="mt-2 text-sm font-bold text-white">
                      Drop Any ISO 15765-4 / SAE J1979 CAN Telemetry CSV Log Here
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Supports ISO 15765-4 Raw CAN Frames, SAE J1979 Multi-PID Exports &amp; HEXORCIST 100-Row WOT Logs
                    </p>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={onLoadBuiltInSampleCsv}
                        className="flex items-center gap-2 rounded-lg bg-[#00FF9D] px-4 py-2 text-xs font-bold text-[#06070A] hover:bg-[#00FF9D]/90 cursor-pointer"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>ISO 15765-4 / SAE J1979 CAN Telemetry CSV</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileDropRef.current?.click()}
                        className="flex items-center gap-2 rounded-lg border border-[#00E5FF]/50 bg-[#00E5FF]/10 px-4 py-2 text-xs font-bold text-[#00E5FF] hover:bg-[#00E5FF]/20 cursor-pointer"
                      >
                        <Upload className="h-4 w-4" />
                        <span>Browse .CSV File</span>
                      </button>

                      <button
                        type="button"
                        onClick={onDownloadSampleCsv}
                        className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs text-slate-200 hover:border-[#FFB800]/60 hover:text-[#FFB800] cursor-pointer"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download 100-Row {soul.codename} WOT CSV</span>
                      </button>

                      <input
                        ref={fileDropRef}
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
                  </div>

                  {csvFrames.length > 0 ? (
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
                    />
                  ) : (
                    <div className="rounded-lg border border-white/10 bg-[#05070B] p-4 text-center text-xs text-slate-400">
                      No CSV log loaded yet — click{" "}
                      <span className="font-bold text-[#00FF9D]">
                        &ldquo;ISO 15765-4 / SAE J1979 CAN Telemetry CSV&rdquo;
                      </span>{" "}
                      above to replay a 100-row WOT pull with a mid-pull mechanical fault anomaly!
                    </div>
                  )}
                </div>
              )}
              {activeTab === "DBC_INSPECTOR" && (
                <div className="space-y-4">
                  {/* DBC Matrix Switcher & Live Sync Toggle */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#05070B] p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          ["GERMAN_V6_DSG", "Euro V6 0B5_TCM"],
                          ["JDM_TWIN_ROTARY", "13B-REW FD3S_ECU"],
                          ["AWD_800V_EV", "800V EV BMS_HV_Status"],
                          ["HEAVY_DIESEL_TOW", "6.7L Diesel J1939_EEC1"],
                        ] as Array<[VehicleArchitectureId, string]>
                      ).map(([id, label], idx) => (
                        <button
                          key={`${id}-${idx}`}
                          type="button"
                          onClick={() => {
                            setMatrixOverride(id);
                            setHoveredSignalName(null);
                            setManualBytes([...SAMPLE_DBC_MATRICES[id].defaultPayloadBytes]);
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                            selectedMatrixId === id
                              ? "border-[#00E5FF] bg-[#00E5FF]/20 text-[#00E5FF]"
                              : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLiveSyncBytes((v) => !v)}
                        className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold cursor-pointer ${
                          liveSyncBytes
                            ? "border-[#00FF9D]/60 bg-[#00FF9D]/15 text-[#00FF9D]"
                            : "border-[#FFB800]/60 bg-[#FFB800]/15 text-[#FFB800]"
                        }`}
                      >
                        {liveSyncBytes
                          ? "LIVE 25Hz ECU PAYLOAD SYNC: ON"
                          : "MANUAL BIT-FLIP INSPECTOR MODE"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* Left: Authentic OpenDBC BO_ / SG_ Signal Definitions */}
                    <div className="lg:col-span-5 rounded-xl border border-white/10 bg-[#05070B] p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <div>
                          <div className="text-xs font-bold text-[#00E5FF]">
                            {activeMatrix.boSyntax}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            CAN ID {activeMatrix.canIdHex} • {activeMatrix.protocolStandard}
                          </div>
                        </div>
                        <span className="rounded bg-[#00E5FF]/15 px-2 py-0.5 text-[10px] text-[#00E5FF]">
                          Hover Signal
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {activeMatrix.signals.map((sig, idx) => {
                          const isFocused = activeSignal.name === sig.name;
                          const decoded = decodeDbcSignalEngineering(payloadBytes, sig);
                          return (
                            <div
                              key={`${sig.name}-${idx}`}
                              onMouseEnter={() => setHoveredSignalName(sig.name)}
                              onClick={() => setHoveredSignalName(sig.name)}
                              className={`rounded-lg border p-2.5 transition cursor-pointer ${
                                isFocused
                                  ? "border-[#00E5FF] bg-[#00E5FF]/15 shadow-[0_0_16px_rgba(0,229,255,0.22)]"
                                  : "border-white/10 bg-[#090C12] hover:border-white/25"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`text-xs font-bold ${
                                    isFocused ? "text-[#00E5FF]" : "text-white"
                                  }`}
                                >
                                  {sig.name}
                                </span>
                                <span className="text-xs font-bold text-[#00FF9D]">
                                  {decoded.formattedPhysical}
                                </span>
                              </div>
                              <div className="mt-1 text-[10px] text-slate-300 break-all">
                                {sig.sgSyntax}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right: Interactive 8x8 (64-Bit) Bit-Map Grid & Live Engineering Math */}
                    <div className="lg:col-span-7 space-y-3.5">
                      <div className="rounded-xl border border-[#00E5FF]/35 bg-[#05070B] p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#00E5FF]">
                            64-Bit CAN Payload Bit-Map (Bytes 0–7 • Click Any Bit to Flip)
                          </span>
                          <span className="rounded bg-[#0A0D14] px-2.5 py-1 text-xs text-[#00FF9D]">
                            {activeMatrix.canIdHex} [{payloadBytes.map(toHexByte).join(" ")}]
                          </span>
                        </div>

                        <div className="grid grid-cols-9 gap-1.5 text-center text-[10px] text-slate-400">
                          <div className="text-left font-bold text-slate-500">BYTE</div>
                          {[7, 6, 5, 4, 3, 2, 1, 0].map((bitCol, colIdx) => (
                            <div key={`bitcol-${bitCol}-${colIdx}`}>b{bitCol}</div>
                          ))}
                        </div>

                        <div className="space-y-1.5">
                          {payloadBytes.map((byteVal, byteIdx) => (
                            <div
                              key={`byte-${byteVal}-${byteIdx}`}
                              className="grid grid-cols-9 gap-1.5 items-center"
                            >
                              <div className="text-[11px] font-bold text-slate-300">
                                B{byteIdx}{" "}
                                <span className="text-[#FFB800]">0x{toHexByte(byteVal)}</span>
                              </div>
                              {[7, 6, 5, 4, 3, 2, 1, 0].map((bitInByte, bitIdx) => {
                                const dbcBit = byteIdx * 8 + bitInByte;
                                const bitVal = (byteVal >> bitInByte) & 1;
                                const isHighlighted = highlightedBitSet.has(dbcBit);
                                return (
                                  <button
                                    key={`dbcbit-${dbcBit}-${bitIdx}`}
                                    type="button"
                                    onClick={() => flipManualBit(byteIdx, bitInByte)}
                                    onMouseEnter={() => {
                                      const owner = activeMatrix.signals.find((s) =>
                                        decodeDbcSignalEngineering(
                                          payloadBytes,
                                          s
                                        ).preview.occupiedDbcBits.includes(dbcBit)
                                      );
                                      if (owner) setHoveredSignalName(owner.name);
                                    }}
                                    className={`flex flex-col items-center justify-center rounded border py-1.5 transition cursor-pointer ${
                                      isHighlighted
                                        ? "border-[#00E5FF] bg-[#00E5FF]/25 text-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.45)]"
                                        : "border-white/10 bg-[#0A0E16] text-slate-300 hover:border-white/30"
                                    }`}
                                  >
                                    <span className="text-xs font-bold leading-none">{bitVal}</span>
                                    <span className="mt-0.5 text-[9px] opacity-70">#{dbcBit}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#00FF9D]/35 bg-[#05070B] p-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#00FF9D]">
                            SIGNAL CONVERSION MATH // {activeSignal.name}
                          </span>
                          <span className="rounded border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-2 py-0.5 text-[10px] text-[#00E5FF]">
                            {activeSignal.byteOrder === "INTEL_LE"
                              ? "@1+ Intel Little-Endian"
                              : "@0+ Motorola Big-Endian"}{" "}
                            • Start {activeSignal.startBit} | Len {activeSignal.length} bits
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">{activeSignal.description}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                          <div className="rounded bg-[#0A0D14] p-2.5 border border-white/10">
                            <div className="text-[10px] text-slate-500">EXTRACTED BINARY</div>
                            <div className="mt-0.5 break-all font-bold text-[#00E5FF]">
                              0b{activeSignalDecoded.preview.binaryString}
                            </div>
                          </div>
                          <div className="rounded bg-[#0A0D14] p-2.5 border border-white/10">
                            <div className="text-[10px] text-slate-500">RAW INTEGER / HEX</div>
                            <div className="mt-0.5 font-bold text-white">
                              {activeSignalDecoded.signedRaw} (
                              {activeSignalDecoded.preview.hexValue})
                            </div>
                          </div>
                          <div className="rounded bg-[#0A0D14] p-2.5 border border-[#00FF9D]/30">
                            <div className="text-[10px] text-slate-500">PHYSICAL OUTPUT</div>
                            <div className="mt-0.5 font-bold text-[#00FF9D]">
                              {activeSignalDecoded.formattedPhysical}
                            </div>
                          </div>
                        </div>
                        <div className="rounded bg-black/60 px-3 py-2 text-[11px] text-slate-300">
                          Formula:{" "}
                          <span className="text-[#FFB800]">
                            ({activeSignalDecoded.signedRaw} × {activeSignal.scale}) + (
                            {activeSignal.offset})
                          </span>{" "}
                          ={" "}
                          <span className="font-bold text-[#00FF9D]">
                            {activeSignalDecoded.formattedPhysical}
                          </span>{" "}
                          <span className="text-slate-500">
                            [Bounds: {activeSignal.min} .. {activeSignal.max} {activeSignal.unit}]
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === "WEBSERIAL_DRAWER" && (
                <div className="space-y-4">
                  {/* Hardware Handshake & Loopback Selector */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={handlePairPhysicalAdapter}
                      className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition cursor-pointer ${
                        physicalPortConnected
                          ? "border-[#00FF9D] bg-[#00FF9D]/15 text-[#00FF9D]"
                          : "border-[#00E5FF]/45 bg-[#00E5FF]/10 text-[#00E5FF] hover:bg-[#00E5FF]/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Cable className="h-5 w-5 shrink-0" />
                        <div>
                          <div className="text-xs font-bold">
                            Pair Physical USB / Bluetooth OBD-II Adapter
                          </div>
                          <div className="text-[10px] text-slate-300">
                            Browser WebSerial API (navigator.serial) @ 38,400 baud • ELM327 / CANable
                          </div>
                        </div>
                      </div>
                      <span className="rounded bg-black/50 px-2 py-1 text-[10px] font-bold">
                        {physicalPortConnected ? "CONNECTED" : "PAIR COM"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSwitchToVirtualLoopback}
                      className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition cursor-pointer ${
                        loopbackActive && !physicalPortConnected
                          ? "border-[#00FF9D] bg-[#00FF9D]/15 text-[#00FF9D]"
                          : "border-[#FFB800]/50 bg-[#FFB800]/10 text-[#FFB800] hover:bg-[#FFB800]/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Zap className="h-5 w-5 shrink-0" />
                        <div>
                          <div className="text-xs font-bold">
                            Virtual Loopback COM Port (No Hardware Required)
                          </div>
                          <div className="text-[10px] text-slate-300">
                            Interactive ELM327 v2.3 ISO 15765-4 CAN 11-bit 500kbaud Transceiver
                          </div>
                        </div>
                      </div>
                      <span className="rounded bg-black/50 px-2 py-1 text-[10px] font-bold">
                        {loopbackActive && !physicalPortConnected ? "LOOPBACK LIVE" : "ACTIVATE"}
                      </span>
                    </button>
                  </div>

                  {/* AT Handshake Initialization Checklist */}
                  <div className="rounded-xl border border-white/10 bg-[#05070B] p-3">
                    <div className="mb-2 flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 font-bold text-[#00E5FF]">
                        <Radio className="h-3.5 w-3.5" />
                        ELM327 AT COMMAND INITIALIZATION SEQUENCE (ISO 15765-4 CAN 11-BIT 500KBAUD)
                      </span>
                      <span className="text-slate-400">{webSerialStatus}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {ELM327_HANDSHAKE_STEPS.map((step, idx) => {
                        const done = handshakeStepIdx > idx;
                        return (
                          <div
                            key={`${step.cmd}-${idx}`}
                            className={`rounded-lg border px-2.5 py-2 text-[11px] ${
                              done
                                ? "border-[#00FF9D]/45 bg-[#00FF9D]/10 text-[#00FF9D]"
                                : "border-white/10 bg-black/40 text-slate-500"
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span>{step.cmd}</span>
                              {done && <CheckCircle2 className="h-3.5 w-3.5" />}
                            </div>
                            <div className="mt-0.5 truncate text-[10px] text-slate-400">
                              {step.desc}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Interactive ELM327 AT / Hex Command Console */}
                  <div className="rounded-xl border border-[#00FF9D]/35 bg-[#05070B] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#00FF9D]">
                        INTERACTIVE ELM327 / ISO-TP HEX COMMAND CONSOLE
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          ["ATZ", "ATZ Reset"],
                          ["ATRV", "ATRV Volts"],
                          ["01 0C", "01 0C RPM"],
                          ["01 0D", "01 0D Speed"],
                          ["03", "03 Read DTC"],
                          ["04", "04 Clear DTC"],
                          ["22 F4 0A", "22 F4 0A DSG"],
                          ["22 11 40", "22 11 40 Boost"],
                          ["09 02", "09 02 VIN"],
                        ].map(([cmd, label], idx) => (
                          <button
                            key={`${cmd}-${idx}`}
                            type="button"
                            onClick={() => void handleDispatchTerminalCommand(cmd)}
                            className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-slate-200 hover:border-[#00E5FF] hover:text-[#00E5FF] cursor-pointer"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="h-64 overflow-y-auto rounded-lg border border-white/10 bg-[#030406] p-3 text-xs space-y-1.5">
                      {terminalLines.map((line, idx) => (
                        <div key={`${line.id}-${idx}`} className="leading-relaxed">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={
                                line.kind === "TX"
                                  ? "font-bold text-[#00E5FF]"
                                  : line.kind === "RX"
                                  ? "font-bold text-[#00FF9D]"
                                  : "text-[#FFB800]"
                              }
                            >
                              {line.text}
                            </span>
                            <span className="shrink-0 text-[10px] text-slate-600">
                              {line.timestamp}
                            </span>
                          </div>
                          {line.annotation && (
                            <div className="pl-3 text-[11px] text-slate-400">
                              ↳ {line.annotation}
                            </div>
                          )}
                        </div>
                      ))}
                      <div ref={terminalBottomRef} />
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleDispatchTerminalCommand();
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value.toUpperCase())}
                        placeholder="Type AT or Hex command (e.g. 01 0C, 03, 04, 22 F4 0A, 09 02, ATRV)..."
                        className="flex-1 rounded-lg border border-white/20 bg-black px-3.5 py-2 text-xs uppercase text-white outline-none focus:border-[#00FF9D]"
                      />
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 rounded-lg bg-[#00FF9D] px-4 py-2 text-xs font-bold text-[#06070A] hover:bg-[#00FF9D]/90 cursor-pointer"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>TRANSMIT</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
