import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  DEFAULT_DRIVING_SLIDERS,
  EXAMPLE_USER_CARS,
  FRANKENSTEIN_PIPELINE_STAGES,
  REAL_WORLD_VEHICLE_PRESETS,
  WORKSPACE_TABS,
  buildUserCustomCarBundle,
  evaluateDrivingStressSliders,
  getWorkspaceTabForScene,
  synthesizeValidIsoVin,
} from "./custom-car-and-sliders";
import { calculateEscrowRateCents } from "./obd-hex-engine";
import { validateUdsResponse, validateVin, validateWorkOrder } from "./work-order-validator";
import {
  isCombustionFaultDtc,
  isMultiGearOrAutoTransFaultDtc,
  rollRandomVehicleFault,
} from "./vehicle-fault-generator";

describe("HEXORCIST Phase 8 — Custom Car Builder, 3 Quick Presets, Stress Sliders, Chimera Pipeline & Kiro Validator", () => {
  it("Validates all 3 One-Click Real-World Vehicle Presets & Kiro Work-Order compliance", () => {
    expect(REAL_WORLD_VEHICLE_PRESETS).toHaveLength(3);

    const [v6Preset, evPreset, commuterPreset] = REAL_WORLD_VEHICLE_PRESETS;
    expect(v6Preset.fairCostUsd).toBe(1480);
    expect(v6Preset.dealerQuoteUsd).toBe(2450);
    expect(v6Preset.faultPairLabel).toBe("P0750 / P17D8");

    expect(evPreset.fairCostUsd).toBe(1120);
    expect(evPreset.dealerQuoteUsd).toBe(2100);
    expect(evPreset.faultPairLabel).toBe("U0100 / P0AA6");

    expect(commuterPreset.fairCostUsd).toBe(420);
    expect(commuterPreset.dealerQuoteUsd).toBe(980);
    expect(commuterPreset.faultPairLabel).toBe("P0171 / P0420");

    for (const preset of REAL_WORLD_VEHICLE_PRESETS) {
      const curse = preset.soul.curses[0];
      const check = validateWorkOrder({
        vin: preset.soul.defaultVin,
        dtcCode: curse.dtcCode,
        faultDescription: curse.mechanicalExplanation,
        oemPartsCostUsd: Math.round(curse.estimatedCostUsd * 0.4),
        laborHours: curse.laborHours,
        laborRateUsd: 163,
      });
      expect(check.valid).toBe(true);
    }

    expect(validateUdsResponse(0x22, [0x62, 0xf4, 0x0a, 0x09, 0x2e]).valid).toBe(true);
  });

  it("Builds custom cars without needing a VIN and passes ISO 3779 VIN validation under fast-check fuzzing", () => {
    for (const ex of EXAMPLE_USER_CARS) {
      const bundle = buildUserCustomCarBundle({
        yearMakeModel: ex.yearMakeModel,
        powertrainType: ex.powertrainType,
        transmissionType: ex.transmissionType,
        symptomOption: ex.symptomOption,
        customObdCode: ex.customObdCode,
      });
      expect(validateVin(bundle.normalizedVin).valid).toBe(true);
      expect(bundle.soul.yearMakeModel).toBe(ex.yearMakeModel);
      expect(bundle.fairCostUsd).toBeGreaterThan(0);
      expect(bundle.dealerQuoteUsd).toBeGreaterThan(bundle.fairCostUsd);
    }

    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (anyCarName) => {
        const vin = synthesizeValidIsoVin(anyCarName);
        expect(validateVin(vin).valid).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("Monotonically increases anomaly score, warnings, and per-mile repair savings rate as Stress Sliders rise", () => {
    const v6Soul = REAL_WORLD_VEHICLE_PRESETS[0].soul;
    const healthyEval = evaluateDrivingStressSliders(
      v6Soul,
      null,
      DEFAULT_DRIVING_SLIDERS,
      "22F40A"
    );
    const moderateWearEval = evaluateDrivingStressSliders(
      v6Soul,
      null,
      { drivingLoadRpm: 4200, heatTempC: 102, partWearPct: 45 },
      "22F40A"
    );
    const failingWearEval = evaluateDrivingStressSliders(
      v6Soul,
      null,
      { drivingLoadRpm: 6200, heatTempC: 124, partWearPct: 90 },
      "22F40A"
    );

    expect(healthyEval.warnings).toHaveLength(0);
    expect(moderateWearEval.stressAnomalyScore).toBeGreaterThan(healthyEval.stressAnomalyScore);
    expect(failingWearEval.stressAnomalyScore).toBeGreaterThan(
      moderateWearEval.stressAnomalyScore
    );
    expect(failingWearEval.isOverheating).toBe(true);
    expect(failingWearEval.isHighLoad).toBe(true);
    expect(failingWearEval.isFailingWear).toBe(true);
    expect(failingWearEval.scopeActual).toBeLessThan(healthyEval.scopeActual);

    const healthyRate = calculateEscrowRateCents(healthyEval.stressAnomalyScore, 0);
    const failingRate = calculateEscrowRateCents(failingWearEval.stressAnomalyScore, 1);
    expect(failingRate).toBeGreaterThan(healthyRate);
  });

  it("Maps all 4 Frankenstein Chimera Pipeline stages & syncs Cinema Pitch scenes 1–8 cleanly", () => {
    expect(FRANKENSTEIN_PIPELINE_STAGES.map((s) => s.stepNum)).toEqual(["01", "02", "03", "04"]);
    expect(WORKSPACE_TABS.map((t) => t.id)).toEqual([
      "LIVE_HEALTH",
      "SCANNER_AI",
      "REPAIR_VAULT",
      "ENGINEER_KIRO",
    ]);
    expect(getWorkspaceTabForScene(1)).toBe("LIVE_HEALTH");
    expect(getWorkspaceTabForScene(2)).toBe("LIVE_HEALTH");
    expect(getWorkspaceTabForScene(3)).toBe("LIVE_HEALTH");
    expect(getWorkspaceTabForScene(4)).toBe("SCANNER_AI");
    expect(getWorkspaceTabForScene(5)).toBe("SCANNER_AI");
    expect(getWorkspaceTabForScene(6)).toBe("REPAIR_VAULT");
    expect(getWorkspaceTabForScene(7)).toBe("SCANNER_AI");
    expect(getWorkspaceTabForScene(8)).toBe("ENGINEER_KIRO");
  });

  it("Enforces Phase 8.6 EV & Manual invariants and non-repeating fault rolls under fast-check", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 40 }),
        fc.double({ min: 0, max: 0.9999, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 0.9999, noNaN: true, noDefaultInfinity: true }),
        (carLabel, r1, r2) => {
          const evRoll = rollRandomVehicleFault(
            { yearMakeModel: carLabel, powertrain: "Full Electric (EV)", transmission: "EV Single-Speed" },
            { rng: () => r1 }
          );
          expect(isCombustionFaultDtc(evRoll.dtcCode)).toBe(false);
          expect(isMultiGearOrAutoTransFaultDtc(evRoll.dtcCode)).toBe(false);

          const manualFirst = rollRandomVehicleFault(
            { yearMakeModel: carLabel, powertrain: "Turbo / Supercharged", transmission: "Manual" },
            { rng: () => r1 }
          );
          const manualSecond = rollRandomVehicleFault(
            { yearMakeModel: carLabel, powertrain: "Turbo / Supercharged", transmission: "Manual" },
            { previousFaultId: manualFirst.id, previousDtcCode: manualFirst.dtcCode, rng: () => r2 }
          );
          expect(manualFirst.targetModule).not.toBe("TCM");
          expect(manualSecond.targetModule).not.toBe("TCM");
          expect(manualSecond.dtcCode).not.toBe(manualFirst.dtcCode);
          expect(manualSecond.oemPartNumber.length).toBeGreaterThan(0);
          expect(manualSecond.fairCostUsd).toBeGreaterThan(0);
        }
      ),
      { numRuns: 150 }
    );
  });
});

