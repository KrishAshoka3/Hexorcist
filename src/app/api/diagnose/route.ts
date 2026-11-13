import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import {
  VEHICLE_SOUL_PRESETS,
  VehicleArchitectureId,
  inspectDTCBitmask,
  parseRawCANFrame,
} from "@/lib/obd-hex-engine";

export interface DiagnoseRequestPayload {
  vehicleId?: VehicleArchitectureId;
  vin?: string;
  rawCanFrame?: string;
  dtcCode?: string;
  telemetrySnapshot?: Record<string, number>;
}

export interface DiagnoseResponsePayload {
  rootCause: string;
  oemPartName: string;
  oemPartNumber: string;
  estimatedCostUsd: number;
  laborHours: number;
  recommendedUdsCommand: string;
  source: "vertex-ai-gemini-2.5-flash" | "deterministic-ecu-necromancer";
  project: string;
  location: string;
  dtcBitmaskHex: string;
  analyzedFrame: string;
  timestamp: string;
}

function buildFallbackAutopsy(
  vehicleId: VehicleArchitectureId,
  vin: string,
  rawCanFrame: string,
  dtcCode: string,
  project: string,
  location: string
): DiagnoseResponsePayload {
  const soul = VEHICLE_SOUL_PRESETS[vehicleId] ?? VEHICLE_SOUL_PRESETS.GERMAN_V6_DSG;
  const safeDtc = /^[PCBU][0-3][0-9A-F]{3}$/i.test(dtcCode.trim())
    ? dtcCode.trim().toUpperCase()
    : soul.curses[0].dtcCode;

  const curse =
    soul.curses.find((c) => c.dtcCode.toUpperCase() === safeDtc) ?? soul.curses[0];
  const parsed = parseRawCANFrame(rawCanFrame);
  const bitmask = inspectDTCBitmask(safeDtc);

  const frameNote = parsed.valid
    ? `CAN ${parsed.canId} [0x${parsed.responseModeHex} PID 0x${parsed.pidHex}] => ${parsed.name}: ${parsed.value?.toFixed(2)} ${parsed.unit} (XOR 0x${parsed.checksumHex}).`
    : `Captured frame "${rawCanFrame}".`;

  return {
    rootCause: `[VIN ${vin}] ${curse.mechanicalExplanation} ${frameNote}`,
    oemPartName: curse.oemPartName,
    oemPartNumber: curse.oemPartNumber,
    estimatedCostUsd: curse.estimatedCostUsd,
    laborHours: curse.laborHours,
    recommendedUdsCommand: curse.recommendedUdsCommand,
    source: "deterministic-ecu-necromancer",
    project,
    location,
    dtcBitmaskHex: bitmask.hexPair,
    analyzedFrame: rawCanFrame,
    timestamp: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  const project = process.env.GOOGLE_CLOUD_PROJECT || "project-6cb8b3e0-9ee1-4093-b53";
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

  let body: DiagnoseRequestPayload = {};
  try {
    body = (await req.json()) as DiagnoseRequestPayload;
  } catch {
    body = {};
  }

  const vehicleId: VehicleArchitectureId =
    body.vehicleId && body.vehicleId in VEHICLE_SOUL_PRESETS
      ? body.vehicleId
      : "GERMAN_V6_DSG";
  const soul = VEHICLE_SOUL_PRESETS[vehicleId];
  const vin = (body.vin || soul.defaultVin).trim().toUpperCase();
  const dtcCode = (body.dtcCode || soul.curses[0].dtcCode).trim().toUpperCase();
  const rawCanFrame = body.rawCanFrame || "7E8 05 62 F4 0A 09 2E A1";

  const fallback = buildFallbackAutopsy(
    vehicleId,
    vin,
    rawCanFrame,
    dtcCode,
    project,
    location
  );

  try {
    const ai = new GoogleGenAI({ vertexai: true, project, location });
    const parsed = parseRawCANFrame(rawCanFrame);
    const prompt = [
      `You are HEXORCIST, an automotive CAN-Bus (SAE J1979) and ISO 14229 UDS diagnostic necromancer.`,
      `Powertrain: ${soul.codename} (${soul.yearMakeModel})`,
      `VIN: ${vin} | Active DTC: ${dtcCode} (${fallback.dtcBitmaskHex})`,
      `Raw CAN Hex Frame: ${rawCanFrame}`,
      parsed.valid ? `Decoded PID: ${parsed.name} = ${parsed.value} ${parsed.unit}` : "",
      body.telemetrySnapshot ? `ECU Snapshot: ${JSON.stringify(body.telemetrySnapshot)}` : "",
      `Return JSON with rootCause, oemPartName, oemPartNumber, estimatedCostUsd, laborHours, and recommendedUdsCommand.`,
    ]
      .filter(Boolean)
      .join("\n");

    const vertexCall = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rootCause: { type: Type.STRING },
            oemPartName: { type: Type.STRING },
            oemPartNumber: { type: Type.STRING },
            estimatedCostUsd: { type: Type.NUMBER },
            laborHours: { type: Type.NUMBER },
            recommendedUdsCommand: { type: Type.STRING },
          },
          required: [
            "rootCause",
            "oemPartName",
            "oemPartNumber",
            "estimatedCostUsd",
            "laborHours",
            "recommendedUdsCommand",
          ],
        },
      },
    });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Vertex timeout")), 6500)
    );
    const response = await Promise.race([vertexCall, timeout]);
    const rawText = response.text?.trim();
    if (!rawText) return NextResponse.json(fallback);

    const data = JSON.parse(rawText) as Partial<DiagnoseResponsePayload>;
    return NextResponse.json({
      rootCause: data.rootCause || fallback.rootCause,
      oemPartName: data.oemPartName || fallback.oemPartName,
      oemPartNumber: data.oemPartNumber || fallback.oemPartNumber,
      estimatedCostUsd:
        typeof data.estimatedCostUsd === "number" && data.estimatedCostUsd > 0
          ? Math.round(data.estimatedCostUsd)
          : fallback.estimatedCostUsd,
      laborHours:
        typeof data.laborHours === "number" && data.laborHours > 0
          ? Math.round(data.laborHours * 10) / 10
          : fallback.laborHours,
      recommendedUdsCommand: data.recommendedUdsCommand || fallback.recommendedUdsCommand,
      source: "vertex-ai-gemini-2.5-flash",
      project,
      location,
      dtcBitmaskHex: fallback.dtcBitmaskHex,
      analyzedFrame: rawCanFrame,
      timestamp: new Date().toISOString(),
    } satisfies DiagnoseResponsePayload);
  } catch {
    return NextResponse.json(fallback);
  }
}
