# Work Order & UDS Checksum Validator — Requirements Specification

## Overview
The Work Order & UDS Checksum Validator provides deterministic validation for automotive repair work orders and ISO 14229 UDS (Unified Diagnostic Services) protocol responses to ensure data integrity and prevent fraudulent or malformed diagnostic communications.

## Functional Requirements (EARS Syntax)

### FR-1: VIN Validation
**WHERE** a 17-character Vehicle Identification Number (VIN) is provided,  
**WHEN** the validator checks VIN format compliance,  
**THEN** the system **SHALL** verify that:
- The VIN is exactly 17 characters in length
- All characters are alphanumeric (A-Z, 0-9)
- The VIN does **NOT** contain the characters I, O, or Q (per ISO 3779 standard)
- The VIN uses only uppercase ASCII characters

### FR-2: SAE J2012 DTC Code Validation
**WHERE** a 5-character Diagnostic Trouble Code (DTC) is provided,  
**WHEN** the validator checks DTC format compliance,  
**THEN** the system **SHALL** verify that:
- The DTC is exactly 5 characters in length
- The first character is one of: P (Powertrain), C (Chassis), B (Body), U (Network)
- The second character is a digit 0-3 representing the sub-type
- The remaining 3 characters are hexadecimal digits (0-9, A-F)
- The code matches the pattern `[PCBU][0-3][0-9A-F]{3}`

### FR-3: Work Order Financial Validation
**WHERE** a mechanic work order contains OEM parts cost and labor cost,  
**WHEN** the validator checks financial integrity,  
**THEN** the system **SHALL** verify that:
- OEM parts cost is a finite, non-negative number (≥ 0)
- Labor hours is a finite, non-negative number (≥ 0)
- Labor rate per hour is a finite, non-negative number (≥ 0)
- Total labor cost equals labor hours multiplied by hourly rate
- Grand total equals OEM parts cost plus total labor cost

### FR-4: Complete Work Order Validation
**WHERE** a complete mechanic work order is submitted,  
**WHEN** the validator performs comprehensive validation,  
**THEN** the system **SHALL** verify that:
- The work order contains a valid VIN (per FR-1)
- The work order contains a valid DTC code (per FR-2)
- All financial fields are valid (per FR-3)
- The work order contains a non-empty textual fault description
- All required fields are present and non-null

### FR-5: ISO 14229 UDS Positive Response Validation
**WHERE** a UDS request Service ID (SID) and response byte array are provided,  
**WHEN** the validator checks UDS protocol compliance,  
**THEN** the system **SHALL** verify that:
- The response byte array is non-empty and contains at least 1 byte
- The first byte of the response (response SID) equals request SID + 0x40
- All bytes in the array are valid 8-bit unsigned integers (0-255)
- The response does **NOT** indicate a Negative Response (0x7F)

### FR-6: ISO 14229 UDS Negative Response Detection
**WHERE** a UDS response begins with byte 0x7F,  
**WHEN** the validator checks the response,  
**THEN** the system **SHALL**:
- Return `valid: false` with error code indicating negative response
- Extract the requested SID from byte[1] if present
- Extract the Negative Response Code (NRC) from byte[2] if present
- Map common NRC values to human-readable descriptions

## Non-Functional Requirements

### NFR-1: Fuzzing Resilience
**WHERE** the validator receives arbitrary, malformed, or adversarial input,  
**WHEN** validation functions are invoked,  
**THEN** the system **SHALL**:
- Never throw unhandled exceptions
- Always return a structured validation result object
- Safely handle null, undefined, non-string, and oversized inputs
- Provide descriptive error messages for each validation failure

### NFR-2: Property-Based Testing
**WHERE** validation logic implements mathematical invariants,  
**WHEN** the test suite executes,  
**THEN** the system **SHALL**:
- Use `fast-check` property-based testing for all validation rules
- Generate at least 200 test cases per validation property
- Verify bijective symmetry (valid inputs → valid outputs → valid inputs)
- Test boundary conditions for all numeric fields
- Fuzz test with arbitrary strings of varying lengths (0-1000 characters)

### NFR-3: Determinism & Reproducibility
**WHERE** identical inputs are provided across multiple invocations,  
**WHEN** validation functions execute,  
**THEN** the system **SHALL**:
- Return identical validation results with identical error messages
- Produce stable results independent of system time or random state
- Maintain referential transparency (no side effects)

### NFR-4: Performance
**WHERE** batch validation of work orders or UDS responses is required,  
**WHEN** validating arrays of 1000+ entries,  
**THEN** the system **SHALL**:
- Complete validation in < 100ms for 1000 work orders
- Use O(n) time complexity for batch operations
- Avoid unnecessary memory allocations

## Data Structures

### WorkOrder Interface
```typescript
interface WorkOrder {
  vin: string;              // 17-character VIN
  dtcCode: string;          // 5-character SAE J2012 code
  faultDescription: string; // Human-readable fault summary
  oemPartsCostUsd: number;  // Non-negative USD amount
  laborHours: number;       // Non-negative hours
  laborRateUsd: number;     // Non-negative USD per hour
}
```

### WorkOrderValidationResult Interface
```typescript
interface WorkOrderValidationResult {
  valid: boolean;
  vin: {
    valid: boolean;
    value: string;
    error?: string;
  };
  dtc: {
    valid: boolean;
    value: string;
    error?: string;
  };
  financial: {
    valid: boolean;
    oemPartsCostUsd: number;
    laborHours: number;
    laborRateUsd: number;
    totalLaborUsd: number;
    grandTotalUsd: number;
    error?: string;
  };
  faultDescription: {
    valid: boolean;
    value: string;
    error?: string;
  };
  errors: string[];
}
```

### UdsResponseValidationResult Interface
```typescript
interface UdsResponseValidationResult {
  valid: boolean;
  requestSid: number;
  responseSid: number;
  expectedResponseSid: number;
  isNegativeResponse: boolean;
  negativeResponseCode?: number;
  negativeResponseDescription?: string;
  responseLength: number;
  error?: string;
}
```

## Acceptance Criteria

1. All validation functions return structured result objects, never throwing exceptions
2. VIN validator rejects strings containing I, O, Q or non-alphanumeric characters
3. DTC validator accepts only [PCBU][0-3][0-9A-F]{3} pattern
4. Financial validator enforces non-negativity and arithmetic consistency
5. UDS validator correctly identifies positive responses (SID + 0x40) and negative responses (0x7F)
6. Property-based tests achieve 100% pass rate across 200+ generated test cases per property
7. Fuzzing tests with arbitrary strings never cause crashes or unhandled exceptions
