import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  CSV_HEADER_COLUMNS,
  SAMPLE_DBC_MATRICES,
  buildCustomVinSoul,
  decodeDbcSignalEngineering,
  extractBitsPreview,
  generateSampleCSV,
  parseTelemetryCSV,
  processVirtualElm327Command,
} from "./log-and-dbc-engine";
import {
  VEHICLE_SOUL_PRESETS,
  VehicleArchitectureId,
  parseRawCANFrame,
} from "./obd-hex-engine";

describe("HEXORCIST Phase 2 — CSV Log Replay, OpenDBC 64-Bit Matrix & ELM327 Suite", () => {
  it("Generates authentic 100-row WOT CSV logs with mid-pull fault anomalies across all 4 Vehicle Souls + Custom VIN", () => {
    const soulIds: VehicleArchitectureId[] = [
      "GERMAN_V6_DSG",
      "JDM_TWIN_ROTARY",
      "AWD_800V_EV",
      "HEAVY_DIESEL_TOW",
    ];

    for (const soulId of soulIds) {
      const csv = generateSampleCSV(soulId);
      const lines = csv.split("\n");
      expect(lines[0]).toBe(CSV_HEADER_COLUMNS);
      expect(lines).toHaveLength(101); // 1 header + 100 telemetry rows

      const parsedFrames = parseTelemetryCSV(csv);
      expect(parsedFrames).toHaveLength(100);
      expect(parsedFrames[0].activeDtc).toBe("NONE");
      expect(parsedFrames[60].activeDtc).toBe(VEHICLE_SOUL_PRESETS[soulId].curses[0].dtcCode);
      expect(parsedFrames[45].rpm).toBeGreaterThan(parsedFrames[0].rpm);

      // Every generated Raw_Hex_Frame must validate cleanly against XOR checksum parser
      for (const f of parsedFrames) {
        const canCheck = parseRawCANFrame(f.rawHexFrame);
        expect(canCheck.valid).toBe(true);
        expect(canCheck.checksumValid).toBe(true);
      }
    }
  });

  it("Universal CSV parser handles Torque Pro / VCDS exports and survives fast-check fuzzing", () => {
    const torqueProSample = [
      "Device Time,Engine RPM(rpm),Speed (OBD)(km/h),Engine Coolant Temperature(C),Short term fuel trim Bank 1(%),Control module voltage(V)",
      "0.10,2450,62,89,1.5,14.22",
      "0.20,3820,88,91,3.2,14.15",
      "0.30,5490,119,95,24.8,13.88",
    ].join("\n");

    const frames = parseTelemetryCSV(torqueProSample);
    expect(frames).toHaveLength(3);
    expect(frames[2].rpm).toBe(5490);
    expect(parseRawCANFrame(frames[2].rawHexFrame).valid).toBe(true);

    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (arbitraryCsv) => {
        const out = parseTelemetryCSV(arbitraryCsv);
        expect(Array.isArray(out)).toBe(true);
      }),
      { numRuns: 300 }
    );
  });

  it("Validates non-overlapping 64-bit OpenDBC matrices (0B5_TCM, FD3S_ECU, BMS_HV_Status, J1939_EEC1)", () => {
    const expectedKeys = {
      GERMAN_V6_DSG: "0B5_TCM",
      JDM_TWIN_ROTARY: "FD3S_ECU",
      AWD_800V_EV: "BMS_HV_Status",
      HEAVY_DIESEL_TOW: "J1939_EEC1",
    } as const;

    for (const [soulId, dbcName] of Object.entries(expectedKeys)) {
      const matrix = SAMPLE_DBC_MATRICES[soulId as VehicleArchitectureId];
      expect(matrix.dbcKey).toBe(dbcName);
      expect(matrix.boSyntax).toContain(`BO_ `);
      expect(matrix.rawDbcText).toContain(`SG_ `);

      const seenBits = new Set<number>();
      for (const sig of matrix.signals) {
        const decoded = decodeDbcSignalEngineering(matrix.defaultPayloadBytes, sig);
        expect(decoded.preview.occupiedDbcBits.length).toBe(sig.length);
        for (const b of decoded.preview.occupiedDbcBits) {
          expect(b).toBeGreaterThanOrEqual(0);
          expect(b).toBeLessThanOrEqual(63);
          expect(seenBits.has(b)).toBe(false);
          seenBits.add(b);
        }
      }
      expect(seenBits.size).toBe(64);
    }

    // Verify extractBitsPreview default 3-arg signature
    const preview = extractBitsPreview([0x2e, 0x09, 0, 0, 0, 0, 0, 0], 0, 16);
    expect(preview.rawUnsigned).toBe(0x092e);
  });

  it("Synthesizes CUSTOM_VIN_SOUL and responds to Virtual Loopback ELM327 AT/Hex commands", () => {
    const customSoul = buildCustomVinSoul({
      vin: "1FA6P8CF5L5109284",
      make: "FORD",
      model: "Mustang GT",
      modelYear: "2020",
      bodyClass: "Coupe",
      engineInfo: "5.0L 8-Cyl 460 HP",
      fuelType: "Gasoline",
      driveType: "RWD",
      plantInfo: "Flat Rock, UNITED STATES",
      displacementL: "5.0",
      cylinders: "8",
      horsepower: "460",
    });

    expect(customSoul.id).toBe("CUSTOM_VIN_SOUL");
    expect(customSoul.yearMakeModel).toBe("2020 FORD Mustang GT");
    expect(customSoul.curses.length).toBeGreaterThanOrEqual(2);

    const ctx = {
      telemetry: customSoul.baselineTelemetry,
      activeDtc: "P0171",
      vin: customSoul.defaultVin,
      soulCodename: customSoul.codename,
    };
    expect(processVirtualElm327Command("ATZ", ctx).rxLines[0]).toContain("ELM327");
    expect(processVirtualElm327Command("01 0C", ctx).rxLines[0]).toMatch(/^7E8 04 41 0C/);
    expect(processVirtualElm327Command("22 F4 0A", ctx).rxLines[0]).toMatch(/^7E8 05 62 F4 0A/);
    expect(processVirtualElm327Command("03", ctx).rxLines[0]).toMatch(/^7E8 04 43 01/);
    expect(processVirtualElm327Command("04", ctx).clearedFaults).toBe(true);
  });
});
