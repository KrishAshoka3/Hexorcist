"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  Binary,
  BrainCircuit,
  Car,
  Loader2,
  Lock,
  Sparkles,
  Unlock,
  X,
} from "lucide-react";
import { inspectDTCBitmask } from "@/lib/obd-hex-engine";
import type { DiagnoseResponsePayload } from "@/app/api/diagnose/route";

export interface EscrowLedgerEntry {
  id: string;
  transferId: string;
  timestamp: string;
  type: "COMMUTE_WITHHOLDING" | "MECHANIC_RELEASE";
  miles: number;
  rateCentsPerMile: number;
  amountCents: number;
  balanceAfterCents: number;
  note: string;
}

interface RightNecromancerVaultColumnProps {
  activeDtc: string;
  onChangeCustomDtc: (code: string) => void;
  autopsyLoading: boolean;
  autopsyResult: DiagnoseResponsePayload | null;
  onRunAutopsy: () => void;
  onApplyRecommendedUds: () => void;
  escrowBalanceCents: number;
  escrowRateCentsPerMile: number;
  anomalyScore: number;
  ledgerEntries: EscrowLedgerEntry[];
  onSimulateCommuteDeposit: () => void;
  onReleaseMechanicEscrow: (shopName: string, amountCents: number) => void;
}

export function RightNecromancerVaultColumn({
  activeDtc,
  onChangeCustomDtc,
  autopsyLoading,
  autopsyResult,
  onRunAutopsy,
  onApplyRecommendedUds,
  escrowBalanceCents,
  escrowRateCentsPerMile,
  anomalyScore,
  ledgerEntries,
  onSimulateCommuteDeposit,
  onReleaseMechanicEscrow,
}: RightNecromancerVaultColumnProps) {
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [shopName, setShopName] = useState("Stuttgart & Tsukuba Master Motorsport LLC");
  const [releaseUsdInput, setReleaseUsdInput] = useState("");

  let bitmask = inspectDTCBitmask("P17D8");
  try {
    bitmask = inspectDTCBitmask(activeDtc);
  } catch {
    bitmask = inspectDTCBitmask("P0300");
  }

  return (
    <aside className="flex flex-col gap-4">
      {/* SAE J2012 Bitmask Inspector & Vertex AI Necromancer */}
      <div className="rounded-xl border border-[#00E5FF]/30 bg-[#0A0D14]/90 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-[#00E5FF]" />
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Vertex AI Diagnostic Necromancer
            </h2>
          </div>
          <span className="rounded bg-[#00E5FF]/15 px-2 py-0.5 font-mono text-[10px] text-[#00E5FF]">
            gemini-2.5-flash
          </span>
        </div>

        {/* SAE J2012 16-Bit Bitmask Inspector */}
        <div className="rounded-lg border border-white/10 bg-[#05070B] p-2.5 font-mono text-[11px] space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <Binary className="h-3.5 w-3.5 text-[#FFB800]" />
              SAE J2012 2-BYTE DTC BITMASK
            </span>
            <input
              type="text"
              maxLength={5}
              value={activeDtc}
              onChange={(e) => onChangeCustomDtc(e.target.value.toUpperCase())}
              className="w-20 rounded border border-white/15 bg-black px-2 py-0.5 text-center font-mono text-xs font-bold text-[#FFB800] outline-none focus:border-[#00E5FF]"
            />
          </div>

          <div className="rounded bg-white/[0.04] px-2 py-1.5 text-center text-xs tracking-widest text-[#00FF9D]">
            {bitmask.binary16}{" "}
            <span className="text-[#00E5FF]">({bitmask.hexPair})</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-300">
            <div className="rounded bg-white/[0.03] p-1.5">
              <span className="text-slate-500">DOMAIN [{bitmask.domainBits}]:</span>{" "}
              <div className="truncate font-semibold text-white">{bitmask.domainLabel}</div>
            </div>
            <div className="rounded bg-white/[0.03] p-1.5">
              <span className="text-slate-500">TYPE [{bitmask.subTypeBits}]:</span>{" "}
              <div className="truncate font-semibold text-white">{bitmask.subTypeLabel}</div>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={autopsyLoading}
          onClick={onRunAutopsy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#00E5FF] to-[#00FF9D] px-4 py-2.5 font-mono text-xs font-bold text-[#06070A] shadow-lg transition hover:opacity-95 disabled:opacity-50 cursor-pointer"
        >
          {autopsyLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <span>RUN LIVE VERTEX AI AUTOPSY</span>
        </button>

        {autopsyResult && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-[#00FF9D]/35 bg-[#05080D] p-3 font-mono text-xs space-y-2"
          >
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#00FF9D] font-bold uppercase">
                {autopsyResult.source}
              </span>
              <span className="text-slate-500">{autopsyResult.dtcBitmaskHex}</span>
            </div>

            <p className="text-[11px] leading-relaxed text-slate-300">
              {autopsyResult.rootCause}
            </p>

            <div className="rounded border border-white/10 bg-white/[0.03] p-2 space-y-1 text-[11px]">
              <div className="text-white font-bold">{autopsyResult.oemPartName}</div>
              <div className="flex items-center justify-between text-slate-400">
                <span>OEM P/N: <strong className="text-[#00E5FF]">{autopsyResult.oemPartNumber}</strong></span>
                <span>{autopsyResult.laborHours} hrs</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-white/10">
                <span className="text-slate-400">EST. REPAIR QUOTE:</span>
                <span className="text-sm font-bold text-[#FFB800]">
                  ${autopsyResult.estimatedCostUsd.toLocaleString()}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onApplyRecommendedUds}
              className="flex w-full items-center justify-between rounded border border-[#FFB800]/40 bg-[#FFB800]/10 px-2.5 py-1.5 text-[11px] text-[#FFB800] hover:bg-[#FFB800]/20 cursor-pointer"
            >
              <span className="truncate">UDS: {autopsyResult.recommendedUdsCommand}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
            </button>
          </motion.div>
        )}
      </div>
      <div className="rounded-xl border border-[#00FF9D]/35 bg-[#0A0D14]/90 p-3.5 space-y-3 phosphor-glow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#00FF9D]" />
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Repair Escrow Sinking-Fund Vault
            </h2>
          </div>
          <span className="rounded bg-[#00FF9D]/15 px-2 py-0.5 font-mono text-[10px] text-[#00FF9D]">
            STRIPE SANDBOX
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-white/10 bg-[#05070B] p-3 font-mono">
          <div>
            <div className="text-[10px] text-slate-400">VAULT ESCROW BALANCE</div>
            <motion.div
              key={escrowBalanceCents}
              initial={{ scale: 1.06, color: "#00E5FF" }}
              animate={{ scale: 1, color: "#00FF9D" }}
              className="mt-0.5 text-2xl font-bold"
            >
              ${(escrowBalanceCents / 100).toFixed(2)}
            </motion.div>
          </div>

          <div className="border-l border-white/10 pl-3">
            <div className="text-[10px] text-slate-400">PER-MILE WITHHOLDING</div>
            <div
              className={`mt-0.5 text-xl font-bold ${
                escrowRateCentsPerMile >= 150 ? "text-[#FF1E42]" : "text-[#00E5FF]"
              }`}
            >
              ${(escrowRateCentsPerMile / 100).toFixed(2)}
              <span className="text-xs font-normal text-slate-400">/mi</span>
            </div>
            <div className="text-[10px] text-slate-500">
              Severity: {anomalyScore}/100
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSimulateCommuteDeposit}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[#00FF9D] px-3 py-2 font-mono text-xs font-bold text-[#06070A] hover:bg-[#00FF9D]/90 cursor-pointer"
          >
            <Car className="h-4 w-4" />
            <span>Simulate 25-Mi Commute</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setReleaseUsdInput(((escrowBalanceCents || 0) / 100).toFixed(2));
              setReleaseModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[#FFB800]/50 bg-[#FFB800]/15 px-3 py-2 font-mono text-xs font-bold text-[#FFB800] hover:bg-[#FFB800]/25 cursor-pointer"
          >
            <Unlock className="h-4 w-4" />
            <span>Release Mechanic Escrow</span>
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="font-mono text-[10px] uppercase text-slate-400">
            Immutable Stripe Sandbox Ledger
          </div>
          <div className="h-44 overflow-y-auto rounded-lg border border-white/10 bg-[#050608] p-2 font-mono text-[10px] space-y-1.5">
            {ledgerEntries.map((item) => (
              <div
                key={item.id}
                className="rounded border border-white/5 bg-white/[0.02] p-2 space-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[#00E5FF] font-bold">{item.transferId}</span>
                  <span
                    className={`font-bold ${
                      item.type === "COMMUTE_WITHHOLDING"
                        ? "text-[#00FF9D]"
                        : "text-[#FFB800]"
                    }`}
                  >
                    {item.type === "COMMUTE_WITHHOLDING" ? "+" : "-"}$
                    {(item.amountCents / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span className="truncate">{item.note}</span>
                  <span className="shrink-0">{item.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
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
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-xl border border-[#FFB800]/50 bg-[#0A0D14] p-5 font-mono shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-sm font-bold text-[#FFB800]">
                  RELEASE MECHANIC ESCROW PAYOUT
                </span>
                <button
                  type="button"
                  onClick={() => setReleaseModalOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    CERTIFIED REPAIR FACILITY
                  </label>
                  <input
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="w-full rounded border border-white/15 bg-black px-3 py-2 text-white outline-none focus:border-[#FFB800]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    SETTLEMENT AMOUNT USD (MAX ${(escrowBalanceCents / 100).toFixed(2)})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={(escrowBalanceCents / 100).toFixed(2)}
                    value={releaseUsdInput}
                    onChange={(e) => setReleaseUsdInput(e.target.value)}
                    className="w-full rounded border border-white/15 bg-black px-3 py-2 text-white outline-none focus:border-[#FFB800]"
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
                className="w-full rounded-lg bg-[#FFB800] py-2.5 text-xs font-bold text-[#06070A] hover:bg-[#FFB800]/90 cursor-pointer"
              >
                AUTHORIZE INSTANT MECHANIC SETTLEMENT
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
