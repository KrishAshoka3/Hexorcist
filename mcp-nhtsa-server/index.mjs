#!/usr/bin/env node
/**
 * HEXORCIST — Standalone NHTSA vPIC VIN Decoder MCP Server (JSON-RPC 2.0 over stdio)
 * Queries https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/{vin}?format=json
 */

import readline from "node:readline";

const SERVER_INFO = {
  name: "hexorcist-nhtsa-vin-mcp",
  version: "1.0.0",
};

const TOOLS = [
  {
    name: "decode_vin",
    description:
      "Decodes any 17-character automotive VIN using the live US DOT NHTSA vPIC API, returning make, model, model year, engine displacement, cylinders, fuel type, body class, and plant details.",
    inputSchema: {
      type: "object",
      properties: {
        vin: {
          type: "string",
          description: "17-character Vehicle Identification Number (VIN)",
          minLength: 11,
          maxLength: 17,
        },
      },
      required: ["vin"],
    },
  },
];

async function decodeVinFromNhtsa(rawVin) {
  const vin = String(rawVin || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-HJ-NPR-Z0-9]/g, "");

  if (vin.length < 11 || vin.length > 17) {
    throw new Error(
      `Invalid VIN "${rawVin}". Expected 17 alphanumeric characters (excluding I, O, Q).`
    );
  }

  const endpoint = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(
    vin
  )}?format=json`;

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`NHTSA vPIC HTTP ${response.status}: ${response.statusText}`);
  }

  const payload = await response.json();
  const row = payload?.Results?.[0];

  if (!row) {
    throw new Error("NHTSA vPIC returned an empty Results array.");
  }

  return {
    vin,
    make: row.Make || "UNKNOWN",
    model: row.Model || "UNKNOWN",
    modelYear: row.ModelYear || "UNKNOWN",
    trim: row.Trim || row.Series || "",
    bodyClass: row.BodyClass || "",
    driveType: row.DriveType || "",
    engineCylinders: row.EngineCylinders || "",
    displacementL: row.DisplacementL || "",
    engineHP: row.EngineHP || "",
    fuelTypePrimary: row.FuelTypePrimary || "",
    electrificationLevel: row.ElectrificationLevel || "",
    transmissionStyle: row.TransmissionStyle || "",
    plantCountry: row.PlantCountry || "",
    plantCity: row.PlantCity || "",
    manufacturer: row.Manufacturer || "",
    errorCode: row.ErrorCode || "0",
    errorText: row.ErrorText || "",
  };
}

function sendResponse(id, result) {
  process.stdout.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      result,
    }) + "\n"
  );
}

function sendError(id, code, message, data) {
  process.stdout.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code, message, ...(data !== undefined ? { data } : {}) },
    }) + "\n"
  );
}

async function handleRpcMessage(msg) {
  if (!msg || typeof msg !== "object") return;

  const { id, method, params } = msg;

  // Notifications have no id and require no response
  if (id === undefined || id === null) {
    return;
  }

  try {
    switch (method) {
      case "initialize": {
        sendResponse(id, {
          protocolVersion: params?.protocolVersion || "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: SERVER_INFO,
        });
        break;
      }

      case "ping": {
        sendResponse(id, {});
        break;
      }

      case "tools/list": {
        sendResponse(id, { tools: TOOLS });
        break;
      }

      case "tools/call": {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        if (toolName !== "decode_vin") {
          sendError(id, -32602, `Unknown tool: ${toolName}`);
          return;
        }

        try {
          const decoded = await decodeVinFromNhtsa(toolArgs.vin);
          sendResponse(id, {
            content: [
              {
                type: "text",
                text: JSON.stringify(decoded, null, 2),
              },
            ],
            isError: false,
          });
        } catch (toolErr) {
          sendResponse(id, {
            content: [
              {
                type: "text",
                text: `VIN decode error: ${
                  toolErr instanceof Error ? toolErr.message : String(toolErr)
                }`,
              },
            ],
            isError: true,
          });
        }
        break;
      }

      default: {
        sendError(id, -32601, `Method not found: ${method}`);
      }
    }
  } catch (err) {
    sendError(
      id,
      -32603,
      err instanceof Error ? err.message : "Internal MCP server error"
    );
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const parsed = JSON.parse(trimmed);
    void handleRpcMessage(parsed);
  } catch {
    sendError(null, -32700, "Parse error: invalid JSON-RPC payload");
  }
});
