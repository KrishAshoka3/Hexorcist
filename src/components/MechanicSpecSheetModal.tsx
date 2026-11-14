"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ClipboardCheck,
  Copy,
  FileText,
  Lock,
  Printer,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import {
  MechanicalCursePreset,
  PidKey,
  VehicleSoulPreset,
} from "@/lib/obd-hex-engine";
import {
  buildFreezeFrameSnapshot,
  evaluateRoadSafetyTriage,
  evaluateShopQuoteFairness,
  formatMechanicSpecSheetPlainText,
  lookupUniversalDtc,
} from "@/lib/obd-scanner-qol";
import type { DiagnoseResponsePayload } from "@/app/api/diagnose/route";
import { playHexSound } from "@/lib/sound-fx";

export interface MechanicSpecSheetModalProps {
  open: boolean;
  onClose: () => void;
  soul: VehicleSoulPreset;
  vin: string;
  activeCurse: MechanicalCursePreset | null;
  activeDtc: string;
  telemetry: Record<PidKey, number>;
  autopsyResult: DiagnoseResponsePayload | null;
  escrowBalanceCents: number;
  escrowRateCentsPerMile: number;
}

export function MechanicSpecSheetModal({
  open,
  onClose,
  soul,
  vin,
  activeCurse,
  activeDtc,
  telemetry,
  autopsyResult,
  escrowBalanceCents,
  escrowRateCentsPerMile,
}: MechanicSpecSheetModalProps) {
  const [copied, setCopied] = useState(false);

  const fallbackCurse =
    activeCurse ??
    soul.curses.find((c) => c.dtcCode.toUpperCase() === activeDtc.toUpperCase()) ??
    soul.curses[0];

  const effectiveDtc = activeCurse?.dtcCode ?? activeDtc ?? fallbackCurse.dtcCode;
  const lookup = lookupUniversalDtc(effectiveDtc);
  const freezeFrame = buildFreezeFrameSnapshot(telemetry, soul, Boolean(activeCurse));
  const safetyTriage = evaluateRoadSafetyTriage(effectiveDtc, activeCurse, telemetry);

  const rootCause =
    autopsyResult?.rootCause ??
    `[VIN ${vin} // ${soul.yearMakeModel}] ${fallbackCurse.mechanicalExplanation}`;
  const oemPartName = autopsyResult?.oemPartName ?? fallbackCurse.oemPartName;
  const oemPartNumber = autopsyResult?.oemPartNumber ?? fallbackCurse.oemPartNumber;
  const fairEstimateUsd = autopsyResult?.estimatedCostUsd ?? fallbackCurse.estimatedCostUsd;
  const laborHours = autopsyResult?.laborHours ?? fallbackCurse.laborHours;
  const recommendedUdsCommand =
    autopsyResult?.recommendedUdsCommand ?? fallbackCurse.recommendedUdsCommand;

  const quoteAudit = evaluateShopQuoteFairness(fairEstimateUsd, laborHours, 2450);
  const passId = `HEX-PASS-${vin.slice(-6)}-${lookup.code}`;

  const plainTextSummary = formatMechanicSpecSheetPlainText({
    soul,
    vin,
    activeDtc: lookup.code,
    hasActiveFault: Boolean(activeCurse),
    freezeFrame,
    rootCause,
    oemPartName,
    oemPartNumber,
    fairEstimateUsd,
    laborHours,
    recommendedUdsCommand,
    escrowBalanceCents,
    escrowRateCentsPerMile,
    safetyTriage,
  });

  const handleCopy = async () => {
    playHexSound("CLICK");
    try {
      await navigator.clipboard.writeText(plainTextSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handlePrint = () => {
    playHexSound("CLICK");
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto"
        >
          <motion.div
            data-cinema-target="MECHANIC_SPEC_MODAL"
            initial={{ scale: 0.96, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 10 }}
            className="w-full max-w-2xl rounded-2xl border border-[#00FF9D]/55 bg-[#080B11] p-5 font-mono text-white shadow-[0_0_55px_rgba(0,255,157,0.28)] space-y-4 my-auto"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00FF9D]">
                  <FileText className="h-4 w-4" />
                  <span>Printable Mechanic Spec Sheet &amp; Pre-Funded Escrow Pass</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-300">
                  Hand this verified SAE J1979 / Vertex AI work order to your shop to skip the $200 diagnostic fee &amp; lock fair OEM book pricing.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-slate-300 hover:text-white cursor-pointer"
                aria-label="Close Mechanic Spec Sheet"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl border border-white/10 bg-[#05070B] p-3 space-y-1">
                <div className="text-[10px] uppercase text-slate-400">Vehicle Profile &amp; ISO 3779 VIN</div>
                <div className="font-bold text-white">{soul.yearMakeModel}</div>
                <div className="text-[11px] text-[#00E5FF]">VIN: {vin}</div>
                <div className="text-[10px] text-slate-400 truncate">{soul.engineSummary}</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#05070B] p-3 space-y-1">
                <div className="text-[10px] uppercase text-slate-400">Confirmed DTC &amp; Module Origin</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-[#FFB800]">{lookup.code}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      activeCurse
                        ? "bg-[#FF1E42]/20 text-[#FF6B81] border border-[#FF1E42]/45"
                        : "bg-[#00FF9D]/15 text-[#00FF9D] border border-[#00FF9D]/40"
                    }`}
                  >
                    {activeCurse ? "CONFIRMED • MIL ON" : "CLEARED • MIL OFF"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">{lookup.moduleOrigin}</div>
                <div className="text-[10px] text-slate-400">
                  SAE J2012: {lookup.bitmask.hexPair} ({lookup.bitmask.binary16})
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-[#00E5FF]/30 bg-[#05070B] p-3 space-y-2">
              <div className="flex items-center justify-between text-[10px] uppercase text-[#00E5FF] font-bold">
                <span>SAE J1979 Mode $02 Freeze-Frame Snapshot</span>
                <span>Captured @ Fault Trigger</span>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center text-[11px]">
                {[
                  { label: "RPM", val: `${freezeFrame.rpm}` },
                  { label: "SPEED", val: `${freezeFrame.speedKmh} km/h` },
                  { label: "COOLANT", val: `${freezeFrame.coolantTempC} °C` },
                  { label: "LOAD %", val: `${freezeFrame.calculatedLoadPct}%` },
                  { label: "VOLTAGE", val: `${freezeFrame.voltageV} V` },
                ].map((item, idx) => (
                  <div
                    key={`${item.label}-${idx}`}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5"
                  >
                    <div className="text-[9px] text-slate-400">{item.label}</div>
                    <div className="font-bold text-white">{item.val}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#FFB800]/35 bg-[#05070B] p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#FFB800]">
                  <Wrench className="h-3.5 w-3.5" />
                  <span>Vertex AI Root Cause &amp; Fair OEM Book Breakdown</span>
                </span>
                <span className="rounded bg-[#00FF9D]/15 px-2 py-0.5 text-[10px] font-bold text-[#00FF9D]">
                  FAIR EST: ${quoteAudit.fairEstimateUsd.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">{rootCause}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                <div className="rounded border border-white/10 bg-white/[0.03] p-2">
                  <div className="text-[9px] text-slate-400">REQUIRED OEM PART</div>
                  <div className="font-bold text-[#00E5FF]">{oemPartNumber}</div>
                  <div className="truncate text-[10px] text-slate-300">{oemPartName}</div>
                </div>
                <div className="rounded border border-white/10 bg-white/[0.03] p-2">
                  <div className="text-[9px] text-slate-400">OEM PARTS BOOK</div>
                  <div className="font-bold text-white">${quoteAudit.oemPartsUsd.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-400">Factory Spec Kit</div>
                </div>
                <div className="rounded border border-white/10 bg-white/[0.03] p-2">
                  <div className="text-[9px] text-slate-400">STANDARD LABOR</div>
                  <div className="font-bold text-white">
                    {quoteAudit.bookLaborHours} hrs @ ${quoteAudit.bookHourlyRateUsd}/hr
                  </div>
                  <div className="text-[10px] text-slate-400">
                    ${quoteAudit.standardLaborUsd.toLocaleString()} Book Labor
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#00FF9D]/45 bg-[#071410] px-3.5 py-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Lock className="h-4 w-4 text-[#00FF9D] shrink-0" />
                <div>
                  <div className="font-bold text-[#00FF9D]">
                    PRE-FUNDED ESCROW PASS // {passId}
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Vault Balance Ready:{" "}
                    <strong className="text-white">${(escrowBalanceCents / 100).toFixed(2)}</strong> •
                    Auto-Save Rate: ${(escrowRateCentsPerMile / 100).toFixed(2)}/mi
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#00FF9D]/50 bg-[#00FF9D]/15 px-2.5 py-1 text-[10px] font-bold text-[#00FF9D]">
                <ShieldCheck className="h-3.5 w-3.5" />
                INSTANT SHOP SETTLEMENT READY
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="flex items-center gap-1.5 rounded-lg border border-[#00E5FF]/50 bg-[#00E5FF]/15 px-3.5 py-2 text-xs font-bold text-[#00E5FF] hover:bg-[#00E5FF]/25 cursor-pointer"
              >
                {copied ? <ClipboardCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? "Copied Mechanic Spec Sheet!" : "Copy Spec Sheet Text"}</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-lg bg-[#00FF9D] px-4 py-2 text-xs font-bold text-[#06070A] shadow-[0_0_20px_rgba(0,255,157,0.3)] hover:bg-[#00FF9D]/90 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Print / Save Work Order PDF</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

