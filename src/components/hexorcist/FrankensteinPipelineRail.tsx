"use client";

import React from "react";
import { LayoutGrid, Layers, Sparkles } from "lucide-react";
import {
  FRANKENSTEIN_PIPELINE_STAGES,
  FrankensteinStageId,
  FrankensteinStageSpec,
  WorkspaceTabId,
} from "@/lib/custom-car-and-sliders";
import type { HeaderHealthStatus } from "./TopCommandBar";
import { playHexSound } from "@/lib/sound-fx";

export interface FrankensteinPipelineRailProps {
  activeStageId: FrankensteinStageId;
  activeWorkspaceTab: WorkspaceTabId;
  bentoCockpitView: boolean;
  onToggleBentoCockpitView: () => void;
  onSelectPipelineStage: (stage: FrankensteinStageSpec) => void;
  onSelectEngineerPro: () => void;
  healthStatus: HeaderHealthStatus;
  connectionLabel: string;
  activeDtcLabel: string;
  fairPriceUsd: number;
  escrowBalanceCents: number;
}

export function FrankensteinPipelineRail({
  activeStageId,
  activeWorkspaceTab,
  bentoCockpitView,
  onToggleBentoCockpitView,
  onSelectPipelineStage,
  onSelectEngineerPro,
  healthStatus,
  connectionLabel,
  activeDtcLabel,
  fairPriceUsd,
  escrowBalanceCents,
}: FrankensteinPipelineRailProps) {
  const traceColor =
    healthStatus === "FAULT"
      ? "#f43f5e"
      : healthStatus === "CAUTION"
      ? "#f59e0b"
      : "#10b981";

  const getStageLiveMetric = (id: FrankensteinStageId): string => {
    switch (id) {
      case "STAGE_01_INGEST":
        return connectionLabel;
      case "STAGE_02_XRAY":
        return healthStatus === "FAULT"
          ? `FAULT • ${activeDtcLabel}`
          : healthStatus === "CAUTION"
          ? "CAUTION • WEAR DRIFT"
          : "4/4 ECUs • PASS";
      case "STAGE_03_VERTEX_AI":
        return `OEM Fair $${fairPriceUsd.toLocaleString()}`;
      case "STAGE_04_ESCROW_KIRO":
        return `Vault $${(escrowBalanceCents / 100).toFixed(2)} • Kiro ✅`;
    }
  };

  return (
    <div
      data-cinema-target="FRANKENSTEIN_PIPELINE"
      className="border-b border-white/[0.07] bg-[#07090f]/90 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                backgroundColor: traceColor,
                boxShadow: `0 0 10px ${traceColor}`,
              }}
            />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              FRANKENSTEIN CHIMERA NEURAL PIPELINE // LIVE TELEMETRY STITCHES
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playHexSound("CLICK");
                onSelectEngineerPro();
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                !bentoCockpitView && activeWorkspaceTab === "ENGINEER_KIRO"
                  ? "border-cyan-400/45 bg-cyan-500/15 text-cyan-200"
                  : "border-white/[0.08] bg-zinc-900/70 text-zinc-300 hover:border-white/[0.18] hover:text-white"
              }`}
            >
              <Sparkles className="h-3 w-3 text-cyan-400" />
              <span>🔬 Engineer Pro (CAN / DBC / Dyno / Kiro PBTs)</span>
            </button>

            <button
              type="button"
              data-cinema-target="BENTO_VIEW_TOGGLE"
              onClick={() => {
                playHexSound("CLICK");
                onToggleBentoCockpitView();
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-[11px] font-semibold transition cursor-pointer ${
                bentoCockpitView
                  ? "border-emerald-500/45 bg-emerald-500/15 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.18)]"
                  : "border-white/[0.1] bg-zinc-900/80 text-zinc-200 hover:border-white/[0.2] hover:text-white"
              }`}
            >
              {bentoCockpitView ? (
                <>
                  <LayoutGrid className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Bento Cockpit View: ON</span>
                </>
              ) : (
                <>
                  <Layers className="h-3.5 w-3.5 text-violet-400" />
                  <span>Toggle Bento Cockpit View</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="relative">
          <svg
            viewBox="0 0 1200 28"
            preserveAspectRatio="none"
            className="pointer-events-none hidden lg:block absolute inset-x-6 top-1/2 -translate-y-1/2 h-7 w-[calc(100%-3rem)] z-0"
            aria-hidden="true"
          >
            <line
              x1="40"
              y1="14"
              x2="1160"
              y2="14"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="2"
            />
            <line
              x1="40"
              y1="14"
              x2="1160"
              y2="14"
              stroke={traceColor}
              strokeWidth="2.2"
              className="animate-chimera-stitch"
            />
          </svg>

          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {FRANKENSTEIN_PIPELINE_STAGES.map((stage) => {
              const isActive = bentoCockpitView
                ? true
                : activeStageId === stage.id ||
                  (activeWorkspaceTab === "ENGINEER_KIRO" &&
                    stage.id === "STAGE_04_ESCROW_KIRO");
              const isFaultStage =
                healthStatus === "FAULT" &&
                (stage.id === "STAGE_02_XRAY" || stage.id === "STAGE_03_VERTEX_AI");

              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => {
                    playHexSound("CLICK");
                    onSelectPipelineStage(stage);
                  }}
                  className={`group relative flex flex-col justify-between rounded-xl border px-3.5 py-2.5 text-left transition cursor-pointer ${
                    isActive
                      ? isFaultStage
                        ? "border-rose-500/45 bg-[#140a10]/95 shadow-[inset_0_1px_0_0_rgba(244,63,94,0.22),0_0_20px_rgba(244,63,94,0.12)]"
                        : "border-emerald-500/40 bg-[#0c1317]/95 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.22),0_0_18px_rgba(16,185,129,0.1)]"
                      : "border-white/[0.08] bg-[#0a0c12]/90 hover:border-white/[0.18] hover:bg-[#0f131d]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold tracking-tight text-white">
                      {stage.icon} {stage.title}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        isFaultStage
                          ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                          : isActive
                          ? "bg-emerald-400 shadow-[0_0_8px_#10b981]"
                          : "bg-zinc-600 group-hover:bg-zinc-400"
                      }`}
                    />
                  </div>
                  <p className="mt-1 text-[10px] leading-snug text-zinc-400 line-clamp-1">
                    {stage.subtitle}
                  </p>
                  <div className="mt-1.5 font-mono text-[10px] font-semibold tabular-nums text-emerald-300/90">
                    {getStageLiveMetric(stage.id)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

