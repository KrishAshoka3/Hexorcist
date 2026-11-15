import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  formatBrandOemPartNumber,
  getValidFaultPoolForVehicle,
  isCombustionFaultDtc,
  isMultiGearOrAutoTransFaultDtc,
  rollRandomVehicleFault,
} from "./vehicle-fault-generator";
import { synthesizeValidIsoVin } from "./custom-car-and-sliders";
import { buildMultiModuleScanReport } from "./obd-scanner-qol";
import { VEHICLE_SOUL_PRESETS } from "./obd-hex-engine";
import { validateDtcCode, validateWorkOrder } from "./work-order-validator";

describe("HEXORCIST Phase 8.6 — Vehicle-Accurate Randomized Fault Engine PBT Suite", () => {
  it("Property 1 (EV Invariant): Full Electric (EV) vehicles NEVER generate combustion or multi-gear transmission faults", () => {
    const evPowertrainArb = fc.constantFrom(
      "Full Electric (EV)",
      "EV",
      "800V Dual-Motor Electric",
      "BEV Zero-Emission"
    );
    const anyTransArb = fc.constantFrom(
      "EV Single-Speed",
      "Standard Automatic",
      "Dual-Clutch (DSG / DCT)",
      "Manual",
      "CVT",
      ""
    );

    fc.assert(
      fc.property(
        fc.integer({ min: 2012, max: 2027 }),
        fc.string({ maxLength: 32 }),
        fc.string({ maxLength: 32 }),
        evPowertrainArb,
        anyTransArb,
        fc.double({ min: 0, max: 0.999999, noNaN: true, noDefaultInfinity: true }),
        (year, make, model, powertrain, transmission, randVal) => {
          const pool = getValidFaultPoolForVehicle({
            year,
            make,
            model,
            powertrain,
            transmission,
          });
          expect(pool.length).toBeGreaterThanOrEqual(4);

          for (const item of pool) {
            expect(isCombustionFaultDtc(item.dtcCode)).toBe(false);
            expect(isMultiGearOrAutoTransFaultDtc(item.dtcCode)).toBe(false);
            expect(item.targetModule).not.toBe("TCM");
            expect(item.targetModuleId).not.toBe("02_TCM");
          }

          const rolled = rollRandomVehicleFault(
            { year, make, model, powertrain, transmission },
            { rng: () => randVal }
          );
          expect(isCombustionFaultDtc(rolled.dtcCode)).toBe(false);
          expect(isMultiGearOrAutoTransFaultDtc(rolled.dtcCode)).toBe(false);
          expect(rolled.targetModule).not.toBe("TCM");
          expect(["BCM", "ECM", "ABS"]).toContain(rolled.targetModule);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("Property 2 (Manual Transmission Invariant): Manual cars NEVER generate TCM automatic/DCT solenoid or torque converter faults", () => {
    const nonEvPowertrainArb = fc.constantFrom(
      "Standard Gas",
      "Turbo / Supercharged",
      "Hybrid",
      ""
    );
    const manualTransArb = fc.constantFrom("Manual", "6-Speed Manual", "6MT", "5MT");

    fc.assert(
      fc.property(
        fc.integer({ min: 1990, max: 2027 }),
        fc.string({ maxLength: 30 }),
        fc.string({ maxLength: 30 }),
        nonEvPowertrainArb,
        manualTransArb,
        fc.double({ min: 0, max: 0.999999, noNaN: true, noDefaultInfinity: true }),
        (year, make, model, powertrain, transmission, randVal) => {
          const pool = getValidFaultPoolForVehicle({
            year,
            make,
            model,
            powertrain,
            transmission,
          });
          expect(pool.length).toBeGreaterThanOrEqual(4);

          for (const item of pool) {
            expect(item.targetModule).not.toBe("TCM");
            expect(item.targetModuleId).not.toBe("02_TCM");
            expect(isMultiGearOrAutoTransFaultDtc(item.dtcCode)).toBe(false);
            expect(item.dtcCode).not.toMatch(/^P[01]7/i);
          }

          const rolled = rollRandomVehicleFault(
            { year, make, model, powertrain, transmission },
            { rng: () => randVal }
          );
          expect(rolled.targetModule).not.toBe("TCM");
          expect(rolled.dtcCode).not.toMatch(/^P[01]7/i);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("Property 3 (Non-Repeating Consecutive Rolls + Valid SAE J2012 DTC + Brand OEM P/N + Positive Fair Cost)", () => {
    const anyPowertrainArb = fc.constantFrom(
      "Standard Gas",
      "Turbo / Supercharged",
      "Hybrid",
      "Full Electric (EV)"
    );
    const anyTransmissionArb = fc.constantFrom(
      "Standard Automatic",
      "Dual-Clutch (DSG / DCT)",
      "Manual",
      "CVT",
      "EV Single-Speed"
    );

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 45 }),
        anyPowertrainArb,
        anyTransmissionArb,
        fc.array(fc.double({ min: 0, max: 0.999999, noNaN: true, noDefaultInfinity: true }), {
          minLength: 8,
          maxLength: 16,
        }),
        (yearMakeModel, powertrain, transmission, randStream) => {
          let prevId: string | null = null;
          let prevDtc: string | null = null;
          const vin = synthesizeValidIsoVin(yearMakeModel);

          for (const r of randStream) {
            const rolled = rollRandomVehicleFault(
              { yearMakeModel, powertrain, transmission },
              {
                previousFaultId: prevId,
                previousDtcCode: prevDtc,
                rng: () => r,
              }
            );

            if (prevId !== null && prevDtc !== null) {
              expect(rolled.id).not.toBe(prevId);
              expect(rolled.dtcCode).not.toBe(prevDtc);
            }

            expect(rolled.dtcCode).toMatch(/^[PCBU][0-3][0-9A-F]{3}$/);
            expect(validateDtcCode(rolled.dtcCode).valid).toBe(true);
            expect(rolled.oemPartNumber.trim().length).toBeGreaterThan(4);
            expect(rolled.fairCostUsd).toBeGreaterThan(0);
            expect(rolled.dealerQuoteUsd).toBeGreaterThan(rolled.fairCostUsd);
            expect(["ECM", "TCM", "ABS", "BCM"]).toContain(rolled.targetModule);
            expect(["SAFE", "CAUTION", "DO NOT DRIVE"]).toContain(rolled.safetyTriageLevel);

            const workCheck = validateWorkOrder({
              vin,
              dtcCode: rolled.dtcCode,
              faultDescription: rolled.mechanicalExplanation,
              oemPartsCostUsd: Math.round(rolled.fairCostUsd * 0.4),
              laborHours: rolled.laborHours,
              laborRateUsd: 163,
            });
            expect(workCheck.valid).toBe(true);

            const scanReport = buildMultiModuleScanReport(
              VEHICLE_SOUL_PRESETS.GERMAN_V6_DSG,
              rolled.curse,
              {
                ...VEHICLE_SOUL_PRESETS.GERMAN_V6_DSG.baselineTelemetry,
                ...(rolled.telemetryOverrides as Record<string, number>),
              }
            );
            const faultedModules = scanReport.modules.filter((m) => m.status === "FAULT");
            const passedModules = scanReport.modules.filter((m) => m.status === "PASS");
            expect(faultedModules).toHaveLength(1);
            expect(passedModules).toHaveLength(3);
            expect(faultedModules[0].module.id).toBe(rolled.targetModuleId);

            prevId = rolled.id;
            prevDtc = rolled.dtcCode;
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("Property 4: Brand-aware OEM part prefixes match Audi/VW/Porsche, Ford, BMW, Toyota, Honda, Tesla & arbitrary brands", () => {
    expect(formatBrandOemPartNumber("Audi", "TCM", "P17D8")).toMatch(/^0B5-/);
    expect(formatBrandOemPartNumber("Porsche", "ECM", "P0299")).toMatch(/^06E-/);
    expect(formatBrandOemPartNumber("Ford", "TCM", "P0741")).toMatch(/^JL3Z-/);
    expect(formatBrandOemPartNumber("BMW", "ECM", "P0302")).toMatch(/^11-65-/);
    expect(formatBrandOemPartNumber("Toyota", "ECM", "P261B")).toMatch(/^89467-/);
    expect(formatBrandOemPartNumber("Honda", "ECM", "P0171")).toMatch(/^37980-/);
    expect(formatBrandOemPartNumber("Tesla", "BCM", "U0100")).toMatch(/^1089334-/);
  });
});
