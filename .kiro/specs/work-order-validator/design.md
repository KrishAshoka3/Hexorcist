# Work Order & UDS Checksum Validator — Design Document

## Architecture Overview

The Work Order & UDS Checksum Validator is implemented as a standalone, side-effect-free TypeScript module with six core validation functions and two batch processing utilities.

```
src/lib/work-order-validator.ts
├─ validateVin(vin: string): VinValidationResult
├─ validateDtcCode(dtc: string): DtcValidationResult
├─ validateFinancials(parts, hours, rate): FinancialValidationResult
├─ validateWorkOrder(order: WorkOrder): WorkOrderValidationResult
├─ validateUdsResponse(reqSid, resBytes[]): UdsResponseValidationResult
└─ batchValidateWorkOrders(orders[]): BatchValidationReport
```

## Design Principles

### 1. Fail-Safe Input Handling
All functions accept potentially hostile inputs and coerce them to safe types:
- `typeof x !== 'string'` → coerce to `String(x ?? '')`
- `!Number.isFinite(x)` → clamp to `0` or reject with error
- `Array.isArray(x) === false` → treat as empty array `[]`

### 2. Structured Error Reporting
Every validation function returns a discriminated union:
```typescript
{ valid: true, ...data } | { valid: false, error: string, ...partialData }
```

### 3. Single Responsibility Principle
Each validator focuses on one concern:
- **VIN Validator**: ISO 3779 format compliance only
- **DTC Validator**: SAE J2012 pattern matching only
- **Financial Validator**: Arithmetic consistency only
- **UDS Validator**: ISO 14229 protocol compliance only

### 4. Composition Over Inheritance
`validateWorkOrder()` composes atomic validators:
```typescript
const vinResult = validateVin(order.vin);
const dtcResult = validateDtcCode(order.dtcCode);
const financialResult = validateFinancials(...);
return { valid: vinResult.valid && dtcResult.valid && ..., ... };
```

## Validation Logic Details

### VIN Validation Algorithm

**Input**: Arbitrary string  
**Output**: `{ valid: boolean, vin: string, error?: string }`

```typescript
1. Coerce input to string: vin = String(input ?? '')
2. Check length === 17, else return { valid: false, error: 'VIN must be exactly 17 characters' }
3. Check /^[A-Z0-9]{17}$/.test(vin), else return { valid: false, error: 'VIN must be alphanumeric uppercase' }
4. Check !/[IOQ]/.test(vin), else return { valid: false, error: 'VIN cannot contain I, O, or Q' }
5. Return { valid: true, vin }
```

**Rationale**: ISO 3779 excludes I, O, Q to prevent visual confusion with 1, 0.

### DTC Code Validation Algorithm

**Input**: Arbitrary string  
**Output**: `{ valid: boolean, dtcCode: string, domain?: string, error?: string }`

```typescript
1. Coerce and normalize: dtc = String(input ?? '').trim().toUpperCase()
2. Check /^[PCBU][0-3][0-9A-F]{3}$/.test(dtc), else return { valid: false, error: 'Invalid SAE J2012 DTC format' }
3. Extract domain: { P: 'Powertrain', C: 'Chassis', B: 'Body', U: 'Network' }[dtc[0]]
4. Return { valid: true, dtcCode: dtc, domain }
```

**Rationale**: SAE J2012 defines a strict 5-character format with domain prefix.

### Financial Validation Algorithm

**Input**: oemPartsCostUsd: number, laborHours: number, laborRateUsd: number  
**Output**: `{ valid: boolean, totalLaborUsd: number, grandTotalUsd: number, error?: string }`

```typescript
1. Check all inputs are finite numbers: Number.isFinite(x)
2. Check all inputs are non-negative: x >= 0
3. Check no input exceeds $1M or 1000 hours (sanity bounds)
4. Compute: totalLaborUsd = laborHours * laborRateUsd
5. Compute: grandTotalUsd = oemPartsCostUsd + totalLaborUsd
6. Verify arithmetic: Math.abs(computed - expected) < 0.01 (floating-point tolerance)
7. Return { valid: true, totalLaborUsd, grandTotalUsd }
```

**Rationale**: Financial calculations must be deterministic and protect against overflow/underflow.

### UDS Response Validation Algorithm

**Input**: requestSid: number, responseBytes: number[]  
**Output**: `{ valid: boolean, isNegativeResponse: boolean, responseSid: number, error?: string }`

```typescript
1. Check responseBytes is array with length >= 1
2. Extract responseSid = responseBytes[0] & 0xFF
3. If responseSid === 0x7F:
   - Extract requestedSid = responseBytes[1] ?? 0
   - Extract nrc = responseBytes[2] ?? 0
   - Return { valid: false, isNegativeResponse: true, negativeResponseCode: nrc, error: lookupNrc(nrc) }
4. Compute expectedResponseSid = (requestSid + 0x40) & 0xFF
5. If responseSid !== expectedResponseSid:
   - Return { valid: false, error: `Expected SID 0x${expectedResponseSid.toString(16)}, got 0x${responseSid.toString(16)}` }
6. Return { valid: true, responseSid, isNegativeResponse: false }
```

**Rationale**: ISO 14229-1 mandates positive response SID = request SID | 0x40.

## UDS Negative Response Code (NRC) Mapping

Common NRC values per ISO 14229-1 Annex A.1:

| NRC | Hex  | Description |
|-----|------|-------------|
| 0x10 | 0x10 | General Reject |
| 0x11 | 0x11 | Service Not Supported |
| 0x12 | 0x12 | Sub-Function Not Supported |
| 0x13 | 0x13 | Incorrect Message Length Or Invalid Format |
| 0x22 | 0x22 | Conditions Not Correct |
| 0x31 | 0x31 | Request Out Of Range |
| 0x33 | 0x33 | Security Access Denied |
| 0x72 | 0x72 | General Programming Failure |

## Batch Processing Architecture

### batchValidateWorkOrders(orders: WorkOrder[]): BatchValidationReport

```typescript
interface BatchValidationReport {
  totalOrders: number;
  validOrders: number;
  invalidOrders: number;
  successRate: number; // 0-100
  results: WorkOrderValidationResult[];
  failureReasons: Record<string, number>; // error message → count
}
```

**Algorithm**:
1. Map each order through `validateWorkOrder()`
2. Aggregate counts: valid, invalid
3. Collect error frequency distribution
4. Compute success rate: `(valid / total) * 100`

## Property-Based Testing Strategy

### Property 1: VIN Round-Trip Symmetry
```typescript
∀ validVin ∈ ValidVins: validateVin(validVin).valid === true
∀ invalidVin ∈ InvalidVins: validateVin(invalidVin).valid === false
```

### Property 2: DTC Format Invariance
```typescript
∀ code ∈ [PCBU][0-3][0-9A-F]{3}: validateDtcCode(code).valid === true
∀ code ∉ [PCBU][0-3][0-9A-F]{3}: validateDtcCode(code).valid === false
```

### Property 3: Financial Arithmetic Consistency
```typescript
∀ (parts, hours, rate) ∈ ℝ≥0:
  validateFinancials(parts, hours, rate).grandTotalUsd === parts + (hours * rate) ± 0.01
```

### Property 4: UDS Response SID Bijection
```typescript
∀ reqSid ∈ [0x00..0xFF]:
  validateUdsResponse(reqSid, [(reqSid + 0x40) & 0xFF]).valid === true
  validateUdsResponse(reqSid, [reqSid]).valid === false
```

### Property 5: Fuzzing Never Throws
```typescript
∀ arbitraryString ∈ Strings:
  ∃ result: validateVin(arbitraryString) returns { valid: boolean, ... }
  (no exceptions thrown)
```

## Error Message Standards

All error messages follow the format:
```
"[Field]: [Reason]. [Constraint]"
```

Examples:
- `"VIN: Must be exactly 17 characters. Got 16 characters."`
- `"DTC: Invalid format. Must match [PCBU][0-3][0-9A-F]{3}."`
- `"Financial: Labor hours cannot be negative. Got -5.2."`
- `"UDS: Response SID mismatch. Expected 0x62, got 0x41."`

## Integration Points

### Existing Code Dependencies
- **Import from**: `./obd-hex-engine.ts` → `encodeDTCString`, `decodeDTCBytes` (for cross-validation)
- **No imports to**: UI components (`src/app`, `src/components`)
- **Test framework**: Vitest + `fast-check`

### Future Extensions
- VIN checksum digit validation (ISO 3779 Annex B — modulo 11 algorithm)
- NHTSA vPIC VIN decode integration via MCP server
- Multi-module UDS session management (0x10, 0x27, 0x28 services)
- Blockchain-backed immutable work order audit trail
