"use client";

import React, { useRef } from "react";
import {
  AlertTriangle,
  Cable,
  Download,
  Flame,
  Pause,
  Play,
  ShieldCheck,
  Terminal,
  Upload,
} from "lucide-react";
import {
  MechanicalCursePreset,
  ParsedCANFrame,
  VehicleSoulPreset,
} from "@/lib/obd-hex-engine";
import { ConnectionMode } from "./TopCommandBar";

export interface FrameLogEntry {
  id: string;
  timestamp: string;
  rawFrame: string;
  parsed: ParsedCANFrame;
}

interface LeftHexTerminalColumnProps {
  soul: VehicleSoulPreset;
  frames: FrameLogEntry[];
  selectedFrame: FrameLogEntry | null;
  onSelectFrame: (entry: FrameLogEntry) => void;
  streamPaused: boolean;
  onTogglePause: () => void;
  activeCurse: MechanicalCursePreset | null;
  onCastCurse: (curse: MechanicalCursePreset) => void;
  onClearCurses: () => void;
  connectionMode: ConnectionMode;
  webSerialStatus: string;
  onConnectWebSerial: () => void;
  onDisconnectExternalSource: () => void;
  onDownloadSampleCsv: () => void;
  onUploadCsvFile: (file: File) => void;
}

export function LeftHexTerminalColumn({
  soul,
  frames,
  selectedFrame,
  onSelectFrame,
  streamPaused,
  onTogglePause,
  activeCurse,
  onCastCurse,
  onClearCurses,
  connectionMode,
  webSerialStatus,
  onConnectWebSerial,
  onDisconnectExternalSource,
  onDownloadSampleCsv,
  onUploadCsvFile,
}: LeftHexTerminalColumnProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inspected = selectedFrame ?? frames[0] ?? null;

  return (
    <aside className="flex flex-col gap-4">
      <div className="rounded-xl border border-white/10 bg-[#0A0D14]/90 p-3.5 shadow-2xl">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[#00FF9D]" />
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              25Hz Raw CAN Hex Matrix
            </h2>
          </div>
          <button
            type="button"
            onClick={onTogglePause}
            className="flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1 font-mono text-[11px] text-slate-300 hover:border-[#00FF9D]/50 hover:text-[#00FF9D] cursor-pointer"
          >
            {streamPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            <span>{streamPaused ? "RESUME" : "FREEZE"}</span>
          </button>
        </div>

        <div className="h-52 overflow-y-auto rounded-lg border border-white/10 bg-[#050608] p-2 font-mono text-[11px] space-y-1">
          {frames.map((entry) => {
            const isSelected = inspected?.id === entry.id;
            const warn = entry.parsed.isWarning;
            return (
              <div
                key={entry.id}
                onClick={() => onSelectFrame(entry)}
                onMouseEnter={() => {
                  if (streamPaused) onSelectFrame(entry);
                }}
                className={`flex items-center justify-between gap-2 rounded px-2 py-1 cursor-pointer transition ${
                  isSelected
                    ? "border border-[#00E5FF]/60 bg-[#00E5FF]/12 text-white"
                    : warn
                    ? "bg-[#FF1E42]/12 text-[#FF6B81] hover:bg-[#FF1E42]/20"
                    : "text-[#00FF9D]/90 hover:bg-white/5"
                }`}
              >
                <span className="truncate">{entry.rawFrame}</span>
                <span className="shrink-0 text-[10px] text-slate-400">
                  {entry.parsed.shortName}:{" "}
                  <strong className={warn ? "text-[#FF1E42]" : "text-[#00E5FF]"}>
                    {entry.parsed.value !== null ? entry.parsed.value.toFixed(1) : "--"}
                  </strong>
                </span>
              </div>
            );
          })}
        </div>

        {inspected && (
          <div className="mt-3 rounded-lg border border-[#00E5FF]/25 bg-[#06090F] p-2.5 font-mono text-[11px]">
            <div className="mb-1.5 flex items-center justify-between text-[10px] text-slate-400">
              <span>ISO 15765-4 BYTE INSPECTOR</span>
              <span
                className={
                  inspected.parsed.checksumValid ? "text-[#00FF9D]" : "text-[#FF1E42]"
                }
              >
                XOR 0x{inspected.parsed.checksumHex}{" "}
                {inspected.parsed.checksumValid ? "✓ VALID" : "✗ CORRUPT"}
              </span>
            </div>

            <div className="grid grid-cols-6 gap-1 text-center">
              <div className="rounded bg-white/5 p-1.5">
                <div className="text-[9px] text-slate-400">ID</div>
                <div className="font-bold text-[#00FF9D]">{inspected.parsed.canId}</div>
              </div>
              <div className="rounded bg-white/5 p-1.5">
                <div className="text-[9px] text-slate-400">PCI</div>
                <div className="font-bold text-white">{inspected.parsed.pciHex}</div>
              </div>
              <div className="rounded bg-white/5 p-1.5">
                <div className="text-[9px] text-slate-400">MODE</div>
                <div className="font-bold text-[#00E5FF]">
                  {inspected.parsed.responseModeHex}
                </div>
              </div>
              <div className="rounded bg-white/5 p-1.5">
                <div className="text-[9px] text-slate-400">PID</div>
                <div className="font-bold text-[#FFB800]">{inspected.parsed.pidHex}</div>
              </div>
              <div className="rounded bg-white/5 p-1.5">
                <div className="text-[9px] text-slate-400">A / B</div>
                <div className="font-bold text-white">
                  {inspected.parsed.byteAHex}
                  {inspected.parsed.byteBHex ? ` ${inspected.parsed.byteBHex}` : ""}
                </div>
              </div>
              <div className="rounded bg-white/5 p-1.5">
                <div className="text-[9px] text-slate-400">XOR</div>
                <div className="font-bold text-[#00FF9D]">
                  {inspected.parsed.checksumHex}
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-1.5 text-xs">
              <span className="text-slate-300 truncate">{inspected.parsed.name}</span>
              <span
                className={`font-bold shrink-0 ${
                  inspected.parsed.isWarning ? "text-[#FF1E42]" : "text-[#00FF9D]"
                }`}
              >
                {inspected.parsed.value !== null
                  ? `${inspected.parsed.value.toFixed(2)} ${inspected.parsed.unit}`
                  : "ERR"}
              </span>
            </div>
          </div>
        )}
      </div>
      {/* Cast Mechanical Curse Deck */}
      <div
        className={`rounded-xl border p-3.5 transition ${
          activeCurse
            ? "border-[#FF1E42]/60 bg-[#14070B]/90 crimson-glow"
            : "border-white/10 bg-[#0A0D14]/90"
        }`}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className={`h-4 w-4 ${activeCurse ? "text-[#FF1E42]" : "text-[#FFB800]"}`} />
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Cast Mechanical Curse
            </h2>
          </div>
          {activeCurse ? (
            <span className="rounded bg-[#FF1E42]/20 px-2 py-0.5 font-mono text-[10px] font-bold text-[#FF1E42]">
              DTC {activeCurse.dtcCode} • SEV {activeCurse.severityScore}%
            </span>
          ) : (
            <span className="rounded bg-[#00FF9D]/15 px-2 py-0.5 font-mono text-[10px] text-[#00FF9D]">
              ECU NOMINAL
            </span>
          )}
        </div>

        <div className="space-y-2">
          {soul.curses.map((curse) => {
            const isCursed = activeCurse?.id === curse.id;
            return (
              <button
                key={curse.id}
                type="button"
                onClick={() => (isCursed ? onClearCurses() : onCastCurse(curse))}
                className={`w-full rounded-lg border p-2.5 text-left transition cursor-pointer ${
                  isCursed
                    ? "border-[#FF1E42] bg-[#FF1E42]/20 text-white"
                    : "border-white/10 bg-[#06080D] hover:border-[#FF1E42]/50 hover:bg-[#FF1E42]/10"
                }`}
              >
                <div className="flex items-center justify-between font-mono text-xs font-bold">
                  <span className={isCursed ? "text-[#FF1E42]" : "text-[#FFB800]"}>
                    [{curse.dtcCode}] {curse.name}
                  </span>
                  <span className="text-[10px] text-slate-400">-{curse.powerLossPct}% WHP</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                  {curse.mechanicalExplanation}
                </p>
              </button>
            );
          })}

          {activeCurse && (
            <button
              type="button"
              onClick={onClearCurses}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#00FF9D]/50 bg-[#00FF9D]/15 py-2 font-mono text-xs font-bold text-[#00FF9D] hover:bg-[#00FF9D]/25 cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>EXORCISE ACTIVE FAULT &amp; RESTORE BASELINE</span>
            </button>
          )}
        </div>
      </div>

      {/* Hardware WebSerial & CSV Replay Deck */}
      <div className="rounded-xl border border-white/10 bg-[#0A0D14]/90 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#00E5FF]">
            Hardware Bus &amp; CSV Telemetry I/O
          </span>
          {connectionMode !== "VIRTUAL ECU 25Hz" && (
            <button
              type="button"
              onClick={onDisconnectExternalSource}
              className="font-mono text-[10px] text-[#FFB800] underline cursor-pointer"
            >
              Return to 25Hz Sim
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onConnectWebSerial}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#00E5FF]/45 bg-[#00E5FF]/10 px-3 py-2 font-mono text-xs font-bold text-[#00E5FF] hover:bg-[#00E5FF]/20 cursor-pointer"
        >
          <Cable className="h-4 w-4" />
          <span>Connect WebSerial Hardware (ELM327 / CAN)</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onDownloadSampleCsv}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 font-mono text-[11px] text-slate-200 hover:border-[#00FF9D]/50 hover:text-[#00FF9D] cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Sample CSV</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 font-mono text-[11px] text-slate-200 hover:border-[#FFB800]/50 hover:text-[#FFB800] cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Replay CSV Log</span>
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

        <div className="flex items-center gap-1.5 rounded bg-[#050608] px-2.5 py-1.5 font-mono text-[10px] text-slate-400">
          <AlertTriangle className="h-3 w-3 shrink-0 text-[#00E5FF]" />
          <span className="truncate">{webSerialStatus}</span>
        </div>
      </div>
    </aside>
  );
}
