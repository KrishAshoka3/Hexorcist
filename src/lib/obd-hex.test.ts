import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  ALL_PID_KEYS,
  UNIVERSAL_PID_REGISTRY,
  VEHICLE_SOUL_PRESETS,
  auditCANFrameBatch,
  buildCANResponseFrame,
  calculateDynoMetrics,
  calculateEscrowRateCents,
  decodeDTCBytes,
  encodeDTCString,
  parseRawCANFrame,
} from "./obd-hex-engine";
import {
  OBD_CONTROL_MODULES,
  PLAIN_ENGLISH_PID_TOOLTIPS,
  buildFreezeFrameSnapshot,
  buildMultiModuleScanReport,
  evaluateRoadSafetyTriage,
  evaluateShopQuoteFairness,
  formatMechanicSpecSheetPlainText,
  lookupUniversalDtc,
} from "./obd-scanner-qol";

describe("HEXORCIST — Universal CAN-Bus Hex Engine & FinTech PBT Suite", () => {
  it("Property 1: Universal PID Round-Trip Serialization (decode(encode(x)) ≈ x across all 12 PIDs)", () => {
    expect(ALL_PID_KEYS).toHaveLength(12);

    for (const pidKey of ALL_PID_KEYS) {
      const def = UNIVERSAL_PID_REGISTRY[pidKey];
      fc.assert(
        fc.property(
          fc.double({ min: def.min, max: def.max, noNaN: true, noDefaultInfinity: true }),
          (value) => {
            const encodedBytes = def.encode(value);
            expect(encodedBytes).toHaveLength(def.byteLength);
            for (const byte of encodedBytes) {
              expect(Number.isInteger(byte)).toBe(true);
              expect(byte).toBeGreaterThanOrEqual(0);
              expect(byte).toBeLessThanOrEqual(255);
            }

            const decodedDirect = def.decode(encodedBytes);
            expect(Math.abs(decodedDirect - value)).toBeLessThanOrEqual(def.tolerance + 1e-9);

            const rawFrame = buildCANResponseFrame(pidKey, value);
            const parsed = parseRawCANFrame(rawFrame);
            expect(parsed.valid).toBe(true);
            expect(parsed.checksumValid).toBe(true);
            expect(parsed.pidKey).toBe(pidKey);
            expect(Math.abs((parsed.value as number) - value)).toBeLessThanOrEqual(
              def.tolerance + 1e-9
            );
          }
        ),
        { numRuns: 200 }
      );
    }
  });

  it("Property 2: SAE J2012 DTC 2-Byte Bitmask Bijective Symmetry (P, C, B, U)", () => {
    const dtcArb = fc
      .tuple(
        fc.constantFrom("P", "C", "B", "U"),
        fc.constantFrom("0", "1", "2", "3"),
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 15 })
      )
      .map(
        ([d, s, n1, n2, n3]) =>
          `${d}${s}${n1.toString(16)}${n2.toString(16)}${n3.toString(16)}`.toUpperCase()
      );

    fc.assert(
      fc.property(dtcArb, (code) => {
        const [byteA, byteB] = encodeDTCString(code);
        expect(decodeDTCBytes(byteA, byteB)).toBe(code);
      }),
      { numRuns: 500 }
    );

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        (byteA, byteB) => {
          const code = decodeDTCBytes(byteA, byteB);
          expect(code).toMatch(/^[PCBU][0-3][0-9A-F]{3}$/);
          expect(encodeDTCString(code)).toEqual([byteA, byteB]);
        }
      ),
      { numRuns: 500 }
    );
  });

  it("Property 3: Fuzzing Resilience — parseRawCANFrame never throws on arbitrary fc.string()", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (arbitraryInput) => {
        const result = parseRawCANFrame(arbitraryInput);
        expect(result).toBeDefined();
        expect(typeof result.valid).toBe("boolean");
      }),
      { numRuns: 1000 }
    );

    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PID_KEYS),
        fc.integer({ min: 1, max: 255 }),
        (pidKey, flipMask) => {
          const def = UNIVERSAL_PID_REGISTRY[pidKey];
          const frame = buildCANResponseFrame(pidKey, (def.min + def.max) / 2);
          const parts = frame.split(" ");
          const badXor = (parseInt(parts[parts.length - 1], 16) ^ flipMask) & 0xff;
          parts[parts.length - 1] = badXor.toString(16).toUpperCase().padStart(2, "0");
          const parsed = parseRawCANFrame(parts.join(" "));
          expect(parsed.valid).toBe(false);
          expect(parsed.checksumValid).toBe(false);
        }
      ),
      { numRuns: 250 }
    );
  });

  it("Property 4: FinTech Escrow Monotonicity & Non-Negative Bounds", () => {
    expect(calculateEscrowRateCents(0, 0)).toBe(5);
    expect(calculateEscrowRateCents(90, 1)).toBeGreaterThanOrEqual(250);

    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 0, max: 8 }),
        fc.integer({ min: 0, max: 8 }),
        (a, b, dtcA, dtcB) => {
          const rateLow = calculateEscrowRateCents(Math.min(a, b), Math.min(dtcA, dtcB));
          const rateHigh = calculateEscrowRateCents(Math.max(a, b), Math.max(dtcA, dtcB));
          expect(rateLow).toBeGreaterThanOrEqual(5);
          expect(rateHigh).toBeGreaterThanOrEqual(rateLow);
        }
      ),
      { numRuns: 500 }
    );
  });

  it("Verifies Road Dyno physics & all 4 Vehicle Soul Presets", () => {
    expect(Object.keys(VEHICLE_SOUL_PRESETS)).toEqual([
      "GERMAN_V6_DSG",
      "JDM_TWIN_ROTARY",
      "AWD_800V_EV",
      "HEAVY_DIESEL_TOW",
    ]);

    const pull = calculateDynoMetrics({
      currentSpeedKmh: 118,
      prevSpeedKmh: 112,
      deltaTimeSec: 0.25,
      rpm: 5800,
      curbWeightKg: 1750,
      dragCoefficientCd: 0.28,
      frontalAreaM2: 2.21,
    });
    expect(pull.whp).toBeGreaterThan(200);
    expect(pull.torqueLbFt).toBeGreaterThan(180);
  });

  it("Property 5: Universal SAE J2012 DTC Decoder & Multi-Module OBD-II Sweep Invariants", () => {
    expect(OBD_CONTROL_MODULES.map((m) => m.rxCanId)).toEqual([
      "0x7E8",
      "0x7E9",
      "0x7EA",
      "0x7EB",
    ]);

    for (const sample of ["P0420", "P0750", "P0300", "P0171", "U0100", "C0035", "B1200"]) {
      const entry = lookupUniversalDtc(sample);
      expect(entry.valid).toBe(true);
      expect(entry.code).toBe(sample);
      expect(entry.plainEnglish.length).toBeGreaterThan(20);
      expect(entry.symptoms.length).toBeGreaterThanOrEqual(2);
    }

    expect(evaluateRoadSafetyTriage("P0420")?.level).toBe("SAFE");
    expect(evaluateRoadSafetyTriage("P0750")?.level).toBe("CAUTION");
    expect(evaluateRoadSafetyTriage("P0300")?.level).toBe("STOP");
    expect(evaluateRoadSafetyTriage("P0AA6")?.level).toBe("STOP");

    const dsg = VEHICLE_SOUL_PRESETS.GERMAN_V6_DSG;
    const nominalReport = buildMultiModuleScanReport(dsg, null, dsg.baselineTelemetry);
    expect(nominalReport.milOn).toBe(false);
    expect(nominalReport.modules.every((m) => m.badgeText === "🟢 PASS (0 Faults)")).toBe(true);

    const faultReport = buildMultiModuleScanReport(dsg, dsg.curses[0], {
      ...dsg.baselineTelemetry,
      ...(dsg.curses[0].telemetryOverrides as Record<string, number>),
    });
    expect(faultReport.milOn).toBe(true);
    expect(
      faultReport.modules.find((m) => m.module.id === "02_TCM")?.badgeText
    ).toBe("🔴 FAULT DETECTED");
    expect(faultReport.dtcCards.map((c) => c.modeHexLabel)).toEqual([
      "Mode $03",
      "Mode $07",
      "Mode $0A",
    ]);

    const dtcArb = fc
      .tuple(
        fc.constantFrom("P", "C", "B", "U"),
        fc.constantFrom("0", "1", "2", "3"),
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 15 })
      )
      .map(
        ([d, s, n1, n2, n3]) =>
          `${d}${s}${n1.toString(16)}${n2.toString(16)}${n3.toString(16)}`.toUpperCase()
      );

    fc.assert(
      fc.property(dtcArb, (code) => {
        const decoded = lookupUniversalDtc(code);
        expect(decoded.valid).toBe(true);
        expect(decoded.code).toBe(code);
        expect(decoded.bitmask.code).toBe(code);
        expect(["SAFE", "CAUTION", "STOP"]).toContain(decoded.safetyTriage.level);
      }),
      { numRuns: 300 }
    );
  });

  it("Property 6: Mechanic Quote Fair-Price Auditor Conservation & Monotonicity + QoL Coverage", () => {
    const dealerAudit = evaluateShopQuoteFairness(1480, 6.5, 2450);
    expect(dealerAudit.isOverpriced).toBe(true);
    expect(dealerAudit.oemPartsUsd).toBe(420);
    expect(dealerAudit.bookLaborHours).toBe(6.5);
    expect(dealerAudit.bookHourlyRateUsd).toBe(163);
    expect(dealerAudit.deltaUsd).toBe(970);
    expect(dealerAudit.deltaPctAboveBook).toBe(65);
    expect(dealerAudit.badgeText).toBe(
      "🔴 OVERPRICED BY $970 (+65% Above OEM Book Rate)"
    );

    const fairAudit = evaluateShopQuoteFairness(1480, 6.5, 1480);
    expect(fairAudit.isOverpriced).toBe(false);
    expect(fairAudit.badgeText).toBe("🟢 FAIR MARKET PRICE");

    fc.assert(
      fc.property(
        fc.integer({ min: 250, max: 8000 }),
        fc.double({ min: 1.0, max: 20.0, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 200, max: 12000 }),
        fc.integer({ min: 200, max: 12000 }),
        (fairUsd, hrs, quoteA, quoteB) => {
          const lowQuote = Math.min(quoteA, quoteB);
          const highQuote = Math.max(quoteA, quoteB);
          const lowRes = evaluateShopQuoteFairness(fairUsd, hrs, lowQuote);
          const highRes = evaluateShopQuoteFairness(fairUsd, hrs, highQuote);

          expect(lowRes.oemPartsUsd + lowRes.standardLaborUsd).toBe(lowRes.fairEstimateUsd);
          expect(highRes.deltaUsd).toBeGreaterThanOrEqual(lowRes.deltaUsd);
          expect(highRes.deltaPctAboveBook).toBeGreaterThanOrEqual(lowRes.deltaPctAboveBook);
        }
      ),
      { numRuns: 300 }
    );

    for (const pid of ALL_PID_KEYS) {
      expect(PLAIN_ENGLISH_PID_TOOLTIPS[pid].explanation.length).toBeGreaterThan(20);
    }

    const dsg = VEHICLE_SOUL_PRESETS.GERMAN_V6_DSG;
    const ff = buildFreezeFrameSnapshot(dsg.baselineTelemetry, dsg, true);
    const specText = formatMechanicSpecSheetPlainText({
      soul: dsg,
      vin: dsg.defaultVin,
      activeDtc: "P0750",
      hasActiveFault: true,
      freezeFrame: ff,
      rootCause: dsg.curses[0].mechanicalExplanation,
      oemPartName: dsg.curses[0].oemPartName,
      oemPartNumber: dsg.curses[0].oemPartNumber,
      fairEstimateUsd: 1480,
      laborHours: 6.5,
      recommendedUdsCommand: dsg.curses[0].recommendedUdsCommand,
      escrowBalanceCents: 55500,
      escrowRateCentsPerMile: 290,
      safetyTriage: evaluateRoadSafetyTriage("P0750"),
    });
    expect(specText).toContain("0B5-398-009-F");
    expect(specText).toContain("HEX-PASS-");
  });

  it("Property 7: CAN Frame XOR Parity Batch Audit — Deterministic Checksum Validation & Fuzzing Resilience", () => {
    // Test 1: Empty batch should return zero counts
    const emptyAudit = auditCANFrameBatch([]);
    expect(emptyAudit.totalFrames).toBe(0);
    expect(emptyAudit.validFrames).toBe(0);
    expect(emptyAudit.checksumPassCount).toBe(0);
    expect(emptyAudit.successRate).toBe(0);
    expect(emptyAudit.results).toEqual([]);

    // Test 2: All valid frames should pass 100%
    const validFrames = ALL_PID_KEYS.map((pidKey) => {
      const def = UNIVERSAL_PID_REGISTRY[pidKey];
      return buildCANResponseFrame(pidKey, (def.min + def.max) / 2);
    });
    const validAudit = auditCANFrameBatch(validFrames);
    expect(validAudit.totalFrames).toBe(12);
    expect(validAudit.validFrames).toBe(12);
    expect(validAudit.checksumPassCount).toBe(12);
    expect(validAudit.checksumFailCount).toBe(0);
    expect(validAudit.successRate).toBe(100);
    expect(validAudit.results.every((r) => r.checksumValid)).toBe(true);

    // Test 3: Corrupted checksums should be detected
    const corruptedFrames = ALL_PID_KEYS.map((pidKey) => {
      const def = UNIVERSAL_PID_REGISTRY[pidKey];
      const frame = buildCANResponseFrame(pidKey, (def.min + def.max) / 2);
      const parts = frame.split(" ");
      const badXor = (parseInt(parts[parts.length - 1], 16) ^ 0x55) & 0xff;
      parts[parts.length - 1] = badXor.toString(16).toUpperCase().padStart(2, "0");
      return parts.join(" ");
    });
    const corruptedAudit = auditCANFrameBatch(corruptedFrames);
    expect(corruptedAudit.totalFrames).toBe(12);
    expect(corruptedAudit.checksumFailCount).toBe(12);
    expect(corruptedAudit.checksumPassCount).toBe(0);
    expect(corruptedAudit.successRate).toBe(0);
    expect(corruptedAudit.results.every((r) => !r.checksumValid)).toBe(true);

    // Test 4: Mixed valid/invalid batch
    const mixedFrames = [
      ...validFrames.slice(0, 6),
      ...corruptedFrames.slice(0, 6),
    ];
    const mixedAudit = auditCANFrameBatch(mixedFrames);
    expect(mixedAudit.totalFrames).toBe(12);
    expect(mixedAudit.checksumPassCount).toBe(6);
    expect(mixedAudit.checksumFailCount).toBe(6);
    expect(mixedAudit.successRate).toBe(50);

    // Test 5: Property-based test with random valid frames
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            pidKey: fc.constantFrom(...ALL_PID_KEYS),
            value: fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (testCases) => {
          const frames = testCases.map((tc) => {
            const def = UNIVERSAL_PID_REGISTRY[tc.pidKey];
            const clampedValue = Math.max(def.min, Math.min(def.max, tc.value));
            return buildCANResponseFrame(tc.pidKey, clampedValue);
          });

          const audit = auditCANFrameBatch(frames);
          expect(audit.totalFrames).toBe(frames.length);
          expect(audit.checksumPassCount).toBe(frames.length);
          expect(audit.successRate).toBe(100);
          expect(audit.results).toHaveLength(frames.length);

          // Verify frame index matches array position
          audit.results.forEach((result, idx) => {
            expect(result.frameIndex).toBe(idx);
            expect(result.rawFrame).toBe(frames[idx]);
            expect(result.checksumValid).toBe(true);
            expect(result.pidKey).not.toBeNull();
          });
        }
      ),
      { numRuns: 100 }
    );

    // Test 6: Property-based test with random corrupted frames
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            pidKey: fc.constantFrom(...ALL_PID_KEYS),
            value: fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
            flipMask: fc.integer({ min: 1, max: 255 }),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (testCases) => {
          const frames = testCases.map((tc) => {
            const def = UNIVERSAL_PID_REGISTRY[tc.pidKey];
            const clampedValue = Math.max(def.min, Math.min(def.max, tc.value));
            const frame = buildCANResponseFrame(tc.pidKey, clampedValue);
            const parts = frame.split(" ");
            const badXor = (parseInt(parts[parts.length - 1], 16) ^ tc.flipMask) & 0xff;
            parts[parts.length - 1] = badXor.toString(16).toUpperCase().padStart(2, "0");
            return parts.join(" ");
          });

          const audit = auditCANFrameBatch(frames);
          expect(audit.totalFrames).toBe(frames.length);
          expect(audit.checksumFailCount).toBe(frames.length);
          expect(audit.checksumPassCount).toBe(0);
          expect(audit.successRate).toBe(0);

          // All results should have mismatched checksums
          audit.results.forEach((result) => {
            expect(result.checksumValid).toBe(false);
            expect(result.expectedChecksumHex).not.toBe(result.actualChecksumHex);
            expect(result.error).toBeDefined();
          });
        }
      ),
      { numRuns: 100 }
    );

    // Test 7: Arbitrary string fuzzing should never throw
    fc.assert(
      fc.property(
        fc.array(fc.string({ maxLength: 200 }), { minLength: 1, maxLength: 100 }),
        (arbitraryFrames) => {
          const audit = auditCANFrameBatch(arbitraryFrames);
          expect(audit).toBeDefined();
          expect(audit.totalFrames).toBe(arbitraryFrames.length);
          expect(audit.results).toHaveLength(arbitraryFrames.length);
          expect(audit.checksumPassCount + audit.checksumFailCount).toBeLessThanOrEqual(
            arbitraryFrames.length
          );
        }
      ),
      { numRuns: 200 }
    );

    // Test 8: Non-string inputs should be safely coerced
    const coercionTestCases = [
      null,
      undefined,
      42,
      {},
      [],
      true,
    ];
    const coercionAudit = auditCANFrameBatch(coercionTestCases as unknown as string[]);
    expect(coercionAudit.totalFrames).toBe(coercionTestCases.length);
    expect(coercionAudit.results).toHaveLength(coercionTestCases.length);

    // Test 9: Checksum independence — identical payloads with different checksums
    // Use a real frame from buildCANResponseFrame to ensure correct structure
    const validFrame = buildCANResponseFrame("010C", 2000); // RPM frame
    const parts = validFrame.split(" ");
    const correctChecksum = parts[parts.length - 1];
    const baseFrame = parts.slice(0, -1).join(" "); // Everything except checksum
    
    const invalidChecksum1 = ((parseInt(correctChecksum, 16) ^ 0x55) & 0xFF).toString(16).toUpperCase().padStart(2, "0");
    const invalidChecksum2 = "00";
    
    const checksumVariants = [
      `${baseFrame} ${correctChecksum}`,
      `${baseFrame} ${invalidChecksum1}`,
      `${baseFrame} ${invalidChecksum2}`,
    ];
    const checksumAudit = auditCANFrameBatch(checksumVariants);
    expect(checksumAudit.totalFrames).toBe(3);
    expect(checksumAudit.checksumPassCount).toBe(1);
    expect(checksumAudit.checksumFailCount).toBe(2);
    expect(checksumAudit.results[0].checksumValid).toBe(true);
    expect(checksumAudit.results[1].checksumValid).toBe(false);
    expect(checksumAudit.results[2].checksumValid).toBe(false);
  });

  it("Property 8: SAE J1979 Coolant Temperature Boundary (-40°C minimum)", () => {
    // PID 0x05 (0105) encodes coolant temp as: byte = (temp°C + 40)
    // Valid range: -40°C to +215°C
    const coolantPid = UNIVERSAL_PID_REGISTRY["0105"];
    
    // Test exact minimum boundary (-40°C)
    const minTempFrame = buildCANResponseFrame("0105", -40);
    const minParsed = parseRawCANFrame(minTempFrame);
    expect(minParsed.valid).toBe(true);
    expect(minParsed.value).toBe(-40);
    expect(minParsed.isWarning).toBe(true); // Below warnLow threshold
    
    // Property: Values at or near -40°C should encode to byte 0x00 and decode correctly
    fc.assert(
      fc.property(
        fc.double({ min: -40, max: -39, noNaN: true, noDefaultInfinity: true }),
        (temp) => {
          const encodedBytes = coolantPid.encode(temp);
          expect(encodedBytes).toHaveLength(1);
          
          // At -40°C, encoded byte should be 0
          if (temp === -40) {
            expect(encodedBytes[0]).toBe(0);
          } else {
            expect(encodedBytes[0]).toBeGreaterThanOrEqual(0);
            expect(encodedBytes[0]).toBeLessThanOrEqual(1);
          }
          
          const decoded = coolantPid.decode(encodedBytes);
          expect(Math.abs(decoded - temp)).toBeLessThanOrEqual(coolantPid.tolerance);
          
          // Full round-trip through CAN frame
          const frame = buildCANResponseFrame("0105", temp);
          const parsed = parseRawCANFrame(frame);
          expect(parsed.valid).toBe(true);
          expect(Math.abs((parsed.value as number) - temp)).toBeLessThanOrEqual(
            coolantPid.tolerance
          );
        }
      ),
      { numRuns: 200 }
    );
    
    // Property: Below -40°C should clamp to -40°C
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: -40.01, noNaN: true, noDefaultInfinity: true }),
        (belowMin) => {
          const encodedBytes = coolantPid.encode(belowMin);
          const decoded = coolantPid.decode(encodedBytes);
          expect(decoded).toBe(-40);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 9: SAE J1979 Engine Speed Boundary (16383.75 RPM maximum)", () => {
    // PID 0x0C (010C) encodes RPM as: uint16 = RPM × 4
    // Valid range: 0 RPM to 16383.75 RPM (in 0.25 RPM increments)
    const rpmPid = UNIVERSAL_PID_REGISTRY["010C"];
    
    // Test exact maximum boundary (16383.75 RPM)
    const maxRpmFrame = buildCANResponseFrame("010C", 16383.75);
    const maxParsed = parseRawCANFrame(maxRpmFrame);
    expect(maxParsed.valid).toBe(true);
    expect(maxParsed.value).toBe(16383.75);
    expect(maxParsed.isWarning).toBe(true); // Above warnHigh threshold (7200)
    
    // Property: Values at or near maximum (16383.75 RPM) should encode to 0xFFFF and decode correctly
    fc.assert(
      fc.property(
        fc.double({ min: 16383, max: 16383.75, noNaN: true, noDefaultInfinity: true }),
        (rpm) => {
          const encodedBytes = rpmPid.encode(rpm);
          expect(encodedBytes).toHaveLength(2);
          
          // At 16383.75 RPM, encoded uint16 should be 65535 (0xFFFF)
          if (rpm === 16383.75) {
            expect(encodedBytes[0]).toBe(0xFF);
            expect(encodedBytes[1]).toBe(0xFF);
          } else {
            const encoded16 = (encodedBytes[0] << 8) | encodedBytes[1];
            expect(encoded16).toBeGreaterThanOrEqual(65532); // Near maximum
            expect(encoded16).toBeLessThanOrEqual(65535);
          }
          
          const decoded = rpmPid.decode(encodedBytes);
          expect(Math.abs(decoded - rpm)).toBeLessThanOrEqual(rpmPid.tolerance);
          
          // Full round-trip through CAN frame
          const frame = buildCANResponseFrame("010C", rpm);
          const parsed = parseRawCANFrame(frame);
          expect(parsed.valid).toBe(true);
          expect(Math.abs((parsed.value as number) - rpm)).toBeLessThanOrEqual(
            rpmPid.tolerance
          );
        }
      ),
      { numRuns: 200 }
    );
    
    // Property: Above 16383.75 RPM should clamp to 16383.75 RPM
    fc.assert(
      fc.property(
        fc.double({ min: 16383.76, max: 20000, noNaN: true, noDefaultInfinity: true }),
        (aboveMax) => {
          const encodedBytes = rpmPid.encode(aboveMax);
          const decoded = rpmPid.decode(encodedBytes);
          expect(decoded).toBe(16383.75);
        }
      ),
      { numRuns: 100 }
    );
    
    // Property: 0.25 RPM granularity quantization
    fc.assert(
      fc.property(
        fc.double({ min: 1000, max: 8000, noNaN: true, noDefaultInfinity: true }),
        (rpm) => {
          const frame = buildCANResponseFrame("010C", rpm);
          const parsed = parseRawCANFrame(frame);
          
          // Verify decoded value is quantized to 0.25 RPM increments
          const quantized = Math.round((parsed.value as number) * 4) / 4;
          expect(Math.abs((parsed.value as number) - quantized)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 200 }
    );
  });
});
