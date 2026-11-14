# Implementation Plan: Work Order & UDS Checksum Validator

## Task Breakdown

- [x] 1. Implement Core Validation Functions (`src/lib/work-order-validator.ts`)
  - [x] 1.1 Implement `validateVin()` with ISO 3779 compliance (17 chars, no I/O/Q)
  - [x] 1.2 Implement `validateDtcCode()` with SAE J2012 pattern matching
  - [x] 1.3 Implement `validateFinancials()` with non-negativity and arithmetic consistency checks
  - [x] 1.4 Implement `validateWorkOrder()` by composing VIN, DTC, and financial validators
  - [x] 1.5 Implement `validateUdsResponse()` with ISO 14229 SID+0x40 verification and NRC detection
  - [x] 1.6 Implement `batchValidateWorkOrders()` for batch processing with aggregate statistics

- [x] 2. Property-Based Testing with `fast-check` (`src/lib/work-order-validator.test.ts`)
  - [x] 2.1 Property 1: VIN validation round-trip symmetry (valid VINs pass, invalid VINs fail)
  - [x] 2.2 Property 2: DTC code format invariance across all [PCBU][0-3][0-9A-F]{3} combinations
  - [x] 2.3 Property 3: Financial arithmetic consistency (grandTotal = parts + laborHours × laborRate)
  - [x] 2.4 Property 4: UDS response SID bijection (responseSid = requestSid + 0x40)
  - [x] 2.5 Property 5: Fuzzing resilience (arbitrary strings never throw exceptions)
  - [x] 2.6 Property 6: Negative response detection (0x7F handling with NRC extraction)
  - [x] 2.7 Property 7: Work order complete validation (composition of all validators)
  - [x] 2.8 Property 8: Batch validation aggregate correctness (sum of valid + invalid = total)

## Acceptance Criteria

- All validation functions return structured result objects with `valid: boolean` discriminator
- VIN validator enforces 17-character length, alphanumeric uppercase, and excludes I/O/Q
- DTC validator accepts only [PCBU][0-3][0-9A-F]{3} pattern, rejects all other formats
- Financial validator enforces non-negativity and arithmetic consistency within 0.01 USD tolerance
- UDS validator correctly identifies positive responses (SID+0x40) and negative responses (0x7F)
- All property-based tests pass with 200+ generated test cases per property
- Fuzzing tests with arbitrary strings (0-1000 chars) never cause unhandled exceptions
- Test suite achieves 100% code coverage on validation logic
- No modifications to UI components in `src/app` or `src/components`

## Testing Strategy

### Unit Tests (Deterministic Cases)
- Valid VIN: `"WAUDGAFL5EA049218"` → `{ valid: true }`
- Invalid VIN (contains O): `"WAUDGAFL5EA04921O"` → `{ valid: false, error: "..." }`
- Valid DTC: `"P0420"` → `{ valid: true, domain: "Powertrain" }`
- Invalid DTC: `"X0420"` → `{ valid: false, error: "..." }`
- Valid UDS: `validateUdsResponse(0x22, [0x62, 0x11, 0x40, 0x12, 0x34])` → `{ valid: true }`
- Negative UDS: `validateUdsResponse(0x22, [0x7F, 0x22, 0x31])` → `{ valid: false, nrc: 0x31 }`

### Property-Based Tests (Generative Cases)
- Generate 200+ valid VINs matching `[A-HJ-NPR-Z0-9]{17}` pattern
- Generate 200+ invalid VINs with I/O/Q or wrong length
- Generate 200+ DTC codes across all domains (P, C, B, U) and sub-types (0-3)
- Generate 200+ financial tuples with non-negative values
- Generate 200+ UDS request/response pairs with correct SID offset
- Fuzz with 1000+ arbitrary strings of length 0-1000

### Boundary Tests
- VIN length: 0, 1, 16, 17, 18, 100 characters
- Financial values: 0, 0.01, 1.0, 999999.99, -1.0, NaN, Infinity
- UDS response: empty array, 1 byte, 255 bytes, non-array input
- DTC sub-type: '0', '3', '4' (4 is invalid), 'A' (invalid)

## Implementation Notes

### ISO 3779 VIN Exclusions
The characters I, O, and Q are excluded from VINs to prevent visual confusion:
- I vs 1 (one)
- O vs 0 (zero)
- Q vs O (capital O)

### SAE J2012 DTC Structure
```
[Domain][SubType][FaultIndex]
   P       0         420
   
Domain: P=Powertrain, C=Chassis, B=Body, U=Network
SubType: 0=SAE, 1=Manufacturer, 2=SAE, 3=Reserved
FaultIndex: 3 hex digits (000-FFF)
```

### ISO 14229 UDS Response Format
```
Positive Response:
  [ResponseSID, ...data]
  where ResponseSID = RequestSID + 0x40

Negative Response:
  [0x7F, RequestSID, NRC]
  where NRC = Negative Response Code
```

## Deliverables

1. `src/lib/work-order-validator.ts` — Core validation module (300-400 LOC)
2. `src/lib/work-order-validator.test.ts` — Property-based test suite (400-500 LOC)
3. `.kiro/specs/work-order-validator/requirements.md` — EARS syntax requirements
4. `.kiro/specs/work-order-validator/design.md` — Architecture and algorithms
5. `.kiro/specs/work-order-validator/tasks.md` — This file

## Estimated Effort

- Task 1 (Implementation): 2-3 hours
- Task 2 (Testing): 2-3 hours
- Total: 4-6 hours
