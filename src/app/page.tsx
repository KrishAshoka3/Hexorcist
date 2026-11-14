"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ALL_PID_KEYS,
  MechanicalCursePreset,
  PidKey,
  SoulProfileId,
  UNIVERSAL_PID_REGISTRY,
  VEHICLE_SOUL_PRESETS,
  VehicleArchitectureId,
  VehicleSoulPreset,
  buildCANResponseFrame,
  calculateDynoMetrics,
  calculateEscrowRateCents,
  parseRawCANFrame,
} from "@/lib/obd-hex-engine";
import {
  TelemetryPlaybackFrame,
  buildCustomVinSoul,
  generateSampleCSV,
  parseTelemetryCSV,
} from "@/lib/log-and-dbc-engine";
import {
  CsvPlaybackScrubberBar,
  HardwareAndDbcModal,
  HardwareStudioTab,
  PlaybackSpeedMultiplier,
} from "@/components/HardwareAndDbcModal";
import {
  ConnectionMode,
  DecodedNhtsaVin,
  TopCommandBar,
  WorkspaceViewMode,
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
import { EngineerProHardwareDock } from "@/components/hexorcist/EngineerProHardwareDock";
import {
  JUDGE_TOUR_STEPS,
  JudgeGuidedTour,
  JudgeTourStepNumber,
} from "@/components/hexorcist/JudgeGuidedTour";
import { KiroArchitectureDrawer } from "@/components/hexorcist/KiroArchitectureDrawer";
import {
  CinemaSpotlightPanelId,
  DemoVideoDirector,
} from "@/components/DemoVideoDirector";
import { StandardObdScannerModal } from "@/components/StandardObdScannerModal";
import { MechanicSpecSheetModal } from "@/components/MechanicSpecSheetModal";
import {
  playHexSound,
  setSoundMuted as persistSoundMuted,
} from "@/lib/sound-fx";
import { ArrowRight, CheckCircle2 } from "lucide-react";
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

let monotonicEntryCounter = 0;
const makeUniqueEntryId = (prefix: string): string => {
  monotonicEntryCounter = (monotonicEntryCounter + 1) % 1_000_000;
  return `${prefix}-${Date.now()}-${monotonicEntryCounter}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
};

function buildInitialDynoCurve(
  soul: VehicleSoulPreset,
  lossPct: number
): DynoCurvePoint[] {
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
  const [customVinSoul, setCustomVinSoul] = useState<VehicleSoulPreset | null>(null);
  const [activeVehicleId, setActiveVehicleId] =
    useState<SoulProfileId>("GERMAN_V6_DSG");
  const soul: VehicleSoulPreset =
    activeVehicleId === "CUSTOM_VIN_SOUL" && customVinSoul
      ? customVinSoul
      : VEHICLE_SOUL_PRESETS[activeVehicleId as VehicleArchitectureId] ??
        VEHICLE_SOUL_PRESETS.GERMAN_V6_DSG;

  const [viewMode, setViewMode] = useState<WorkspaceViewMode>("FOCUSED");
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<1 | 2 | 3>(1);
  const [soundMuted, setSoundMutedState] = useState<boolean>(false);
  const [kiroDrawerOpen, setKiroDrawerOpen] = useState<boolean>(false);
  const [kiroAutoRunTrigger, setKiroAutoRunTrigger] = useState<number>(0);
  const [cinemaLauncherOpen, setCinemaLauncherOpen] = useState<boolean>(false);
  const [cinemaRunning, setCinemaRunning] = useState<boolean>(false);
  const [cinemaRecording, setCinemaRecording] = useState<boolean>(false);
  const [cinemaSpotlightPanel, setCinemaSpotlightPanel] =
    useState<CinemaSpotlightPanelId | null>(null);
  const [cinemaSignalIndex, setCinemaSignalIndex] = useState<number | null>(null);
  const [cinemaVinModalOpen, setCinemaVinModalOpen] = useState<boolean>(false);
  const [cinemaTooltipPid, setCinemaTooltipPid] = useState<
    "22F40A" | "0106" | "0142" | null
  >(null);
  const [obdScannerModalOpen, setObdScannerModalOpen] = useState<boolean>(false);
  const [scannerSweepTrigger, setScannerSweepTrigger] = useState<number>(0);
  const [mechanicSpecModalOpen, setMechanicSpecModalOpen] = useState<boolean>(false);
  const [shopQuoteUsd, setShopQuoteUsd] = useState<number>(2450);
  const [guidedTourStep, setGuidedTourStep] = useState<JudgeTourStepNumber | null>(null);
  const [tourAutoPlaying, setTourAutoPlaying] = useState<boolean>(true);
  const [tourStepProgressPct, setTourStepProgressPct] = useState<number>(0);

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
    buildInitialDynoCurve(VEHICLE_SOUL_PRESETS.GERMAN_V6_DSG, soul.curses[0].powerLossPct)
  );
  const [dynoRunning, setDynoRunning] = useState<boolean>(false);

  const [hardwareModalOpen, setHardwareModalOpen] = useState<boolean>(false);
  const [hardwareStudioTab, setHardwareStudioTab] =
    useState<HardwareStudioTab>("CSV_REPLAY");
  const [csvFrames, setCsvFrames] = useState<TelemetryPlaybackFrame[]>([]);
  const [csvCursor, setCsvCursor] = useState<number>(0);
  const [csvPlaying, setCsvPlaying] = useState<boolean>(false);
  const [csvSpeed, setCsvSpeed] = useState<PlaybackSpeedMultiplier>(1);
  const [csvSourceLabel, setCsvSourceLabel] = useState<string>(
    "ISO 15765-4 / SAE J1979 CAN Telemetry CSV"
  );
  const [physicalPortConnected, setPhysicalPortConnected] = useState<boolean>(false);
  const [loopbackActive, setLoopbackActive] = useState<boolean>(false);

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

  const handleToggleSoundMuted = () => {
    const next = !soundMuted;
    setSoundMutedState(next);
    persistSoundMuted(next);
    if (!next) {
      playHexSound("CLICK");
    }
  };

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
      id: makeUniqueEntryId("frame"),
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

  const applyCsvFrameToDashboard = useCallback(
    (frame: TelemetryPlaybackFrame, currentSoul: VehicleSoulPreset) => {
      ingestRawFrame(frame.rawHexFrame);
      setTelemetry((prev) => ({
        ...prev,
        "010C": frame.rpm,
        "010D": frame.speedKmh,
        "0105": frame.coolantC,
        "0106": frame.stftPct,
        "0142": frame.voltageV,
        [currentSoul.primaryPid]: frame.primarySensorActual,
      }));

      const scopeTarget =
        scopePid === currentSoul.primaryPid
          ? frame.primarySensorTarget
          : scopePid === "0106"
          ? 0
          : currentSoul.baselineTelemetry[scopePid];
      const scopeActual =
        scopePid === currentSoul.primaryPid
          ? frame.primarySensorActual
          : scopePid === "010C"
          ? frame.rpm
          : scopePid === "010D"
          ? frame.speedKmh
          : scopePid === "0105"
          ? frame.coolantC
          : scopePid === "0106"
          ? frame.stftPct
          : scopePid === "0142"
          ? frame.voltageV
          : frame.primarySensorActual;

      setScopeHistory((prev) => [
        ...prev.slice(-49),
        {
          tick: `${(frame.timestampMs / 1000).toFixed(1)}s`,
          target: Number(scopeTarget.toFixed(2)),
          actual: Number(scopeActual.toFixed(2)),
        },
      ]);

      if (frame.activeDtc !== "NONE") {
        setCustomDtc(frame.activeDtc);
        const matched =
          currentSoul.curses.find((c) => c.dtcCode === frame.activeDtc) ??
          currentSoul.curses[0];
        setActiveCurse(matched);
      } else {
        setActiveCurse(null);
      }
    },
    [ingestRawFrame, scopePid]
  );

  // 25Hz (40ms) Virtual ECU Engine
  useEffect(() => {
    if (streamPaused || connectionMode !== "VIRTUAL ECU 25Hz") return;

    const interval = setInterval(() => {
      const step = tickCounterRef.current++;
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
      ingestRawFrame(buildCANResponseFrame(pid, noisyVal));

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

  // Synchronized 1x / 2x / 5x CSV Scrubber Replay Engine
  useEffect(() => {
    if (
      connectionMode !== "CSV REPLAY" ||
      !csvPlaying ||
      streamPaused ||
      csvFrames.length === 0
    ) {
      return;
    }
    const stepDelayMs = Math.max(20, Math.round(100 / csvSpeed));
    const timer = setInterval(() => {
      setCsvCursor((prev) => {
        const next = (prev + 1) % csvFrames.length;
        applyCsvFrameToDashboard(csvFrames[next], soul);
        return next;
      });
    }, stepDelayMs);

    return () => clearInterval(timer);
  }, [connectionMode, csvPlaying, streamPaused, csvFrames, csvSpeed, soul, applyCsvFrameToDashboard]);

  const handleSelectVehicle = (id: SoulProfileId) => {
    const nextSoul =
      id === "CUSTOM_VIN_SOUL" && customVinSoul
        ? customVinSoul
        : VEHICLE_SOUL_PRESETS[id as VehicleArchitectureId] ??
          VEHICLE_SOUL_PRESETS.GERMAN_V6_DSG;
    const defaultCurse = nextSoul.curses[0];
    setActiveVehicleId(id);
    setActiveVin(nextSoul.defaultVin);
    if (id !== "CUSTOM_VIN_SOUL") setDecodedVinInfo(null);
    setActiveCurse(defaultCurse);
    setCustomDtc(defaultCurse.dtcCode);
    setScopePid(nextSoul.primaryPid);
    setTelemetry({
      ...nextSoul.baselineTelemetry,
      ...(defaultCurse.telemetryOverrides as Partial<Record<PidKey, number>>),
    });
    setScopeHistory([]);
    setAutopsyResult(null);
    setDynoCurve(buildInitialDynoCurve(nextSoul, defaultCurse.powerLossPct));
  };

  const handleBindCustomVinSoul = (decoded: DecodedNhtsaVin) => {
    const boundSoul = buildCustomVinSoul(decoded);
    const defaultCurse = boundSoul.curses[0];
    setCustomVinSoul(boundSoul);
    setActiveVehicleId("CUSTOM_VIN_SOUL");
    setActiveVin(boundSoul.defaultVin);
    setDecodedVinInfo(decoded);
    setActiveCurse(defaultCurse);
    setCustomDtc(defaultCurse.dtcCode);
    setScopePid(boundSoul.primaryPid);
    setTelemetry({
      ...boundSoul.baselineTelemetry,
      ...(defaultCurse.telemetryOverrides as Partial<Record<PidKey, number>>),
    });
    setScopeHistory([]);
    setAutopsyResult(null);
    setDynoCurve(buildInitialDynoCurve(boundSoul, defaultCurse.powerLossPct));
    setWebSerialStatus(
      `Bound Custom VIN Soul: ${boundSoul.yearMakeModel} (${boundSoul.defaultVin})`
    );
  };

  const handleCastCurse = (curse: MechanicalCursePreset) => {
    playHexSound("FAULT_ALERT");
    setActiveCurse(curse);
    setCustomDtc(curse.dtcCode);
    setScopePid(curse.targetPid);
    setDynoCurve(buildInitialDynoCurve(soul, curse.powerLossPct));
    setActiveWorkflowStep(2);
  };

  const handleClearCurses = () => {
    playHexSound("EXORCISM_CHIME");
    setActiveCurse(null);
    setTelemetry({ ...soul.baselineTelemetry });
    setDynoCurve(buildInitialDynoCurve(soul, 0));
  };

  const handleConnectPhysicalSerial = async (): Promise<boolean> => {
    try {
      const nav = navigator as Navigator & {
        serial?: { requestPort: () => Promise<WebSerialPortLike> };
      };
      if (!nav.serial) {
        setWebSerialStatus(
          "WebSerial API unavailable — switch to Virtual Loopback COM Port"
        );
        return false;
      }
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: 38400 });
      serialPortRef.current = port;
      setPhysicalPortConnected(true);
      setLoopbackActive(false);
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
            setPhysicalPortConnected(false);
            setWebSerialStatus("WebSerial link closed — Virtual ECU resumed");
            setConnectionMode("VIRTUAL ECU 25Hz");
          } finally {
            reader.releaseLock();
          }
        })();
      }
      return true;
    } catch (err) {
      setWebSerialStatus(
        err instanceof Error
          ? `WebSerial: ${err.message} — Virtual Loopback Ready`
          : "Port selection cancelled — Virtual Loopback Ready"
      );
      return false;
    }
  };

  const handleSendPhysicalSerialCommand = async (cmd: string): Promise<boolean> => {
    const port = serialPortRef.current;
    if (!port?.writable) return false;
    try {
      const writer = port.writable.getWriter();
      await writer.write(new TextEncoder().encode(`${cmd}\r`));
      writer.releaseLock();
      return true;
    } catch {
      return false;
    }
  };

  const handleActivateLoopbackPort = () => {
    playHexSound("CLICK");
    setPhysicalPortConnected(false);
    setLoopbackActive(true);
    setConnectionMode("WEBSERIAL ELM327");
    setWebSerialStatus("Virtual Loopback COM4 Active (ELM327 ISO 15765-4 500kbaud)");
  };

  const handleDisconnectExternal = async () => {
    try {
      await serialPortRef.current?.close();
    } catch {
      // ignore close errors
    }
    serialPortRef.current = null;
    csvQueueRef.current = [];
    setPhysicalPortConnected(false);
    setLoopbackActive(false);
    setCsvPlaying(false);
    setConnectionMode("VIRTUAL ECU 25Hz");
    setWebSerialStatus("Returned to 25Hz Virtual ECU Telemetry");
  };

  const startCsvPlaybackSession = (
    parsedFrames: TelemetryPlaybackFrame[],
    label: string
  ) => {
    if (parsedFrames.length === 0) {
      setWebSerialStatus(`No valid telemetry rows found in ${label}`);
      return;
    }
    setCsvFrames(parsedFrames);
    setCsvSourceLabel(label);
    setCsvCursor(0);
    setCsvPlaying(true);
    setScopePid(soul.primaryPid);
    setConnectionMode("CSV REPLAY");
    const seedWindow = parsedFrames.slice(0, 12).map((f) => ({
      tick: `${(f.timestampMs / 1000).toFixed(1)}s`,
      target: Number(f.primarySensorTarget.toFixed(2)),
      actual: Number(f.primarySensorActual.toFixed(2)),
    }));
    setScopeHistory(seedWindow);
    applyCsvFrameToDashboard(parsedFrames[0], soul);
    setWebSerialStatus(`Replaying ${parsedFrames.length} frames from ${label}`);
  };

  const handleSeekCsv = (index: number) => {
    if (csvFrames.length === 0) return;
    const clamped = Math.min(csvFrames.length - 1, Math.max(0, index));
    setCsvCursor(clamped);
    const startWin = Math.max(0, clamped - 30);
    const windowSamples: ScopeSample[] = csvFrames
      .slice(startWin, clamped + 1)
      .map((f) => ({
        tick: `${(f.timestampMs / 1000).toFixed(1)}s`,
        target: Number(f.primarySensorTarget.toFixed(2)),
        actual: Number(f.primarySensorActual.toFixed(2)),
      }));
    setScopeHistory(windowSamples);
    applyCsvFrameToDashboard(csvFrames[clamped], soul);
  };

  const handleLoadBuiltInSampleCsv = () => {
    playHexSound("CLICK");
    const csv = generateSampleCSV(activeVehicleId, customVinSoul);
    const parsedFrames = parseTelemetryCSV(csv);
    setActiveWorkflowStep(2);
    startCsvPlaybackSession(
      parsedFrames,
      `ISO 15765-4 / SAE J1979 CAN Telemetry CSV (${soul.codename})`
    );
  };

  const handleDownloadSampleCsv = () => {
    const csv = generateSampleCSV(activeVehicleId, customVinSoul);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hexorcist_${soul.codename.toLowerCase()}_100row_wot_log.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setWebSerialStatus(`Downloaded 100-row WOT CSV log for ${soul.codename}`);
  };

  const handleUploadCsvFile = async (file: File) => {
    const text = await file.text();
    const parsedFrames = parseTelemetryCSV(text);
    startCsvPlaybackSession(parsedFrames, file.name);
  };

  const handleRunDynoPull = () => {
    if (dynoRunning) return;
    setDynoRunning(true);
    const fullCurve = buildInitialDynoCurve(
      soul,
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
      const rxId = makeUniqueEntryId("uds-rx");
      const txId = makeUniqueEntryId("uds-tx");
      setUdsLogs((prev) => [
        {
          id: rxId,
          timestamp: tRx,
          direction: "RX 7E8",
          hex: "7E8 01 44 45",
          description:
            "SAE J1979 Mode 44 Positive Response — Stored DTCs & Fuel Trims Exorcised",
          status: "OK",
        },
        {
          id: txId,
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
      const rxId = makeUniqueEntryId("uds-rx");
      const txId = makeUniqueEntryId("uds-tx");
      setUdsLogs((prev) => [
        {
          id: rxId,
          timestamp: tRx,
          direction: "RX 7E8",
          hex: "7E8 05 6F F0 10 03 74",
          description:
            "ISO 14229 InputOutputControlByIdentifier — Aux Cooling Fans Locked @ 100% Duty",
          status: "OK",
        },
        {
          id: txId,
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
      const rxId = makeUniqueEntryId("uds-rx");
      const txId = makeUniqueEntryId("uds-tx");
      setUdsLogs((prev) => [
        {
          id: rxId,
          timestamp: tRx,
          direction: "RX 7E8",
          hex: "7E8 04 71 01 F4 0A 8B",
          description:
            "ISO 14229 RoutineControl Positive Response — Solenoid & Sensor Calibration Restored (100% Health)",
          status: "OK",
        },
        {
          id: txId,
          timestamp: tTx,
          direction: "TX 7E0",
          hex: "7E0 04 31 01 F4 0A",
          description:
            "ISO 14229 Mode 31 StartRoutine (Bidirectional Solenoid / BMS / DPF Reset)",
          status: "OK",
        },
        ...prev,
      ]);
      handleClearCurses();
      setActiveWorkflowStep(3);
    }
  };

  const handleRunAutopsy = async (
    endpoint: "/api/autopsy" | "/api/diagnose" = "/api/autopsy"
  ) => {
    playHexSound("AUTOPSY_SCAN");
    setAutopsyLoading(true);
    try {
      const targetFrame =
        selectedFrame?.rawFrame ??
        frames[0]?.rawFrame ??
        buildCANResponseFrame(soul.primaryPid, telemetry[soul.primaryPid]);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: activeVehicleId,
          vin: activeVin,
          rawCanFrame: targetFrame,
          dtcCode: activeCurse?.dtcCode ?? customDtc,
          telemetrySnapshot: telemetry,
          customSoul: activeVehicleId === "CUSTOM_VIN_SOUL" ? customVinSoul ?? undefined : undefined,
        }),
      });
      const json = (await res.json()) as DiagnoseResponsePayload;
      setAutopsyResult(json);
      setActiveWorkflowStep(3);
    } finally {
      setAutopsyLoading(false);
    }
  };

  const escrowBalanceRef = useRef<number>(escrowBalanceCents);
  useEffect(() => {
    escrowBalanceRef.current = escrowBalanceCents;
  }, [escrowBalanceCents]);

  const handleSimulateCommuteDeposit = () => {
    playHexSound("ESCROW_DEPOSIT");
    setActiveWorkflowStep(3);
    const miles = 25;
    const depositCents = miles * escrowRateCentsPerMile;
    const nextBalance = escrowBalanceRef.current + depositCents;
    escrowBalanceRef.current = nextBalance;
    const txHash = Math.random().toString(36).slice(2, 9);
    const entryId = makeUniqueEntryId("ledger-dep");
    setEscrowBalanceCents(nextBalance);
    setLedgerEntries((prev) => [
      {
        id: entryId,
        transferId: `tr_escrow_${txHash}`,
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
    const safeDeduction = Math.min(escrowBalanceRef.current, Math.max(0, amountCents));
    const nextBalance = Math.max(0, escrowBalanceRef.current - safeDeduction);
    escrowBalanceRef.current = nextBalance;
    const txHash = Math.random().toString(36).slice(2, 9);
    const entryId = makeUniqueEntryId("ledger-rel");
    setEscrowBalanceCents(nextBalance);
    setLedgerEntries((prev) => [
      {
        id: entryId,
        transferId: `tr_escrow_rel_${txHash}`,
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

  const executeGuidedTourStep = (step: JudgeTourStepNumber) => {
    setGuidedTourStep(step);
    setTourStepProgressPct(0);

    if (step === 1) {
      const dsgSoul = VEHICLE_SOUL_PRESETS.GERMAN_V6_DSG;
      const p0750Curse = dsgSoul.curses[0];
      setConnectionMode("VIRTUAL ECU 25Hz");
      setCsvPlaying(false);
      setStreamPaused(false);
      setActiveVehicleId("GERMAN_V6_DSG");
      setActiveVin(dsgSoul.defaultVin);
      setDecodedVinInfo(null);
      setActiveCurse(p0750Curse);
      setCustomDtc(p0750Curse.dtcCode);
      setScopePid("22F40A");
      setActiveTab("OSCILLOSCOPE");
      setTelemetry({
        ...dsgSoul.baselineTelemetry,
        ...(p0750Curse.telemetryOverrides as Partial<Record<PidKey, number>>),
      });
      setDynoCurve(buildInitialDynoCurve(dsgSoul, p0750Curse.powerLossPct));
      setActiveWorkflowStep(1);
      playHexSound("FAULT_ALERT");
    } else if (step === 2) {
      setActiveTab("OSCILLOSCOPE");
      setScopePid("22F40A");
      playHexSound("CLICK");
    } else if (step === 3) {
      setActiveWorkflowStep(2);
      void handleRunAutopsy();
    } else if (step === 4) {
      setActiveWorkflowStep(3);
      handleSimulateCommuteDeposit();
    } else if (step === 5) {
      setActiveWorkflowStep(3);
      setActiveTab("UDS_TERMINAL");
      handleDispatchUdsCommand("31");
    }
  };

  const handleStartGuidedTour = () => {
    if (cinemaRunning) {
      setCinemaRunning(false);
      setCinemaSpotlightPanel(null);
    }
    setCinemaLauncherOpen(false);
    if (guidedTourStep !== null) {
      setGuidedTourStep(null);
      setTourStepProgressPct(0);
      playHexSound("CLICK");
      return;
    }
    setTourAutoPlaying(true);
    executeGuidedTourStep(1);
  };

  const handleNextGuidedTourStep = () => {
    if (guidedTourStep === null) return;
    if (guidedTourStep >= 5) {
      setGuidedTourStep(null);
      setTourStepProgressPct(0);
      playHexSound("CLICK");
      return;
    }
    executeGuidedTourStep((guidedTourStep + 1) as JudgeTourStepNumber);
  };

  const nextTourStepRef = useRef(handleNextGuidedTourStep);
  useEffect(() => {
    nextTourStepRef.current = handleNextGuidedTourStep;
  });

  useEffect(() => {
    if (guidedTourStep === null || !tourAutoPlaying) return;
    const stepDurationMs = 6000;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= stepDurationMs) {
        clearInterval(timer);
        nextTourStepRef.current();
      } else {
        setTourStepProgressPct((elapsed / stepDurationMs) * 100);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [guidedTourStep, tourAutoPlaying]);

  const activeTourSpotlightPanel = useMemo(() => {
    if (cinemaRunning && cinemaSpotlightPanel) return cinemaSpotlightPanel;
    return guidedTourStep
      ? JUDGE_TOUR_STEPS.find((s) => s.step === guidedTourStep)?.targetPanel ?? null
      : null;
  }, [cinemaRunning, cinemaSpotlightPanel, guidedTourStep]);

  const handleClearMode04Broadcast = useCallback(() => {
    const tTx = nowTimeStr();
    const tRx = nowTimeStr();
    const rxId = makeUniqueEntryId("obd-rx");
    const txId = makeUniqueEntryId("obd-tx");
    setUdsLogs((prev) => [
      {
        id: rxId,
        timestamp: tRx,
        direction: "RX 7E8",
        hex: "7E8 01 44",
        description:
          "SAE J1979 Mode $44 Positive Response — Active/Pending DTCs Cleared & MIL Turned OFF",
        status: "OK",
      },
      {
        id: txId,
        timestamp: tTx,
        direction: "TX 7E0",
        hex: "7DF 01 04",
        description:
          "SAE J1979 Functional Broadcast Mode $04 Clear Codes & Reset Check Engine Light",
        status: "OK",
      },
      ...prev,
    ]);
    playHexSound("EXORCISM_CHIME");
    setActiveCurse(null);
    setTelemetry({ ...soul.baselineTelemetry });
    setDynoCurve(buildInitialDynoCurve(soul, 0));
  }, [soul]);

  const handleCinemaResetNominalFocused = useCallback(() => {
    const dsg = VEHICLE_SOUL_PRESETS.GERMAN_V6_DSG;
    setGuidedTourStep(null);
    setTourStepProgressPct(0);
    setViewMode("FOCUSED");
    setConnectionMode("VIRTUAL ECU 25Hz");
    setCsvPlaying(false);
    setStreamPaused(false);
    setHardwareModalOpen(false);
    setObdScannerModalOpen(false);
    setMechanicSpecModalOpen(false);
    setKiroDrawerOpen(false);
    setCinemaSignalIndex(null);
    setCinemaTooltipPid(null);
    setCinemaVinModalOpen(false);
    setShopQuoteUsd(2450);
    setActiveVehicleId("GERMAN_V6_DSG");
    setActiveVin(dsg.defaultVin);
    setDecodedVinInfo(null);
    setActiveCurse(null);
    setCustomDtc("P0750");
    setScopePid("22F40A");
    setActiveTab("OSCILLOSCOPE");
    setTelemetry({ ...dsg.baselineTelemetry });
    setAutopsyResult(null);
    setDynoCurve(buildInitialDynoCurve(dsg, 0));
    setActiveWorkflowStep(1);
  }, []);

  const handleCinemaInjectP0750 = useCallback(() => {
    const dsg = VEHICLE_SOUL_PRESETS.GERMAN_V6_DSG;
    const p0750 = dsg.curses[0];
    playHexSound("FAULT_ALERT");
    setActiveVehicleId("GERMAN_V6_DSG");
    setActiveVin(dsg.defaultVin);
    setActiveCurse(p0750);
    setCustomDtc(p0750.dtcCode);
    setScopePid("22F40A");
    setActiveTab("OSCILLOSCOPE");
    setTelemetry({
      ...dsg.baselineTelemetry,
      ...(p0750.telemetryOverrides as Partial<Record<PidKey, number>>),
    });
    setDynoCurve(buildInitialDynoCurve(dsg, p0750.powerLossPct));
    setActiveWorkflowStep(2);
  }, []);

  const handleCinemaOpenLiveNhtsaVinModal = useCallback(async () => {
    const sampleVin = "1FA6P8CF5L5109284";
    const fallbackVin: DecodedNhtsaVin = {
      vin: sampleVin,
      make: "NA V8 POWERTRAIN",
      model: "5.0L V8 Fastback",
      modelYear: "2020",
      bodyClass: "Coupe",
      engineInfo: "5.0L 8-Cyl 460 HP",
      fuelType: "Gasoline",
      driveType: "RWD",
      plantInfo: "US DOT NHTSA vPIC Calibrated",
      displacementL: "5.0",
      cylinders: "8",
      horsepower: "460",
    };
    setActiveVin(sampleVin);
    setDecodedVinInfo(fallbackVin);
    setCinemaVinModalOpen(true);

    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(
          sampleVin
        )}?format=json`
      );
      if (!res.ok) return;
      const data = await res.json();
      const row = data?.Results?.[0];
      if (!row) return;
      setDecodedVinInfo({
        vin: sampleVin,
        make: row.Make || fallbackVin.make,
        model: row.Model || fallbackVin.model,
        modelYear: row.ModelYear || fallbackVin.modelYear,
        bodyClass: row.BodyClass || fallbackVin.bodyClass,
        engineInfo:
          [
            row.DisplacementL ? `${row.DisplacementL}L` : "",
            row.EngineCylinders ? `${row.EngineCylinders}-Cyl` : "",
            row.EngineHP ? `${row.EngineHP} HP` : "",
          ]
            .filter(Boolean)
            .join(" ") || fallbackVin.engineInfo,
        fuelType: row.FuelTypePrimary || fallbackVin.fuelType,
        driveType: row.DriveType || fallbackVin.driveType,
        plantInfo:
          [row.PlantCity, row.PlantCountry].filter(Boolean).join(", ") ||
          fallbackVin.plantInfo,
        displacementL: row.DisplacementL || fallbackVin.displacementL,
        cylinders: row.EngineCylinders || fallbackVin.cylinders,
        horsepower: row.EngineHP || fallbackVin.horsepower,
      });
    } catch {
      // Offline fallbackVin already populated cleanly
    }
  }, []);

  const handleCinemaBindVinAndPrepareDyno = useCallback(() => {
    const vinData: DecodedNhtsaVin =
      decodedVinInfo && decodedVinInfo.vin === "1FA6P8CF5L5109284"
        ? decodedVinInfo
        : {
            vin: "1FA6P8CF5L5109284",
            make: "NA V8 POWERTRAIN",
            model: "5.0L V8 Fastback",
            modelYear: "2020",
            bodyClass: "Coupe",
            engineInfo: "5.0L 8-Cyl 460 HP",
            fuelType: "Gasoline",
            driveType: "RWD",
            plantInfo: "US DOT NHTSA vPIC Calibrated",
            displacementL: "5.0",
            cylinders: "8",
            horsepower: "460",
          };
    const boundSoul = buildCustomVinSoul(vinData);
    setCinemaVinModalOpen(false);
    setCustomVinSoul(boundSoul);
    setActiveVehicleId("CUSTOM_VIN_SOUL");
    setActiveVin(boundSoul.defaultVin);
    setDecodedVinInfo(vinData);
    setActiveCurse(null);
    setScopePid(boundSoul.primaryPid);
    setTelemetry({ ...boundSoul.baselineTelemetry });
    setDynoCurve(buildInitialDynoCurve(boundSoul, 0));
    setViewMode("FOCUSED");
    setActiveTab("ROAD_DYNO");
  }, [decodedVinInfo]);

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
        viewMode={viewMode}
        onChangeViewMode={(m) => {
          playHexSound("CLICK");
          setViewMode(m);
        }}
        activeVehicleId={activeVehicleId}
        onSelectVehicle={(id) => {
          playHexSound("CLICK");
          handleSelectVehicle(id);
        }}
        customVinSoul={customVinSoul}
        onBindCustomVinSoul={handleBindCustomVinSoul}
        onOpenHardwareStudio={(tab) => {
          playHexSound("CLICK");
          setCinemaSignalIndex(null);
          setHardwareStudioTab(tab);
          setHardwareModalOpen(true);
        }}
        onToggleCinemaLauncher={() => {
          playHexSound("CLICK");
          if (guidedTourStep !== null) {
            setGuidedTourStep(null);
            setTourStepProgressPct(0);
          }
          setCinemaLauncherOpen((open) => !open);
        }}
        cinemaLauncherOpen={cinemaLauncherOpen}
        cinemaRunning={cinemaRunning}
        cinemaRecording={cinemaRecording}
        cinemaVinModalOpen={cinemaVinModalOpen}
        onCloseCinemaVinModal={() => setCinemaVinModalOpen(false)}
        onStartGuidedTour={handleStartGuidedTour}
        guidedTourStep={guidedTourStep}
        onOpenKiroDrawer={() => {
          playHexSound("CLICK");
          setKiroDrawerOpen(true);
        }}
        soundMuted={soundMuted}
        onToggleSoundMuted={handleToggleSoundMuted}
        connectionMode={connectionMode}
        crtEnabled={crtEnabled}
        onToggleCrt={() => {
          playHexSound("CLICK");
          setCrtEnabled((v) => !v);
        }}
        activeVin={activeVin}
        decodedVinInfo={decodedVinInfo}
        onApplyVin={(vin, decoded) => {
          setActiveVin(vin);
          setDecodedVinInfo(decoded);
        }}
        hasActiveFault={Boolean(activeCurse)}
        onOpenObdScannerModal={() => {
          playHexSound("CLICK");
          setObdScannerModalOpen(true);
          setScannerSweepTrigger((c) => c + 1);
        }}
      />

      <main className="mx-auto max-w-[1840px] px-4 py-4 space-y-4">
        {/* 1-2-3 Visual Workflow Stepper (Progressive Disclosure in Focused Mode) */}
        {viewMode === "FOCUSED" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 rounded-xl border border-white/10 bg-[#0A0D14]/90 p-2.5 font-mono">
            {[
              {
                step: 1 as const,
                title: "1. Inject Fault / Load Log",
                sub: activeCurse
                  ? `Active Fault: ${activeCurse.dtcCode} (${activeCurse.powerLossPct}% WHP Loss)`
                  : "ECU Nominal — Select a Fault or Load CSV",
                done: Boolean(activeCurse) || connectionMode === "CSV REPLAY",
              },
              {
                step: 2 as const,
                title: "2. Run Vertex AI Autopsy",
                sub: autopsyResult
                  ? `Quote Ready: $${autopsyResult.estimatedCostUsd.toLocaleString()} (${autopsyResult.oemPartNumber})`
                  : "Diagnose Root Cause, OEM Spec & Labor",
                done: Boolean(autopsyResult),
              },
              {
                step: 3 as const,
                title: "3. Fund Escrow & Exorcise ECU",
                sub: `Vault $${(escrowBalanceCents / 100).toFixed(2)} • Rate $${(
                  escrowRateCentsPerMile / 100
                ).toFixed(2)}/mi`,
                done: !activeCurse && udsLogs.length > 2,
              },
            ].map((item, idx) => {
              const isActive = activeWorkflowStep === item.step;
              return (
                <button
                  key={`${item.step}-${idx}`}
                  type="button"
                  onClick={() => {
                    playHexSound("CLICK");
                    setActiveWorkflowStep(item.step);
                    if (item.step === 3 && activeCurse) {
                      setActiveTab("UDS_TERMINAL");
                    }
                  }}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-left transition cursor-pointer ${
                    isActive
                      ? "border-[#00FF9D]/80 bg-[#00FF9D]/12 text-white shadow-[0_0_20px_rgba(0,255,157,0.16)]"
                      : "border-white/10 bg-[#06080D] text-slate-300 hover:border-white/25"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      {item.done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#00FF9D]" />
                      ) : null}
                      <span className={isActive ? "text-[#00FF9D]" : "text-white"}>
                        {item.title}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-slate-400">{item.sub}</div>
                  </div>
                  {idx < 2 ? (
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 hidden md:block" />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
        {connectionMode === "CSV REPLAY" && csvFrames.length > 0 && (
          <CsvPlaybackScrubberBar
            frames={csvFrames}
            cursor={csvCursor}
            playing={csvPlaying}
            speed={csvSpeed}
            sourceLabel={csvSourceLabel}
            primaryPid={soul.primaryPid}
            onSeek={handleSeekCsv}
            onTogglePlay={() => setCsvPlaying((p) => !p)}
            onChangeSpeed={setCsvSpeed}
            onExitReplay={handleDisconnectExternal}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-3">
            <LeftHexTerminalColumn
              viewMode={viewMode}
              activeWorkflowStep={activeWorkflowStep}
              tourSpotlightPanel={activeTourSpotlightPanel}
              forceOpenHexDrawer={guidedTourStep === 1}
              activeDtc={activeCurse?.dtcCode ?? customDtc}
              soul={soul}
              frames={frames}
              selectedFrame={selectedFrame}
              onSelectFrame={setSelectedFrame}
              streamPaused={streamPaused}
              onTogglePause={() => {
                playHexSound("CLICK");
                setStreamPaused((p) => !p);
              }}
              activeCurse={activeCurse}
              onCastCurse={handleCastCurse}
              onClearCurses={handleClearCurses}
              connectionMode={connectionMode}
              webSerialStatus={webSerialStatus}
              onConnectWebSerial={() => {
                playHexSound("CLICK");
                setHardwareStudioTab("WEBSERIAL_DRAWER");
                setHardwareModalOpen(true);
              }}
              onDisconnectExternalSource={handleDisconnectExternal}
              onDownloadSampleCsv={handleDownloadSampleCsv}
              onUploadCsvFile={handleUploadCsvFile}
              onLoadBuiltInSampleCsv={handleLoadBuiltInSampleCsv}
              onOpenDbcInspector={() => {
                playHexSound("CLICK");
                setHardwareStudioTab("DBC_INSPECTOR");
                setHardwareModalOpen(true);
              }}
            />
          </div>

          <div className="lg:col-span-6">
            <CenterDiagnosticColumn
              viewMode={viewMode}
              activeWorkflowStep={activeWorkflowStep}
              tourSpotlightPanel={activeTourSpotlightPanel}
              activeTab={activeTab}
              onSelectTab={(t) => {
                playHexSound("CLICK");
                setActiveTab(t);
              }}
              soul={soul}
              activeCurse={activeCurse}
              telemetry={telemetry}
              scopePid={scopePid}
              onSelectScopePid={(p) => {
                playHexSound("CLICK");
                setScopePid(p);
              }}
              scopeHistory={scopeHistory}
              dynoCurve={dynoCurve}
              dynoRunning={dynoRunning}
              peakActualWhp={peakActualWhp}
              peakActualTorque={peakActualTorque}
              onRunDynoPull={handleRunDynoPull}
              udsLogs={udsLogs}
              onDispatchUdsCommand={handleDispatchUdsCommand}
              activeVin={activeVin}
              scannerSweepTrigger={scannerSweepTrigger}
              onClearMode04Codes={handleClearMode04Broadcast}
              onCastCurse={handleCastCurse}
              onOpenMechanicSpecSheet={() => setMechanicSpecModalOpen(true)}
              cinemaTooltipPid={cinemaTooltipPid}
            />
          </div>

          <div className="lg:col-span-3">
            <RightNecromancerVaultColumn
              viewMode={viewMode}
              activeWorkflowStep={activeWorkflowStep}
              tourSpotlightPanel={activeTourSpotlightPanel}
              activeDtc={activeCurse?.dtcCode ?? customDtc}
              hasActiveFault={Boolean(activeCurse)}
              activeCurse={activeCurse}
              telemetry={telemetry}
              shopQuoteUsd={shopQuoteUsd}
              onChangeShopQuoteUsd={setShopQuoteUsd}
              onOpenMechanicSpecSheet={() => setMechanicSpecModalOpen(true)}
              onChangeCustomDtc={setCustomDtc}
              autopsyLoading={autopsyLoading}
              autopsyResult={autopsyResult}
              onRunAutopsy={() => void handleRunAutopsy("/api/autopsy")}
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

        {/* Unfolded OpenDBC 64-Bit Signal Matrix & WebSerial ELM327 AT Terminal in Engineer Pro Mode */}
        {viewMode === "PRO" && (
          <EngineerProHardwareDock
            activeVehicleId={activeVehicleId}
            soul={soul}
            telemetry={telemetry}
            activeDtc={activeCurse?.dtcCode ?? null}
            activeVin={activeVin}
            webSerialStatus={webSerialStatus}
            loopbackActive={loopbackActive}
            physicalPortConnected={physicalPortConnected}
            onActivateLoopbackPort={handleActivateLoopbackPort}
            onIngestLoopbackFrame={ingestRawFrame}
            onClearFaultsFromTerminal={handleClearCurses}
            onOpenFullModal={(tab) => {
              playHexSound("CLICK");
              setHardwareStudioTab(tab);
              setHardwareModalOpen(true);
            }}
          />
        )}
      </main>

      <JudgeGuidedTour
        activeStep={guidedTourStep}
        autoPlaying={tourAutoPlaying}
        stepProgressPct={tourStepProgressPct}
        onNextStep={handleNextGuidedTourStep}
        onToggleAutoPlay={() => {
          playHexSound("CLICK");
          setTourAutoPlaying((p) => !p);
        }}
        onSkipTour={() => {
          playHexSound("CLICK");
          setGuidedTourStep(null);
          setTourStepProgressPct(0);
        }}
      />

      <KiroArchitectureDrawer
        open={kiroDrawerOpen}
        autoRunTrigger={kiroAutoRunTrigger}
        onClose={() => {
          playHexSound("CLICK");
          setKiroDrawerOpen(false);
        }}
      />

      <HardwareAndDbcModal
        open={hardwareModalOpen}
        activeTab={hardwareStudioTab}
        onChangeTab={setHardwareStudioTab}
        onClose={() => {
          setCinemaSignalIndex(null);
          setHardwareModalOpen(false);
        }}
        activeVehicleId={activeVehicleId}
        soul={soul}
        telemetry={telemetry}
        activeDtc={activeCurse?.dtcCode ?? null}
        activeVin={activeVin}
        csvFrames={csvFrames}
        csvCursor={csvCursor}
        csvPlaying={csvPlaying}
        csvSpeed={csvSpeed}
        csvSourceLabel={csvSourceLabel}
        onSeekCsv={handleSeekCsv}
        onTogglePlayCsv={() => setCsvPlaying((p) => !p)}
        onChangeSpeedCsv={setCsvSpeed}
        onLoadBuiltInSampleCsv={handleLoadBuiltInSampleCsv}
        onDownloadSampleCsv={handleDownloadSampleCsv}
        onUploadCsvFile={handleUploadCsvFile}
        physicalPortConnected={physicalPortConnected}
        loopbackActive={loopbackActive}
        webSerialStatus={webSerialStatus}
        onConnectPhysicalSerial={handleConnectPhysicalSerial}
        onActivateLoopbackPort={handleActivateLoopbackPort}
        onSendPhysicalSerialCommand={handleSendPhysicalSerialCommand}
        onIngestLoopbackFrame={ingestRawFrame}
        onClearFaultsFromTerminal={handleClearCurses}
        cinemaSignalIndex={cinemaSignalIndex}
      />

      <StandardObdScannerModal
        open={obdScannerModalOpen}
        onClose={() => setObdScannerModalOpen(false)}
        onDockInCenterWorkspace={() => setActiveTab("OBD_SCANNER")}
        soul={soul}
        vin={activeVin}
        activeCurse={activeCurse}
        telemetry={telemetry}
        scanTriggerCount={scannerSweepTrigger}
        onClearMode04Codes={handleClearMode04Broadcast}
        onInjectFaultPreset={handleCastCurse}
        onOpenMechanicSpecSheet={() => {
          setObdScannerModalOpen(false);
          setMechanicSpecModalOpen(true);
        }}
      />

      <MechanicSpecSheetModal
        open={mechanicSpecModalOpen}
        onClose={() => setMechanicSpecModalOpen(false)}
        soul={soul}
        vin={activeVin}
        activeCurse={activeCurse}
        activeDtc={activeCurse?.dtcCode ?? customDtc}
        telemetry={telemetry}
        autopsyResult={autopsyResult}
        escrowBalanceCents={escrowBalanceCents}
        escrowRateCentsPerMile={escrowRateCentsPerMile}
      />

      <DemoVideoDirector
        launcherOpen={cinemaLauncherOpen}
        onCloseLauncher={() => setCinemaLauncherOpen(false)}
        isRunning={cinemaRunning}
        onRunningChange={setCinemaRunning}
        isRecording={cinemaRecording}
        onRecordingChange={setCinemaRecording}
        activeDtcCode={activeCurse?.dtcCode ?? null}
        escrowRateCentsPerMile={escrowRateCentsPerMile}
        escrowBalanceCents={escrowBalanceCents}
        peakActualWhp={peakActualWhp}
        onResetNominalFocused={handleCinemaResetNominalFocused}
        onSpotlightPanel={setCinemaSpotlightPanel}
        onSetCinemaTooltipPid={setCinemaTooltipPid}
        onInjectPrimaryFaultP0750={handleCinemaInjectP0750}
        onOpenObdScannerTabAndSweep={() => {
          setActiveTab("OBD_SCANNER");
          setScannerSweepTrigger((c) => c + 1);
        }}
        onTriggerVertexAutopsy={() => void handleRunAutopsy("/api/autopsy")}
        onSetShopQuoteUsd={setShopQuoteUsd}
        onSimulateCommuteEscrow={handleSimulateCommuteDeposit}
        onSetMechanicSpecModalOpen={setMechanicSpecModalOpen}
        onClearObdMode04={handleClearMode04Broadcast}
        onOpenUdsTerminalTab={() => setActiveTab("UDS_TERMINAL")}
        onFireUdsExorcism31={() => handleDispatchUdsCommand("31")}
        onOpenOscilloscopeTab={() => setActiveTab("OSCILLOSCOPE")}
        onSwitchToEngineerProMode={() => setViewMode("PRO")}
        onOpenDbcMatrixModal={(sigIdx) => {
          setCinemaSignalIndex(sigIdx);
          setHardwareStudioTab("DBC_INSPECTOR");
          setHardwareModalOpen(true);
        }}
        onSwitchModalToCsvReplayAndLoad={() => {
          setCinemaSignalIndex(null);
          setHardwareStudioTab("CSV_REPLAY");
          setHardwareModalOpen(true);
          setCsvSpeed(2);
          handleLoadBuiltInSampleCsv();
        }}
        onCloseHardwareModalAndResumeSim={() => {
          setCinemaSignalIndex(null);
          setHardwareModalOpen(false);
          void handleDisconnectExternal();
        }}
        onOpenLiveNhtsaVinModal={() => {
          void handleCinemaOpenLiveNhtsaVinModal();
        }}
        onBindNhtsaVinAndPrepareDyno={handleCinemaBindVinAndPrepareDyno}
        onExecuteWotDynoPull={handleRunDynoPull}
        onOpenKiroProofsDrawer={() => {
          setKiroDrawerOpen(true);
          setKiroAutoRunTrigger((n) => n + 1);
        }}
        onCloseAllOverlaysForFinale={() => {
          setCinemaSignalIndex(null);
          setCinemaTooltipPid(null);
          setHardwareModalOpen(false);
          setObdScannerModalOpen(false);
          setMechanicSpecModalOpen(false);
          setKiroDrawerOpen(false);
          setCinemaVinModalOpen(false);
          void handleDisconnectExternal();
          setViewMode("FOCUSED");
          setActiveTab("OSCILLOSCOPE");
        }}
      />
    </div>
  );
}

