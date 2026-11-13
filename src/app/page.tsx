"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ALL_PID_KEYS,
  MechanicalCursePreset,
  PidKey,
  UNIVERSAL_PID_REGISTRY,
  VEHICLE_SOUL_PRESETS,
  VehicleArchitectureId,
  buildCANResponseFrame,
  calculateDynoMetrics,
  calculateEscrowRateCents,
  generateSampleTelemetryCsv,
  parseRawCANFrame,
} from "@/lib/obd-hex-engine";
import {
  ConnectionMode,
  DecodedNhtsaVin,
  TopCommandBar,
} from "@/components/hexorcist/TopCommandBar";
import {
  FrameLogEntry,
  LeftHexTerminalColumn,
} from "@/components/hexorcist/LeftHexTerminalColumn";
import {
  CenterDiagnosticColumn,
  CenterTabId,
  DynoCurvePoint,
  ScopeSample,
  UdsHandshakeEntry,
} from "@/components/hexorcist/CenterDiagnosticColumn";
import {
  EscrowLedgerEntry,
  RightNecromancerVaultColumn,
} from "@/components/hexorcist/RightNecromancerVaultColumn";
import type { DiagnoseResponsePayload } from "@/app/api/diagnose/route";

interface WebSerialPortLike {
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable?: ReadableStream<Uint8Array>;
  writable?: WritableStream<Uint8Array>;
}

const nowTimeStr = (): string => {
  const d = new Date();
  return d.toTimeString().slice(0, 8) + "." + String(d.getMilliseconds()).padStart(3, "0");
};

function buildInitialDynoCurve(
  vehicleId: VehicleArchitectureId,
  lossPct: number
): DynoCurvePoint[] {
  const soul = VEHICLE_SOUL_PRESETS[vehicleId];
  const pts: DynoCurvePoint[] = [];
  let prevSpeed = 52;

  for (let rpm = 2000; rpm <= 7000; rpm += 250) {
    const norm = (rpm - 2000) / 5000;
    const torqueShape = Math.sin(norm * Math.PI * 0.88 + 0.18);
    const speedStep = 3.8 + torqueShape * 2.95 * (soul.peakHealthyWhp / 340);
    const currSpeed = prevSpeed + speedStep;
    const metrics = calculateDynoMetrics({
      currentSpeedKmh: currSpeed,
      prevSpeedKmh: prevSpeed,
      deltaTimeSec: 0.22,
      rpm,
      curbWeightKg: soul.curbWeightKg,
      dragCoefficientCd: soul.dragCoefficientCd,
      frontalAreaM2: soul.frontalAreaM2,
    });
    prevSpeed = currSpeed;
    const scaleFactor = soul.peakHealthyWhp / Math.max(180, metrics.whp * 1.05);
    const healthyWhp = Math.round(
      Math.min(soul.peakHealthyWhp, metrics.whp * (0.62 + 0.42 * norm) * scaleFactor)
    );
    const actualWhp = Math.round(healthyWhp * (1 - lossPct / 100));
    const healthyTorque = Math.round((healthyWhp * 5252) / rpm);
    const actualTorque = Math.round((actualWhp * 5252) / rpm);
    pts.push({ rpm, healthyWhp, actualWhp, healthyTorque, actualTorque });
  }
  return pts;
}

export default function HexorcistDashboardPage() {
  const [activeVehicleId, setActiveVehicleId] =
    useState<VehicleArchitectureId>("GERMAN_V6_DSG");
  const soul = VEHICLE_SOUL_PRESETS[activeVehicleId];

  const [crtEnabled, setCrtEnabled] = useState<boolean>(true);
  const [connectionMode, setConnectionMode] =
    useState<ConnectionMode>("VIRTUAL ECU 25Hz");
  const [activeVin, setActiveVin] = useState<string>(soul.defaultVin);
  const [decodedVinInfo, setDecodedVinInfo] = useState<DecodedNhtsaVin | null>(null);

  const [activeCurse, setActiveCurse] = useState<MechanicalCursePreset | null>(
    soul.curses[0]
  );
  const [customDtc, setCustomDtc] = useState<string>(soul.curses[0].dtcCode);
  const [telemetry, setTelemetry] = useState<Record<PidKey, number>>({
    ...soul.baselineTelemetry,
    ...(soul.curses[0].telemetryOverrides as Partial<Record<PidKey, number>>),
  });

  const [frames, setFrames] = useState<FrameLogEntry[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<FrameLogEntry | null>(null);
  const [streamPaused, setStreamPaused] = useState<boolean>(false);
  const [webSerialStatus, setWebSerialStatus] = useState<string>(
    "25Hz Virtual ECU Active — WebSerial & CSV Ready"
  );

  const [activeTab, setActiveTab] = useState<CenterTabId>("OSCILLOSCOPE");
  const [scopePid, setScopePid] = useState<PidKey>(soul.primaryPid);
  const [scopeHistory, setScopeHistory] = useState<ScopeSample[]>([]);

  const [dynoCurve, setDynoCurve] = useState<DynoCurvePoint[]>(() =>
    buildInitialDynoCurve("GERMAN_V6_DSG", soul.curses[0].powerLossPct)
  );
  const [dynoRunning, setDynoRunning] = useState<boolean>(false);

  const [udsLogs, setUdsLogs] = useState<UdsHandshakeEntry[]>([
    {
      id: "uds-boot-1",
      timestamp: "00:00:00.120",
      direction: "TX 7E0",
      hex: "7E0 02 10 03 11",
      description: "ISO 14229 DiagnosticSessionControl -> ExtendedSession (0x03)",
      status: "OK",
    },
    {
      id: "uds-boot-2",
      timestamp: "00:00:00.142",
      direction: "RX 7E8",
      hex: "7E8 06 50 03 00 32 01 F4 9A",
      description: "Positive Response Extended Diagnostic Session Unlocked",
      status: "OK",
    },
  ]);

  const [autopsyLoading, setAutopsyLoading] = useState<boolean>(false);
  const [autopsyResult, setAutopsyResult] = useState<DiagnoseResponsePayload | null>(null);

  const [escrowBalanceCents, setEscrowBalanceCents] = useState<number>(48250);
  const [ledgerEntries, setLedgerEntries] = useState<EscrowLedgerEntry[]>([
    {
      id: "init-1",
      transferId: "tr_kiroween_9f81a0c4",
      timestamp: "08:15:02",
      type: "COMMUTE_WITHHOLDING",
      miles: 25,
      rateCentsPerMile: 5,
      amountCents: 125,
      balanceAfterCents: 48250,
      note: "25 mi Nominal Baseline Sweep ($0.05/mi)",
    },
  ]);

  const tickCounterRef = useRef<number>(0);
  const serialPortRef = useRef<WebSerialPortLike | null>(null);
  const csvQueueRef = useRef<string[]>([]);

  const anomalyScore = useMemo(() => {
    if (activeCurse) return activeCurse.severityScore;
    let warnings = 0;
    for (const k of ALL_PID_KEYS) {
      const def = UNIVERSAL_PID_REGISTRY[k];
      const v = telemetry[k];
      if (v < def.warnLow || v > def.warnHigh) warnings += 18;
    }
    return Math.min(100, warnings);
  }, [activeCurse, telemetry]);

  const escrowRateCentsPerMile = useMemo(
    () => calculateEscrowRateCents(anomalyScore, activeCurse ? 1 : 0),
    [anomalyScore, activeCurse]
  );

  const ingestRawFrame = useCallback((rawFrame: string) => {
    const parsed = parseRawCANFrame(rawFrame);
    if (!parsed.valid || !parsed.pidKey || parsed.value === null) return;

    const entry: FrameLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: nowTimeStr(),
      rawFrame,
      parsed,
    };

    setFrames((prev) => [entry, ...prev.slice(0, 44)]);
    setTelemetry((prev) => ({
      ...prev,
      [parsed.pidKey as PidKey]: parsed.value as number,
    }));
  }, []);

  // 25Hz (40ms) Virtual ECU & CSV Replay Engine
  useEffect(() => {
    if (streamPaused || connectionMode === "WEBSERIAL ELM327") return;

    const interval = setInterval(() => {
      const step = tickCounterRef.current++;

      if (connectionMode === "CSV REPLAY" && csvQueueRef.current.length > 0) {
        const nextFrame = csvQueueRef.current[step % csvQueueRef.current.length];
        ingestRawFrame(nextFrame);
        return;
      }

      const pid = ALL_PID_KEYS[step % ALL_PID_KEYS.length];
      const def = UNIVERSAL_PID_REGISTRY[pid];
      const targetVal = soul.baselineTelemetry[pid];
      const baseActual =
        activeCurse && activeCurse.telemetryOverrides[pid] !== undefined
          ? (activeCurse.telemetryOverrides[pid] as number)
          : targetVal;

      const wave =
        Math.sin(step * 0.24) * Math.max(def.tolerance * 1.5, Math.abs(baseActual) * 0.018);
      const noisyVal = Math.min(def.max, Math.max(def.min, baseActual + wave));
      const frame = buildCANResponseFrame(pid, noisyVal);
      ingestRawFrame(frame);

      if (step % 2 === 0) {
        const scopeDef = UNIVERSAL_PID_REGISTRY[scopePid];
        const scopeTarget = soul.baselineTelemetry[scopePid];
        const scopeBase =
          activeCurse && activeCurse.telemetryOverrides[scopePid] !== undefined
            ? (activeCurse.telemetryOverrides[scopePid] as number)
            : scopeTarget;
        const scopeActual = Math.min(
          scopeDef.max,
          Math.max(
            scopeDef.min,
            scopeBase +
              Math.sin(step * 0.22) *
                Math.max(scopeDef.tolerance, Math.abs(scopeBase) * 0.025)
          )
        );
        setScopeHistory((prev) => [
          ...prev.slice(-49),
          {
            tick: `${(step * 0.04).toFixed(1)}s`,
            target: Number(scopeTarget.toFixed(2)),
            actual: Number(scopeActual.toFixed(2)),
          },
        ]);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [streamPaused, connectionMode, soul, activeCurse, scopePid, ingestRawFrame]);

  const handleSelectVehicle = (id: VehicleArchitectureId) => {
    const nextSoul = VEHICLE_SOUL_PRESETS[id];
    const defaultCurse = nextSoul.curses[0];
    setActiveVehicleId(id);
    setActiveVin(nextSoul.defaultVin);
    setDecodedVinInfo(null);
    setActiveCurse(defaultCurse);
    setCustomDtc(defaultCurse.dtcCode);
    setScopePid(nextSoul.primaryPid);
    setTelemetry({
      ...nextSoul.baselineTelemetry,
      ...(defaultCurse.telemetryOverrides as Partial<Record<PidKey, number>>),
    });
    setScopeHistory([]);
    setAutopsyResult(null);
    setDynoCurve(buildInitialDynoCurve(id, defaultCurse.powerLossPct));
  };

  const handleCastCurse = (curse: MechanicalCursePreset) => {
    setActiveCurse(curse);
    setCustomDtc(curse.dtcCode);
    setScopePid(curse.targetPid);
    setDynoCurve(buildInitialDynoCurve(activeVehicleId, curse.powerLossPct));
  };

  const handleClearCurses = () => {
    setActiveCurse(null);
    setTelemetry({ ...soul.baselineTelemetry });
    setDynoCurve(buildInitialDynoCurve(activeVehicleId, 0));
  };

  const handleConnectWebSerial = async () => {
    try {
      const nav = navigator as Navigator & {
        serial?: { requestPort: () => Promise<WebSerialPortLike> };
      };
      if (!nav.serial) {
        setWebSerialStatus(
          "WebSerial unavailable in this browser — using 25Hz Virtual ECU"
        );
        return;
      }
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: 38400 });
      serialPortRef.current = port;
      setConnectionMode("WEBSERIAL ELM327");
      setWebSerialStatus("ELM327 Connected @ 38400 baud (ISO 15765-4 CAN 500k)");

      if (port.writable) {
        const writer = port.writable.getWriter();
        const enc = new TextEncoder();
        for (const cmd of ["ATZ\r", "ATE0\r", "ATL0\r", "ATH1\r", "ATSP6\r", "010C\r"]) {
          await writer.write(enc.encode(cmd));
        }
        writer.releaseLock();
      }

      if (port.readable) {
        const reader = port.readable.getReader();
        const dec = new TextDecoder();
        let buf = "";
        void (async () => {
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buf += dec.decode(value, { stream: true });
              const lines = buf.split(/[\r\n>]+/);
              buf = lines.pop() ?? "";
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith("7E")) ingestRawFrame(trimmed);
              }
            }
          } catch {
            setWebSerialStatus("WebSerial link closed — Virtual ECU resumed");
            setConnectionMode("VIRTUAL ECU 25Hz");
          } finally {
            reader.releaseLock();
          }
        })();
      }
    } catch (err) {
      setWebSerialStatus(
        err instanceof Error
          ? `WebSerial: ${err.message}`
          : "WebSerial port selection cancelled"
      );
    }
  };

  const handleDisconnectExternal = async () => {
    try {
      await serialPortRef.current?.close();
    } catch {
      // ignore close errors
    }
    serialPortRef.current = null;
    csvQueueRef.current = [];
    setConnectionMode("VIRTUAL ECU 25Hz");
    setWebSerialStatus("Returned to 25Hz Virtual ECU Telemetry");
  };

  const handleDownloadSampleCsv = () => {
    const csv = generateSampleTelemetryCsv(activeVehicleId);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hexorcist_${activeVehicleId.toLowerCase()}_can_log.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setWebSerialStatus(`Exported 48-frame CAN CSV log for ${soul.codename}`);
  };

  const handleUploadCsvFile = async (file: File) => {
    const text = await file.text();
    const extracted: string[] = [];
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/7E[8-F]\s+[0-9A-Fa-f]{2}(?:\s+[0-9A-Fa-f]{2}){4,7}/);
      if (match) extracted.push(match[0].toUpperCase());
    }
    if (extracted.length === 0) {
      setWebSerialStatus("CSV contained no valid 7E8 ISO 15765-4 hex frames");
      return;
    }
    csvQueueRef.current = extracted;
    setConnectionMode("CSV REPLAY");
    setWebSerialStatus(`Replaying ${extracted.length} CAN frames from ${file.name}`);
  };

  const handleRunDynoPull = () => {
    if (dynoRunning) return;
    setDynoRunning(true);
    const fullCurve = buildInitialDynoCurve(
      activeVehicleId,
      activeCurse ? activeCurse.powerLossPct : 0
    );
    setDynoCurve([]);
    fullCurve.forEach((pt, idx) => {
      setTimeout(() => {
        setDynoCurve((prev) => [...prev, pt]);
        setTelemetry((prev) => ({ ...prev, "010C": pt.rpm }));
        if (idx === fullCurve.length - 1) setDynoRunning(false);
      }, idx * 75);
    });
  };

  const handleDispatchUdsCommand = (mode: "04" | "2F" | "31") => {
    const tTx = nowTimeStr();
    const tRx = nowTimeStr();

    if (mode === "04") {
      setUdsLogs((prev) => [
        {
          id: `${Date.now()}-rx`,
          timestamp: tRx,
          direction: "RX 7E8",
          hex: "7E8 01 44 45",
          description:
            "SAE J1979 Mode 44 Positive Response — Stored DTCs & Fuel Trims Exorcised",
          status: "OK",
        },
        {
          id: `${Date.now()}-tx`,
          timestamp: tTx,
          direction: "TX 7E0",
          hex: "7E0 01 04 05",
          description: "SAE J1979 Mode 04 Clear/Reset Emission & Powertrain DTCs",
          status: "OK",
        },
        ...prev,
      ]);
      handleClearCurses();
    } else if (mode === "2F") {
      setUdsLogs((prev) => [
        {
          id: `${Date.now()}-rx`,
          timestamp: tRx,
          direction: "RX 7E8",
          hex: "7E8 05 6F F0 10 03 74",
          description:
            "ISO 14229 InputOutputControlByIdentifier — Aux Cooling Fans Locked @ 100% Duty",
          status: "OK",
        },
        {
          id: `${Date.now()}-tx`,
          timestamp: tTx,
          direction: "TX 7E0",
          hex: "7E0 05 2F F0 10 03 FF",
          description: "ISO 14229 Mode 2F Override Cooling Fan & Chiller PWM Actuators",
          status: "OK",
        },
        ...prev,
      ]);
      setTelemetry((prev) => ({
        ...prev,
        "0105": Math.max(76, (prev["0105"] ?? 90) - 22),
        "015C": Math.max(68, (prev["015C"] ?? 85) - 24),
      }));
    } else {
      setUdsLogs((prev) => [
        {
          id: `${Date.now()}-rx`,
          timestamp: tRx,
          direction: "RX 7E8",
          hex: "7E8 04 71 01 FF 0A 80",
          description:
            "ISO 14229 RoutineControl Positive Response — Subsystem Adaptation & Regen Complete",
          status: "OK",
        },
        {
          id: `${Date.now()}-tx`,
          timestamp: tTx,
          direction: "TX 7E0",
          hex: "7E0 04 31 01 FF 0A C0",
          description:
            "ISO 14229 Mode 31 StartRoutine (Mechatronic Kiss-Point / BMS Balance / DPF Regen)",
          status: "OK",
        },
        ...prev,
      ]);
      handleClearCurses();
    }
  };

  const handleRunAutopsy = async () => {
    setAutopsyLoading(true);
    try {
      const targetFrame =
        selectedFrame?.rawFrame ??
        frames[0]?.rawFrame ??
        buildCANResponseFrame(soul.primaryPid, telemetry[soul.primaryPid]);

      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: activeVehicleId,
          vin: activeVin,
          rawCanFrame: targetFrame,
          dtcCode: activeCurse?.dtcCode ?? customDtc,
          telemetrySnapshot: telemetry,
        }),
      });
      const json = (await res.json()) as DiagnoseResponsePayload;
      setAutopsyResult(json);
    } finally {
      setAutopsyLoading(false);
    }
  };

  const handleSimulateCommuteDeposit = () => {
    const miles = 25;
    const depositCents = miles * escrowRateCentsPerMile;
    const nextBalance = escrowBalanceCents + depositCents;
    const txHash = Math.random().toString(16).slice(2, 10);
    setEscrowBalanceCents(nextBalance);
    setLedgerEntries((prev) => [
      {
        id: `${Date.now()}-${txHash}`,
        transferId: `tr_kiroween_${txHash}`,
        timestamp: new Date().toTimeString().slice(0, 8),
        type: "COMMUTE_WITHHOLDING",
        miles,
        rateCentsPerMile: escrowRateCentsPerMile,
        amountCents: depositCents,
        balanceAfterCents: nextBalance,
        note: `25 mi @ $${(escrowRateCentsPerMile / 100).toFixed(2)}/mi (${
          activeCurse ? `DTC ${activeCurse.dtcCode}` : "Nominal"
        })`,
      },
      ...prev,
    ]);
  };

  const handleReleaseMechanicEscrow = (shopName: string, amountCents: number) => {
    const safeDeduction = Math.min(escrowBalanceCents, Math.max(0, amountCents));
    const nextBalance = Math.max(0, escrowBalanceCents - safeDeduction);
    const txHash = Math.random().toString(16).slice(2, 10);
    setEscrowBalanceCents(nextBalance);
    setLedgerEntries((prev) => [
      {
        id: `${Date.now()}-${txHash}`,
        transferId: `tr_kiroween_rel_${txHash}`,
        timestamp: new Date().toTimeString().slice(0, 8),
        type: "MECHANIC_RELEASE",
        miles: 0,
        rateCentsPerMile: escrowRateCentsPerMile,
        amountCents: safeDeduction,
        balanceAfterCents: nextBalance,
        note: `Escrow Released -> ${shopName}`,
      },
      ...prev,
    ]);
  };

  const peakActualWhp = useMemo(
    () => dynoCurve.reduce((max, p) => Math.max(max, p.actualWhp), 0),
    [dynoCurve]
  );
  const peakActualTorque = useMemo(
    () => dynoCurve.reduce((max, p) => Math.max(max, p.actualTorque), 0),
    [dynoCurve]
  );

  return (
    <div className={`min-h-screen bg-[#06070A] text-white ${crtEnabled ? "crt-scanlines" : ""}`}>
      <TopCommandBar
        activeVehicleId={activeVehicleId}
        onSelectVehicle={handleSelectVehicle}
        connectionMode={connectionMode}
        crtEnabled={crtEnabled}
        onToggleCrt={() => setCrtEnabled((v) => !v)}
        activeVin={activeVin}
        decodedVinInfo={decodedVinInfo}
        onApplyVin={(vin, decoded) => {
          setActiveVin(vin);
          setDecodedVinInfo(decoded);
        }}
        hasActiveFault={Boolean(activeCurse)}
      />

      <main className="mx-auto max-w-[1840px] px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-3">
            <LeftHexTerminalColumn
              soul={soul}
              frames={frames}
              selectedFrame={selectedFrame}
              onSelectFrame={setSelectedFrame}
              streamPaused={streamPaused}
              onTogglePause={() => setStreamPaused((p) => !p)}
              activeCurse={activeCurse}
              onCastCurse={handleCastCurse}
              onClearCurses={handleClearCurses}
              connectionMode={connectionMode}
              webSerialStatus={webSerialStatus}
              onConnectWebSerial={handleConnectWebSerial}
              onDisconnectExternalSource={handleDisconnectExternal}
              onDownloadSampleCsv={handleDownloadSampleCsv}
              onUploadCsvFile={handleUploadCsvFile}
            />
          </div>

          <div className="lg:col-span-6">
            <CenterDiagnosticColumn
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              soul={soul}
              activeCurse={activeCurse}
              telemetry={telemetry}
              scopePid={scopePid}
              onSelectScopePid={setScopePid}
              scopeHistory={scopeHistory}
              dynoCurve={dynoCurve}
              dynoRunning={dynoRunning}
              peakActualWhp={peakActualWhp}
              peakActualTorque={peakActualTorque}
              onRunDynoPull={handleRunDynoPull}
              udsLogs={udsLogs}
              onDispatchUdsCommand={handleDispatchUdsCommand}
            />
          </div>

          <div className="lg:col-span-3">
            <RightNecromancerVaultColumn
              activeDtc={activeCurse?.dtcCode ?? customDtc}
              onChangeCustomDtc={setCustomDtc}
              autopsyLoading={autopsyLoading}
              autopsyResult={autopsyResult}
              onRunAutopsy={handleRunAutopsy}
              onApplyRecommendedUds={() => {
                setActiveTab("UDS_TERMINAL");
                const rec = autopsyResult?.recommendedUdsCommand ?? "";
                if (rec.startsWith("04")) handleDispatchUdsCommand("04");
                else if (rec.startsWith("2F")) handleDispatchUdsCommand("2F");
                else handleDispatchUdsCommand("31");
              }}
              escrowBalanceCents={escrowBalanceCents}
              escrowRateCentsPerMile={escrowRateCentsPerMile}
              anomalyScore={anomalyScore}
              ledgerEntries={ledgerEntries}
              onSimulateCommuteDeposit={handleSimulateCommuteDeposit}
              onReleaseMechanicEscrow={handleReleaseMechanicEscrow}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

