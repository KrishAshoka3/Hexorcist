"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Cpu,
  FileText,
  Radio,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  MechanicalCursePreset,
  PidKey,
  VehicleSoulPreset,
} from "@/lib/obd-hex-engine";
import {
  DtcStorageMode,
  OBD_CONTROL_MODULES,
  buildMultiModuleScanReport,
  lookupUniversalDtc,
} from "@/lib/obd-scanner-qol";
import { playHexSound } from "@/lib/sound-fx";

export interface ObdScannerTxLogEntry {
  id: string;
  timestamp: string;
  tx: string;
  rx: string;
  summary: string;
}

export interface StandardObdScannerPanelProps {
  soul: VehicleSoulPreset;
  vin: string;
  activeCurse: MechanicalCursePreset | null;
  telemetry: Record<PidKey, number>;
  scanTriggerCount?: number;
  onClearMode04Codes: () => void;
  onInjectFaultPreset?: (curse: MechanicalCursePreset) => void;
  onOpenMechanicSpecSheet?: () => void;
  compactHeader?: boolean;
}

const QUICK_LOOKUP_CODES = [
  "P0750",
  "P0420",
  "P0300",
  "P0171",
  "U0100",
  "C0035",
  "B1200",
] as const;

let scannerLogSeq = 0;
function nextScannerLogId(): string {
  scannerLogSeq = (scannerLogSeq + 1) % 1_000_000;
  return `obd-log-${Date.now()}-${scannerLogSeq}`;
}

function nowClock(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

export function StandardObdScannerPanel({
  soul,
  vin,
  activeCurse,
  telemetry,
  scanTriggerCount = 0,
  onClearMode04Codes,
  onInjectFaultPreset,
  onOpenMechanicSpecSheet,
  compactHeader = false,
}: StandardObdScannerPanelProps) {
  const [scanning, setScanning] = useState(false);
  const [scanProgressPct, setScanProgressPct] = useState(100);
  const [activePollModuleIdx, setActivePollModuleIdx] = useState<number>(3);
  const [modeFilter, setModeFilter] = useState<"ALL" | DtcStorageMode>("ALL");
  const [lookupInput, setLookupInput] = useState<string>(activeCurse?.dtcCode ?? "P0420");
  const [scannerLogs, setScannerLogs] = useState<ObdScannerTxLogEntry[]>([
    {
      id: "seed-obd-scan",
      timestamp: "00:00:00.240",
      tx: "TX: 7DF 01 03",
      rx: "RX: 7E8..7EB MULTI-ECU",
      summary: "SAE J1979 Functional Broadcast Mode $03/$07/$0A Ready across ECM, TCM, ABS & BCM",
    },
  ]);

  const report = useMemo(
    () => buildMultiModuleScanReport(soul, activeCurse, telemetry),
    [soul, activeCurse, telemetry]
  );

  const lookupResult = useMemo(() => lookupUniversalDtc(lookupInput), [lookupInput]);

  const filteredDtcCards = useMemo(() => {
    if (modeFilter === "ALL") return report.dtcCards;
    return report.dtcCards.filter((c) => c.storageMode === modeFilter);
  }, [report.dtcCards, modeFilter]);

  const runFourModuleSweep = () => {
    playHexSound("AUTOPSY_SCAN");
    setScanning(true);
    setScanProgressPct(8);
    setActivePollModuleIdx(0);

    const steps: Array<{ pct: number; modIdx: number; delay: number }> = [
      { pct: 28, modIdx: 0, delay: 240 },
      { pct: 54, modIdx: 1, delay: 520 },
      { pct: 79, modIdx: 2, delay: 800 },
      { pct: 100, modIdx: 3, delay: 1080 },
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setScanProgressPct(step.pct);
        setActivePollModuleIdx(step.modIdx);
        if (idx === steps.length - 1) {
          setScanning(false);
          setScannerLogs((prev) => [
            {
              id: nextScannerLogId(),
              timestamp: nowClock(),
              tx: "TX: 7E0..7E3 [03 / 07 / 0A]",
              rx: activeCurse
                ? `RX: FAULT ${activeCurse.dtcCode} DETECTED`
                : "RX: 7E8..7EB 43 00 (0 FAULTS)",
              summary: activeCurse
                ? `4-Module Sweep Complete — Confirmed ${activeCurse.dtcCode} + Mode $02 Freeze-Frame`
                : "4-Module Sweep Complete — ECM, TCM, ABS & BCM All Nominal (0 Faults)",
            },
            ...prev.slice(0, 5),
          ]);
        }
      }, step.delay);
    });
  };

  useEffect(() => {
    if (scanTriggerCount <= 0) return;
    const kickTimer = window.setTimeout(() => {
      runFourModuleSweep();
    }, 0);
    return () => window.clearTimeout(kickTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanTriggerCount]);

  const handleMode04BroadcastClear = () => {
    const ts = nowClock();
    setScannerLogs((prev) => [
      {
        id: nextScannerLogId(),
        timestamp: ts,
        tx: "TX: 7DF 01 04",
        rx: "RX: 7E8 01 44 • 7E9 01 44",
        summary:
          "SAE J1979 Mode $04 Clear/Reset Diagnostic Info — Active/Pending DTCs Wiped & Check Engine Light (MIL) OFF",
      },
      ...prev.slice(0, 5),
    ]);
    onClearMode04Codes();
  };
  return (
    <div
      data-cinema-target="OBD_SCANNER_VIEW"
      className="rounded-xl border border-[#00E5FF]/35 bg-[#0A0D14]/95 p-4 font-mono space-y-4"
    >
      {/* Top Scanner Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#00E5FF]">
              🔍 Standard OBD-II Multi-Module Scanner (ECM / TCM / ABS / BCM)
            </h2>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                report.milOn
                  ? "border-[#FF1E42]/65 bg-[#FF1E42]/20 text-[#FF6B81]"
                  : "border-[#00FF9D]/55 bg-[#00FF9D]/15 text-[#00FF9D]"
              }`}
            >
              {report.milOn ? (
                <>
                  <ShieldAlert className="h-3 w-3" />
                  <span>MIL ON • {report.totalFaults} STORED RECORDS</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  <span>MIL OFF • ALL MODULES PASS</span>
                </>
              )}
            </span>
          </div>
          {!compactHeader && (
            <p className="mt-0.5 text-[11px] text-slate-400">
              SAE J1979 Modes $02 Freeze-Frame • $03 Confirmed • $07 Pending • $0A Permanent • $04 Reset MIL ({vin})
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runFourModuleSweep}
            disabled={scanning}
            className="flex items-center gap-1.5 rounded-lg bg-[#00E5FF] px-3.5 py-2 text-xs font-bold text-[#06070A] shadow-[0_0_20px_rgba(0,229,255,0.28)] hover:bg-[#00E5FF]/90 disabled:opacity-60 cursor-pointer"
          >
            <Radio className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
            <span>{scanning ? "Scanning 4 Control Modules..." : "Scan All Control Modules"}</span>
          </button>

          <button
            type="button"
            data-cinema-target="MODE_04_CLEAR_BTN"
            onClick={handleMode04BroadcastClear}
            className="flex items-center gap-1.5 rounded-lg border border-[#00FF9D]/60 bg-[#00FF9D]/15 px-3.5 py-2 text-xs font-bold text-[#00FF9D] hover:bg-[#00FF9D]/25 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Clear Codes &amp; Reset Check Engine Light (Mode $04)</span>
          </button>
        </div>
      </div>

      {/* Animated Multi-Module Sweep Bar & 4 Module Status Cards */}
      <div className="rounded-xl border border-white/10 bg-[#05070B] p-3 space-y-2.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-bold text-slate-300">
            {scanning
              ? `POLLING ${OBD_CONTROL_MODULES[activePollModuleIdx]?.fullName}...`
              : "ISO 15765-4 CAN 500kbaud 4-MODULE SYSTEM SWEEP"}
          </span>
          <span className="font-bold text-[#00E5FF]">{scanProgressPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full transition-all duration-200 ${
              report.milOn && !scanning
                ? "bg-gradient-to-r from-[#00E5FF] via-[#FFB800] to-[#FF1E42]"
                : "bg-gradient-to-r from-[#00E5FF] to-[#00FF9D]"
            }`}
            style={{ width: `${scanProgressPct}%` }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {report.modules.map((modStatus, idx) => {
            const isBeingPolled = scanning && idx === activePollModuleIdx;
            return (
              <div
                key={`${modStatus.module.id}-${idx}`}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[11px] transition ${
                  isBeingPolled
                    ? "border-[#00E5FF] bg-[#00E5FF]/10"
                    : modStatus.status === "FAULT"
                    ? "border-[#FF1E42]/65 bg-[#18070C]"
                    : "border-[#00FF9D]/30 bg-white/[0.02]"
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate font-bold text-white">
                    {modStatus.module.fullName}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {modStatus.module.txCanId} → {modStatus.module.rxCanId}
                    {modStatus.dtcCodes.length > 0
                      ? ` • DTC: ${modStatus.dtcCodes.join(", ")}`
                      : ""}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    modStatus.status === "FAULT"
                      ? "bg-[#FF1E42]/20 text-[#FF6B81] border border-[#FF1E42]/50"
                      : "bg-[#00FF9D]/15 text-[#00FF9D] border border-[#00FF9D]/40"
                  }`}
                >
                  {modStatus.badgeText}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Road Safety Triage Banner ("Can I Drive With This?") */}
      {report.primarySafetyTriage && (
        <div
          data-cinema-target="SAFETY_TRIAGE_BANNER"
          className={`rounded-xl border p-3.5 space-y-1 ${
            report.primarySafetyTriage.level === "STOP"
              ? "border-[#FF1E42] bg-[#1D060B] text-[#FF6B81] shadow-[0_0_28px_rgba(255,30,66,0.28)]"
              : report.primarySafetyTriage.level === "CAUTION"
              ? "border-[#FFB800]/80 bg-[#1B1304] text-[#FFD166] shadow-[0_0_24px_rgba(255,184,0,0.2)]"
              : "border-[#00FF9D]/65 bg-[#061811] text-[#00FF9D]"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
              🚦 CAN I DRIVE WITH THIS? • ROAD SAFETY TRIAGE
            </span>
            <span className="rounded-full border border-current/40 bg-black/35 px-2.5 py-0.5 text-[11px] font-black">
              {report.primarySafetyTriage.badgeText}
            </span>
          </div>
          <div className="text-xs font-bold text-white">
            {report.primarySafetyTriage.headline}
          </div>
          <p className="text-[11px] leading-snug text-slate-200">
            {report.primarySafetyTriage.guidance}
          </p>
        </div>
      )}

      {/* SAE J1979 Mode $03 / $07 / $0A Active, Pending & Permanent DTC Cards */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            SAE J1979 Trouble Codes (Mode $03 / $07 / $0A)
          </span>
          <div className="flex flex-wrap gap-1">
            {(
              [
                { id: "ALL", label: `All (${report.dtcCards.length})` },
                { id: "MODE_03_CONFIRMED", label: "Mode $03 Confirmed" },
                { id: "MODE_07_PENDING", label: "Mode $07 Pending" },
                { id: "MODE_0A_PERMANENT", label: "Mode $0A Permanent" },
              ] as const
            ).map((tab, idx) => (
              <button
                key={`${tab.id}-${idx}`}
                type="button"
                onClick={() => {
                  playHexSound("CLICK");
                  setModeFilter(tab.id);
                }}
                className={`rounded border px-2 py-1 text-[10px] font-bold transition cursor-pointer ${
                  modeFilter === tab.id
                    ? "border-[#00E5FF] bg-[#00E5FF]/20 text-[#00E5FF]"
                    : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {filteredDtcCards.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#00FF9D]/35 bg-[#06130E] p-4 text-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-[#00FF9D] shrink-0" />
              <div>
                <div className="font-bold text-[#00FF9D]">
                  0 Active, Pending, or Permanent Trouble Codes Stored — Check Engine Light OFF
                </div>
                <div className="text-[11px] text-slate-300">
                  ECM (0x7E8), TCM (0x7E9), ABS (0x7EA), and BCM (0x7EB) passed SAE J1979 diagnostic sweep.
                </div>
              </div>
            </div>
            {onInjectFaultPreset && soul.curses[0] && (
              <button
                type="button"
                onClick={() => onInjectFaultPreset(soul.curses[0])}
                className="rounded-lg border border-[#FFB800]/50 bg-[#FFB800]/15 px-3 py-1.5 text-[11px] font-bold text-[#FFB800] hover:bg-[#FFB800]/25 cursor-pointer"
              >
                Simulate {soul.curses[0].dtcCode} Fault
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredDtcCards.map((card, idx) => (
              <div
                key={`${card.id}-${idx}`}
                className={`rounded-xl border p-3.5 space-y-2.5 ${
                  card.storageMode === "MODE_03_CONFIRMED"
                    ? "border-[#FF1E42]/65 bg-[#12070B]"
                    : "border-white/12 bg-[#06090F]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[#FFB800]/20 border border-[#FFB800]/50 px-2.5 py-0.5 text-sm font-black text-[#FFB800]">
                      {card.code}
                    </span>
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-[#00E5FF]">
                      {card.moduleOrigin} ({card.rxCanId})
                    </span>
                    <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
                      {card.modeHexLabel}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                      card.milIlluminated
                        ? "bg-[#FF1E42]/20 text-[#FF6B81] border border-[#FF1E42]/50"
                        : "bg-[#FFB800]/15 text-[#FFD166] border border-[#FFB800]/45"
                    }`}
                  >
                    {card.statusPill}
                  </span>
                </div>

                <div>
                  <div className="text-xs font-bold text-white">{card.title}</div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">
                    {card.plainEnglish}
                  </p>
                </div>

                <div className="rounded-lg border border-[#00E5FF]/25 bg-[#04070B] p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-[#00E5FF]">
                    <span className="font-bold">
                      ❄️ MODE $02 FREEZE-FRAME SNAPSHOT (AT FAULT TRIGGER)
                    </span>
                    <span className="text-slate-400">SAE J2012 {card.bitmask.hexPair}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
                    {[
                      { k: "RPM", v: `${card.freezeFrame.rpm}` },
                      { k: "Speed", v: `${card.freezeFrame.speedKmh} km/h` },
                      { k: "Coolant Temp", v: `${card.freezeFrame.coolantTempC} °C` },
                      { k: "Load %", v: `${card.freezeFrame.calculatedLoadPct}%` },
                      { k: "Voltage", v: `${card.freezeFrame.voltageV} V` },
                    ].map((cell, cIdx) => (
                      <div
                        key={`${card.id}-${cell.k}-${cIdx}`}
                        className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-1"
                      >
                        <div className="text-[9px] text-slate-400">{cell.k}</div>
                        <div className="font-bold text-white">{cell.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Universal "Lookup Any DTC Code" Search Bar */}
      <div className="rounded-xl border border-white/12 bg-[#05070B] p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#00E5FF]">
            <Search className="h-3.5 w-3.5" />
            <span>Universal &quot;Lookup Any DTC Code&quot; Decoder (SAE J2012 16-Bit)</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {QUICK_LOOKUP_CODES.map((sampleCode, idx) => (
              <button
                key={`${sampleCode}-${idx}`}
                type="button"
                onClick={() => {
                  playHexSound("CLICK");
                  setLookupInput(sampleCode);
                }}
                className={`rounded border px-2 py-0.5 text-[10px] font-bold cursor-pointer ${
                  lookupResult.code === sampleCode
                    ? "border-[#FFB800] bg-[#FFB800]/20 text-[#FFB800]"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-[#00E5FF]/50 hover:text-[#00E5FF]"
                }`}
              >
                {sampleCode}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            maxLength={5}
            value={lookupInput}
            onChange={(e) => setLookupInput(e.target.value.toUpperCase())}
            placeholder="Type any 5-char DTC (e.g. P0420, P0750, P0300, U0100, C0035, B1200)"
            className="w-full sm:w-72 rounded-lg border border-white/15 bg-black px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#FFB800] outline-none focus:border-[#00E5FF]"
          />
          <span className="rounded border border-[#00FF9D]/35 bg-[#00FF9D]/10 px-2.5 py-1 text-[11px] font-bold text-[#00FF9D]">
            {lookupResult.bitmask.binary16} ({lookupResult.bitmask.hexPair})
          </span>
          <span className="rounded bg-white/5 px-2.5 py-1 text-[10px] text-slate-300">
            {lookupResult.bitmask.domainLabel} • {lookupResult.bitmask.subTypeLabel}
          </span>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-white">
              {lookupResult.code} — {lookupResult.title}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                lookupResult.severity === "CRITICAL"
                  ? "bg-[#FF1E42]/20 text-[#FF6B81] border border-[#FF1E42]/45"
                  : lookupResult.severity === "MODERATE"
                  ? "bg-[#FFB800]/20 text-[#FFD166] border border-[#FFB800]/45"
                  : "bg-[#00FF9D]/15 text-[#00FF9D] border border-[#00FF9D]/40"
              }`}
            >
              SEVERITY: {lookupResult.severity} • {lookupResult.moduleOrigin}
            </span>
          </div>
          <p className="text-[11px] text-slate-300">{lookupResult.plainEnglish}</p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {lookupResult.symptoms.map((sym, idx) => (
              <span
                key={`${lookupResult.code}-sym-${idx}`}
                className="rounded border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-slate-300"
              >
                • {sym}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Live Scanner CAN Transaction Log + Mechanic Spec Sheet Shortcut */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#050609] px-3 py-2 text-[10px]">
        <div className="min-w-0 flex-1 space-y-1">
          {scannerLogs.slice(0, 2).map((entry, idx) => (
            <div key={`${entry.id}-${idx}`} className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-[#00E5FF]">{entry.tx}</span>
              <span className="font-bold text-[#00FF9D]">→ {entry.rx}</span>
              <span className="truncate text-slate-400">{entry.summary}</span>
            </div>
          ))}
        </div>
        {onOpenMechanicSpecSheet && (
          <button
            type="button"
            onClick={onOpenMechanicSpecSheet}
            className="flex items-center gap-1.5 rounded-lg border border-[#FFB800]/50 bg-[#FFB800]/15 px-3 py-1.5 text-[11px] font-bold text-[#FFB800] hover:bg-[#FFB800]/25 cursor-pointer shrink-0"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Printable Mechanic Spec Sheet</span>
          </button>
        )}
      </div>
    </div>
  );
}
export interface StandardObdScannerModalProps extends StandardObdScannerPanelProps {
  open: boolean;
  onClose: () => void;
  onDockInCenterWorkspace?: () => void;
}

export function StandardObdScannerModal({
  open,
  onClose,
  onDockInCenterWorkspace,
  ...panelProps
}: StandardObdScannerModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[58] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            className="w-full max-w-4xl rounded-2xl border border-[#00E5FF]/55 bg-[#070A10] p-4 font-mono text-white shadow-[0_0_60px_rgba(0,229,255,0.28)] space-y-3 my-auto"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00E5FF]">
                <Cpu className="h-4 w-4 text-[#00FF9D]" />
                <span>SAE J1979 Multi-Module OBD-II Diagnostic Scanner (ECM / TCM / ABS / BCM)</span>
              </div>
              <div className="flex items-center gap-2">
                {onDockInCenterWorkspace && (
                  <button
                    type="button"
                    onClick={() => {
                      playHexSound("CLICK");
                      onDockInCenterWorkspace();
                      onClose();
                    }}
                    className="rounded-lg border border-[#00FF9D]/45 bg-[#00FF9D]/10 px-2.5 py-1 text-[10px] font-bold text-[#00FF9D] hover:bg-[#00FF9D]/20 cursor-pointer"
                  >
                    Open in Center Workspace Tab
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-slate-300 hover:text-white cursor-pointer"
                  aria-label="Close OBD-II Scanner Modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <StandardObdScannerPanel {...panelProps} compactHeader />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}




