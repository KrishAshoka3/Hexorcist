import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  validateVin,
  validateDtcCode,
  validateFinancials,
  validateWorkOrder,
  validateUdsResponse,
  batchValidateWorkOrders,
  type WorkOrder,
} from "./work-order-validator";

describe("HEXORCIST — Work Order & UDS Checksum Validator PBT Suite", () => {
  // =========================================================================
  // Property 1: VIN Validation Round-Trip Symmetry
  // =========================================================================
  it("Property 1: VIN Validation — Valid VINs pass, invalid VINs fail", () => {
    // Valid VIN arbitrary: 17 alphanumeric uppercase chars excluding I, O, Q
    const validVinArb = fc
      .array(fc.constantFrom(...("ABCDEFGHJKLMNPRSTUVWXYZ0123456789".split(""))), {
        minLength: 17,
        maxLength: 17,
      })
      .map((chars) => chars.join(""));

    fc.assert(
      fc.property(validVinArb, (vin) => {
        const result = validateVin(vin);
        expect(result.valid).toBe(true);
        expect(result.vin).toBe(vin);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 200 }
    );

    // Invalid VIN: wrong length
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter((s) => s.length !== 17),
        (invalidVin) => {
          const result = validateVin(invalidVin);
          expect(result.valid).toBe(false);
          expect(result.error).toContain("must be exactly 17 characters");
        }
      ),
      { numRuns: 200 }
    );

    // Invalid VIN: contains I, O, or Q
    const vinWithForbiddenChars = fc
      .array(fc.constantFrom(...("ABCDEFGHJKLMNPRSTUVWXYZ0123456789".split(""))), {
        minLength: 16,
        maxLength: 16,
      })
      .chain((chars) =>
        fc.constantFrom("I", "O", "Q").map((forbidden) => [...chars, forbidden].join(""))
      );

    fc.assert(
      fc.property(vinWithForbiddenChars, (vin) => {
        const result = validateVin(vin);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("cannot contain the letters I, O, or Q");
      }),
      { numRuns: 200 }
    );

    // Deterministic test cases
    expect(validateVin("WAUDGAFL5EA049218").valid).toBe(true);
    expect(validateVin("1HGBH41JXMN109186").valid).toBe(true);
    expect(validateVin("JM1FD3331P0204912").valid).toBe(true);
    expect(validateVin("WAUDGAFL5EA04921O").valid).toBe(false); // Contains O
    expect(validateVin("WAUDGAFL5EA04921I").valid).toBe(false); // Contains I
    expect(validateVin("WAUDGAFL5EA04921Q").valid).toBe(false); // Contains Q
    expect(validateVin("WAUDGAFL5EA04921").valid).toBe(false); // 16 chars
    expect(validateVin("WAUDGAFL5EA0492188").valid).toBe(false); // 18 chars
  });

  // =========================================================================
  // Property 2: DTC Code Format Invariance
  // =========================================================================
  it("Property 2: DTC Code Format Invariance — [PCBU][0-3][0-9A-F]{3}", () => {
    // Valid DTC arbitrary
    const validDtcArb = fc
      .tuple(
        fc.constantFrom("P", "C", "B", "U"),
        fc.constantFrom("0", "1", "2", "3"),
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 15 })
      )
      .map(
        ([domain, subType, d1, d2, d3]) =>
          `${domain}${subType}${d1.toString(16)}${d2.toString(16)}${d3.toString(16)}`.toUpperCase()
      );

    fc.assert(
      fc.property(validDtcArb, (dtc) => {
        const result = validateDtcCode(dtc);
        expect(result.valid).toBe(true);
        expect(result.dtcCode).toBe(dtc);
        expect(result.domain).toBeDefined();
        expect(result.subType).toBeDefined();
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 500 }
    );

    // Invalid DTC: wrong first character
    fc.assert(
      fc.property(
        fc
          .constantFrom("X", "Y", "Z", "0", "1")
          .chain((invalid) =>
            fc
              .tuple(
                fc.constantFrom("0", "1", "2", "3"),
                fc.integer({ min: 0, max: 4095 }).map(n => n.toString(16).toUpperCase().padStart(3, "0"))
              )
              .map(([sub, hex]) => `${invalid}${sub}${hex}`)
          ),
        (invalidDtc) => {
          const result = validateDtcCode(invalidDtc);
          expect(result.valid).toBe(false);
          expect(result.error).toContain("Invalid SAE J2012 DTC format");
        }
      ),
      { numRuns: 200 }
    );

    // Invalid DTC: wrong second character (must be 0-3)
    fc.assert(
      fc.property(
        fc
          .constantFrom("P", "C", "B", "U")
          .chain((domain) =>
            fc
              .constantFrom("4", "5", "6", "7", "8", "9", "A", "B")
              .chain((invalid) =>
                fc.integer({ min: 0, max: 4095 }).map(n => `${domain}${invalid}${n.toString(16).toUpperCase().padStart(3, "0")}`)
              )
          ),
        (invalidDtc) => {
          const result = validateDtcCode(invalidDtc);
          expect(result.valid).toBe(false);
          expect(result.error).toContain("Invalid SAE J2012 DTC format");
        }
      ),
      { numRuns: 200 }
    );

    // Deterministic test cases
    expect(validateDtcCode("P0420").valid).toBe(true);
    expect(validateDtcCode("P0420").domain).toBe("Powertrain");
    expect(validateDtcCode("C0035").valid).toBe(true);
    expect(validateDtcCode("C0035").domain).toBe("Chassis");
    expect(validateDtcCode("B1200").valid).toBe(true);
    expect(validateDtcCode("B1200").domain).toBe("Body");
    expect(validateDtcCode("U0100").valid).toBe(true);
    expect(validateDtcCode("U0100").domain).toBe("Network");
    expect(validateDtcCode("X0420").valid).toBe(false); // Invalid domain
    expect(validateDtcCode("P4420").valid).toBe(false); // Invalid sub-type
    expect(validateDtcCode("P042G").valid).toBe(false); // Invalid hex digit
    expect(validateDtcCode("P042").valid).toBe(false); // Too short
    expect(validateDtcCode("P04200").valid).toBe(false); // Too long
  });

  // =========================================================================
  // Property 3: Financial Arithmetic Consistency
  // =========================================================================
  it("Property 3: Financial Arithmetic Consistency — grandTotal = parts + laborHours × laborRate", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
        (parts, hours, rate) => {
          const result = validateFinancials(parts, hours, rate);
          expect(result.valid).toBe(true);
          expect(result.oemPartsCostUsd).toBe(parts);
          expect(result.laborHours).toBe(hours);
          expect(result.laborRateUsd).toBe(rate);

          // Verify arithmetic consistency within floating-point tolerance
          const expectedTotalLabor = hours * rate;
          const expectedGrandTotal = parts + expectedTotalLabor;
          expect(Math.abs(result.totalLaborUsd - expectedTotalLabor)).toBeLessThan(0.01);
          expect(Math.abs(result.grandTotalUsd - expectedGrandTotal)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 300 }
    );

    // Negative values should fail
    fc.assert(
      fc.property(
        fc.double({ min: -10000, max: -0.01, noNaN: true, noDefaultInfinity: true }),
        (negativeValue) => {
          expect(validateFinancials(negativeValue, 10, 100).valid).toBe(false);
          expect(validateFinancials(1000, negativeValue, 100).valid).toBe(false);
          expect(validateFinancials(1000, 10, negativeValue).valid).toBe(false);
        }
      ),
      { numRuns: 200 }
    );

    // Deterministic test cases
    const result1 = validateFinancials(1480, 6.5, 163);
    expect(result1.valid).toBe(true);
    expect(result1.totalLaborUsd).toBeCloseTo(1059.5, 2);
    expect(result1.grandTotalUsd).toBeCloseTo(2539.5, 2);

    expect(validateFinancials(0, 0, 0).valid).toBe(true);
    expect(validateFinancials(0, 0, 0).grandTotalUsd).toBe(0);

    expect(validateFinancials(-100, 10, 100).valid).toBe(false);
    expect(validateFinancials(100, -10, 100).valid).toBe(false);
    expect(validateFinancials(100, 10, -100).valid).toBe(false);
    expect(validateFinancials(NaN, 10, 100).valid).toBe(false);
    expect(validateFinancials(100, NaN, 100).valid).toBe(false);
    expect(validateFinancials(100, 10, Infinity).valid).toBe(false);
  });

  // =========================================================================
  // Property 4: UDS Response SID Bijection
  // =========================================================================
  it("Property 4: UDS Response SID Bijection — responseSid = requestSid + 0x40", () => {
    // Filter out request SID 0x3F and 0xBF because 0x3F + 0x40 = 0x7F (negative response marker)
    // and 0xBF + 0x40 = 0xFF which wraps to 0xFF
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 255 }).filter((sid) => {
          const expectedResponse = (sid + 0x40) & 0xff;
          return expectedResponse !== 0x7f; // Avoid collision with negative response marker
        }),
        fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 64 }),
        (reqSid, dataBytes) => {
          const expectedResSid = (reqSid + 0x40) & 0xff;
          const responseBytes = [expectedResSid, ...dataBytes];

          const result = validateUdsResponse(reqSid, responseBytes);
          expect(result.valid).toBe(true);
          expect(result.requestSid).toBe(reqSid);
          expect(result.responseSid).toBe(expectedResSid);
          expect(result.expectedResponseSid).toBe(expectedResSid);
          expect(result.isNegativeResponse).toBe(false);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 300 }
    );

    // Incorrect SID should fail
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }).filter((wrongSid) => wrongSid !== 0x7f),
        (reqSid, wrongSid) => {
          const expectedSid = (reqSid + 0x40) & 0xff;
          if (wrongSid === expectedSid) return; // Skip if accidentally correct

          const result = validateUdsResponse(reqSid, [wrongSid, 0x11, 0x40]);
          expect(result.valid).toBe(false);
          expect(result.error).toContain("SID mismatch");
        }
      ),
      { numRuns: 200 }
    );

    // Deterministic test cases
    const validUds = validateUdsResponse(0x22, [0x62, 0x11, 0x40, 0x12, 0x34]);
    expect(validUds.valid).toBe(true);
    expect(validUds.responseSid).toBe(0x62);
    expect(validUds.expectedResponseSid).toBe(0x62);

    const invalidUds = validateUdsResponse(0x22, [0x41, 0x0c, 0x1f, 0x40]);
    expect(invalidUds.valid).toBe(false);
    expect(invalidUds.error).toContain("Expected 0x62, got 0x41");
  });

  // =========================================================================
  // Property 5: Fuzzing Resilience — Never Throws
  // =========================================================================
  it("Property 5: Fuzzing Resilience — Arbitrary inputs never throw exceptions", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 1000 }), (arbitraryString) => {
        const vinResult = validateVin(arbitraryString);
        expect(vinResult).toBeDefined();
        expect(typeof vinResult.valid).toBe("boolean");

        const dtcResult = validateDtcCode(arbitraryString);
        expect(dtcResult).toBeDefined();
        expect(typeof dtcResult.valid).toBe("boolean");
      }),
      { numRuns: 1000 }
    );

    fc.assert(
      fc.property(fc.anything(), fc.anything(), fc.anything(), (a, b, c) => {
        const result = validateFinancials(a, b, c);
        expect(result).toBeDefined();
        expect(typeof result.valid).toBe("boolean");
      }),
      { numRuns: 500 }
    );

    fc.assert(
      fc.property(fc.anything(), fc.anything(), (reqSid, resBytes) => {
        const result = validateUdsResponse(reqSid, resBytes);
        expect(result).toBeDefined();
        expect(typeof result.valid).toBe("boolean");
      }),
      { numRuns: 500 }
    );

    // Non-string/non-array inputs should be safely coerced
    expect(() => validateVin(null)).not.toThrow();
    expect(() => validateVin(undefined)).not.toThrow();
    expect(() => validateVin(42)).not.toThrow();
    expect(() => validateVin({})).not.toThrow();
    expect(() => validateVin([])).not.toThrow();

    expect(() => validateDtcCode(null)).not.toThrow();
    expect(() => validateDtcCode(true)).not.toThrow();

    expect(() => validateFinancials(null, undefined, "foo")).not.toThrow();

    expect(() => validateUdsResponse(0x22, null)).not.toThrow();
    expect(() => validateUdsResponse(0x22, "not an array")).not.toThrow();
  });

  // =========================================================================
  // Property 6: UDS Negative Response Detection (0x7F + NRC)
  // =========================================================================
  it("Property 6: UDS Negative Response Detection — 0x7F handling with NRC extraction", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        (reqSid, nrc) => {
          const negativeResponse = [0x7f, reqSid, nrc];
          const result = validateUdsResponse(reqSid, negativeResponse);

          expect(result.valid).toBe(false);
          expect(result.isNegativeResponse).toBe(true);
          expect(result.responseSid).toBe(0x7f);
          expect(result.negativeResponseCode).toBe(nrc);
          expect(result.negativeResponseDescription).toBeDefined();
          expect(result.error).toContain("Negative Response");
        }
      ),
      { numRuns: 300 }
    );

    // Deterministic negative response test cases
    const nrcSecurityDenied = validateUdsResponse(0x27, [0x7f, 0x27, 0x33]);
    expect(nrcSecurityDenied.valid).toBe(false);
    expect(nrcSecurityDenied.isNegativeResponse).toBe(true);
    expect(nrcSecurityDenied.negativeResponseCode).toBe(0x33);
    expect(nrcSecurityDenied.negativeResponseDescription).toContain("Security Access Denied");

    const nrcServiceNotSupported = validateUdsResponse(0x10, [0x7f, 0x10, 0x11]);
    expect(nrcServiceNotSupported.valid).toBe(false);
    expect(nrcServiceNotSupported.negativeResponseCode).toBe(0x11);
    expect(nrcServiceNotSupported.negativeResponseDescription).toContain("Service Not Supported");

    const nrcRequestOutOfRange = validateUdsResponse(0x22, [0x7f, 0x22, 0x31]);
    expect(nrcRequestOutOfRange.valid).toBe(false);
    expect(nrcRequestOutOfRange.negativeResponseCode).toBe(0x31);
    expect(nrcRequestOutOfRange.negativeResponseDescription).toContain("Request Out Of Range");
  });

  // =========================================================================
  // Property 7: Work Order Complete Validation & Batch Processing
  // =========================================================================
  it("Property 7: Work Order Complete Validation — Composition of all validators", () => {
    const validWorkOrderArb = fc.record({
      vin: fc
        .array(fc.constantFrom(...("ABCDEFGHJKLMNPRSTUVWXYZ0123456789".split(""))), {
          minLength: 17,
          maxLength: 17,
        })
        .map((chars) => chars.join("")),
      dtcCode: fc
        .tuple(
          fc.constantFrom("P", "C", "B", "U"),
          fc.constantFrom("0", "1", "2", "3"),
          fc.integer({ min: 0, max: 4095 }).map(n => n.toString(16).toUpperCase().padStart(3, "0"))
        )
        .map(([d, s, hex]) => `${d}${s}${hex}`),
      faultDescription: fc.string({ minLength: 10, maxLength: 200 }),
      oemPartsCostUsd: fc.double({ min: 0, max: 50000, noNaN: true, noDefaultInfinity: true }),
      laborHours: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
      laborRateUsd: fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
    });

    fc.assert(
      fc.property(validWorkOrderArb, (order) => {
        const result = validateWorkOrder(order);
        expect(result.valid).toBe(true);
        expect(result.vin.valid).toBe(true);
        expect(result.dtc.valid).toBe(true);
        expect(result.financial.valid).toBe(true);
        expect(result.faultDescription.valid).toBe(true);
        expect(result.errors).toEqual([]);
      }),
      { numRuns: 200 }
    );

    // Deterministic complete work order
    const validOrder: WorkOrder = {
      vin: "WAUDGAFL5EA049218",
      dtcCode: "P0750",
      faultDescription: "0B5 Shift Solenoid A / Line Pressure Sensor Drift",
      oemPartsCostUsd: 1480,
      laborHours: 6.5,
      laborRateUsd: 163,
    };
    const validResult = validateWorkOrder(validOrder);
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toEqual([]);

    // Invalid work order (multiple failures)
    const invalidOrder = {
      vin: "TOOSHORT",
      dtcCode: "X9999",
      faultDescription: "",
      oemPartsCostUsd: -500,
      laborHours: -10,
      laborRateUsd: 150,
    };
    const invalidResult = validateWorkOrder(invalidOrder);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
    expect(invalidResult.vin.valid).toBe(false);
    expect(invalidResult.dtc.valid).toBe(false);
    expect(invalidResult.financial.valid).toBe(false);
    expect(invalidResult.faultDescription.valid).toBe(false);
  });

  // =========================================================================
  // Property 8: Batch Validation Aggregate Correctness
  // =========================================================================
  it("Property 8: Batch Validation — sum(valid) + sum(invalid) = total", () => {
    const workOrderArb = fc.record({
      vin: fc.string({ maxLength: 30 }),
      dtcCode: fc.string({ maxLength: 10 }),
      faultDescription: fc.string({ maxLength: 100 }),
      oemPartsCostUsd: fc.double({ min: -1000, max: 100000 }),
      laborHours: fc.double({ min: -100, max: 500 }),
      laborRateUsd: fc.double({ min: -500, max: 1000 }),
    });

    fc.assert(
      fc.property(fc.array(workOrderArb, { minLength: 1, maxLength: 100 }), (orders) => {
        const report = batchValidateWorkOrders(orders);

        expect(report.totalOrders).toBe(orders.length);
        expect(report.validOrders + report.invalidOrders).toBe(report.totalOrders);
        expect(report.results).toHaveLength(orders.length);

        // Verify success rate calculation
        const expectedRate =
          report.totalOrders > 0
            ? Math.round((report.validOrders / report.totalOrders) * 10000) / 100
            : 0;
        expect(report.successRate).toBe(expectedRate);

        // Verify failure reason aggregation
        const totalFailures = Object.values(report.failureReasons).reduce(
          (sum, count) => sum + count,
          0
        );
        expect(totalFailures).toBeGreaterThanOrEqual(report.invalidOrders);
      }),
      { numRuns: 100 }
    );

    // Deterministic batch test
    const orders: WorkOrder[] = [
      {
        vin: "WAUDGAFL5EA049218",
        dtcCode: "P0420",
        faultDescription: "Catalyst efficiency below threshold",
        oemPartsCostUsd: 850,
        laborHours: 2.5,
        laborRateUsd: 120,
      },
      {
        vin: "TOOSHORT",
        dtcCode: "P0420",
        faultDescription: "Valid fault",
        oemPartsCostUsd: 500,
        laborHours: 1,
        laborRateUsd: 100,
      },
      {
        vin: "1HGBH41JXMN109186",
        dtcCode: "INVALID",
        faultDescription: "Valid fault",
        oemPartsCostUsd: 300,
        laborHours: 1.5,
        laborRateUsd: 110,
      },
    ];

    const report = batchValidateWorkOrders(orders);
    expect(report.totalOrders).toBe(3);
    expect(report.validOrders).toBe(1);
    expect(report.invalidOrders).toBe(2);
    expect(report.successRate).toBeCloseTo(33.33, 2);
  });
});
