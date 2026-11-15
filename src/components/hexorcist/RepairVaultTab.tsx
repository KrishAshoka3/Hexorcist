"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Car,
  FileText,
  Lock,
  Scale,
  ShieldCheck,
  Unlock,
  X,
} from "lucide-react";
import {
  MechanicalCursePreset,
  VehicleSoulPreset,
} from "@/lib/obd-hex-engine";
import { lookupUniversalDtc } from "@/lib/obd-scanner-qol";
import { validateUdsResponse, validateWorkOrder } from "@/lib/work-order-validator";
import type { DiagnoseResponsePayload } from "@/app/api/diagnose/route";
import type { EscrowLedgerEntry } from "./RightNecromancerVaultColumn";
import { playHexSound } from "@/lib/sound-fx";

export interface RepairVaultTabProps {
  soul: VehicleSoulPreset;
  vin: string;
  activeCurse: MechanicalCursePreset | null;
  activeDtc: string;
  autopsyResult: DiagnoseResponsePayload | null;
  escrowBalanceCents: number;
  escrowRateCentsPerMile: number;
  anomalyScore: number;
  ledgerEntries: EscrowLedgerEntry[];
  onSimulateCommuteDeposit: () => void;
  onReleaseMechanicEscrow: (shopName: string, amountCents: number) => void;
  onOpenMechanicSpecSheet: () => void;
}

export function RepairVaultTab({
  soul,
  vin,
  activeCurse,
  activeDtc,
  autopsyResult,
  escrowBalanceCents,
  escrowRateCentsPerMile,
  anomalyScore,
  ledgerEntries,
  onSimulateCommuteDeposit,
  onReleaseMechanicEscrow,
  onOpenMechanicSpecSheet,
}: RepairVaultTabProps) {
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [shopName, setShopName] = useState("Certified Autonomous Drivetrain Lab LLC");
  const [releaseUsdInput, setReleaseUsdInput] = useState("");

  const fallbackCurse = activeCurse ?? soul.curses[0];
  const fairGoalUsd =
    autopsyResult?.estimatedCostUsd ?? fallbackCurse.estimatedCostUsd ?? 1480;
  const fairGoalCents = Math.max(100, fairGoalUsd * 100);
  const fundedPct = Math.min(100, Math.max(0, Math.round((escrowBalanceCents / fairGoalCents) * 100)));

  // Double-entry accounting equation: Assets = Liabilities + Equity (cent-exact)
  const assetsCents = escrowBalanceCents;
  const liabilitiesCents = activeCurse ? Math.min(assetsCents, fairGoalCents) : 0;
  const equityCents = assetsCents - liabilitiesCents;

  const lookup = lookupUniversalDtc(activeCurse?.dtcCode ?? activeDtc);
  const workOrderCheck = validateWorkOrder({
    vin,
    dtcCode: lookup.code,
    faultDescription:
      autopsyResult?.rootCause ?? fallbackCurse.mechanicalExplanation,
    oemPartsCostUsd: Math.round(fairGoalUsd * 0.35),
    laborHours: autopsyResult?.laborHours ?? fallbackCurse.laborHours,
    laborRateUsd: 163,
  });
  const udsCheck = validateUdsResponse(0x22, [0x62, 0xf4, 0x0a, 0x09, 0x2e]);
  const isKiroVerified = workOrderCheck.valid && udsCheck.valid;

  const ringRadius = 56;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - fundedPct / 100);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-6 items-start">
        {/* Left Column (55%): Autonomous Save-Per-Mile Escrow Vault */}
        <section
          data-cinema-target="RIGHT_ESCROW_VAULT"
          className="obsidian-panel rounded-2xl p-6 space-y-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                  Autonomous Save-Per-Mile Escrow Vault
                </h2>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Automatically scales per-mile withholding when wear or faults are detected.
              </p>
            </div>

            <span
              className={`rounded-full border px-3 py-1 font-mono text-xs font-semibold ${
                escrowRateCentsPerMile >= 120
                  ? "border-amber-500/35 bg-amber-500/10 text-amber-300"
                  : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              ${(escrowRateCentsPerMile / 100).toFixed(2)} / mile
            </span>
          </div>

          {/* Big Progress Ring + Saved Toward Repair Summary */}
          <div className="flex flex-col sm:flex-row items-center gap-6 rounded-2xl border border-white/[0.07] bg-zinc-950/60 p-6">
            <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
              <svg className="h-36 w-36 -rotate-90" viewBox="0 0 136 136">
                <circle
                  cx="68"
                  cy="68"
                  r={ringRadius}
                  fill="none"
                  stroke="rgba(255,255,255,0.07)"
                  strokeWidth="10"
                />
                <circle
                  cx="68"
                  cy="68"
                  r={ringRadius}
                  fill="none"
                  stroke={activeCurse ? "#f59e0b" : "#10b981"}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-2xl font-semibold text-white">
                  {fundedPct}%
                </span>
                <span className="text-[11px] text-zinc-400">Funded</span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-3">
              <div>
                <div className="text-xs font-medium text-zinc-400">Saved Toward Repair</div>
                <motion.div
                  key={escrowBalanceCents}
                  initial={{ scale: 1.04 }}
                  animate={{ scale: 1 }}
                  className="mt-1 flex items-baseline gap-2"
                >
                  <span className="font-mono text-3xl font-semibold tracking-tight text-white">
                    ${(escrowBalanceCents / 100).toFixed(2)}
                  </span>
                  <span className="text-xs text-zinc-400">
                    of ${fairGoalUsd.toLocaleString()} fair OEM target
                  </span>
                </motion.div>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full transition-all duration-500 ${
                    activeCurse ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                  style={{ width: `${Math.max(4, fundedPct)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Vehicle: {soul.yearMakeModel}</span>
                <span>Severity {anomalyScore}/100</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onSimulateCommuteDeposit}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-semibold text-zinc-950 shadow-sm hover:bg-emerald-400 transition cursor-pointer"
            >
              <Car className="h-4 w-4" />
              <span>Simulate 25-Mile Commute</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playHexSound("CLICK");
                setReleaseUsdInput(((escrowBalanceCents || 0) / 100).toFixed(2));
                setReleaseModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
            >
              <Unlock className="h-4 w-4" />
              <span>Release Mechanic Escrow</span>
            </button>
          </div>
        </section>

        {/* Right Column (45%): Double-Entry Escrow Ledger & Printable Mechanic Work Order */}
        <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-6 shadow-xl space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                  Double-Entry Escrow Ledger
                </h2>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Cent-exact invariant: Assets = Liabilities + Equity
              </p>
            </div>
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-emerald-300">
              Balanced
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <div className="rounded-xl border border-white/[0.07] bg-zinc-950/60 p-3">
              <div className="text-[11px] text-zinc-400">Assets</div>
              <div className="mt-1 font-mono text-base font-semibold text-white">
                ${(assetsCents / 100).toFixed(2)}
              </div>
              <div className="text-[10px] text-zinc-500">Custodial Cash</div>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-zinc-950/60 p-3">
              <div className="text-[11px] text-zinc-400">Liabilities</div>
              <div className="mt-1 font-mono text-base font-semibold text-amber-300">
                ${(liabilitiesCents / 100).toFixed(2)}
              </div>
              <div className="text-[10px] text-zinc-500">Repair Reserve</div>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-zinc-950/60 p-3">
              <div className="text-[11px] text-zinc-400">Equity</div>
              <div className="mt-1 font-mono text-base font-semibold text-emerald-400">
                ${(equityCents / 100).toFixed(2)}
              </div>
              <div className="text-[10px] text-zinc-500">Driver Buffer</div>
            </div>
          </div>

          <div className="max-h-40 overflow-y-auto rounded-xl border border-white/[0.06] bg-zinc-950/70 p-3 space-y-2 text-xs">
            {ledgerEntries.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                className="flex items-center justify-between gap-2 border-b border-white/[0.05] pb-2 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-zinc-300 truncate">{item.note}</div>
                  <div className="font-mono text-[10px] text-zinc-500">
                    {item.transferId} • {item.timestamp}
                  </div>
                </div>
                <span
                  className={`font-mono font-semibold shrink-0 ${
                    item.type === "COMMUTE_WITHHOLDING" ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {item.type === "COMMUTE_WITHHOLDING" ? "+" : "-"}$
                  {(item.amountCents / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                {isKiroVerified
                  ? "✅ Verified by Kiro Work-Order Validator"
                  : "Kiro Work-Order Ready"}
              </span>
              <span className="text-[11px] text-zinc-500">Skip $200 diag fee</span>
            </div>

            <button
              type="button"
              data-cinema-target="OPEN_SPEC_SHEET_BTN"
              onClick={() => {
                playHexSound("CLICK");
                onOpenMechanicSpecSheet();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/35 bg-violet-500/15 px-4 py-3 text-xs font-semibold text-violet-200 hover:bg-violet-500/25 transition cursor-pointer"
            >
              <FileText className="h-4 w-4 text-violet-300" />
              <span>Open Printable Mechanic Work Order</span>
            </button>
          </div>
        </section>
      </div>
      <AnimatePresence>
        {releaseModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                <span className="text-sm font-semibold text-white">
                  Release Mechanic Escrow Payout
                </span>
                <button
                  type="button"
                  onClick={() => setReleaseModalOpen(false)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1">Repair Facility</label>
                  <input
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">
                    Amount USD (Max ${(escrowBalanceCents / 100).toFixed(2)})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={(escrowBalanceCents / 100).toFixed(2)}
                    value={releaseUsdInput}
                    onChange={(e) => setReleaseUsdInput(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-white outline-none focus:border-amber-400"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const cents = Math.min(
                    escrowBalanceCents,
                    Math.max(0, Math.round((parseFloat(releaseUsdInput) || 0) * 100))
                  );
                  if (cents > 0) {
                    onReleaseMechanicEscrow(shopName, cents);
                    setReleaseModalOpen(false);
                  }
                }}
                className="w-full rounded-xl bg-amber-400 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-300 cursor-pointer"
              >
                Authorize Mechanic Settlement
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

