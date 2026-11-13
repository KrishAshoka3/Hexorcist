"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Pause, Play, Sparkles, X } from "lucide-react";

export type JudgeTourStepNumber = 1 | 2 | 3 | 4 | 5;
export type JudgeTourPanelId =
  | "FAULT_HEX"
  | "OSCILLOSCOPE"
  | "VERTEX_AUTOPSY"
  | "ESCROW_VAULT"
  | "UDS_EXORCISM";

export interface JudgeTourStepMeta {
  step: JudgeTourStepNumber;
  badge: string;
  title: string;
  description: string;
  telemetryCallout: string;
  targetPanel: JudgeTourPanelId;
}

export const JUDGE_TOUR_STEPS: JudgeTourStepMeta[] = [
  {
    step: 1,
    badge: "STEP 1 OF 5 • FAULT INJECTION",
    title: "Cast Mechanical Fault (P0750 Solenoid / Sensor Drift)",
    description:
      "Injected DTC P0750 on the 7-Speed DSG (0B5) valve body. Watch live 25Hz CAN response frames on ID 0x7E8 mutate immediately as hydraulic pressure collapses from 8.45 Bar to 2.35 Bar.",
    telemetryCallout: "RX: 7E8 05 62 F4 0A 09 2E A1 (2.35 Bar — FAULT MUTATION)",
    targetPanel: "FAULT_HEX",
  },
  {
    step: 2,
    badge: "STEP 2 OF 5 • 60FPS WAVEFORM DIVERGENCE",
    title: "Dual-Trace Oscilloscope Target vs. Actual Divergence",
    description:
      "The cyan dashed trace holds ECU commanded setpoint (8.45 Bar) while the crimson live trace exposes severe solenoid pressure drift across the clutch pack.",
    telemetryCallout: "Target: 8.45 Bar vs. Actual: 2.35 Bar (-72% Drift)",
    targetPanel: "OSCILLOSCOPE",
  },
  {
    step: 3,
    badge: "STEP 3 OF 5 • VERTEX AI AUTOPSY",
    title: "Google Cloud Vertex AI Root-Cause & Repair Estimate",
    description:
      "Dispatched live CAN hex frame, VIN, and SAE J2012 bitmask to Gemini 2.5 Flash on Vertex AI to return root cause, OEM part specification, labor hours, and repair estimate.",
    telemetryCallout: "OEM Spec #0B5-398-009-F • Est. Repair Quote: $1,640 (5.5 hrs)",
    targetPanel: "VERTEX_AUTOPSY",
  },
  {
    step: 4,
    badge: "STEP 4 OF 5 • AUTONOMOUS FINTECH ESCROW",
    title: "Dynamic Per-Mile Withholding & 25-Mile Commute Deposit",
    description:
      "Anomaly severity (86/100) dynamically scaled per-mile withholding from $0.05/mi to $2.90/mi and deposited a 25-mile commute reserve into the Autonomous FinTech Escrow Sandbox Ledger.",
    telemetryCallout: "+25 mi Commute Deposit Credited to Repair Escrow Vault",
    targetPanel: "ESCROW_VAULT",
  },
  {
    step: 5,
    badge: "STEP 5 OF 5 • BIDIRECTIONAL UDS EXORCISM",
    title: "Execute UDS Hex Reset Routine (TX: 7E0 04 31 01 F4 0A)",
    description:
      "Transmitted bidirectional ISO 14229 RoutineControl frame TX: 7E0 04 31 01 F4 0A to recalibrate the solenoid valves, clear P0750, and restore 100% vehicle health ($0.05/mi).",
    telemetryCallout: "TX: 7E0 04 31 01 F4 0A -> RX: 7E8 04 71 01 F4 0A (100% HEALTH)",
    targetPanel: "UDS_EXORCISM",
  },
];

interface JudgeGuidedTourProps {
  activeStep: JudgeTourStepNumber | null;
  autoPlaying: boolean;
  stepProgressPct: number;
  onNextStep: () => void;
  onToggleAutoPlay: () => void;
  onSkipTour: () => void;
}

export function JudgeGuidedTour({
  activeStep,
  autoPlaying,
  stepProgressPct,
  onNextStep,
  onToggleAutoPlay,
  onSkipTour,
}: JudgeGuidedTourProps) {
  const stepMeta = activeStep
    ? JUDGE_TOUR_STEPS.find((s) => s.step === activeStep) ?? null
    : null;

  return (
    <AnimatePresence>
      {stepMeta && (
        <motion.div
          key={stepMeta.step}
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-md rounded-2xl border-2 border-[#00FF9D]/80 bg-[#070B12]/98 p-4 font-mono text-white shadow-[0_0_50px_rgba(0,255,157,0.3)] backdrop-blur-xl space-y-3"
        >
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-[#00E5FF] to-[#00FF9D] transition-all duration-150"
              style={{ width: `${Math.min(100, Math.max(4, stepProgressPct))}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#00FF9D]/15 px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#00FF9D]">
              <Sparkles className="h-3 w-3" />
              {stepMeta.badge}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleAutoPlay}
                className="flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:border-[#00E5FF]/50 hover:text-[#00E5FF] cursor-pointer"
              >
                {autoPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                <span>{autoPlaying ? "Auto 30s" : "Paused"}</span>
              </button>
              <button
                type="button"
                onClick={onSkipTour}
                className="flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:border-[#FF1E42]/60 hover:text-[#FF6B81] cursor-pointer"
              >
                <X className="h-3 w-3" />
                <span>Skip</span>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-white leading-snug">{stepMeta.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{stepMeta.description}</p>
          </div>

          <div className="rounded-lg border border-[#00E5FF]/35 bg-[#04070C] px-3 py-2 text-[11px] font-bold text-[#00E5FF]">
            {stepMeta.telemetryCallout}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n, idx) => (
                <span
                  key={`${n}-${idx}`}
                  className={`h-2 rounded-full transition-all ${
                    n === stepMeta.step
                      ? "w-6 bg-[#00FF9D]"
                      : n < stepMeta.step
                      ? "w-2 bg-[#00E5FF]"
                      : "w-2 bg-white/20"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={onNextStep}
              className="flex items-center gap-1.5 rounded-lg bg-[#00FF9D] px-3.5 py-2 text-xs font-bold text-[#06070A] shadow-[0_0_20px_rgba(0,255,157,0.28)] hover:bg-[#00FF9D]/90 cursor-pointer"
            >
              {stepMeta.step === 5 ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Finish Demo</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
