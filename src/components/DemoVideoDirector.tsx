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

export type CinemaSpotlightPanelId =
  | "FAULT_HEX"
  | "OSCILLOSCOPE"
  | "OBD_SCANNER"
  | "VERTEX_AUTOPSY"
  | "ESCROW_VAULT"
  | "UDS_EXORCISM"
  | "ROAD_DYNO";

export type CinemaDomTargetId =
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

export const TOTAL_CINEMA_DURATION_MS = 152_000; // 2:32 (~152 seconds, safely under 3:00 limit)

export const CINEMA_SCENES: CinemaSceneConfig[] = [
  defineScene({
    id: "scene-1-everyday-problem",
    sceneNumber: 1,
    startMs: 0,
    endMs: 16_000,
    badge: "SCENE 1 OF 8 • FULL-SCREEN INTRO (0:00–0:16)",
    headline:
      "Meet HEXORCIST: Your Car's Translator, AI Mechanic, Fair-Price Auditor & Automatic Repair Vault",
    plainEnglish:
      "When your Check Engine Light turns on, your car speaks in cryptic trouble codes, dealers hand you an overpriced quote, and your bank account isn't ready. HEXORCIST solves all four in one place.",
    underTheHood:
      "Unifying 4-module SAE J1979 OBD-II scanning, Google Cloud Vertex AI root-cause & fair-price auditing, and cent-exact per-mile FinTech repair escrow.",
    accentTone: "PHOSPHOR",
  }),
  defineScene({
    id: "scene-2-healthy-heartbeat",
    sceneNumber: 2,
    startMs: 16_000,
    endMs: 34_000,
    badge: "SCENE 2 OF 8 • HEALTHY HEARTBEAT & PLAIN-ENGLISH TOOLTIPS (0:16–0:34)",
    headline: "Healthy Engine Heartbeat & Plain-English Sensor Explanations (?)",
    plainEnglish:
      "In Focused Mode, the green EKG oscilloscope confirms target and actual pressure match cleanly, while (?) tooltips translate terms like STFT %, Target vs. Actual Pressure, and Terminal 30 Voltage into everyday English.",
    underTheHood:
      "Streaming 25Hz SAE J1979 / UDS telemetry with progressive disclosure and newcomer-friendly inline KPI definitions.",
    accentTone: "PHOSPHOR",
  }),
  defineScene({
    id: "scene-3-obd-scanner-triage",
    sceneNumber: 3,
    startMs: 34_000,
    endMs: 54_000,
    badge: "SCENE 3 OF 8 • FAULT INJECTION & 4-MODULE OBD-II SCANNER (0:34–0:54)",
    headline: "Multi-Module OBD-II Sweep (ECM/TCM/ABS/BCM), Freeze-Frame & Road Safety Triage",
    plainEnglish:
      "Simulating a failing transmission valve triggers our 4-module scanner sweep—catching confirmed code P0750 in the TCM, capturing the Freeze-Frame snapshot, and flashing a '🟡 CAUTION: CAN I DRIVE THIS?' safety banner.",
    underTheHood:
      "Polls 0x7E8 ECM, 0x7E9 TCM, 0x7EA ABS & 0x7EB BCM across SAE J1979 Modes $02/$03/$07/$0A with automated road-safety triage.",
    accentTone: "CRIMSON",
  }),
  defineScene({
    id: "scene-4-ai-mechanic-quote-checker",
    sceneNumber: 4,
    startMs: 54_000,
    endMs: 76_000,
    badge: "SCENE 4 OF 8 • VERTEX AI AUTOPSY & OVERCHARGE DETECTOR (0:54–1:16)",
    headline: "Google Cloud Vertex AI Diagnosis & Mechanic Quote Fair-Price Checker",
    plainEnglish:
      "Vertex AI pinpoints the exact OEM repair kit ($1,480 fair book total: $420 parts + 6.5 hrs @ $163/hr), while the Shop Quote Checker instantly flags a $2,450 dealer quote as $970 overpriced (+65%).",
    underTheHood:
      "Gemini 2.5 Flash on Vertex AI (/api/autopsy) decodes SAE J2012 bitmask 0x07 0x50 and audits shop quotes against OEM book labor & parts.",
    accentTone: "CRIMSON",
  }),
  defineScene({
    id: "scene-5-repair-vault",
    sceneNumber: 5,
    startMs: 76_000,
    endMs: 96_000,
    badge: "SCENE 5 OF 8 • AUTO-SAVE VAULT & MECHANIC WORK ORDER (1:16–1:36)",
    headline: "Per-Mile Auto-Save Repair Vault & Printable Mechanic Spec Sheet",
    plainEnglish:
      "HEXORCIST automatically boosts your per-mile repair savings rate, deposits a 25-mile commute reserve, and generates a Printable Mechanic Spec Sheet & Escrow Pass so you can skip the $200 shop diagnostic fee.",
    underTheHood:
      "Monotonic cent-exact FinTech sinking-fund ledger ($0.05/mi -> $2.90/mi) paired with a pre-funded ISO 3779 VIN & Freeze-Frame work order.",
    accentTone: "PHOSPHOR",
  }),
  defineScene({
    id: "scene-6-reset-car",
    sceneNumber: 6,
    startMs: 96_000,
    endMs: 114_000,
    badge: "SCENE 6 OF 8 • MODE $04 CLEAR & UDS EXORCISM (1:36–1:54)",
    headline: "Clearing Check Engine Light (Mode $04) & Restoring 100% ECU Health",
    plainEnglish:
      "One click transmits Mode $04 to wipe active/pending codes and turn off the Check Engine Light, followed by Bidirectional UDS calibration—turning all modules PASS and restoring 100% green health.",
    underTheHood:
      "Broadcasts SAE J1979 TX: 7DF 01 04 -> RX: 7E8 01 44 plus ISO 14229 UDS RoutineControl TX: 7E0 04 31 01 F4 0A.",
    accentTone: "PHOSPHOR",
  }),
  defineScene({
    id: "scene-7-any-vin-pro-mode",
    sceneNumber: 7,
    startMs: 114_000,
    endMs: 136_000,
    badge: "SCENE 7 OF 8 • VIN DECODER, PRO MODE, .DBC & DYNO (1:54–2:16)",
    headline: "Universal 17-Digit VIN Decoder, Engineer Pro Mode, .DBC Matrix & Road Dyno",
    plainEnglish:
      "Flip to Engineer Pro Mode to inspect 64-bit .DBC network signals and CSV drive logs, or decode any real 17-digit US DOT VIN to run a calibrated Wide-Open-Throttle Road Dyno pull.",
    underTheHood:
      "Live US DOT NHTSA vPIC 17-digit VIN lookup, 64-bit OpenDBC bit matrix, ISO 15765-4 CSV replay & WOT Virtual Road Dyno (2,000–7,000 RPM).",
    accentTone: "PHOSPHOR",
  }),
  defineScene({
    id: "scene-8-kiro-architecture",
    sceneNumber: 8,
    startMs: 136_000,
    endMs: 152_000,
    badge: "SCENE 8 OF 8 • KIRO ARCHITECTURE & PBT PROOFS (2:16–2:32)",
    headline: "Engineered with Kiro Specs, Agent Hooks, MCP & fast-check Property-Based Testing",
    plainEnglish:
      "Every sensor byte, DTC lookup, fair-price audit, and cent of escrow math is mathematically verified using Kiro EARS Specifications, Agent Hooks, US DOT MCP, and fast-check Property-Based Testing.",
    underTheHood:
      "Spec-driven .kiro/specs EARS requirements, PostFileSave Vitest Agent Hooks, standalone NHTSA MCP server & fast-check PBT suites.",
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
    icon: "🔍",
    title: "4-Module OBD-II Scanner",
    desc: "Sweeps ECM, TCM, ABS & BCM with plain-English tooltips & road-safety triage",
    techTag: "SAE J1979 0x7E8..0x7EB",
  },
  {
    id: "ai-mechanic",
    icon: "🛡️",
    title: "Vertex AI & Fair-Price Auditor",
    desc: "Pinpoints the $1,480 OEM repair & flags overpriced $2,450 dealer quotes",
    techTag: "Gemini 2.5 Flash Audit",
  },
  {
    id: "piggy-bank",
    icon: "🏦",
    title: "Auto-Save Vault & Work Order",
    desc: "Auto-saves per mile you drive & prints a Mechanic Spec Sheet + Escrow Pass",
    techTag: "Cent-Exact FinTech Vault",
  },
] as const;

const CLOSING_PILLARS = [
  { id: "can-bus", code: "4-MODULE OBD-II + UDS", label: "ECM/TCM/ABS/BCM Scanner & Mode $04 Reset" },
  { id: "vertex-ai", code: "VERTEX AI + QUOTE AUDIT", label: "Root Cause, Safety Triage & Overcharge Detector" },
  { id: "fintech-escrow", code: "$0.05 -> $2.90/MI", label: "Auto-Save Vault & Printable Mechanic Pass" },
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
  } = props;

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

    // Scene 1 (0:00–0:16): Full-Screen Intro Card -> Dissolve to Healthy Dashboard
    fireOnce("s1-init", 0, () => {
      onResetNominalFocused();
      onSetCinemaTooltipPid(null);
      onSetMechanicSpecModalOpen(false);
      onSetShopQuoteUsd(2450);
      onSpotlightPanel(null);
      setCalloutTarget(null);
    });
    fireOnce("s1-dissolve-dashboard", 15_000, () => {
      playHexSound("CLICK");
      onSpotlightPanel("OSCILLOSCOPE");
      setCalloutTarget({
        targetId: "CENTER_PANEL",
        label: "HEALTHY CAR HEARTBEAT • TARGET & ACTUAL MATCH (8.45 BAR)",
        whyMatters:
          "In Focused Mode, this green EKG oscilloscope confirms both pressure lines match at 8.45 Bar—zero fluid leaks or mechanical wear.",
        tone: "PHOSPHOR",
      });
    });

    // Scene 2 (0:16–0:34): Healthy Heartbeat & Plain-English KPI Tooltips (?)
    fireOnce("s2-healthy-scope", 16_000, () => {
      onSpotlightPanel("OSCILLOSCOPE");
      setCalloutTarget({
        targetId: "CENTER_PANEL",
        label: "FOCUSED MODE • CLEAN GREEN EKG OSCILLOSCOPE",
        whyMatters:
          "Beginners see a calm, readable health monitor instead of raw hexadecimal bytes—as long as both traces overlap, your car is nominal.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s2-kpi-tooltip-pressure", 22_000, () => {
      playHexSound("CLICK");
      onSetCinemaTooltipPid("22F40A");
      setCalloutTarget({
        targetId: "CENTER_KPI_GRID",
        label: "PLAIN-ENGLISH (?) TOOLTIP • TARGET VS. ACTUAL PRESSURE",
        whyMatters:
          "Every KPI card includes a (?) badge explaining automotive terms like Target vs. Actual Pressure in plain everyday English.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s2-kpi-tooltip-stft", 26_800, () => {
      playHexSound("CLICK");
      onSetCinemaTooltipPid("0106");
      setCalloutTarget({
        targetId: "CENTER_KPI_GRID",
        label: "PLAIN-ENGLISH (?) TOOLTIP • STFT % & TERMINAL 30 VOLTAGE",
        whyMatters:
          "Explains 'STFT %' ('How much extra fuel the computer is adding right now') and 'Terminal 30 Voltage' with healthy spec ranges.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s2-kpi-tooltip-volt", 30_800, () => {
      onSetCinemaTooltipPid("0142");
    });

    // Scene 3 (0:34–0:54): Fault Injection & Standard OBD-II Multi-Module Code Scanner
    fireOnce("s3-inject-fault", 34_000, () => {
      onSetCinemaTooltipPid(null);
      onInjectPrimaryFaultP0750();
      onSpotlightPanel("OSCILLOSCOPE");
      setCalloutTarget({
        targetId: "CENTER_PANEL",
        label: "FAULT INJECTED • PRESSURE DROPS 8.45 -> 2.35 BAR",
        whyMatters:
          "A failing transmission shift solenoid drops hydraulic pressure to 2.35 Bar—turning the EKG trace crimson immediately.",
        tone: "CRIMSON",
        showPressureDropPointer: true,
      });
    });
    fireOnce("s3-open-obd-scanner", 39_000, () => {
      playHexSound("CLICK");
      onOpenObdScannerTabAndSweep();
      onSpotlightPanel("OBD_SCANNER");
      setCalloutTarget({
        targetId: "OBD_SCANNER_VIEW",
        label: "4-MODULE OBD-II SWEEP • ECM / TCM / ABS / BCM",
        whyMatters:
          "Polls 01 ECM (0x7E8), 02 TCM (0x7E9), 03 ABS (0x7EA) & 09 BCM (0x7EB), catching confirmed P0750 + Mode $02 Freeze-Frame.",
        tone: "CRIMSON",
      });
    });
    fireOnce("s3-highlight-triage", 45_500, () => {
      playHexSound("CLICK");
      setCalloutTarget({
        targetId: "SAFETY_TRIAGE_BANNER",
        label: "🟡 CAUTION: CAN I DRIVE WITH THIS? • LIMP HOME RISK",
        whyMatters:
          "Answers every driver's #1 question immediately: safe for short low-speed trips to the shop, avoid highway towing or hard throttle.",
        tone: "CRIMSON",
      });
    });

    // Scene 4 (0:54–1:16): Vertex AI Autopsy & "Mechanic Quote Overcharge Detector"
    fireOnce("s4-spotlight-ai-mechanic", 54_000, () => {
      playHexSound("CLICK");
      onSpotlightPanel("VERTEX_AUTOPSY");
      setCalloutTarget({
        targetId: "RIGHT_NECROMANCER",
        label: "GOOGLE CLOUD VERTEX AI • $1,480 FAIR OEM ESTIMATE",
        whyMatters:
          "Gemini 2.5 Flash decodes P0750 into OEM kit #0B5-398-009-F ($420 OEM parts + 6.5 hrs @ $163/hr = $1,480 fair total).",
        tone: "CRIMSON",
      });
    });
    fireOnce("s4-run-autopsy", 56_000, () => {
      onTriggerVertexAutopsy();
    });
    fireOnce("s4-quote-checker", 64_500, () => {
      playHexSound("CLICK");
      onSetShopQuoteUsd(2450);
      setCalloutTarget({
        targetId: "RIGHT_QUOTE_CHECKER",
        label: "DEALER QUOTE $2,450 -> 🔴 OVERPRICED BY $970 (+65%)",
        whyMatters:
          "Audits any shop quote against OEM book parts ($420) + standard labor (6.5 hrs @ $163/hr), flagging a $970 dealer markup instantly!",
        tone: "CRIMSON",
      });
    });

    // Scene 5 (1:16–1:36): Auto-Save Per Mile Escrow Vault & Mechanic Work Order
    fireOnce("s5-spotlight-escrow", 76_000, () => {
      playHexSound("CLICK");
      onSpotlightPanel("ESCROW_VAULT");
      setCalloutTarget({
        targetId: "RIGHT_ESCROW_VAULT",
        label: "AUTO-SAVE PER MILE VAULT • RATE SCALES AUTOMATICALLY",
        whyMatters:
          "As soon as P0750 is detected, HEXORCIST boosts per-mile withholding ($0.05/mi -> $2.90/mi) to pre-fund the repair while you drive.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s5-simulate-commute", 81_500, () => {
      onSimulateCommuteEscrow();
      setCalloutTarget({
        targetId: "RIGHT_ESCROW_VAULT",
        label: "25-MILE COMMUTE DEPOSITED • REPAIR DOLLARS LOCKED",
        whyMatters:
          "Simulating a 25-mile commute locks cent-exact repair funds directly into your autonomous FinTech escrow ledger.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s5-open-spec-sheet", 88_000, () => {
      playHexSound("CLICK");
      onSpotlightPanel(null);
      onSetMechanicSpecModalOpen(true);
      setCalloutTarget({
        targetId: "MECHANIC_SPEC_MODAL",
        label: "PRINTABLE MECHANIC SPEC SHEET & ESCROW PASS",
        whyMatters:
          "Bundles your VIN, Confirmed DTCs, Freeze-Frame, OEM Part # & Pre-Funded Escrow Pass so you can skip the $200 shop diagnostic fee.",
        tone: "PHOSPHOR",
      });
    });

    // Scene 6 (1:36–1:54): Clearing Codes (Mode $04) & Bidirectional UDS Exorcism
    fireOnce("s6-prepare-mode04", 96_000, () => {
      playHexSound("CLICK");
      onSetMechanicSpecModalOpen(false);
      onOpenObdScannerTabAndSweep();
      onSpotlightPanel("OBD_SCANNER");
      setCalloutTarget({
        targetId: "MODE_04_CLEAR_BTN",
        label: "MODE $04 BROADCAST • CLEAR CODES & RESET MIL",
        whyMatters:
          "Once repaired, clicking Clear Codes sends SAE J1979 TX: 7DF 01 04 -> RX: 7E8 01 44 to wipe fault memory and turn off the Check Engine Light.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s6-fire-mode04", 100_000, () => {
      onClearObdMode04();
      setCalloutTarget({
        targetId: "OBD_SCANNER_VIEW",
        label: "CHECK ENGINE LIGHT OFF • ALL 4 MODULES PASS",
        whyMatters:
          "ECM, TCM, ABS & BCM all return 🟢 PASS (0 Faults) immediately after the Mode $04 broadcast.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s6-fire-uds-31", 104_500, () => {
      onOpenUdsTerminalTab();
      onSpotlightPanel("UDS_EXORCISM");
      onFireUdsExorcism31();
      setCalloutTarget({
        targetId: "CENTER_PANEL",
        label: "BIDIRECTIONAL UDS EXORCISM • TX: 7E0 04 31 01 F4 0A",
        whyMatters:
          "Executes ISO 14229 solenoid kiss-point adaptation to confirm factory valve calibration.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s6-verify-green-scope", 109_000, () => {
      onOpenOscilloscopeTab();
      onSpotlightPanel("OSCILLOSCOPE");
      setCalloutTarget({
        targetId: "CENTER_PANEL",
        label: "100% VEHICLE HEALTH RESTORED • RATE BACK TO $0.05/MI",
        whyMatters:
          "Both green oscilloscope traces lock back onto 8.45 Bar and per-mile savings drop back to $0.05/mi.",
        tone: "PHOSPHOR",
      });
    });

    // Scene 7 (1:54–2:16): Universal VIN Decoder, Engineer Pro Mode, .DBC Matrix & Dyno Pull
    fireOnce("s7-pro-mode", 114_000, () => {
      playHexSound("CLICK");
      onSwitchToEngineerProMode();
      onSpotlightPanel("FAULT_HEX");
      setCalloutTarget({
        targetId: "LEFT_HEX_STREAM",
        label: "ENGINEER PRO MODE • LIVE 25HZ RAW CAN NETWORK",
        whyMatters:
          "Flip to Engineer Pro Mode to inspect raw 25Hz ISO 15765-4 hexadecimal frames and XOR checksums.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s7-dbc-sig-0", 117_200, () => {
      playHexSound("CLICK");
      onSpotlightPanel(null);
      onOpenDbcMatrixModal(0);
      setCalloutTarget({
        targetId: "MODAL_DBC_MATRIX",
        label: "64-BIT .DBC SIGNAL MATRIX • BIT-LEVEL DECODING",
        whyMatters:
          "Highlights exact bit positions inside 64-bit OpenDBC payloads for clutch pressure, fluid temp, and RPM.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s7-dbc-sig-2", 119_500, () => {
      onOpenDbcMatrixModal(2);
    });
    fireOnce("s7-csv-scrubber", 122_000, () => {
      playHexSound("CLICK");
      onSwitchModalToCsvReplayAndLoad();
      setCalloutTarget({
        targetId: "MODAL_CSV_SCRUBBER",
        label: "ISO 15765-4 CSV REPLAY • 2X TIMELINE SCRUBBER",
        whyMatters:
          "Scrub recorded 100-row highway telemetry logs frame by frame to isolate intermittent anomalies.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s7-open-vin", 126_200, () => {
      onCloseHardwareModalAndResumeSim();
      playHexSound("CLICK");
      onOpenLiveNhtsaVinModal();
      setCalloutTarget({
        targetId: "VIN_MODAL_CARD",
        label: "LIVE US DOT NHTSA 17-DIGIT VIN CALIBRATION",
        whyMatters:
          "Decode any real 17-digit ISO 3779 VIN via US DOT vPIC to bind factory displacement, mass & horsepower.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s7-bind-vin-dyno", 130_000, () => {
      playHexSound("CLICK");
      onBindNhtsaVinAndPrepareDyno();
      onSpotlightPanel("ROAD_DYNO");
      setCalloutTarget({
        targetId: "CENTER_PANEL",
        label: "VIRTUAL ROAD DYNO • WOT HORSEPOWER & TORQUE PULL",
        whyMatters:
          "Executes a physics-calibrated 2,000–7,000 RPM Wide-Open-Throttle pull comparing healthy vs. actual WHP.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s7-wot-pull", 130_800, () => {
      onExecuteWotDynoPull();
    });

    // Scene 8 (2:16–2:32): Kiro Architecture & Property-Based Testing Proofs
    fireOnce("s8-open-kiro", 136_000, () => {
      onSpotlightPanel(null);
      onOpenKiroProofsDrawer();
      setCalloutTarget({
        targetId: "KIRO_PBT_CARD",
        label: "KIRO EARS SPECS, AGENT HOOKS, MCP & FAST-CHECK PBT",
        whyMatters:
          "Verifies CAN round-trips, SAE J2012 DTC bijections, fair-price audits & monotonic escrow math across thousands of random inputs.",
        tone: "PHOSPHOR",
      });
    });
    fireOnce("s8-closing-card", 145_500, () => {
      playHexSound("EXORCISM_CHIME");
      stopChillBackgroundMusic(5.2);
      setCalloutTarget(null);
      onCloseAllOverlaysForFinale();
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
    onBindNhtsaVinAndPrepareDyno,
    onClearObdMode04,
    onCloseAllOverlaysForFinale,
    onCloseHardwareModalAndResumeSim,
    onExecuteWotDynoPull,
    onFireUdsExorcism31,
    onInjectPrimaryFaultP0750,
    onOpenDbcMatrixModal,
    onOpenKiroProofsDrawer,
    onOpenLiveNhtsaVinModal,
    onOpenObdScannerTabAndSweep,
    onOpenOscilloscopeTab,
    onOpenUdsTerminalTab,
    onResetNominalFocused,
    onRunningChange,
    onSetCinemaTooltipPid,
    onSetMechanicSpecModalOpen,
    onSetShopQuoteUsd,
    onSimulateCommuteEscrow,
    onSpotlightPanel,
    onSwitchModalToCsvReplayAndLoad,
    onSwitchToEngineerProMode,
    onTriggerVertexAutopsy,
    stopMediaRecorderAndDownload,
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
      ["s1-dissolve-dashboard", 15_000],
      ["s2-healthy-scope", 16_000],
      ["s2-kpi-tooltip-pressure", 22_000],
      ["s2-kpi-tooltip-stft", 26_800],
      ["s2-kpi-tooltip-volt", 30_800],
      ["s3-inject-fault", 34_000],
      ["s3-open-obd-scanner", 39_000],
      ["s3-highlight-triage", 45_500],
      ["s4-spotlight-ai-mechanic", 54_000],
      ["s4-run-autopsy", 56_000],
      ["s4-quote-checker", 64_500],
      ["s5-spotlight-escrow", 76_000],
      ["s5-simulate-commute", 81_500],
      ["s5-open-spec-sheet", 88_000],
      ["s6-prepare-mode04", 96_000],
      ["s6-fire-mode04", 100_000],
      ["s6-fire-uds-31", 104_500],
      ["s6-verify-green-scope", 109_000],
      ["s7-pro-mode", 114_000],
      ["s7-dbc-sig-0", 117_200],
      ["s7-dbc-sig-2", 119_500],
      ["s7-csv-scrubber", 122_000],
      ["s7-open-vin", 126_200],
      ["s7-bind-vin-dyno", 130_000],
      ["s7-wot-pull", 130_800],
      ["s8-open-kiro", 136_000],
      ["s8-closing-card", 145_500],
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
    onSetCinemaTooltipPid(null);
    onSetMechanicSpecModalOpen(false);
    onResetNominalFocused();
    if (targetSceneNumber === 4 || targetSceneNumber === 5 || targetSceneNumber === 6) {
      onInjectPrimaryFaultP0750();
    }
    if (targetSceneNumber === 5 || targetSceneNumber === 6) {
      onTriggerVertexAutopsy();
    }
    if (targetSceneNumber === 6) {
      onSimulateCommuteEscrow();
    }

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

  const showOpeningTitleCard = isRunning && elapsedMs < 15_000;
  const showClosingTitleCard = isRunning && elapsedMs >= 145_500;
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
            className="fixed top-[74px] left-1/2 z-[68] w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 rounded-2xl border border-[#00FF9D]/75 bg-[#06070A]/96 p-4 font-mono text-white shadow-[0_0_48px_rgba(0,255,157,0.3)] backdrop-blur-2xl"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00FF9D]">
                  <Clapperboard className="h-4 w-4" />
                  <span>Newcomer-Friendly Cinema Pitch Director (2:32 • Chill Ambient Music)</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Self-running 8-scene walkthrough (~2:32) showcasing Plain-English KPI Tooltips, 4-Module OBD-II Code Scanner, Road Safety Triage, Vertex AI Quote Auditor, Auto-Save Vault, Printable Mechanic Spec Sheet, Pro Mode &amp; Kiro PBT proofs.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleMusic}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                    musicEnabled
                      ? "border-[#00FF9D]/60 bg-[#00FF9D]/15 text-[#00FF9D]"
                      : "border-white/15 bg-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  <Music className="h-3.5 w-3.5" />
                  <span>🎵 Music: {musicEnabled ? "ON" : "OFF"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecorderStatus(null);
                    onCloseLauncher();
                  }}
                  className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-slate-300 hover:border-white/35 hover:text-white cursor-pointer"
                  aria-label="Close Cinema Pitch Launcher"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleStartVisualAutoPilot}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#00FF9D] px-4 py-3 text-xs font-bold text-[#06070A] shadow-[0_0_24px_rgba(0,255,157,0.32)] transition hover:bg-[#00FF9D]/90 cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current shrink-0" />
                <span>▶ Play 2:32 Cinema Pitch (Auto-Pilot + Chill Music)</span>
              </button>

              <button
                type="button"
                onClick={() => void handleStartRecordAndRun()}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#FF1E42]/80 bg-[#FF1E42]/20 px-4 py-3 text-xs font-bold text-white shadow-[0_0_24px_rgba(255,30,66,0.28)] transition hover:bg-[#FF1E42]/30 cursor-pointer"
              >
                <Video className="h-4 w-4 text-[#FF1E42] shrink-0" />
                <span>🔴 Record Tab &amp; Run 2:32 Pitch (Exports .webm)</span>
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
                    ? "ZERO AUTOMOTIVE BACKGROUND NEEDED • 2:32 GUIDED STORY"
                    : "KIROWEEN 2026 • KIRO EARS SPECS & FAST-CHECK PROOFS VERIFIED"}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white drop-shadow-[0_0_28px_rgba(0,255,157,0.3)]">
                {showOpeningTitleCard
                  ? "Meet HEXORCIST: Your Car's Translator, AI Mechanic, Fair-Price Auditor & Automatic Repair Vault"
                  : "HEXORCIST — Car Scanner, Fair-Price Auditor & Repair Vault in Perfect Sync"}
              </h1>

              <div className="mx-auto max-w-4xl rounded-2xl border border-[#00FF9D]/45 bg-[#0A0F18]/90 px-5 py-3.5 text-xs sm:text-base leading-relaxed text-slate-100 shadow-[0_0_40px_rgba(0,255,157,0.14)]">
                {showOpeningTitleCard
                  ? "When your Check Engine Light turns on, your car speaks in cryptic trouble codes, dealers hand you an overpriced quote, and your bank account isn't ready. HEXORCIST translates, audits, and funds the repair automatically."
                  : "Every calculation—from 4-module OBD-II & 25Hz CAN decoding to fair-price auditing and cent-exact repair savings—is mathematically verified with Kiro EARS Specifications, Agent Hooks, US DOT NHTSA MCP, and Property-Based Testing."}
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
                          ⚠️ Pressure Drop Detected!
                        </div>
                        <div className="text-[10px] font-bold text-[#FF6B81]">
                          Actual: 2.35 Bar vs. Needed: 8.45 Bar
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





