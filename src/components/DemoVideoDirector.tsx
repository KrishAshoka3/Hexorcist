"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Crosshair,
  Download,
  Lightbulb,
  Music,
  Pause,
  Play,
  Radio,
  Sparkles,
  Square,
  Video,
  X,
  Zap,
} from "lucide-react";
import {
  isChillMusicEnabled,
  playHexSound,
  setChillMusicEnabled,
  startChillBackgroundMusic,
  stopChillBackgroundMusic,
} from "@/lib/sound-fx";
import {
  DEFAULT_DRIVING_SLIDERS,
  DrivingStressSlidersState,
  FrankensteinStageId,
  QuickVehiclePresetId,
  UserPowertrainType,
  UserTransmissionType,
  WorkspaceTabId,
  getWorkspaceTabForScene,
} from "@/lib/custom-car-and-sliders";
import type { MechanicalCursePreset } from "@/lib/obd-hex-engine";
import type { ObdModuleId } from "@/lib/obd-scanner-qol";
import type { GeneratedVehicleFault } from "@/lib/vehicle-fault-generator";
import type { EngineerSubTabId } from "./hexorcist/EngineerAndKiroTab";

export { getWorkspaceTabForScene };

export type CinemaSpotlightPanelId =
  | "FAULT_HEX"
  | "OSCILLOSCOPE"
  | "OBD_SCANNER"
  | "VERTEX_AUTOPSY"
  | "ESCROW_VAULT"
  | "UDS_EXORCISM"
  | "ROAD_DYNO";

export type CinemaDomTargetId =
  | "TOP_VEHICLE_BAR"
  | "FRANKENSTEIN_PIPELINE"
  | "TOP_HARDWARE_DOCK"
  | "DOCK_OBD_HARDWARE"
  | "DOCK_CSV_DROPZONE"
  | "DOCK_LOAD_SAMPLE_CSV"
  | "DOCK_CSV_SCRUBBER"
  | "DOCK_VEHICLE_GARAGE"
  | "VEHICLE_INPUT_BAR"
  | "SANDBOX_CONTROL_BAR"
  | "SIMULATE_RANDOM_FAULT_BTN"
  | "REROLL_RANDOM_FAULT_BTN"
  | "XRAY_CHASSIS"
  | "XRAY_NODE_ECM"
  | "XRAY_NODE_TCM"
  | "XRAY_NODE_ABS"
  | "XRAY_NODE_BCM"
  | "VEHICLE_SELECTOR_POPOVER"
  | "ENTER_OWN_CAR_BTN"
  | "OWN_CAR_MODAL_CARD"
  | "DRIVING_STRESS_SLIDERS"
  | "PART_WEAR_SLIDER"
  | "KIRO_VALIDATOR_BADGE"
  | "LEFT_ECU_PANEL"
  | "LEFT_CURSE_DECK"
  | "LEFT_HEX_STREAM"
  | "CENTER_PANEL"
  | "CENTER_KPI_GRID"
  | "OBD_SCANNER_VIEW"
  | "SAFETY_TRIAGE_BANNER"
  | "MODE_04_CLEAR_BTN"
  | "RIGHT_NECROMANCER"
  | "RIGHT_QUOTE_CHECKER"
  | "RIGHT_ESCROW_VAULT"
  | "MECHANIC_SPEC_MODAL"
  | "TOP_MODE_TOGGLE"
  | "MODAL_DBC_MATRIX"
  | "MODAL_CSV_SCRUBBER"
  | "VIN_MODAL_CARD"
  | "ROAD_DYNO_CARD"
  | "KIRO_PBT_CARD";

export type CinemaSceneNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface CinemaSceneConfig {
  id: string;
  sceneNumber: CinemaSceneNumber;
  startMs: number;
  endMs: number;
  badge: string;
  headline: string;
  plainEnglish: string;
  underTheHood: string;
  subtitleLine1: string;
  subtitleLine2: string;
  accentTone: "PHOSPHOR" | "CRIMSON";
}

function defineScene(
  cfg: Omit<CinemaSceneConfig, "subtitleLine1" | "subtitleLine2">
): CinemaSceneConfig {
  return {
    ...cfg,
    subtitleLine1: cfg.plainEnglish,
    subtitleLine2: cfg.underTheHood,
  };
}

export const TOTAL_CINEMA_DURATION_MS = 165_000; // 2:45 full Obsidian HMI tour

export const CINEMA_SCENES: CinemaSceneConfig[] = [
  defineScene({
    id: "scene-1-frankenstein-chimera",
    sceneNumber: 1,
    startMs: 0,
    endMs: 15_000,
    badge: "SCENE 1 OF 8 • FRANKENSTEIN CHIMERA OS (0:00–0:15)",
    headline:
      "HEXORCIST Obsidian OS: Stitching OBD-II Hardware, Vertex AI & FinTech Escrow",
    plainEnglish:
      "Cars speak in raw CAN-bus hex, dealerships overcharge by hundreds, and surprise repairs wreck budgets. HEXORCIST unifies all three inside an OEM-caliber digital cockpit.",
    underTheHood:
      "SAE J1979 / ISO 14229 CAN-FD telemetry + Interactive SVG X-Ray Chassis + Vertex AI Gemini 2.5 Flash + Double-Entry FinTech Escrow.",
    accentTone: "PHOSPHOR",
  }),
  defineScene({
    id: "scene-2-top-hardware-csv-dock",
    sceneNumber: 2,
    startMs: 15_000,
    endMs: 42_000,
    badge: "SCENE 2 OF 8 • CUSTOM VEHICLE INPUT & CSV PRIORITY OVERRIDE (0:15–0:42)",
    headline:
      "Stage 01: Custom Vehicle Input Bar, CSV Override Lockout & Sandbox Calibration",
    plainEnglish:
      "Switches from a 2014 Audi S4 DSG to a 2024 Dual-Motor EV and 2022 Ford F-150 5.0L Automatic, shows how loading a CSV log overrides and locks out the simulator, then returns to Sandbox mode.",
    underTheHood:
      "Strict Data Source Priority Engine (WebSerial OBD-II > CSV Log Replay > Vehicle-Accurate Sandbox Simulator) + OEM part calibration.",
    accentTone: "PHOSPHOR",
  }),
  defineScene({
    id: "scene-3-svg-xray-and-sliders",
    sceneNumber: 3,
    startMs: 42_000,
    endMs: 62_000,
    badge: "SCENE 3 OF 8 • RANDOMIZED CAR-ACCURATE FAULT & SVG X-RAY (0:42–1:02)",
    headline:
      "Stage 02A: Vehicle-Accurate Randomized Fault Engine & Dynamic SVG X-Ray Targeting",
    plainEnglish:
      "Clicks '🎲 Simulate Random Issue' (and 'Re-Roll Another Issue') to roll authentic, non-repeating car-specific faults—lighting up the exact affected ECU ([ECM]/[TCM]/[ABS]/[BCM]) and spiking the 60fps Heart Monitor!",
    underTheHood:
      "Powertrain-invariant fault pools (EV excludes combustion/TCM; Manual excludes TCM) + brand-stamped OEM part numbers (JL3Z-... / 0B5-... / 1089334-...).",
    accentTone: "CRIMSON",
  }),
  defineScene({
    id: "scene-4-multi-ecu-scanner-triage",
    sceneNumber: 4,
    startMs: 62_000,
    endMs: 82_000,
    badge: "SCENE 4 OF 8 • 4-MODULE OBD-II SWEEP & SAFETY TRIAGE (1:02–1:22)",
    headline:
      'Stage 02B: 4-Module OBD-II Scanner & "Can I Drive This?" Safety Triage Banner',
    plainEnglish:
      "Sweeps ECM, TCM, ABS & BCM simultaneously—isolating the active fault on its exact ECU while the other 3 modules show 🟢 PASS—and displays plain-English road safety guidance.",
    underTheHood:
      "Polls 0x7E8..0x7EB across SAE J1979 Modes $02/$03/$07/$0A with automated SAFE / CAUTION / DO NOT DRIVE triage.",
    accentTone: "CRIMSON",
  }),
  defineScene({
    id: "scene-5-vertex-ai-ripoff-detector",
    sceneNumber: 5,
    startMs: 82_000,
    endMs: 104_000,
    badge: "SCENE 5 OF 8 • VERTEX AI MECHANIC & QUOTE OVERCHARGE AUDIT (1:22–1:44)",
    headline:
      "Stage 03: Google Cloud Vertex AI Diagnosis & Shop Quote Overcharge Detector",
    plainEnglish:
      "Vertex AI Mechanic translates the newly rolled fault into plain English with brand-matched OEM part pricing and catches dealership markup ripoffs automatically!",
    underTheHood:
      "Gemini 2.5 Flash (/api/autopsy) decodes SAE J2012 bitmask, OEM part catalog, and fair book labor vs. dealer quote.",
    accentTone: "CRIMSON",
  }),
  defineScene({
    id: "scene-6-fintech-escrow-kiro-work-order",
    sceneNumber: 6,
    startMs: 104_000,
    endMs: 126_000,
    badge: "SCENE 6 OF 8 • FINTECH ESCROW VAULT & KIRO WORK ORDER (1:44–2:06)",
    headline:
      "Stage 04A: Save-Per-Mile Escrow Vault & Kiro-Verified Printable Work Order",
    plainEnglish:
      "Simulates a 25-mile commute into balanced Double-Entry Escrow (Assets = Liabilities + Equity) and opens the Printable Mechanic Work Order carrying '✅ Verified by Kiro Work-Order Validator'.",
    underTheHood:
      "Monotonic cent-exact sinking-fund ledger ($0.05/mi -> $2.90/mi) + ISO 3779 / UDS validation via src/lib/work-order-validator.ts.",
    accentTone: "PHOSPHOR",
  }),
  defineScene({
    id: "scene-7-mode-04-reset-xray-pass",
    sceneNumber: 7,
    startMs: 126_000,
    endMs: 142_000,
    badge: "SCENE 7 OF 8 • MODE $04 ECU RESET -> X-RAY CHASSIS PASS (2:06–2:22)",
    headline:
      "One-Click Clear Codes (Mode $04) Restores SVG Vehicle X-Ray Nodes to 🟢 PASS",
    plainEnglish:
      "Broadcasts SAE J1979 Mode $04 across the CAN bus—turning off the Check Engine Light and restoring every node on the Interactive SVG Vehicle X-Ray Chassis back to Emerald 🟢 PASS!",
    underTheHood:
      "Functional broadcast TX: 7DF 01 04 -> RX: 7E8 01 44 + ISO 14229 UDS RoutineControl TX: 7E0 04 31 01 F4 0A.",
    accentTone: "PHOSPHOR",
  }),
  defineScene({
    id: "scene-8-engineer-pro-kiro-suite",
    sceneNumber: 8,
    startMs: 142_000,
    endMs: 165_000,
    badge: "SCENE 8 OF 8 • ENGINEER PRO, DYNO & KIRO PBT SUITE (2:22–2:45)",
    headline:
      "Stage 04B: 64-Bit .DBC Matrix, Virtual Road Dyno & Kiro Property-Based Proofs",
    plainEnglish:
      "Opens the Engineer Pro & Kiro Verification Suite: 64-bit OpenDBC bit matrix, live WOT Virtual Road Dyno pull, and Kiro EARS Specs + Agent Hooks + 280+ passing fast-check Property Tests.",
    underTheHood:
      ".kiro/specs/ + PostFileSave Vitest Hooks + US DOT NHTSA MCP Server + live browser fast-check invariant suite.",
    accentTone: "PHOSPHOR",
  }),
];

export interface DemoVideoDirectorProps {
  launcherOpen: boolean;
  onCloseLauncher: () => void;
  isRunning: boolean;
  onRunningChange: (running: boolean) => void;
  isRecording: boolean;
  onRecordingChange: (recording: boolean) => void;
  activeDtcCode: string | null;
  escrowRateCentsPerMile: number;
  escrowBalanceCents: number;
  peakActualWhp: number;
  onResetNominalFocused: () => void;
  onSpotlightPanel: (panel: CinemaSpotlightPanelId | null) => void;
  onSetCinemaTooltipPid: (pid: "22F40A" | "0106" | "0142" | null) => void;
  onInjectPrimaryFaultP0750: () => void;
  onOpenObdScannerTabAndSweep: () => void;
  onTriggerVertexAutopsy: () => void;
  onSetShopQuoteUsd: (usd: number) => void;
  onSimulateCommuteEscrow: () => void;
  onSetMechanicSpecModalOpen: (open: boolean) => void;
  onClearObdMode04: () => void;
  onOpenUdsTerminalTab: () => void;
  onFireUdsExorcism31: () => void;
  onOpenOscilloscopeTab: () => void;
  onSwitchToEngineerProMode: () => void;
  onOpenDbcMatrixModal: (signalIdx: number) => void;
  onSwitchModalToCsvReplayAndLoad: () => void;
  onCloseHardwareModalAndResumeSim: () => void;
  onOpenLiveNhtsaVinModal: () => void;
  onBindNhtsaVinAndPrepareDyno: () => void;
  onExecuteWotDynoPull: () => void;
  onOpenKiroProofsDrawer: () => void;
  onCloseAllOverlaysForFinale: () => void;
  onSetOwnCarModalOpen?: (open: boolean) => void;
  onSetVehiclePopoverOpen?: (open: boolean) => void;
  onSelectQuickPresetHealthy?: (presetId: QuickVehiclePresetId) => void;
  onSetDrivingSliders?: (sliders: DrivingStressSlidersState) => void;
  activeTab?: WorkspaceTabId;
  onSwitchWorkspaceTab?: (tab: WorkspaceTabId, subTab?: EngineerSubTabId) => void;
  onLoadTopDockSampleCsv?: () => void;
  onSeekTopDockCsv?: (index: number) => void;
  onExitTopDockCsv?: () => void;
  onSelectXRayModule?: (moduleId: ObdModuleId) => void;
  onSetPipelineStageOverride?: (stageId: FrankensteinStageId | null) => void;
  onSetBentoCockpitView?: (enabled: boolean) => void;
  activeCurse?: MechanicalCursePreset | null;
  onApplyInlineVehicle?: (spec: {
    yearMakeModel: string;
    powertrainType: UserPowertrainType;
    transmissionType: UserTransmissionType;
  }) => void;
  onRollRandomFault?: () => GeneratedVehicleFault | null;
}

interface CalloutTargetState {
  targetId: CinemaDomTargetId;
  label: string;
  whyMatters: string;
  tone: "PHOSPHOR" | "CRIMSON";
  showPressureDropPointer?: boolean;
}

interface MeasuredBox {
  top: number;
  left: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
}

function formatTimecode(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

const INTRO_STORY_STEPS = [
  {
    id: "car-code",
    icon: "🚗",
    title: "Enter Your Car + 4-Module Scanner",
    desc: "Load any car by name or 17-digit VIN, test live stress sliders & scan ECM/TCM/ABS/BCM",
    techTag: "No VIN Needed + SAE J1979",
  },
  {
    id: "ai-mechanic",
    icon: "🛡️",
    title: "Vertex AI & Fair-Price Checker",
    desc: "Explains the broken part in plain English ($1,480) & catches $970 shop overcharges",
    techTag: "Gemini 2.5 Flash Audit",
  },
  {
    id: "piggy-bank",
    icon: "🏦",
    title: "Save-Per-Mile Vault & Kiro Pass",
    desc: "Auto-saves repair cash while you drive & prints a Kiro-Verified Mechanic Work Order",
    techTag: "Kiro Validator + FinTech Vault",
  },
] as const;

const CLOSING_PILLARS = [
  { id: "can-bus", code: "ANY CAR + 4-ECU SCANNER", label: "Custom Car Builder, Stress Sliders & Mode $04 Reset" },
  { id: "vertex-ai", code: "VERTEX AI + QUOTE CHECKER", label: "Plain-English Diagnosis & $970 Overcharge Detector" },
  { id: "fintech-escrow", code: "KIRO VERIFIED + VAULT", label: "Save-Per-Mile Escrow & Printable Mechanic Pass" },
] as const;

export function DemoVideoDirector(props: DemoVideoDirectorProps) {
  const {
    launcherOpen,
    onCloseLauncher,
    isRunning,
    onRunningChange,
    isRecording,
    onRecordingChange,
    activeDtcCode,
    escrowRateCentsPerMile,
    escrowBalanceCents,
    peakActualWhp,
    onResetNominalFocused,
    onSpotlightPanel,
    onSetCinemaTooltipPid,
    onInjectPrimaryFaultP0750,
    onOpenObdScannerTabAndSweep,
    onTriggerVertexAutopsy,
    onSetShopQuoteUsd,
    onSimulateCommuteEscrow,
    onSetMechanicSpecModalOpen,
    onClearObdMode04,
    onOpenUdsTerminalTab,
    onFireUdsExorcism31,
    onOpenOscilloscopeTab,
    onSwitchToEngineerProMode,
    onOpenDbcMatrixModal,
    onSwitchModalToCsvReplayAndLoad,
    onCloseHardwareModalAndResumeSim,
    onOpenLiveNhtsaVinModal,
    onBindNhtsaVinAndPrepareDyno,
    onExecuteWotDynoPull,
    onOpenKiroProofsDrawer,
    onCloseAllOverlaysForFinale,
    onSetOwnCarModalOpen,
    onSetVehiclePopoverOpen,
    onSelectQuickPresetHealthy,
    onSetDrivingSliders,
    onSwitchWorkspaceTab,
    onLoadTopDockSampleCsv,
    onSeekTopDockCsv,
    onExitTopDockCsv,
    onSelectXRayModule,
    onSetPipelineStageOverride,
    onSetBentoCockpitView,
    activeCurse,
    onApplyInlineVehicle,
    onRollRandomFault,
  } = props;

  const switchWorkspace = useCallback(
    (tab: WorkspaceTabId, subTab?: EngineerSubTabId) => {
      onSwitchWorkspaceTab?.(tab, subTab);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("hexorcist:switch-tab", {
            detail: { tab, subTab },
          })
        );
      }
    },
    [onSwitchWorkspaceTab]
  );

  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(false);
  const [musicEnabled, setMusicEnabled] = useState<boolean>(() => isChillMusicEnabled());
  const [calloutTarget, setCalloutTarget] = useState<CalloutTargetState | null>(null);
  const [measuredBox, setMeasuredBox] = useState<MeasuredBox | null>(null);
  const [recorderStatus, setRecorderStatus] = useState<string | null>(null);
  const [lastExportUrl, setLastExportUrl] = useState<string | null>(null);

  const firedCuesRef = useRef<Set<string>>(new Set());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const callbacksRef = useRef(props);

  const handleToggleMusic = useCallback(() => {
    playHexSound("CLICK");
    setMusicEnabled((prev) => {
      const next = !prev;
      setChillMusicEnabled(next);
      if (next && callbacksRef.current.isRunning) {
        startChillBackgroundMusic();
      } else if (!next) {
        stopChillBackgroundMusic(0.35);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    callbacksRef.current = props;
  });

  const downloadWebmBlob = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setLastExportUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "hexorcist-kiroween-2026-demo.webm";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setRecorderStatus("Exported hexorcist-kiroween-2026-demo.webm (60fps VP9 WebM)");
  }, []);

  const stopMediaRecorderAndDownload = useCallback(
    (shouldDownload: boolean) => {
      const recorder = mediaRecorderRef.current;
      const stream = mediaStreamRef.current;

      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = () => {
          if (shouldDownload && recordedChunksRef.current.length > 0) {
            const mime = recorder.mimeType || "video/webm;codecs=vp9";
            const blob = new Blob(recordedChunksRef.current, { type: mime });
            downloadWebmBlob(blob);
          }
          recordedChunksRef.current = [];
          stream?.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
          mediaRecorderRef.current = null;
          callbacksRef.current.onRecordingChange(false);
        };
        try {
          recorder.stop();
        } catch {
          stream?.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
          mediaRecorderRef.current = null;
          callbacksRef.current.onRecordingChange(false);
        }
      } else {
        stream?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        callbacksRef.current.onRecordingChange(false);
      }
    },
    [downloadWebmBlob]
  );

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      stopChillBackgroundMusic(0.25);
    };
  }, []);

  const beginCinemaPlayback = useCallback(() => {
    firedCuesRef.current = new Set();
    setElapsedMs(0);
    setPaused(false);
    setCalloutTarget(null);
    onCloseLauncher();
    onRunningChange(true);
    playHexSound("CLICK");
    if (isChillMusicEnabled()) {
      startChillBackgroundMusic();
    }
  }, [onCloseLauncher, onRunningChange]);

  const handleStartVisualAutoPilot = () => {
    setRecorderStatus(null);
    beginCinemaPlayback();
  };

  const handleStartRecordAndRun = async () => {
    setRecorderStatus(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== "function"
    ) {
      setRecorderStatus(
        "Screen capture API unavailable in this browser — launching Visual Auto-Pilot mode."
      );
      beginCinemaPlayback();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 60 },
        audio: true,
      });

      const preferredMime = "video/webm;codecs=vp9";
      const candidateMimes = [
        preferredMime,
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const supportedMime =
        typeof MediaRecorder !== "undefined"
          ? candidateMimes.find((m) => MediaRecorder.isTypeSupported(m)) ?? ""
          : "";

      const recorder = supportedMime
        ? new MediaRecorder(stream, {
            mimeType: supportedMime,
            videoBitsPerSecond: 8_000_000,
          })
        : new MediaRecorder(stream);

      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener("ended", () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            stopMediaRecorderAndDownload(true);
          }
        });
      }

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      onRecordingChange(true);
      setRecorderStatus("Recording browser tab @ 60fps (VP9 WebM)...");
      beginCinemaPlayback();
    } catch (err) {
      onRecordingChange(false);
      setRecorderStatus(
        err instanceof Error
          ? `Tab capture cancelled (${err.message}). Click Play Visual Cinema Pitch anytime.`
          : "Tab capture cancelled — click Play Visual Cinema Pitch anytime."
      );
    }
  };

  const handleExitCinema = useCallback(
    (exportRecordingIfActive: boolean) => {
      playHexSound("CLICK");
      stopChillBackgroundMusic(0.45);
      if (isRecording) {
        stopMediaRecorderAndDownload(exportRecordingIfActive);
      }
      setCalloutTarget(null);
      setPaused(false);
      onSpotlightPanel(null);
      onCloseAllOverlaysForFinale();
      onRunningChange(false);
    },
    [
      isRecording,
      onCloseAllOverlaysForFinale,
      onRunningChange,
      onSpotlightPanel,
      stopMediaRecorderAndDownload,
    ]
  );

  useEffect(() => {
    if (!isRunning || paused) return;
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min(250, Math.max(0, now - lastTick));
      lastTick = now;
      setElapsedMs((prev) => Math.min(TOTAL_CINEMA_DURATION_MS, prev + delta));
    }, 50);

    return () => window.clearInterval(timer);
  }, [isRunning, paused]);

  useEffect(() => {
    if (!isRunning) return;
    const fired = firedCuesRef.current;
    const fireOnce = (cueKey: string, atMs: number, fn: () => void) => {
      if (elapsedMs >= atMs && !fired.has(cueKey)) {
        fired.add(cueKey);
        fn();
      }
    };

    // Scene 1 (0:00–0:15): Cinematic Title Card introducing the Frankenstein Chimera
    fireOnce("s1-init", 0, () => {
      onSetBentoCockpitView?.(false);
      onSetPipelineStageOverride?.("STAGE_01_INGEST");
      onResetNominalFocused();
      switchWorkspace("LIVE_HEALTH");
      onSelectQuickPresetHealthy?.("PRESET_2014_V6_DSG");
      onSelectXRayModule?.("02_TCM");
      onSetCinemaTooltipPid(null);
      onSetVehiclePopoverOpen?.(false);
      onSetOwnCarModalOpen?.(false);
      onSetDrivingSliders?.(DEFAULT_DRIVING_SLIDERS);
      onSetMechanicSpecModalOpen(false);
      onSetShopQuoteUsd(2450);
      onSpotlightPanel(null);
      setCalloutTarget(null);
    });

    // Scene 2 (0:15–0:42): Custom Car Vehicle Input Bar -> CSV Override Lockout -> Return to Sandbox
    fireOnce("s2-spotlight-vehicle-input", 15_000, () => {
      playHexSound("CLICK");
      onSetBentoCockpitView?.(false);
      onSetPipelineStageOverride?.("STAGE_01_INGEST");
      switchWorkspace("LIVE_HEALTH");
      onSelectQuickPresetHealthy?.("PRESET_2014_V6_DSG");
      setCalloutTarget({
        targetId: "VEHICLE_INPUT_BAR",
        label: "🚗 STAGE 01: VEHICLE INPUT BAR • 2014 AUDI S4 3.0T DSG",
        whyMatters:
          "Enter any Year, Make, Model, Powertrain, and Transmission right in the Vehicle Input bar to calibrate mechanically valid faults.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s2-switch-custom-ev", 19_200, () => {
      playHexSound("EXORCISM_CHIME");
      onApplyInlineVehicle?.({
        yearMakeModel: "2024 Dual-Motor AWD EV",
        powertrainType: "Full Electric (EV)",
        transmissionType: "EV Single-Speed",
      });
      setCalloutTarget({
        targetId: "VEHICLE_INPUT_BAR",
        label: "⚡ SWITCHED TO 2024 DUAL-MOTOR EV • ZERO COMBUSTION / TCM FAULTS",
        whyMatters:
          "Calibrates to EV architecture—strictly excluding spark, fuel trim, exhaust, and multi-gear transmission codes!",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s2-switch-custom-f150", 24_200, () => {
      playHexSound("EXORCISM_CHIME");
      onApplyInlineVehicle?.({
        yearMakeModel: "2022 Ford F-150 5.0L Automatic",
        powertrainType: "Standard Gas",
        transmissionType: "Standard Automatic",
      });
      setCalloutTarget({
        targetId: "VEHICLE_INPUT_BAR",
        label: "🛻 SWITCHED TO 2022 FORD F-150 5.0L AUTOMATIC • JL3Z OEM SPEC",
        whyMatters:
          "Loads Ford 5.0L V8 Automatic profile with JL3Z-... OEM part stamps in clean 🟢 PASS Sandbox state.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s2-csv-override-lockout", 29_500, () => {
      playHexSound("CLICK");
      onLoadTopDockSampleCsv?.();
      setCalloutTarget({
        targetId: "SANDBOX_CONTROL_BAR",
        label: "🔒 CSV FILE OVERWRITES & LOCKS OUT RANDOM SIMULATOR",
        whyMatters:
          "Data Source Priority Engine: Uploading or replaying a CSV log immediately overrides and locks out the Sandbox simulator!",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s2-scrub-csv-frame", 33_800, () => {
      onSeekTopDockCsv?.(24);
      setCalloutTarget({
        targetId: "DOCK_CSV_SCRUBBER",
        label: "📂 LIVE CSV TIMELINE SCRUBBER • OVERRIDING SIMULATOR",
        whyMatters:
          "Scrubs recorded CAN frames while keeping the random simulator locked until CSV Replay exits.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s2-return-sandbox-f150", 37_800, () => {
      playHexSound("CLICK");
      onExitTopDockCsv?.();
      onApplyInlineVehicle?.({
        yearMakeModel: "2022 Ford F-150 5.0L Automatic",
        powertrainType: "Standard Gas",
        transmissionType: "Standard Automatic",
      });
      onSetDrivingSliders?.(DEFAULT_DRIVING_SLIDERS);
      setCalloutTarget({
        targetId: "SIMULATE_RANDOM_FAULT_BTN",
        label: "🟢 RETURNED TO SANDBOX MODE • READY TO ROLL RANDOM ISSUE",
        whyMatters:
          "Exiting CSV Replay unlocks '🎲 Simulate Random Issue for 2022 Ford F-150' in clean 4/4 ECU PASS state.",
        tone: "PHOSPHOR",
      });
    });

    // Scene 3 (0:42–1:02): Clicks 🎲 Simulate Random Issue -> Rolls Car-Accurate Fault -> Lights Up Exact SVG X-Ray Node!
    fireOnce("s3-click-random-roll-1", 42_000, () => {
      playHexSound("CLICK");
      switchWorkspace("LIVE_HEALTH");
      onSetPipelineStageOverride?.("STAGE_02_XRAY");
      const rolled = onRollRandomFault?.() ?? null;
      if (!rolled) {
        onInjectPrimaryFaultP0750();
      }
      const targetNode: CinemaDomTargetId =
        rolled?.targetModule === "ECM"
          ? "XRAY_NODE_ECM"
          : rolled?.targetModule === "ABS"
          ? "XRAY_NODE_ABS"
          : rolled?.targetModule === "BCM"
          ? "XRAY_NODE_BCM"
          : "XRAY_NODE_TCM";
      onSpotlightPanel("OSCILLOSCOPE");
      setCalloutTarget({
        targetId: targetNode,
        label: rolled
          ? `🎲 ROLLED [${rolled.targetModule}] ${rolled.codeDisplayLabel} • ${rolled.oemPartNumber}`
          : "🎲 ROLLED CAR-ACCURATE FAULT ON SVG X-RAY CHASSIS",
        whyMatters: rolled
          ? `${rolled.title} lights up [${rolled.targetModule}] on the SVG X-Ray Chassis & spikes the 60fps Heart Monitor!`
          : "Highlights the exact affected ECU node on the Interactive SVG Vehicle X-Ray Chassis!",
        tone: "CRIMSON",
      });
    });
    fireOnce("s3-focus-reroll-btn", 49_500, () => {
      playHexSound("CLICK");
      setCalloutTarget({
        targetId: "REROLL_RANDOM_FAULT_BTN",
        label: "🎲 RE-ROLL ANOTHER ISSUE • NEVER REPEATS PREVIOUS FAULT",
        whyMatters:
          "Judges can re-roll consecutive non-repeating, mechanically valid faults tailored to the exact vehicle!",
        tone: "CRIMSON",
      });
    });
    fireOnce("s3-click-random-roll-2", 53_000, () => {
      const rolled2 = onRollRandomFault?.() ?? null;
      const nodeTag = rolled2?.targetModule ?? "TCM";
      setCalloutTarget({
        targetId: "XRAY_CHASSIS",
        label: rolled2
          ? `🔴 NEW NON-REPEATING ROLL: [${nodeTag}] ${rolled2.codeDisplayLabel} (${rolled2.oemPartNumber})`
          : "🔴 SVG X-RAY NODE & 60FPS HEART MONITOR ANOMALY",
        whyMatters: rolled2
          ? `Dynamically switches X-Ray focus to [${nodeTag}] with brand-stamped ${rolled2.oemPartNumber} ($${rolled2.fairCostUsd.toLocaleString()} fair fix)!`
          : "Updates the SVG X-Ray Chassis, 60fps Heart Monitor, Scanner, AI Autopsy & Escrow Vault in sync!",
        tone: "CRIMSON",
        showPressureDropPointer: true,
      });
    });

    // Scene 4 (1:02–1:22): 4-Module OBD-II Scanner + "Can I Drive This?" Safety Triage Banner
    fireOnce("s4-sweep-4-modules", 62_000, () => {
      playHexSound("CLICK");
      onSetPipelineStageOverride?.("STAGE_02_XRAY");
      switchWorkspace("SCANNER_AI");
      onOpenObdScannerTabAndSweep();
      onSpotlightPanel("OBD_SCANNER");
      setCalloutTarget({
        targetId: "OBD_SCANNER_VIEW",
        label: "🔍 4-MODULE OBD-II SCANNER • ACTIVE ECU ISOLATED (3/4 🟢 PASS)",
        whyMatters:
          "Sweeps ECM, TCM, ABS & BCM—isolating the rolled fault on its exact ECU while the other 3 modules show 🟢 PASS!",
        tone: "CRIMSON",
      });
    });
    fireOnce("s4-highlight-triage", 73_000, () => {
      playHexSound("CLICK");
      switchWorkspace("SCANNER_AI");
      setCalloutTarget({
        targetId: "SAFETY_TRIAGE_BANNER",
        label: "🚦 CAN I DRIVE THIS? • AUTOMATED ROAD SAFETY TRIAGE",
        whyMatters:
          "Translates the rolled DTC & live sensor anomaly into SAFE, CAUTION, or DO NOT DRIVE guidance.",
        tone: "CRIMSON",
      });
    });

    // Scene 5 (1:22–1:44): Vertex AI Mechanic + Shop Quote Overcharge Detector
    fireOnce("s5-vertex-ai-mechanic", 82_000, () => {
      playHexSound("CLICK");
      onSetPipelineStageOverride?.("STAGE_03_VERTEX_AI");
      switchWorkspace("SCANNER_AI");
      onSpotlightPanel("VERTEX_AUTOPSY");
      setCalloutTarget({
        targetId: "RIGHT_NECROMANCER",
        label: "🧠 STAGE 03: GOOGLE CLOUD VERTEX AI MECHANIC AUTOPSY",
        whyMatters:
          "Gemini 2.5 Flash explains the newly rolled fault in plain English with brand-matched OEM part number & fair book cost.",
        tone: "CRIMSON",
      });
    });
    fireOnce("s5-run-autopsy", 83_500, () => {
      onTriggerVertexAutopsy();
    });
    fireOnce("s5-ripoff-detector", 93_000, () => {
      playHexSound("CLICK");
      switchWorkspace("SCANNER_AI");
      const currentCurse = callbacksRef.current.activeCurse;
      const dealerQuote =
        currentCurse?.dealerQuoteUsd ??
        (currentCurse ? Math.round((currentCurse.estimatedCostUsd * 1.65) / 10) * 10 : 2450);
      onSetShopQuoteUsd(dealerQuote);
      setCalloutTarget({
        targetId: "RIGHT_QUOTE_CHECKER",
        label: `🚨 SHOP OVERCHARGE DETECTOR • $${dealerQuote.toLocaleString()} DEALER QUOTE FLAGGED`,
        whyMatters:
          "Compares the dealership quote against OEM parts + standard book labor to protect drivers from markups!",
        tone: "CRIMSON",
      });
    });

    // Scene 6 (1:44–2:06): FinTech Save-Per-Mile Vault + 25-Mile Commute + Kiro-Verified Printable Work Order
    fireOnce("s6-fintech-vault", 104_000, () => {
      playHexSound("CLICK");
      onSetPipelineStageOverride?.("STAGE_04_ESCROW_KIRO");
      switchWorkspace("REPAIR_VAULT");
      onSpotlightPanel("ESCROW_VAULT");
      setCalloutTarget({
        targetId: "RIGHT_ESCROW_VAULT",
        label: "🏦 STAGE 04: AUTONOMOUS SAVE-PER-MILE FINTECH VAULT",
        whyMatters:
          "Automatically scales per-mile withholding ($0.05/mi -> $2.90/mi) toward the $1,480 repair target.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s6-simulate-commute", 109_500, () => {
      switchWorkspace("REPAIR_VAULT");
      onSimulateCommuteEscrow();
      setCalloutTarget({
        targetId: "RIGHT_ESCROW_VAULT",
        label: "SIMULATE 25-MILE COMMUTE • DOUBLE-ENTRY ESCROW",
        whyMatters:
          "Locks cent-exact repair funds into custodial escrow with Assets = Liabilities + Equity balanced.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s6-open-work-order", 116_500, () => {
      playHexSound("CLICK");
      onSpotlightPanel(null);
      onSetMechanicSpecModalOpen(true);
      setCalloutTarget({
        targetId: "KIRO_VALIDATOR_BADGE",
        label: "✅ VERIFIED BY KIRO WORK-ORDER VALIDATOR",
        whyMatters:
          "Validates ISO 3779 VIN, SAE J2012 code, OEM parts/labor math & UDS checksum on the printable work order!",
        tone: "PHOSPHOR",
      });
    });

    // Scene 7 (2:06–2:22): Clear Codes (Mode $04) -> Turns SVG Vehicle X-Ray Chassis nodes back to 🟢 PASS
    fireOnce("s7-prepare-mode04", 126_000, () => {
      playHexSound("CLICK");
      onSetMechanicSpecModalOpen(false);
      onSetPipelineStageOverride?.("STAGE_02_XRAY");
      switchWorkspace("SCANNER_AI");
      onOpenObdScannerTabAndSweep();
      onSpotlightPanel("OBD_SCANNER");
      setCalloutTarget({
        targetId: "MODE_04_CLEAR_BTN",
        label: "CLEAR CODES / RESET ECU (MODE $04)",
        whyMatters:
          "Broadcasts SAE J1979 TX: 7DF 01 04 -> RX: 7E8 01 44 across all 4 ECUs to clear fault memory and MIL.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s7-fire-mode04", 130_500, () => {
      onClearObdMode04();
      onFireUdsExorcism31();
      onSetDrivingSliders?.(DEFAULT_DRIVING_SLIDERS);
    });
    fireOnce("s7-xray-restored-pass", 133_500, () => {
      onSetPipelineStageOverride?.("STAGE_01_INGEST");
      switchWorkspace("LIVE_HEALTH");
      onSelectXRayModule?.("02_TCM");
      onOpenOscilloscopeTab();
      onSpotlightPanel("OSCILLOSCOPE");
      setCalloutTarget({
        targetId: "XRAY_CHASSIS",
        label: "🟢 SVG VEHICLE X-RAY CHASSIS RESTORED • 4/4 ECUs PASS",
        whyMatters:
          "[ECM], [TCM], [ABS] & [BCM] return to Emerald 🟢 PASS and 60fps hydraulic pressure locks back onto 8.45 Bar!",
        tone: "PHOSPHOR",
      });
    });

    // Scene 8 (2:22–2:45): Engineer Pro & Kiro Verification Suite (.DBC Matrix, Virtual Road Dyno, Kiro Specs + PBTs)
    fireOnce("s8-dbc-matrix", 142_000, () => {
      playHexSound("CLICK");
      onSetPipelineStageOverride?.("STAGE_04_ESCROW_KIRO");
      switchWorkspace("ENGINEER_KIRO", "CAN_DBC");
      onSwitchToEngineerProMode();
      onSpotlightPanel(null);
      onOpenDbcMatrixModal(0);
      setCalloutTarget({
        targetId: "MODAL_DBC_MATRIX",
        label: "🔬 ENGINEER PRO • 64-BIT .DBC SIGNAL BIT MATRIX",
        whyMatters:
          "Inspects live bit-packed OpenDBC signals across 25Hz ISO 15765-4 hexadecimal frames.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s8-dbc-sig-2", 145_000, () => {
      onOpenDbcMatrixModal(2);
    });
    fireOnce("s8-virtual-dyno", 148_000, () => {
      playHexSound("CLICK");
      switchWorkspace("ENGINEER_KIRO", "DYNO_UDS");
      onSpotlightPanel("ROAD_DYNO");
      onExecuteWotDynoPull();
      setCalloutTarget({
        targetId: "ROAD_DYNO_CARD",
        label: "🏎️ LIVE VIRTUAL ROAD DYNO PULL • WHP & TORQUE",
        whyMatters:
          "Executes a physics-calibrated 2,000–7,000 RPM Wide-Open-Throttle pull graphing healthy vs. actual WHP.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s8-kiro-pbt-suite", 153_500, () => {
      onSpotlightPanel(null);
      switchWorkspace("ENGINEER_KIRO", "KIRO_PROOFS");
      onOpenKiroProofsDrawer();
      setCalloutTarget({
        targetId: "KIRO_PBT_CARD",
        label: "🛡️ KIRO EARS SPECS, AGENT HOOKS & FAST-CHECK PBTs",
        whyMatters:
          "Runs 280+ live property-based invariant checks across CAN round-trips, ISO 3779 VINs & escrow math!",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s8-closing-card", 159_500, () => {
      playHexSound("EXORCISM_CHIME");
      stopChillBackgroundMusic(5.0);
      setCalloutTarget(null);
      onCloseAllOverlaysForFinale();
      onSetPipelineStageOverride?.(null);
      switchWorkspace("LIVE_HEALTH");
    });
    fireOnce("s8-finish", TOTAL_CINEMA_DURATION_MS, () => {
      stopChillBackgroundMusic(0.25);
      if (isRecording) {
        stopMediaRecorderAndDownload(true);
      }
      setCalloutTarget(null);
      onSpotlightPanel(null);
      onRunningChange(false);
    });
  }, [
    elapsedMs,
    isRecording,
    isRunning,
    onApplyInlineVehicle,
    onBindNhtsaVinAndPrepareDyno,
    onClearObdMode04,
    onCloseAllOverlaysForFinale,
    onCloseHardwareModalAndResumeSim,
    onExecuteWotDynoPull,
    onExitTopDockCsv,
    onFireUdsExorcism31,
    onInjectPrimaryFaultP0750,
    onLoadTopDockSampleCsv,
    onOpenDbcMatrixModal,
    onOpenKiroProofsDrawer,
    onOpenLiveNhtsaVinModal,
    onOpenObdScannerTabAndSweep,
    onOpenOscilloscopeTab,
    onOpenUdsTerminalTab,
    onResetNominalFocused,
    onRollRandomFault,
    onRunningChange,
    onSeekTopDockCsv,
    onSelectQuickPresetHealthy,
    onSelectXRayModule,
    onSetBentoCockpitView,
    onSetCinemaTooltipPid,
    onSetDrivingSliders,
    onSetMechanicSpecModalOpen,
    onSetOwnCarModalOpen,
    onSetPipelineStageOverride,
    onSetVehiclePopoverOpen,
    onSetShopQuoteUsd,
    onSimulateCommuteEscrow,
    onSpotlightPanel,
    onSwitchModalToCsvReplayAndLoad,
    onSwitchToEngineerProMode,
    onTriggerVertexAutopsy,
    stopMediaRecorderAndDownload,
    switchWorkspace,
  ]);

  const handleJumpToScene = (targetSceneNumber: CinemaSceneNumber) => {
    const targetCfg = CINEMA_SCENES.find((s) => s.sceneNumber === targetSceneNumber);
    if (!targetCfg) return;
    playHexSound("CLICK");
    if (isChillMusicEnabled()) {
      startChillBackgroundMusic();
    }

    const allCueTimestamps: Array<[string, number]> = [
      ["s1-init", 0],
      ["s2-spotlight-dock", 15_000],
      ["s2-load-sample-csv", 19_000],
      ["s2-scrub-csv-frame", 22_800],
      ["s2-open-own-car-vin", 26_000],
      ["s2-select-v6-dsg", 33_000],
      ["s3-healthy-xray", 38_000],
      ["s3-sliders-step-1", 44_500],
      ["s3-sliders-step-2", 48_500],
      ["s3-tcm-node-fault", 52_000],
      ["s4-sweep-4-modules", 58_000],
      ["s4-highlight-triage", 70_000],
      ["s5-vertex-ai-mechanic", 80_000],
      ["s5-run-autopsy", 81_500],
      ["s5-ripoff-detector", 92_000],
      ["s6-fintech-vault", 104_000],
      ["s6-simulate-commute", 109_500],
      ["s6-open-work-order", 116_500],
      ["s7-prepare-mode04", 126_000],
      ["s7-fire-mode04", 130_500],
      ["s7-xray-restored-pass", 133_500],
      ["s8-dbc-matrix", 142_000],
      ["s8-dbc-sig-2", 145_000],
      ["s8-virtual-dyno", 148_000],
      ["s8-kiro-pbt-suite", 153_500],
      ["s8-closing-card", 159_500],
      ["s8-finish", TOTAL_CINEMA_DURATION_MS],
    ];

    const preFired = new Set<string>();
    for (const [key, ms] of allCueTimestamps) {
      if (ms < targetCfg.startMs) {
        preFired.add(key);
      }
    }
    firedCuesRef.current = preFired;

    onCloseAllOverlaysForFinale();
    onExitTopDockCsv?.();
    onSetBentoCockpitView?.(false);
    onSetVehiclePopoverOpen?.(false);
    onSetOwnCarModalOpen?.(false);
    onSetCinemaTooltipPid(null);
    onSetMechanicSpecModalOpen(false);
    onSetDrivingSliders?.(DEFAULT_DRIVING_SLIDERS);
    onResetNominalFocused();
    if (
      targetSceneNumber === 4 ||
      targetSceneNumber === 5 ||
      targetSceneNumber === 6 ||
      targetSceneNumber === 7
    ) {
      onInjectPrimaryFaultP0750();
    }
    if (targetSceneNumber === 6 || targetSceneNumber === 7) {
      onTriggerVertexAutopsy();
    }
    if (targetSceneNumber === 7) {
      onSimulateCommuteEscrow();
    }
    switchWorkspace(
      getWorkspaceTabForScene(targetSceneNumber),
      targetSceneNumber === 8 ? "CAN_DBC" : "CAN_DBC"
    );

    setElapsedMs(targetCfg.startMs);
    setPaused(false);
  };

  useEffect(() => {
    if (!isRunning || !calloutTarget) {
      return;
    }

    const selector = `[data-cinema-target="${calloutTarget.targetId}"]`;
    const firstMatch = document.querySelector(selector);
    if (firstMatch instanceof HTMLElement) {
      const r = firstMatch.getBoundingClientRect();
      if (r.bottom > window.innerHeight - 175 || r.top < 64) {
        firstMatch.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    const measure = () => {
      const el = document.querySelector(selector);
      if (!(el instanceof HTMLElement)) {
        setMeasuredBox(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width <= 4 || rect.height <= 4) {
        setMeasuredBox(null);
        return;
      }
      const pad = 6;
      setMeasuredBox({
        top: Math.max(8, rect.top - pad),
        left: Math.max(8, rect.left - pad),
        width: Math.min(window.innerWidth - 16, rect.width + pad * 2),
        height: Math.min(window.innerHeight - 16, rect.height + pad * 2),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
    };

    const rafId = window.requestAnimationFrame(measure);
    const interval = window.setInterval(measure, 120);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(interval);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [isRunning, calloutTarget]);

  const currentScene: CinemaSceneConfig = useMemo(() => {
    for (let i = CINEMA_SCENES.length - 1; i >= 0; i--) {
      if (elapsedMs >= CINEMA_SCENES[i].startMs) {
        return CINEMA_SCENES[i];
      }
    }
    return CINEMA_SCENES[0];
  }, [elapsedMs]);

  const sceneProgressPct = useMemo(() => {
    const span = Math.max(1, currentScene.endMs - currentScene.startMs);
    return Math.min(100, Math.max(0, ((elapsedMs - currentScene.startMs) / span) * 100));
  }, [currentScene, elapsedMs]);

  const showOpeningTitleCard = isRunning && elapsedMs < 14_600;
  const showClosingTitleCard = isRunning && elapsedMs >= 159_500;
  const activeTone: "PHOSPHOR" | "CRIMSON" =
    calloutTarget?.tone ?? currentScene.accentTone;

  const coachmarkPos = useMemo(() => {
    if (!measuredBox) return null;
    const width = 284;
    const gap = 14;
    const fitsRight =
      measuredBox.left + measuredBox.width + gap + width <= measuredBox.viewportWidth - 12;
    const fitsLeft = measuredBox.left - gap - width >= 12;
    const left = fitsRight
      ? measuredBox.left + measuredBox.width + gap
      : fitsLeft
      ? measuredBox.left - gap - width
      : Math.max(
          12,
          Math.min(
            measuredBox.viewportWidth - width - 12,
            measuredBox.left + measuredBox.width - width - 10
          )
        );
    const top = Math.max(
      76,
      Math.min(
        Math.max(84, measuredBox.viewportHeight - 310),
        measuredBox.top + (fitsRight || fitsLeft ? 16 : 38)
      )
    );
    return { top, left, width };
  }, [measuredBox]);

  return (
    <>
      {/* 1. Cinema Pitch Launcher Bar */}
      <AnimatePresence>
        {(launcherOpen || (!isRunning && recorderStatus)) && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="fixed top-[74px] left-1/2 z-[68] w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 rounded-2xl border border-white/10 bg-zinc-900/95 p-5 text-zinc-100 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                  <Clapperboard className="h-4 w-4 text-violet-400" />
                  <span>Cinema Pitch Director (2:45 • Obsidian OS &amp; Chimera Pipeline Tour)</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Self-running 8-scene tour showcasing the Top Hardware/CSV Dock, Interactive SVG Vehicle X-Ray Chassis, Vertex AI Ripoff Detector, FinTech Vault &amp; Kiro PBT Suite.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleMusic}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    musicEnabled
                      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                      : "border-white/10 bg-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  <Music className="h-3.5 w-3.5" />
                  <span>Music: {musicEnabled ? "ON" : "OFF"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecorderStatus(null);
                    onCloseLauncher();
                  }}
                  className="rounded-xl border border-white/10 bg-zinc-800/70 p-2 text-zinc-400 hover:text-white cursor-pointer"
                  aria-label="Close Cinema Pitch Launcher"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleStartVisualAutoPilot}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-semibold text-zinc-950 shadow-sm transition hover:bg-emerald-400 cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current shrink-0" />
                <span>Play 2:45 Cinema Pitch (Auto-Pilot)</span>
              </button>

              <button
                type="button"
                onClick={() => void handleStartRecordAndRun()}
                className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 cursor-pointer"
              >
                <Video className="h-4 w-4 text-[#FF1E42] shrink-0" />
                <span>🔴 Record Tab &amp; Run 2:45 Pitch (Exports .webm)</span>
              </button>
            </div>

            {(recorderStatus || lastExportUrl) && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0A0E16] px-3 py-2 text-[11px]">
                <span className="text-[#00E5FF]">
                  {recorderStatus ?? "Last 60fps VP9 WebM recording ready."}
                </span>
                {lastExportUrl && (
                  <a
                    href={lastExportUrl}
                    download="hexorcist-kiroween-2026-demo.webm"
                    className="inline-flex items-center gap-1.5 rounded border border-[#00FF9D]/50 bg-[#00FF9D]/15 px-2.5 py-1 font-bold text-[#00FF9D] hover:bg-[#00FF9D]/25"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download hexorcist-kiroween-2026-demo.webm</span>
                  </a>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {/* 2. Scene 1 Everyday Problem Intro Card & Scene 8 Closing Card */}
      <AnimatePresence>
        {(showOpeningTitleCard || showClosingTitleCard) && (
          <motion.div
            key={showOpeningTitleCard ? "opening-title-card" : "closing-title-card"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02, filter: "blur(8px)" }}
            transition={{ duration: 0.85, ease: "easeInOut" }}
            className="fixed inset-0 z-[72] flex flex-col items-center justify-center bg-[#06070A]/96 px-6 pb-52 pt-10 font-mono text-white backdrop-blur-2xl"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(0,255,157,0.12),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(0,229,255,0.1),transparent_45%)]" />

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="relative z-10 mx-auto max-w-5xl text-center space-y-4"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00FF9D]/50 bg-[#00FF9D]/10 px-4 py-1.5 text-xs font-bold tracking-[0.16em] text-[#00FF9D]">
                <Sparkles className="h-3.5 w-3.5" />
                <span>
                  {showOpeningTitleCard
                    ? "KIROWEEN FRANKENSTEIN CATEGORY • 2:45 OBSIDIAN OS TOUR"
                    : "KIROWEEN 2026 • KIRO EARS SPECS & WORK-ORDER VALIDATOR VERIFIED"}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white drop-shadow-[0_0_28px_rgba(0,255,157,0.3)]">
                {showOpeningTitleCard
                  ? "HEXORCIST: OBD-II Hardware + Interactive SVG X-Ray + Vertex AI + FinTech Escrow"
                  : "HEXORCIST Obsidian OS — Frankenstein Automotive Chimera"}
              </h1>

              <div className="mx-auto max-w-4xl rounded-2xl border border-[#00FF9D]/45 bg-[#0A0F18]/90 px-5 py-3.5 text-xs sm:text-base leading-relaxed text-slate-100 shadow-[0_0_40px_rgba(0,255,157,0.14)]">
                {showOpeningTitleCard
                  ? "Stitching real SAE J1979 OBD-II & CSV telemetry, an Interactive SVG Vehicle X-Ray Chassis, Google Cloud Vertex AI quote auditing, and Double-Entry Save-Per-Mile FinTech Escrow."
                  : "Every byte, 4-module ECU sweep, OEM overcharge audit, Kiro-Verified Printable Work Order, and cent of escrow math is verified with Kiro EARS Specs & Property-Based Testing."}
              </div>

              {showOpeningTitleCard ? (
                <div className="mx-auto flex flex-col md:flex-row items-stretch justify-center gap-2.5 pt-2">
                  {INTRO_STORY_STEPS.map((step, idx) => (
                    <React.Fragment key={`${step.id}-${idx}`}>
                      <div className="flex-1 rounded-2xl border border-[#00FF9D]/35 bg-[#0B121C]/90 px-4 py-3.5 text-left shadow-lg">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl" aria-hidden="true">
                            {step.icon}
                          </span>
                          <div>
                            <div className="text-xs sm:text-sm font-extrabold text-white">
                              {step.title}
                            </div>
                            <div className="text-[10px] font-bold text-[#00E5FF]">
                              {step.techTag}
                            </div>
                          </div>
                        </div>
                        <p className="mt-2 text-[11px] leading-snug text-slate-300">
                          {step.desc}
                        </p>
                      </div>
                      {idx < INTRO_STORY_STEPS.length - 1 && (
                        <div className="flex items-center justify-center px-1 text-lg font-bold text-[#00FF9D]">
                          <span className="hidden md:inline" aria-hidden="true">
                            ➡️
                          </span>
                          <ArrowRight className="h-5 w-5 md:hidden text-[#00FF9D] rotate-90" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {CLOSING_PILLARS.map((pillar, idx) => (
                    <div
                      key={`${pillar.id}-${idx}`}
                      className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-left"
                    >
                      <div className="text-[11px] font-bold text-[#00FF9D]">{pillar.code}</div>
                      <div className="mt-0.5 text-[11px] text-slate-300">{pillar.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Glowing Target Callout Ring + Spotlight Coachmark + Scene 3 Pressure Drop Pointer */}
      <AnimatePresence>
        {isRunning &&
          !showOpeningTitleCard &&
          !showClosingTitleCard &&
          calloutTarget &&
          measuredBox &&
          coachmarkPos && (
            <React.Fragment key={`${calloutTarget.targetId}-${calloutTarget.label}`}>
              <motion.div
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  top: measuredBox.top,
                  left: measuredBox.left,
                  width: measuredBox.width,
                  height: measuredBox.height,
                }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
                className={`pointer-events-none fixed z-[65] rounded-2xl border-2 ${
                  calloutTarget.tone === "CRIMSON"
                    ? "border-[#FF1E42] shadow-[0_0_38px_rgba(255,30,66,0.48),inset_0_0_22px_rgba(255,30,66,0.15)]"
                    : "border-[#00FF9D] shadow-[0_0_38px_rgba(0,255,157,0.42),inset_0_0_22px_rgba(0,255,157,0.12)]"
                }`}
              >
                <motion.div
                  animate={{ opacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 1.35, repeat: Infinity }}
                  className={`absolute inset-0 rounded-2xl border ${
                    calloutTarget.tone === "CRIMSON" ? "border-[#FF1E42]" : "border-[#00FF9D]"
                  }`}
                />
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 1.25, repeat: Infinity }}
                  className={`absolute left-3 flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-black tracking-wider shadow-xl ${
                    measuredBox.top < 44 ? "top-2" : "-top-3.5"
                  } ${
                    calloutTarget.tone === "CRIMSON"
                      ? "border-[#FF1E42] bg-[#1A050A]/95 text-[#FF6B81]"
                      : "border-[#00FF9D] bg-[#04120C]/95 text-[#00FF9D]"
                  }`}
                >
                  <Zap className="h-3 w-3 shrink-0" />
                  <span>FOCUS HERE</span>
                  <span className="text-white/60">•</span>
                  <span className="text-white truncate max-w-[260px] sm:max-w-[420px]">
                    {calloutTarget.label}
                  </span>
                  <Crosshair className="h-3 w-3 shrink-0" />
                </motion.div>

                {calloutTarget.showPressureDropPointer && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.94 }}
                    animate={{ opacity: 1, y: [0, -5, 0], scale: 1 }}
                    transition={{
                      y: { duration: 1.15, repeat: Infinity, ease: "easeInOut" },
                      opacity: { duration: 0.25 },
                    }}
                    className="absolute left-1/2 top-[34%] -translate-x-1/2 flex flex-col items-center"
                  >
                    <div className="flex items-center gap-2 rounded-xl border-2 border-[#FF1E42] bg-[#190409]/95 px-3.5 py-2 font-mono shadow-[0_0_32px_rgba(255,30,66,0.65)]">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-[#FF1E42]" />
                      <div className="text-left">
                        <div className="text-xs font-black tracking-wide text-white">
                          ⚠️{" "}
                          {activeCurse
                            ? `Telemetry Anomaly (${activeCurse.codeDisplayLabel ?? activeCurse.dtcCode})!`
                            : "Telemetry Anomaly Detected!"}
                        </div>
                        <div className="text-[10px] font-bold text-[#FF6B81]">
                          {activeCurse?.symptomSummary ??
                            `OEM Part ${activeCurse?.oemPartNumber ?? "Active"} • Fair Fix $${(
                              activeCurse?.estimatedCostUsd ?? 890
                            ).toLocaleString()}`}
                        </div>
                      </div>
                    </div>
                    <div className="h-3 w-3 -mt-1.5 rotate-45 border-b-2 border-r-2 border-[#FF1E42] bg-[#190409]" />
                  </motion.div>
                )}
              </motion.div>

              <motion.aside
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, top: coachmarkPos.top, left: coachmarkPos.left }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.28 }}
                style={{ width: coachmarkPos.width }}
                className={`pointer-events-none fixed z-[70] rounded-xl border bg-[#070B12]/95 p-3 font-mono text-white shadow-2xl backdrop-blur-xl ${
                  calloutTarget.tone === "CRIMSON"
                    ? "border-[#FF1E42]/80 shadow-[0_0_30px_rgba(255,30,66,0.32)]"
                    : "border-[#00E5FF]/75 shadow-[0_0_30px_rgba(0,229,255,0.26)]"
                }`}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#00E5FF]">
                  <Lightbulb className="h-3.5 w-3.5 shrink-0 text-[#FFB800]" />
                  <span>Why This Panel Matters</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-100">
                  {calloutTarget.whyMatters}
                </p>
              </motion.aside>
            </React.Fragment>
          )}
      </AnimatePresence>
      {/* 4. Cinema Story HUD Overlay (Bottom Center — High-Contrast Glassmorphic Banner) */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 26 }}
            transition={{ duration: 0.3 }}
            className={`fixed bottom-4 left-1/2 z-[75] w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 rounded-2xl border-2 bg-[#06070A]/95 p-4 font-mono text-white backdrop-blur-2xl space-y-2.5 ${
              activeTone === "CRIMSON"
                ? "border-[#FF1E42]/90 shadow-[0_0_52px_rgba(255,30,66,0.4)]"
                : "border-[#00FF9D]/85 shadow-[0_0_52px_rgba(0,255,157,0.34)]"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black tracking-wider ${
                    activeTone === "CRIMSON"
                      ? "border-[#FF1E42]/70 bg-[#FF1E42]/20 text-[#FF6B81]"
                      : "border-[#00FF9D]/65 bg-[#00FF9D]/15 text-[#00FF9D]"
                  }`}
                >
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span>{currentScene.badge}</span>
                </span>

                {isRecording && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF1E42] bg-[#FF1E42]/25 px-2.5 py-1 text-[10px] font-bold text-white animate-pulse">
                    <Radio className="h-3 w-3 text-[#FF1E42]" />
                    <span>REC 60FPS .WEBM</span>
                  </span>
                )}

                <span className="rounded bg-white/5 px-2 py-1 text-[10px] text-slate-300">
                  {formatTimecode(elapsedMs)} / {formatTimecode(TOTAL_CINEMA_DURATION_MS)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleToggleMusic}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-bold transition cursor-pointer ${
                    musicEnabled
                      ? "border-[#00FF9D]/60 bg-[#00FF9D]/15 text-[#00FF9D] hover:bg-[#00FF9D]/25"
                      : "border-white/15 bg-white/5 text-slate-400 hover:border-white/35 hover:text-white"
                  }`}
                  title="Toggle Procedural Chill Ambient Music"
                >
                  <Music className="h-3 w-3" />
                  <span>🎵 Music: {musicEnabled ? "ON" : "OFF"}</span>
                </button>

                <button
                  type="button"
                  disabled={currentScene.sceneNumber <= 1}
                  onClick={() =>
                    handleJumpToScene(
                      Math.max(1, currentScene.sceneNumber - 1) as CinemaSceneNumber
                    )
                  }
                  className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-slate-300 hover:border-[#00E5FF]/60 hover:text-[#00E5FF] disabled:opacity-35 cursor-pointer"
                  title="Previous Scene"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playHexSound("CLICK");
                    setPaused((p) => !p);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-slate-200 hover:border-[#00FF9D]/60 hover:text-[#00FF9D] cursor-pointer"
                >
                  {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                  <span>{paused ? "Resume" : "Pause"}</span>
                </button>

                <button
                  type="button"
                  disabled={currentScene.sceneNumber >= 8}
                  onClick={() =>
                    handleJumpToScene(
                      Math.min(8, currentScene.sceneNumber + 1) as CinemaSceneNumber
                    )
                  }
                  className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-slate-300 hover:border-[#00E5FF]/60 hover:text-[#00E5FF] disabled:opacity-35 cursor-pointer"
                  title="Next Scene"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>

                {isRecording && (
                  <button
                    type="button"
                    onClick={() => handleExitCinema(true)}
                    className="flex items-center gap-1 rounded-lg border border-[#FF1E42] bg-[#FF1E42] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#FF1E42]/90 cursor-pointer"
                    title="Stop & Export .webm Now"
                  >
                    <Square className="h-2.5 w-2.5 fill-current" />
                    <span>Save .webm</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleExitCinema(false)}
                  className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] text-slate-300 hover:border-[#FF1E42]/60 hover:text-[#FF6B81] cursor-pointer"
                >
                  <X className="h-3 w-3" />
                  <span>Exit</span>
                </button>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full transition-all duration-100 ${
                  activeTone === "CRIMSON"
                    ? "bg-gradient-to-r from-[#FFB800] via-[#FF1E42] to-[#FF6B81]"
                    : "bg-gradient-to-r from-[#00E5FF] to-[#00FF9D]"
                }`}
                style={{ width: `${Math.max(3, sceneProgressPct)}%` }}
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                {currentScene.headline}
              </h2>

              <div className="rounded-xl border border-[#00FF9D]/35 bg-[#071510]/85 px-3 py-2 space-y-0.5">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#00FF9D]">
                  🟢 IN PLAIN ENGLISH (What&apos;s Happening)
                </div>
                <p className="text-[11px] sm:text-xs leading-relaxed text-slate-100">
                  {currentScene.plainEnglish}
                </p>
              </div>

              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px]">
                <span className="font-extrabold uppercase tracking-wider text-[#00E5FF] shrink-0">
                  ⚡ UNDER THE HOOD (The Tech Chimera):
                </span>
                <span className="text-slate-300 leading-snug">{currentScene.underTheHood}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2 text-[10px]">
              <div className="flex items-center gap-1.5">
                {CINEMA_SCENES.map((scene, idx) => {
                  const isCurrent = scene.sceneNumber === currentScene.sceneNumber;
                  const isCompleted = scene.sceneNumber < currentScene.sceneNumber;
                  return (
                    <button
                      key={`${scene.id}-${idx}`}
                      type="button"
                      onClick={() => handleJumpToScene(scene.sceneNumber)}
                      className={`h-2.5 rounded-full transition-all cursor-pointer ${
                        isCurrent
                          ? activeTone === "CRIMSON"
                            ? "w-8 bg-[#FF1E42]"
                            : "w-8 bg-[#00FF9D]"
                          : isCompleted
                          ? "w-3 bg-[#00E5FF]"
                          : "w-3 bg-white/20 hover:bg-white/40"
                      }`}
                      title={`Jump to Scene ${scene.sceneNumber}`}
                    />
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-slate-300">
                <span className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-0.5">
                  <CheckCircle2 className="h-3 w-3 text-[#00FF9D]" />
                  <span>DTC: {activeDtcCode ?? "NONE (100% HEALTH)"}</span>
                </span>
                <span className="rounded bg-white/5 px-2 py-0.5 text-[#00FF9D]">
                  Escrow: ${(escrowRateCentsPerMile / 100).toFixed(2)}/mi ($
                  {(escrowBalanceCents / 100).toFixed(2)})
                </span>
                <span className="rounded bg-white/5 px-2 py-0.5 text-[#00E5FF]">
                  Dyno Peak: {peakActualWhp} WHP
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}





