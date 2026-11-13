"use client";

import React, { useMemo, useState } from "react";
import { Binary, Cable, Send } from "lucide-react";
import {
  PidKey,
  SoulProfileId,
  VehicleArchitectureId,
  VehicleSoulPreset,
  toHexByte,
} from "@/lib/obd-hex-engine";
import {
  DbcSignalDefinition,
  SAMPLE_DBC_MATRICES,
  buildLiveDbcPayloadBytes,
  decodeDbcSignalEngineering,
  processVirtualElm327Command,
} from "@/lib/log-and-dbc-engine";
import type { HardwareStudioTab } from "@/components/HardwareAndDbcModal";

interface EngineerProHardwareDockProps {
  activeVehicleId: SoulProfileId;
  soul: VehicleSoulPreset;
  telemetry: Record<PidKey, number>;
  activeDtc: string | null;
  activeVin: string;
  webSerialStatus: string;
  loopbackActive: boolean;
  physicalPortConnected: boolean;
  onActivateLoopbackPort: () => void;
  onIngestLoopbackFrame: (rawFrame: string) => void;
  onClearFaultsFromTerminal: () => void;
  onOpenFullModal: (tab: HardwareStudioTab) => void;
}

let dockLogSeq = 0;
const nextDockLogId = (prefix: string): string => {
  dockLogSeq = (dockLogSeq + 1) % 1_000_000;
  return `${prefix}-${Date.now()}-${dockLogSeq}-${Math.random().toString(36).slice(2, 7)}`;
};

export function EngineerProHardwareDock({
  activeVehicleId,
  soul,
  telemetry,
  activeDtc,
  activeVin,
  webSerialStatus,
  loopbackActive,
  physicalPortConnected,
  onActivateLoopbackPort,
  onIngestLoopbackFrame,
  onClearFaultsFromTerminal,
  onOpenFullModal,
}: EngineerProHardwareDockProps) {
  const matrixId: VehicleArchitectureId =
    activeVehicleId === "CUSTOM_VIN_SOUL"
      ? "GERMAN_V6_DSG"
      : (activeVehicleId as VehicleArchitectureId);
  const matrix = SAMPLE_DBC_MATRICES[matrixId];
  const liveBytes = useMemo(
    () => buildLiveDbcPayloadBytes(matrixId, telemetry, Boolean(activeDtc)),
    [matrixId, telemetry, activeDtc]
  );

  const [atInput, setAtInput] = useState("01 0C");
  const [atLog, setAtLog] = useState<Array<{ id: string; tx: string; rx: string }>>([
    {
      id: "dock-init",
      tx: "ATSP6",
      rx: "OK // ISO 15765-4 CAN (11-bit ID, 500 kbaud)",
    },
  ]);

  const sendDockCmd = (raw?: string) => {
    const cmd = (raw ?? atInput).trim().toUpperCase();
    if (!cmd) return;
    if (!loopbackActive && !physicalPortConnected) {
      onActivateLoopbackPort();
    }
    const resp = processVirtualElm327Command(cmd, {
      telemetry,
      activeDtc,
      vin: activeVin,
      soulCodename: soul.codename,
    });
    const uid = nextDockLogId("dock");
    setAtLog((prev) => [
      { id: uid, tx: cmd, rx: resp.rxLines.join(" | ") },
      ...prev.slice(0, 7),
    ]);
    for (const line of resp.rxLines) {
      if (line.startsWith("7E8 ")) onIngestLoopbackFrame(line);
    }
    if (resp.clearedFaults) onClearFaultsFromTerminal();
    if (!raw) setAtInput("");
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 font-mono">
      <div className="lg:col-span-7 rounded-xl border border-[#00E5FF]/30 bg-[#0A0D14]/90 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Binary className="h-4 w-4 text-[#00E5FF]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              OpenDBC 64-Bit Bit-Packing Matrix // {matrix.messageName} ({matrix.canIdHex})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenFullModal("DBC_INSPECTOR")}
            className="rounded border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-2.5 py-1 text-[10px] font-bold text-[#00E5FF] hover:bg-[#00E5FF]/20 cursor-pointer"
          >
            Interactive 64-Bit Bit-Flip Studio ↗
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-[#05070B] px-3 py-2 text-[11px]">
          <span className="text-slate-400">LIVE 8-BYTE PAYLOAD:</span>
          {liveBytes.map((b, idx) => (
            <span
              key={`byte-${b}-${idx}`}
              className="rounded border border-[#00FF9D]/35 bg-[#00FF9D]/10 px-2 py-0.5 font-bold text-[#00FF9D]"
            >
              B{idx}:{toHexByte(b)}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          {matrix.signals.slice(0, 6).map((sig: DbcSignalDefinition, idx) => {
            const dec = decodeDbcSignalEngineering(liveBytes, sig);
            return (
              <div
                key={`${sig.name}-${idx}`}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-[#05070B] px-3 py-2"
              >
                <div className="min-w-0 pr-2">
                  <div className="truncate font-bold text-white">{sig.name}</div>
                  <div className="text-[10px] text-slate-400">
                    Bit {sig.startBit}|{sig.length} •{" "}
                    {sig.byteOrder === "INTEL_LE" ? "Intel LE" : "Motorola BE"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-bold text-[#00E5FF]">
                    {dec.physicalValue.toFixed(sig.scale < 0.1 ? 2 : 1)} {sig.unit}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    0x{dec.preview.rawUnsigned.toString(16).toUpperCase().padStart(2, "0")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-5 rounded-xl border border-purple-400/35 bg-[#0A0D14]/90 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cable className="h-4 w-4 text-purple-300" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              WebSerial ELM327 AT / ISO-TP Terminal
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenFullModal("WEBSERIAL_DRAWER")}
            className="rounded border border-purple-400/40 bg-purple-500/15 px-2.5 py-1 text-[10px] font-bold text-purple-200 hover:bg-purple-500/25 cursor-pointer"
          >
            Pair USB/BT Hardware ↗
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {["ATZ", "ATRV", "01 0C", "03", "04", "22 F4 0A", "09 02"].map((cmd, idx) => (
            <button
              key={`${cmd}-${idx}`}
              type="button"
              onClick={() => sendDockCmd(cmd)}
              className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-slate-200 hover:border-purple-400 hover:text-purple-200 cursor-pointer"
            >
              {cmd}
            </button>
          ))}
        </div>

        <div className="h-32 overflow-y-auto rounded-lg border border-white/10 bg-[#04060A] p-2.5 text-[11px] space-y-1.5">
          {atLog.map((entry, idx) => (
            <div key={`${entry.id}-${idx}`} className="border-b border-white/5 pb-1">
              <div className="text-[#00E5FF] font-bold">&gt; {entry.tx}</div>
              <div className="text-[#00FF9D] truncate">{entry.rx}</div>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendDockCmd();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={atInput}
            onChange={(e) => setAtInput(e.target.value.toUpperCase())}
            placeholder="ATZ, 01 0C, 03, 04, 22 F4 0A..."
            className="flex-1 rounded-lg border border-white/15 bg-black px-3 py-1.5 text-xs uppercase text-white outline-none focus:border-purple-400"
          />
          <button
            type="submit"
            className="flex items-center gap-1 rounded-lg bg-purple-400 px-3 py-1.5 text-xs font-bold text-[#06070A] hover:bg-purple-300 cursor-pointer"
          >
            <Send className="h-3 w-3" />
            <span>TX</span>
          </button>
        </form>
        <div className="truncate text-[10px] text-slate-400">{webSerialStatus}</div>
      </div>
    </section>
  );
}
