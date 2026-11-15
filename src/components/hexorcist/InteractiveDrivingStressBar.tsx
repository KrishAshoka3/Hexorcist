"use client";

import React from "react";
import { RotateCcw } from "lucide-react";
import { DrivingStressSlidersState } from "@/lib/custom-car-and-sliders";
import { playHexSound } from "@/lib/sound-fx";

export interface InteractiveDrivingStressBarProps {
  sliders: DrivingStressSlidersState;
  onChangeSliders: (next: DrivingStressSlidersState) => void;
  onResetSliders?: () => void;
  escrowRateCentsPerMile: number;
  warnings: string[];
}

export function InteractiveDrivingStressBar({
  sliders,
  onChangeSliders,
  onResetSliders,
  escrowRateCentsPerMile,
  warnings,
}: InteractiveDrivingStressBarProps) {
  return (
    <div
      data-cinema-target="DRIVING_STRESS_SLIDERS"
      className="obsidian-panel rounded-2xl p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-white">
            🎛️ Live Driving Stress &amp; Wear Simulator
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Drag Driving Load, Thermal Stress, or Part Wear to watch the SVG X-Ray Chassis &amp; 60fps Heart Monitor react in real time.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={`rounded-full border px-3 py-1 font-mono text-xs font-medium tabular-nums transition ${
              escrowRateCentsPerMile >= 120
                ? "border-rose-500/35 bg-rose-500/12 text-rose-300"
                : escrowRateCentsPerMile > 15
                ? "border-amber-500/35 bg-amber-500/12 text-amber-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            Auto-Save ${(escrowRateCentsPerMile / 100).toFixed(2)}/mi
          </span>

          {onResetSliders && (
            <button
              type="button"
              onClick={() => {
                playHexSound("CLICK");
                onResetSliders();
              }}
              className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-white/[0.18] hover:text-white transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Driving Load Slider */}
        <div className="obsidian-subcard rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-zinc-200">Driving Load RPM</span>
            <span
              className={`font-mono font-semibold tabular-nums ${
                sliders.drivingLoadRpm >= 5400 ? "text-amber-400" : "text-zinc-100"
              }`}
            >
              {sliders.drivingLoadRpm.toLocaleString()} RPM
            </span>
          </div>
          <input
            type="range"
            min={800}
            max={6800}
            step={50}
            value={sliders.drivingLoadRpm}
            onChange={(e) =>
              onChangeSliders({
                ...sliders,
                drivingLoadRpm: Number(e.target.value),
              })
            }
            aria-label="Driving Load (Cruising vs. Steep Hill / Hard Acceleration)"
            className="w-full accent-indigo-400 cursor-pointer"
          />
          <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
            <span>Cruise (800)</span>
            <span>Hard Pull (6,800)</span>
          </div>
        </div>

        {/* 2. Thermal Stress Slider */}
        <div className="obsidian-subcard rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-zinc-200">Thermal Stress °C</span>
            <span
              className={`font-mono font-semibold tabular-nums ${
                sliders.heatTempC >= 109 ? "text-rose-400" : "text-zinc-100"
              }`}
            >
              {sliders.heatTempC}°C ({Math.round((sliders.heatTempC * 9) / 5 + 32)}°F)
            </span>
          </div>
          <input
            type="range"
            min={75}
            max={135}
            step={1}
            value={sliders.heatTempC}
            onChange={(e) =>
              onChangeSliders({
                ...sliders,
                heatTempC: Number(e.target.value),
              })
            }
            aria-label="Engine & Transmission Heat (Normal vs. Overheating)"
            className="w-full accent-amber-400 cursor-pointer"
          />
          <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
            <span>Normal (75°C)</span>
            <span>Overheat (135°C)</span>
          </div>
        </div>

        {/* 3. Part Wear Slider */}
        <div
          data-cinema-target="PART_WEAR_SLIDER"
          className={`rounded-xl border p-4 space-y-2.5 transition ${
            sliders.partWearPct >= 65
              ? "border-rose-500/35 bg-rose-950/25"
              : sliders.partWearPct >= 35
              ? "border-amber-500/30 bg-amber-950/20"
              : "border-white/[0.06] bg-zinc-950/60"
          }`}
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-zinc-200">Part Wear</span>
            <span
              className={`font-mono font-semibold ${
                sliders.partWearPct >= 65
                  ? "text-rose-400"
                  : sliders.partWearPct >= 35
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {sliders.partWearPct}% Wear
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={2}
            value={sliders.partWearPct}
            onChange={(e) =>
              onChangeSliders({
                ...sliders,
                partWearPct: Number(e.target.value),
              })
            }
            aria-label="Part Wear & Tear Simulator (Brand New vs. Failing Part)"
            className="w-full accent-rose-500 cursor-pointer"
          />
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>New (0%)</span>
            <span>Failing (100%)</span>
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-2.5 text-xs text-amber-200 space-y-1">
          {warnings.map((warn, idx) => (
            <div key={`${warn}-${idx}`} className="font-medium">
              {warn}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
