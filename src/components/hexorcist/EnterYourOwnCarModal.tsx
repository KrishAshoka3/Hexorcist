"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, Search, Sparkles, X } from "lucide-react";
import {
  EXAMPLE_USER_CARS,
  SYMPTOM_PICKER_OPTIONS,
  UserCustomCarConfig,
  UserPowertrainType,
  UserSymptomOption,
  UserTransmissionType,
} from "@/lib/custom-car-and-sliders";
import { playHexSound } from "@/lib/sound-fx";

export interface EnterYourOwnCarModalProps {
  open: boolean;
  onClose: () => void;
  initialConfig?: UserCustomCarConfig | null;
  onSaveCustomCar: (config: UserCustomCarConfig) => void;
}

const POWERTRAIN_OPTIONS: readonly UserPowertrainType[] = [
  "Standard Gas",
  "Turbo / Supercharged",
  "Hybrid",
  "Full Electric (EV)",
];

const TRANSMISSION_OPTIONS: readonly UserTransmissionType[] = [
  "Standard Automatic",
  "Dual-Clutch (DSG / DCT)",
  "Manual",
  "CVT",
  "EV Single-Speed",
];

const QUICK_OBD_CODES = ["P0420", "P0300", "P0750", "P0171"] as const;

export function EnterYourOwnCarModal({
  open,
  onClose,
  initialConfig,
  onSaveCustomCar,
}: EnterYourOwnCarModalProps) {
  const [yearMakeModel, setYearMakeModel] = useState<string>(
    initialConfig?.yearMakeModel ?? "2019 BMW M340i"
  );
  const [powertrainType, setPowertrainType] = useState<UserPowertrainType>(
    initialConfig?.powertrainType ?? "Turbo / Supercharged"
  );
  const [transmissionType, setTransmissionType] = useState<UserTransmissionType>(
    initialConfig?.transmissionType ?? "Standard Automatic"
  );
  const [symptomOption, setSymptomOption] = useState<UserSymptomOption>(
    initialConfig?.symptomOption ?? "CHECK_ENGINE_LIGHT"
  );
  const [customObdCode, setCustomObdCode] = useState<string>(
    initialConfig?.customObdCode ?? ""
  );
  const [vinInput, setVinInput] = useState<string>(initialConfig?.vin ?? "");
  const [vinLookupLoading, setVinLookupLoading] = useState(false);
  const [vinLookupMsg, setVinLookupMsg] = useState<string | null>(null);

  const handleNhtsaAutofill = async () => {
    const cleanVin = vinInput.trim().toUpperCase();
    if (cleanVin.length !== 17) {
      setVinLookupMsg("Optional: Enter a 17-character VIN, or leave blank (No VIN Needed!).");
      return;
    }
    playHexSound("CLICK");
    setVinLookupLoading(true);
    setVinLookupMsg(null);
    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(
          cleanVin
        )}?format=json`
      );
      const data = await res.json();
      const row = data?.Results?.[0];
      if (row && (row.Make || row.Model)) {
        const ymm = [row.ModelYear, row.Make, row.Model].filter(Boolean).join(" ").trim();
        if (ymm) setYearMakeModel(ymm);
        const fuel = String(row.FuelTypePrimary || "").toLowerCase();
        const turbo = String(row.Turbo || row.OtherEngineInfo || "").toLowerCase();
        if (fuel.includes("electric") && !fuel.includes("hybrid")) {
          setPowertrainType("Full Electric (EV)");
          setTransmissionType("EV Single-Speed");
        } else if (fuel.includes("hybrid")) {
          setPowertrainType("Hybrid");
        } else if (turbo.includes("yes") || turbo.includes("turbo") || turbo.includes("super")) {
          setPowertrainType("Turbo / Supercharged");
        } else {
          setPowertrainType("Standard Gas");
        }
        setVinLookupMsg(`✅ NHTSA Factory Spec Loaded: ${ymm || cleanVin}`);
      } else {
        setVinLookupMsg("VIN accepted — ready to calibrate your vehicle.");
      }
    } catch {
      setVinLookupMsg("Offline VIN synthesis ready — click Save to load your car.");
    } finally {
      setVinLookupLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            data-cinema-target="OWN_CAR_MODAL_CARD"
            initial={{ scale: 0.97, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl border border-white/[0.1] bg-zinc-900 p-6 text-zinc-100 shadow-2xl space-y-5 my-auto"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] pb-4">
              <div>
                <div className="flex items-center gap-2 text-base font-semibold tracking-tight text-white">
                  <span>🚗 Enter Your Own Car</span>
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                    No VIN Required
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  Enter any Year, Make &amp; Model to calibrate live gauges, OBD-II modules, and fair OEM repair pricing.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/[0.08] bg-zinc-800/60 p-2 text-zinc-400 hover:text-white cursor-pointer"
                aria-label="Close Enter Your Own Car Modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 1. Year, Make & Model */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-300">
                1. Year, Make &amp; Model
              </label>
              <input
                type="text"
                value={yearMakeModel}
                onChange={(e) => setYearMakeModel(e.target.value)}
                placeholder="e.g., 2019 BMW M340i, 2021 Subaru WRX, 2018 Ford F-150, 2022 Toyota RAV4"
                className="w-full rounded-xl border border-white/[0.08] bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] text-zinc-500">Examples:</span>
                {EXAMPLE_USER_CARS.map((ex, idx) => (
                  <button
                    key={`${ex.label}-${idx}`}
                    type="button"
                    onClick={() => {
                      playHexSound("CLICK");
                      setYearMakeModel(ex.yearMakeModel);
                      setPowertrainType(ex.powertrainType);
                      setTransmissionType(ex.transmissionType);
                      setSymptomOption(ex.symptomOption);
                      setCustomObdCode("");
                    }}
                    className="rounded-lg border border-white/[0.08] bg-zinc-800/50 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-300 cursor-pointer"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2 & 3. Powertrain & Transmission */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-300">
                  2. Powertrain
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {POWERTRAIN_OPTIONS.map((opt) => {
                    const active = powertrainType === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          playHexSound("CLICK");
                          setPowertrainType(opt);
                          if (opt === "Full Electric (EV)") {
                            setTransmissionType("EV Single-Speed");
                          }
                        }}
                        className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition cursor-pointer ${
                          active
                            ? "border-emerald-500/45 bg-emerald-500/10 text-emerald-300"
                            : "border-white/[0.07] bg-zinc-950 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-300">
                  3. Transmission
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TRANSMISSION_OPTIONS.map((opt) => {
                    const active = transmissionType === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          playHexSound("CLICK");
                          setTransmissionType(opt);
                        }}
                        className={`rounded-xl border px-3 py-2 text-left text-[11px] font-medium transition cursor-pointer ${
                          active
                            ? "border-violet-500/45 bg-violet-500/10 text-violet-300"
                            : "border-white/[0.07] bg-zinc-950 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. What Problem / Code Are You Having? (Optional) */}
            <div className="space-y-2.5 rounded-xl border border-white/[0.07] bg-zinc-950/70 p-4">
              <label className="block text-xs font-medium text-zinc-300">
                4. Symptom or Trouble Code (Optional)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SYMPTOM_PICKER_OPTIONS.map((sym) => {
                  const selected = symptomOption === sym.id && !customObdCode.trim();
                  return (
                    <button
                      key={sym.id}
                      type="button"
                      onClick={() => {
                        playHexSound("CLICK");
                        setSymptomOption(sym.id);
                        setCustomObdCode("");
                      }}
                      className={`flex flex-col items-start rounded-xl border px-3 py-2 text-left transition cursor-pointer ${
                        selected
                          ? "border-amber-500/45 bg-amber-500/10 text-amber-200"
                          : "border-white/[0.06] bg-zinc-900/60 text-zinc-300 hover:border-white/15"
                      }`}
                    >
                      <span className="text-xs font-medium">{sym.label}</span>
                      <span className="text-[10px] text-zinc-500">{sym.helper}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-zinc-400">
                  Or type OBD-II code:
                </span>
                <input
                  type="text"
                  maxLength={5}
                  value={customObdCode}
                  onChange={(e) => setCustomObdCode(e.target.value.toUpperCase())}
                  placeholder="P0420"
                  className="w-24 rounded-lg border border-white/[0.1] bg-zinc-900 px-2.5 py-1 text-center font-mono text-xs font-semibold uppercase text-amber-300 outline-none focus:border-emerald-500/50"
                />
                {QUICK_OBD_CODES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      playHexSound("CLICK");
                      setCustomObdCode(code);
                    }}
                    className="rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-0.5 font-mono text-[11px] text-zinc-300 hover:border-amber-500/40 hover:text-amber-300 cursor-pointer"
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Optional 17-Digit VIN Lookup (No VIN Needed!) */}
            <div className="rounded-xl border border-white/[0.07] bg-zinc-950/70 p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                <span className="font-medium text-zinc-300">
                  Optional: 17-Digit VIN Auto-Fill (US DOT NHTSA)
                </span>
                <span className="text-[11px] text-zinc-500">Leave blank if unknown</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  maxLength={17}
                  value={vinInput}
                  onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                  placeholder="Optional 17-digit VIN (e.g. WAUDGAFL5EA049218)"
                  className="flex-1 rounded-xl border border-white/[0.08] bg-zinc-900 px-3 py-2 font-mono text-xs uppercase text-white outline-none focus:border-violet-500/50"
                />
                <button
                  type="button"
                  disabled={vinLookupLoading}
                  onClick={() => void handleNhtsaAutofill()}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-violet-500/35 bg-violet-500/10 px-3.5 py-2 text-xs font-medium text-violet-300 hover:bg-violet-500/20 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {vinLookupLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                  <span>Lookup VIN</span>
                </button>
              </div>
              {vinLookupMsg && (
                <div className="text-xs text-emerald-400">{vinLookupMsg}</div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Saved locally &amp; calibrates all workspaces</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/[0.08] bg-zinc-800/60 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playHexSound("EXORCISM_CHIME");
                    onSaveCustomCar({
                      yearMakeModel: yearMakeModel.trim() || "2019 BMW M340i",
                      powertrainType,
                      transmissionType,
                      symptomOption,
                      customObdCode: customObdCode.trim().toUpperCase(),
                      vin: vinInput.trim().toUpperCase() || undefined,
                    });
                    onClose();
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 shadow-sm hover:bg-emerald-400 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Load My Car</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
