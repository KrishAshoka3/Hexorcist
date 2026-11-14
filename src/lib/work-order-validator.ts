/**
 * HEXORCIST — Mechanic Work Order & ISO 14229 UDS Checksum Validator
 * 
 * Provides deterministic validation for automotive repair work orders and
 * Unified Diagnostic Services (UDS) protocol responses to ensure data integrity
 * and prevent fraudulent or malformed diagnostic communications.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface VinValidationResult {
  valid: boolean;
  vin: string;
  error?: string;
}

export interface DtcValidationResult {
  valid: boolean;
  dtcCode: string;
  domain?: string;
  subType?: string;
  error?: string;
}

export interface FinancialValidationResult {
  valid: boolean;
  oemPartsCostUsd: number;
  laborHours: number;
  laborRateUsd: number;
  totalLaborUsd: number;
  grandTotalUsd: number;
  error?: string;
}

export interface WorkOrder {
  vin: string;
  dtcCode: string;
  faultDescription: string;
  oemPartsCostUsd: number;
  laborHours: number;
  laborRateUsd: number;
}

export interface WorkOrderValidationResult {
  valid: boolean;
  vin: VinValidationResult;
  dtc: DtcValidationResult;
  financial: FinancialValidationResult;
  faultDescription: {
    valid: boolean;
    value: string;
    error?: string;
  };
  errors: string[];
}

export interface UdsResponseValidationResult {
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

export interface BatchValidationReport {
  totalOrders: number;
  validOrders: number;
  invalidOrders: number;
  successRate: number;
  results: WorkOrderValidationResult[];
  failureReasons: Record<string, number>;
}

// ============================================================================
// Constants
// ============================================================================

const DTC_DOMAIN_MAP: Record<string, string> = {
  P: "Powertrain",
  C: "Chassis",
  B: "Body",
  U: "Network",
};

const DTC_SUBTYPE_MAP: Record<string, string> = {
  "0": "SAE/ISO Generic Standard",
  "1": "OEM Manufacturer Specific",
  "2": "SAE/ISO Controlled Sub-Group",
  "3": "Joint SAE/OEM Reserved",
};

// ISO 14229-1 Annex A.1 — Common Negative Response Codes
const UDS_NRC_MAP: Record<number, string> = {
  0x10: "General Reject",
  0x11: "Service Not Supported",
  0x12: "Sub-Function Not Supported",
  0x13: "Incorrect Message Length Or Invalid Format",
  0x21: "Busy Repeat Request",
  0x22: "Conditions Not Correct",
  0x24: "Request Sequence Error",
  0x25: "No Response From Sub-Net Component",
  0x26: "Failure Prevents Execution Of Requested Action",
  0x31: "Request Out Of Range",
  0x33: "Security Access Denied",
  0x35: "Invalid Key",
  0x36: "Exceed Number Of Attempts",
  0x37: "Required Time Delay Not Expired",
  0x70: "Upload Download Not Accepted",
  0x71: "Transfer Data Suspended",
  0x72: "General Programming Failure",
  0x73: "Wrong Block Sequence Counter",
  0x78: "Request Correctly Received - Response Pending",
  0x7E: "Sub-Function Not Supported In Active Session",
  0x7F: "Service Not Supported In Active Session",
};

// ============================================================================
// Core Validation Functions
// ============================================================================

/**
 * Validates a 17-character Vehicle Identification Number (VIN) per ISO 3779.
 * 
 * Requirements:
 * - Exactly 17 characters
 * - Alphanumeric uppercase (A-Z, 0-9)
 * - Must NOT contain I, O, or Q (visual confusion with 1, 0)
 * 
 * @param vin - Raw VIN string to validate
 * @returns Structured validation result with error details
 */
export function validateVin(vin: unknown): VinValidationResult {
  const safeVin = typeof vin === "string" ? vin : String(vin ?? "");
  const normalized = safeVin.trim().toUpperCase();

  if (normalized.length !== 17) {
    return {
      valid: false,
      vin: safeVin,
      error: `VIN must be exactly 17 characters. Got ${normalized.length} characters.`,
    };
  }

  if (!/^[A-Z0-9]{17}$/.test(normalized)) {
    return {
      valid: false,
      vin: safeVin,
      error: "VIN must contain only alphanumeric uppercase characters (A-Z, 0-9).",
    };
  }

  if (/[IOQ]/.test(normalized)) {
    return {
      valid: false,
      vin: safeVin,
      error: "VIN cannot contain the letters I, O, or Q per ISO 3779 standard.",
    };
  }

  return {
    valid: true,
    vin: normalized,
  };
}

/**
 * Validates a 5-character SAE J2012 Diagnostic Trouble Code (DTC).
 * 
 * Format: [PCBU][0-3][0-9A-F]{3}
 * - Domain: P=Powertrain, C=Chassis, B=Body, U=Network
 * - SubType: 0=SAE, 1=Manufacturer, 2=SAE, 3=Reserved
 * - FaultIndex: 3 hexadecimal digits
 * 
 * @param dtc - Raw DTC string to validate
 * @returns Structured validation result with domain and sub-type metadata
 */
export function validateDtcCode(dtc: unknown): DtcValidationResult {
  const safeDtc = typeof dtc === "string" ? dtc : String(dtc ?? "");
  const normalized = safeDtc.trim().toUpperCase();

  if (!/^[PCBU][0-3][0-9A-F]{3}$/.test(normalized)) {
    return {
      valid: false,
      dtcCode: safeDtc,
      error: "Invalid SAE J2012 DTC format. Must match [PCBU][0-3][0-9A-F]{3}.",
    };
  }

  return {
    valid: true,
    dtcCode: normalized,
    domain: DTC_DOMAIN_MAP[normalized[0]],
    subType: DTC_SUBTYPE_MAP[normalized[1]],
  };
}

/**
 * Validates financial components of a work order.
 * 
 * Requirements:
 * - All values must be finite, non-negative numbers
 * - Total labor = laborHours × laborRateUsd
 * - Grand total = oemPartsCostUsd + totalLaborUsd
 * - Values must not exceed $1M or 1000 hours (sanity bounds)
 * 
 * @param oemPartsCostUsd - OEM parts cost in USD
 * @param laborHours - Labor hours
 * @param laborRateUsd - Hourly labor rate in USD
 * @returns Structured validation result with computed totals
 */
export function validateFinancials(
  oemPartsCostUsd: unknown,
  laborHours: unknown,
  laborRateUsd: unknown
): FinancialValidationResult {
  let parts: number;
  let hours: number;
  let rate: number;

  try {
    parts = Number(oemPartsCostUsd);
    hours = Number(laborHours);
    rate = Number(laborRateUsd);
  } catch {
    // Handle cases where Number() conversion might throw (e.g., objects with broken toString)
    parts = NaN;
    hours = NaN;
    rate = NaN;
  }

  const invalid = (error: string): FinancialValidationResult => ({
    valid: false,
    oemPartsCostUsd: Number.isFinite(parts) ? parts : 0,
    laborHours: Number.isFinite(hours) ? hours : 0,
    laborRateUsd: Number.isFinite(rate) ? rate : 0,
    totalLaborUsd: 0,
    grandTotalUsd: 0,
    error,
  });

  if (!Number.isFinite(parts)) {
    return invalid("OEM parts cost must be a finite number.");
  }
  if (!Number.isFinite(hours)) {
    return invalid("Labor hours must be a finite number.");
  }
  if (!Number.isFinite(rate)) {
    return invalid("Labor rate must be a finite number.");
  }

  if (parts < 0) {
    return invalid(`OEM parts cost cannot be negative. Got $${parts.toFixed(2)}.`);
  }
  if (hours < 0) {
    return invalid(`Labor hours cannot be negative. Got ${hours.toFixed(2)} hours.`);
  }
  if (rate < 0) {
    return invalid(`Labor rate cannot be negative. Got $${rate.toFixed(2)}/hr.`);
  }

  if (parts > 1000000) {
    return invalid(`OEM parts cost exceeds sanity bound of $1M. Got $${parts.toFixed(2)}.`);
  }
  if (hours > 1000) {
    return invalid(`Labor hours exceed sanity bound of 1000 hours. Got ${hours.toFixed(2)} hours.`);
  }
  if (rate > 1000) {
    return invalid(`Labor rate exceeds sanity bound of $1000/hr. Got $${rate.toFixed(2)}/hr.`);
  }

  const totalLaborUsd = hours * rate;
  const grandTotalUsd = parts + totalLaborUsd;

  return {
    valid: true,
    oemPartsCostUsd: parts,
    laborHours: hours,
    laborRateUsd: rate,
    totalLaborUsd: Math.round(totalLaborUsd * 100) / 100,
    grandTotalUsd: Math.round(grandTotalUsd * 100) / 100,
  };
}

/**
 * Validates a complete mechanic work order by composing VIN, DTC, financial,
 * and fault description validators.
 * 
 * @param order - Complete work order object
 * @returns Structured validation result with all field-level validations
 */
export function validateWorkOrder(order: Partial<WorkOrder>): WorkOrderValidationResult {
  const vinResult = validateVin(order.vin);
  const dtcResult = validateDtcCode(order.dtcCode);
  const financialResult = validateFinancials(
    order.oemPartsCostUsd,
    order.laborHours,
    order.laborRateUsd
  );

  const faultDesc = typeof order.faultDescription === "string" ? order.faultDescription : "";
  const faultDescValid = faultDesc.trim().length > 0;

  const faultDescResult = {
    valid: faultDescValid,
    value: faultDesc,
    error: faultDescValid ? undefined : "Fault description cannot be empty.",
  };

  const errors: string[] = [];
  if (!vinResult.valid) errors.push(vinResult.error!);
  if (!dtcResult.valid) errors.push(dtcResult.error!);
  if (!financialResult.valid) errors.push(financialResult.error!);
  if (!faultDescValid) errors.push(faultDescResult.error!);

  return {
    valid: vinResult.valid && dtcResult.valid && financialResult.valid && faultDescValid,
    vin: vinResult,
    dtc: dtcResult,
    financial: financialResult,
    faultDescription: faultDescResult,
    errors,
  };
}

/**
 * Validates an ISO 14229 UDS (Unified Diagnostic Services) response byte array.
 * 
 * Requirements:
 * - Positive response: First byte (response SID) = request SID + 0x40
 * - Negative response: First byte = 0x7F, followed by requested SID and NRC
 * - All bytes must be valid 8-bit unsigned integers (0-255)
 * 
 * @param requestSid - UDS request Service ID (0x00-0xFF)
 * @param responseBytes - Response byte array
 * @returns Structured validation result with NRC details for negative responses
 */
export function validateUdsResponse(
  requestSid: unknown,
  responseBytes: unknown
): UdsResponseValidationResult {
  let reqSid: number;
  try {
    reqSid = Number(requestSid) & 0xff;
  } catch {
    reqSid = 0;
  }
  
  const expectedResponseSid = (reqSid + 0x40) & 0xff;

  const invalid = (error: string, partial?: Partial<UdsResponseValidationResult>): UdsResponseValidationResult => ({
    valid: false,
    requestSid: reqSid,
    responseSid: 0,
    expectedResponseSid,
    isNegativeResponse: false,
    responseLength: 0,
    error,
    ...partial,
  });

  if (!Array.isArray(responseBytes)) {
    return invalid("UDS response must be an array of bytes.");
  }

  if (responseBytes.length === 0) {
    return invalid("UDS response cannot be empty.");
  }

  for (let i = 0; i < responseBytes.length; i++) {
    const byte = responseBytes[i];
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
      return invalid(`UDS response byte[${i}] must be 0-255. Got ${byte}.`);
    }
  }

  const responseSid = responseBytes[0] & 0xff;

  // Check for Negative Response (0x7F)
  if (responseSid === 0x7f) {
    const requestedSid = responseBytes.length >= 2 ? (responseBytes[1] & 0xff) : 0;
    const nrc = responseBytes.length >= 3 ? (responseBytes[2] & 0xff) : 0;
    const nrcDesc = UDS_NRC_MAP[nrc] || `Unknown NRC 0x${nrc.toString(16).toUpperCase().padStart(2, "0")}`;

    return {
      valid: false,
      requestSid: reqSid,
      responseSid: 0x7f,
      expectedResponseSid,
      isNegativeResponse: true,
      negativeResponseCode: nrc,
      negativeResponseDescription: nrcDesc,
      responseLength: responseBytes.length,
      error: `Negative Response: ${nrcDesc} (NRC 0x${nrc.toString(16).toUpperCase().padStart(2, "0")})`,
    };
  }

  // Check for correct positive response SID
  if (responseSid !== expectedResponseSid) {
    return invalid(
      `UDS response SID mismatch. Expected 0x${expectedResponseSid.toString(16).toUpperCase().padStart(2, "0")}, got 0x${responseSid.toString(16).toUpperCase().padStart(2, "0")}.`,
      {
        responseSid,
        responseLength: responseBytes.length,
      }
    );
  }

  return {
    valid: true,
    requestSid: reqSid,
    responseSid,
    expectedResponseSid,
    isNegativeResponse: false,
    responseLength: responseBytes.length,
  };
}

/**
 * Validates a batch of work orders and returns aggregate statistics.
 * 
 * @param orders - Array of work orders to validate
 * @returns Batch validation report with success rate and error frequency distribution
 */
export function batchValidateWorkOrders(orders: unknown): BatchValidationReport {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const results = safeOrders.map((order) => validateWorkOrder(order as Partial<WorkOrder>));

  const validOrders = results.filter((r) => r.valid).length;
  const invalidOrders = results.length - validOrders;

  const failureReasons: Record<string, number> = {};
  for (const result of results) {
    if (!result.valid) {
      for (const error of result.errors) {
        failureReasons[error] = (failureReasons[error] || 0) + 1;
      }
    }
  }

  return {
    totalOrders: results.length,
    validOrders,
    invalidOrders,
    successRate: results.length > 0 ? Math.round((validOrders / results.length) * 10000) / 100 : 0,
    results,
    failureReasons,
  };
}
