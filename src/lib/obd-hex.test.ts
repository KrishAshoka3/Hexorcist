import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  ALL_PID_KEYS,
  UNIVERSAL_PID_REGISTRY,
  VEHICLE_SOUL_PRESETS,
  buildCANResponseFrame,
  calculateDynoMetrics,
  calculateEscrowRateCents,
  decodeDTCBytes,
  encodeDTCString,
  parseRawCANFrame,
} from "./obd-hex-engine";

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
});
