"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Loader2,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  MechanicalCursePreset,
  PidKey,
  VehicleSoulPreset,
  inspectDTCBitmask,
} from "@/lib/obd-hex-engine";
import {
  buildFreezeFrameSnapshot,
  buildMultiModuleScanReport,
  evaluateRoadSafetyTriage,
  evaluateShopQuoteFairness,
  lookupUniversalDtc,
} from "@/lib/obd-scanner-qol";
import { formatVehicleShortMakeModel } from "@/lib/vehicle-fault-generator";
import type { DiagnoseResponsePayload } from "@/app/api/diagnose/route";
import { playHexSound } from "@/lib/sound-fx";

export interface ScannerAndAiTabProps {
  soul: VehicleSoulPreset;
  vin: string;
  activeCurse: MechanicalCursePreset | null;
  activeDtc: string;
  onChangeCustomDtc: (code: string) => void;
  telemetry: Record<PidKey, number>;
  scanTriggerCount: number;
  onClearMode04Codes: () => void;
  onCastCurse: (curse: MechanicalCursePreset) => void;
  onRollRandomFault?: () => void;
  simulatorLockedReason?: string | null;
  autopsyLoading: boolean;
  autopsyResult: DiagnoseResponsePayload | null;
  onRunAutopsy: () => void;
  onApplyRecommendedUds: () => void;
  shopQuoteUsd: number;
  onChangeShopQuoteUsd: (usd: number) => void;
}

const QUICK_LOOKUP_CODES = ["P0750", "P0420", "P0300", "P0171", "U0100"] as const;

export function ScannerAndAiTab({
  soul,
  activeCurse,
  activeDtc,
  onChangeCustomDtc,
  telemetry,
  scanTriggerCount,
  onClearMode04Codes,
  onCastCurse,
  onRollRandomFault,
  simulatorLockedReason = null,
  autopsyLoading,
  autopsyResult,
  onRunAutopsy,
  onApplyRecommendedUds,
  shopQuoteUsd,
  onChangeShopQuoteUsd,
}: ScannerAndAiTabProps) {
  const [scanning, setScanning] = useState(false);
  const [scanProgressPct, setScanProgressPct] = useState(100);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupInput, setLookupInput] = useState(activeDtc || "P0750");

  const report = useMemo(
    () => buildMultiModuleScanReport(soul, activeCurse, telemetry),
    [soul, activeCurse, telemetry]
  );
  const freezeFrame = useMemo(
    () => buildFreezeFrameSnapshot(telemetry, soul, Boolean(activeCurse)),
    [telemetry, soul, activeCurse]
  );
  const lookupResult = useMemo(() => lookupUniversalDtc(lookupInput), [lookupInput]);

  const runFourModuleSweep = () => {
    playHexSound("AUTOPSY_SCAN");
    setScanning(true);
    setScanProgressPct(18);
    const timers = [
      setTimeout(() => setScanProgressPct(52), 260),
      setTimeout(() => setScanProgressPct(84), 560),
      setTimeout(() => {
        setScanProgressPct(100);
        setScanning(false);
      }, 880),
    ];
    return () => timers.forEach(clearTimeout);
  };

  useEffect(() => {
    if (scanTriggerCount <= 0) return;
    const t0 = setTimeout(() => {
      playHexSound("AUTOPSY_SCAN");
      setScanning(true);
      setScanProgressPct(18);
    }, 0);
    const t1 = setTimeout(() => setScanProgressPct(52), 260);
    const t2 = setTimeout(() => setScanProgressPct(84), 560);
    const t3 = setTimeout(() => {
      setScanProgressPct(100);
      setScanning(false);
    }, 880);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [scanTriggerCount]);

  let bitmask = inspectDTCBitmask("P0750");
  try {
    bitmask = inspectDTCBitmask(activeDtc);
  } catch {
    bitmask = inspectDTCBitmask("P0300");
  }

  const fallbackCurse = activeCurse ?? soul.curses[0];
  const baselineFairUsd =
    autopsyResult?.estimatedCostUsd ?? fallbackCurse.estimatedCostUsd ?? 1480;
  const baselineLaborHrs =
    autopsyResult?.laborHours ?? fallbackCurse.laborHours ?? 6.5;
  const quoteAudit = evaluateShopQuoteFairness(
    baselineFairUsd,
    baselineLaborHrs,
    shopQuoteUsd
  );
  const safetyTriage = activeCurse
    ? evaluateRoadSafetyTriage(activeDtc, activeCurse, telemetry)
    : null;

  const updateShopQuote = (nextUsd: number) => {
    const bounded = Math.max(0, Math.min(12000, Math.round(nextUsd || 0)));
    onChangeShopQuoteUsd(bounded);
  };

  return (
    <div className="flex flex-col gap-6">
      <div
        data-cinema-target="SAFETY_TRIAGE_BANNER"
        className={`rounded-2xl border px-6 py-4 shadow-xl flex flex-wrap items-center justify-between gap-3 ${
          safetyTriage
            ? safetyTriage.level === "STOP"
              ? "border-rose-500/35 bg-rose-950/30 text-rose-200"
              : "border-amber-500/35 bg-amber-950/25 text-amber-200"
            : "border-emerald-500/20 bg-zinc-900/60 text-zinc-200"
        }`}
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Can I Drive This?
            </span>
            <span className="text-sm font-semibold">
              {safetyTriage
                ? safetyTriage.badgeText
                : "🟢 All 4 Control Modules Pass — Zero Active Faults"}
            </span>
          </div>
          {safetyTriage && (
            <p className="text-xs text-zinc-300">{safetyTriage.guidance}</p>
          )}
        </div>
        <span className="font-mono text-xs text-zinc-400">
          {report.milOn ? "MIL: ON" : "MIL: OFF"} • {report.totalFaults} Stored DTCs
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[45fr_55fr] gap-6 items-start">
        {/* Left Column (45%): 4-Module Standard OBD-II Code Scanner */}
        <section
          id="cockpit-stage-02-scanner"
          data-cinema-target="OBD_SCANNER_VIEW"
          className="obsidian-panel rounded-2xl p-6 space-y-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                4-Module OBD-II Code Scanner
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Polls ECM, TCM, ABS &amp; BCM across Modes $03/$07/$0A.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={runFourModuleSweep}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-800 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-700 transition cursor-pointer"
              >
                <Radio className={`h-3.5 w-3.5 ${scanning ? "animate-pulse text-violet-400" : "text-zinc-300"}`} />
                <span>{scanning ? "Scanning…" : "Scan Modules"}</span>
              </button>

              <button
                type="button"
                data-cinema-target="MODE_04_CLEAR_BTN"
                onClick={onClearMode04Codes}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Clear Codes (Mode $04)</span>
              </button>
            </div>
          </div>

          {scanning && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-violet-500 transition-all duration-200"
                style={{ width: `${scanProgressPct}%` }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {report.modules.map((m) => {
              const isFault = m.status === "FAULT";
              return (
                <div
                  key={m.module.id}
                  className={`rounded-xl border p-3.5 space-y-1 transition ${
                    isFault
                      ? "border-rose-500/35 bg-rose-950/25"
                      : "border-white/[0.06] bg-zinc-950/60"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{m.module.shortLabel}</span>
                    <span className="font-mono text-[11px] text-zinc-500">{m.module.rxCanId}</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">{m.module.originLabel}</div>
                  <div
                    className={`pt-1 text-xs font-semibold ${
                      isFault ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {isFault ? `🔴 Fault (${m.dtcCodes.join(", ")})` : "🟢 Pass (0 Faults)"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Freeze-Frame Snapshot Pill */}
          <div className="rounded-xl border border-white/[0.07] bg-zinc-950/70 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-zinc-400">Freeze-Frame ($02)</span>
            <span className="font-mono text-zinc-200">
              {freezeFrame.rpm} RPM • {freezeFrame.speedKmh} km/h • {freezeFrame.coolantTempC}°C •{" "}
              {freezeFrame.calculatedLoadPct}% Load • {freezeFrame.voltageV}V
            </span>
          </div>

          {report.dtcCards.length > 0 ? (
            <div className="space-y-2.5">
              {report.dtcCards.slice(0, 2).map((card) => (
                <div
                  key={card.id}
                  className="rounded-xl border border-rose-500/25 bg-rose-950/20 p-3.5 space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-rose-300">
                      {card.code} • {card.title}
                    </span>
                    <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-300">
                      {card.modeHexLabel}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{card.plainEnglish}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-emerald-300 font-medium">
                0 Trouble Codes Stored — MIL OFF
              </span>
              <div className="flex flex-wrap gap-1.5">
                {simulatorLockedReason ? (
                  <span className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] text-zinc-400">
                    🔒 {simulatorLockedReason}
                  </span>
                ) : onRollRandomFault ? (
                  <button
                    type="button"
                    onClick={onRollRandomFault}
                    className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1 font-semibold text-[11px] text-amber-200 hover:bg-amber-500/25 cursor-pointer"
                  >
                    🎲 Simulate Random Issue for {formatVehicleShortMakeModel(soul.yearMakeModel)}
                  </button>
                ) : (
                  soul.curses.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onCastCurse(c)}
                      className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] text-zinc-300 hover:border-rose-500/40 hover:text-rose-300 cursor-pointer"
                    >
                      Simulate {c.dtcCode}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="border-t border-white/[0.06] pt-3">
            <button
              type="button"
              onClick={() => setLookupOpen((v) => !v)}
              className="flex w-full items-center justify-between text-xs font-medium text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" />
                <span>Universal DTC Code Lookup (P / C / B / U)</span>
              </span>
              {lookupOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {lookupOpen && (
              <div className="mt-3 rounded-xl border border-white/[0.06] bg-zinc-950/70 p-3.5 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="text"
                    maxLength={5}
                    value={lookupInput}
                    onChange={(e) => setLookupInput(e.target.value.toUpperCase())}
                    className="w-24 rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1 text-center font-mono font-bold text-amber-300 outline-none focus:border-violet-400"
                  />
                  {QUICK_LOOKUP_CODES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setLookupInput(c)}
                      className="rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-300 hover:text-white cursor-pointer"
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="text-zinc-200 font-medium">
                  {lookupResult.code}: {lookupResult.title}
                </div>
                <p className="text-zinc-400 leading-relaxed">{lookupResult.plainEnglish}</p>
              </div>
            )}
          </div>
        </section>

        {/* Right Column (55%): Vertex AI Diagnosis + Mechanic Quote Checker Side-by-Side */}
        <div
          id="cockpit-stage-03"
          className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start"
        >
          {/* Card 1: Google Cloud Vertex AI Plain-English Diagnosis */}
          <section
            data-cinema-target="RIGHT_NECROMANCER"
            className="obsidian-panel rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-violet-400" />
                  <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                    Vertex AI Mechanic
                  </h2>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Plain-English root cause &amp; OEM part diagnosis.
                </p>
              </div>
              <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-0.5 font-mono text-[10px] font-medium text-violet-300 shrink-0">
                gemini-2.5-flash
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-zinc-950/70 px-3.5 py-2.5 text-xs">
              <span className="text-zinc-400">Trouble Code ({bitmask.hexPair}):</span>
              <input
                type="text"
                maxLength={5}
                value={activeDtc}
                onChange={(e) => onChangeCustomDtc(e.target.value.toUpperCase())}
                className="w-20 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-center font-mono text-xs font-bold text-amber-300 outline-none focus:border-violet-400"
              />
            </div>

            <button
              type="button"
              disabled={autopsyLoading}
              onClick={onRunAutopsy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-xs font-semibold text-white shadow-sm hover:bg-violet-400 disabled:opacity-50 transition cursor-pointer"
            >
              {autopsyLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span>Run Vertex AI Diagnosis</span>
            </button>

            {autopsyResult ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-violet-500/25 bg-zinc-950/70 p-4 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-violet-300">{autopsyResult.source}</span>
                  <span className="font-mono text-zinc-500">{autopsyResult.dtcBitmaskHex}</span>
                </div>
                <p className="text-zinc-300 leading-relaxed">{autopsyResult.rootCause}</p>
                <div className="rounded-xl border border-white/[0.06] bg-zinc-900/70 p-3 space-y-1.5">
                  <div className="font-semibold text-white">{autopsyResult.oemPartName}</div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>
                      OEM P/N:{" "}
                      <strong className="font-mono text-violet-300">
                        {autopsyResult.oemPartNumber}
                      </strong>
                    </span>
                    <span className="font-mono">{autopsyResult.laborHours} hrs</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-1.5">
                    <span className="text-zinc-400">Fair OEM Estimate</span>
                    <span className="font-mono text-sm font-semibold text-emerald-400">
                      ${autopsyResult.estimatedCostUsd.toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onApplyRecommendedUds}
                  className="flex w-full items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20 cursor-pointer"
                >
                  <span className="truncate font-mono">
                    UDS: {autopsyResult.recommendedUdsCommand}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                </button>
              </motion.div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-zinc-950/50 p-4 text-xs text-zinc-400 space-y-1.5">
                <div className="font-medium text-zinc-200">{fallbackCurse.oemPartName}</div>
                <p className="leading-relaxed">
                  Click &ldquo;Run Vertex AI Diagnosis&rdquo; to translate {activeDtc} into a plain-English root cause, OEM part spec, and fair labor breakdown.
                </p>
              </div>
            )}
          </section>

          {/* Card 2: Mechanic Quote Overcharge Checker */}
          <section
            data-cinema-target="RIGHT_QUOTE_CHECKER"
            className="obsidian-panel rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                    Mechanic Quote Checker
                  </h2>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Audit shop quotes against OEM book pricing.
                </p>
              </div>
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300 shrink-0">
                Fair ${quoteAudit.fairEstimateUsd.toLocaleString()}
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <label htmlFor="shop-quote-input">Shop / Dealer Quote ($ USD)</label>
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500">$</span>
                  <input
                    id="shop-quote-input"
                    type="number"
                    min={200}
                    max={10000}
                    step={10}
                    value={shopQuoteUsd}
                    onChange={(e) => updateShopQuote(Number(e.target.value))}
                    className="w-24 rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1 text-right font-mono text-xs font-semibold text-white outline-none focus:border-violet-400"
                  />
                </div>
              </div>

              <input
                type="range"
                min={300}
                max={4500}
                step={10}
                value={Math.min(4500, Math.max(300, shopQuoteUsd))}
                onChange={(e) => updateShopQuote(Number(e.target.value))}
                aria-label="Compare Shop Quote Slider"
                className="w-full accent-violet-400 cursor-pointer"
              />

              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {[
                  {
                    label: `Fair ($${quoteAudit.fairEstimateUsd})`,
                    val: quoteAudit.fairEstimateUsd,
                  },
                  {
                    label: `Indy ($${Math.round((quoteAudit.fairEstimateUsd * 1.06) / 10) * 10})`,
                    val: Math.round((quoteAudit.fairEstimateUsd * 1.06) / 10) * 10,
                  },
                  {
                    label: `Dealer ($${(
                      activeCurse?.dealerQuoteUsd ??
                      (quoteAudit.fairEstimateUsd === 1480
                        ? 2450
                        : quoteAudit.fairEstimateUsd === 1120
                        ? 2100
                        : quoteAudit.fairEstimateUsd === 420
                        ? 980
                        : Math.round((quoteAudit.fairEstimateUsd * 1.65) / 10) * 10)
                    ).toLocaleString()})`,
                    val:
                      activeCurse?.dealerQuoteUsd ??
                      (quoteAudit.fairEstimateUsd === 1480
                        ? 2450
                        : quoteAudit.fairEstimateUsd === 1120
                        ? 2100
                        : quoteAudit.fairEstimateUsd === 420
                        ? 980
                        : Math.round((quoteAudit.fairEstimateUsd * 1.65) / 10) * 10),
                  },
                ].map((preset, idx) => (
                  <button
                    key={`${preset.label}-${idx}`}
                    type="button"
                    onClick={() => {
                      playHexSound("CLICK");
                      updateShopQuote(preset.val);
                    }}
                    className="rounded-lg border border-white/[0.08] bg-zinc-950/70 px-2.5 py-1 text-zinc-300 hover:border-violet-400/40 hover:text-white cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className={`rounded-xl border px-3.5 py-3 text-xs font-semibold leading-snug ${
                quoteAudit.isOverpriced
                  ? "border-rose-500/35 bg-rose-500/10 text-rose-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {quoteAudit.badgeText}
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl border border-white/[0.06] bg-zinc-950/60 p-3">
                <div className="text-[11px] text-zinc-500">OEM Parts</div>
                <div className="mt-0.5 font-mono font-semibold text-white">
                  ${quoteAudit.oemPartsUsd.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-zinc-950/60 p-3">
                <div className="text-[11px] text-zinc-500">Book Labor</div>
                <div className="mt-0.5 font-mono font-semibold text-white">
                  {quoteAudit.bookLaborHours}h @ ${quoteAudit.bookHourlyRateUsd}/hr
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
