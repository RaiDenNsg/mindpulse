import { useState, useRef, useCallback, useEffect } from "react";
import {
  calculateCognitiveLoad,
  detectFocusState,
  calculateFocusScore,
  calculateProductivity,
  getInsightMessage,
  type FocusState,
} from "@/utils/cognitiveLogic";
import { getTodayKey } from "@/utils/storage";
import { auth } from "@/firebase/config";
import { saveSession } from "@/firebase/sessions";

const GRAPH_UPDATE_INTERVAL_MS = 5000;
const AUTO_SAVE_INTERVAL_MS = 60000;
const MIN_TYPING_BEFORE_SAVE_MS = 30000;
const SESSION_SAVED_EVENT = "mindpulse:session-saved";

export interface TrackingState {
  totalKeystrokes: number;
  backspaceCount: number;
  typingSpeed: number;
  idleTime: number;
  cognitiveLoad: number;
  focusState: FocusState;
  focusScore: number;
  productivity: number;
  backspaceRate: number;
  sessionDuration: number;
  insight: string;
  graphData: Array<{ time: number; load: number }>;
}

export function useTracking() {
  const [state, setState] = useState<TrackingState>({
    totalKeystrokes: 0,
    backspaceCount: 0,
    typingSpeed: 0,
    idleTime: 0,
    cognitiveLoad: 0,
    focusState: "Neutral",
    focusScore: 0,
    productivity: 0,
    backspaceRate: 0,
    sessionDuration: 0,
    insight: "Start typing to begin tracking 🎯",
    graphData: [],
  });

  const keystrokesRef = useRef(0);
  const backspacesRef = useRef(0);
  const lastKeypressRef = useRef(Date.now());
  const sessionStartRef = useRef(Date.now());
  const typingTimeRef = useRef(0);
  const cognitiveLoadsRef = useRef<number[]>([]);
  const intervalKeystrokesRef = useRef(0);
  const intervalBackspacesRef = useRef(0);
  const lastSavedAtRef = useRef(0);
  const hasStartedTypingRef = useRef(false);

  const handleKeyDown = useCallback((key: string) => {
    const now = Date.now();
    const gap = now - lastKeypressRef.current;

    // Count as typing time if gap < 5s
    if (gap < 5000) {
      typingTimeRef.current += gap;
    }

    lastKeypressRef.current = now;
    keystrokesRef.current++;
    intervalKeystrokesRef.current++;
    hasStartedTypingRef.current = true;

    if (key === "Backspace") {
      backspacesRef.current++;
      intervalBackspacesRef.current++;
    }
  }, []);

  const emitSessionSaved = useCallback((userId: string) => {
    if (typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(
      new CustomEvent(SESSION_SAVED_EVENT, {
        detail: { userId },
      })
    );
  }, []);

  const persistSessionData = useCallback((sessionSec: number, focusScore: number, productivity: number) => {
    const userId = auth?.currentUser?.uid;
    if (!userId) {
      console.log("Skipping save: missing user uid");
      return;
    }

    if (typingTimeRef.current < MIN_TYPING_BEFORE_SAVE_MS) {
      console.log("Skipping save: typing time below threshold", {
        typingTimeMs: typingTimeRef.current,
        requiredMs: MIN_TYPING_BEFORE_SAVE_MS,
      });
      return;
    }

    const avgLoad = cognitiveLoadsRef.current.length > 0
      ? cognitiveLoadsRef.current.reduce((a, b) => a + b, 0) / cognitiveLoadsRef.current.length
      : 0;

    console.log("Saving session...", { userId });

    void saveSession(userId, {
      date: getTodayKey(),
      avgCognitiveLoad: Math.round(avgLoad),
      focusScore,
      productivity,
      backspaceRate: keystrokesRef.current > 0
        ? Math.round((backspacesRef.current / keystrokesRef.current) * 100)
        : 0,
      sessionDuration: Math.max(0, Math.round(sessionSec)),
    }).then(() => {
      lastSavedAtRef.current = Date.now();
      emitSessionSaved(userId);
      console.log("Session saved successfully", { userId });
    }).catch(() => {
      // Silent fail to avoid interrupting tracking UI on transient network issues.
      console.log("Session save failed");
    });
  }, [emitSessionSaved]);

  // Update stats every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const sessionMs = now - sessionStartRef.current;
      const sessionSec = sessionMs / 1000;
      const sessionMin = sessionMs / 60000;
      const idleSec = (now - lastKeypressRef.current) / 1000;

      // Use period-based metrics for more responsive cognitive load calculation
      // This reflects current activity instead of session-wide averages
      const periodSpeed = intervalKeystrokesRef.current > 0
        ? intervalKeystrokesRef.current
        : 0;
      const periodBRate = intervalKeystrokesRef.current > 0
        ? Math.round((intervalBackspacesRef.current / intervalKeystrokesRef.current) * 100)
        : 0;

      // Calculate cognitive load based on current period activity
      const load = calculateCognitiveLoad(intervalBackspacesRef.current, idleSec, periodSpeed);
      console.log("Cognitive debug", {
        backspaceCount: intervalBackspacesRef.current,
        idleTime: Number(idleSec.toFixed(2)),
        typingSpeed: periodSpeed,
        cognitiveLoad: Math.round(load),
      });
      const focus = detectFocusState(periodSpeed, periodBRate, idleSec);
      const fScore = calculateFocusScore(typingTimeRef.current, sessionMs);
      const prod = calculateProductivity(fScore, periodBRate);
      const insight = getInsightMessage(focus, periodBRate, idleSec, load);
      const nextPoint = { time: Math.round(sessionSec), load: Math.round(load) };

      // Once typing starts, keep appending every 5s so the graph reflects current values.
      const shouldAppendGraphPoint = hasStartedTypingRef.current;

      cognitiveLoadsRef.current.push(load);

      setState(prev => ({
        totalKeystrokes: keystrokesRef.current,
        backspaceCount: backspacesRef.current,
        typingSpeed: sessionMin > 0 ? Math.round(keystrokesRef.current / sessionMin) : 0,
        idleTime: Math.round(idleSec),
        cognitiveLoad: Math.round(load),
        focusState: focus,
        focusScore: fScore,
        productivity: prod,
        backspaceRate: keystrokesRef.current > 0
          ? Math.round((backspacesRef.current / keystrokesRef.current) * 100)
          : 0,
        sessionDuration: Math.round(sessionSec),
        insight,
        graphData: shouldAppendGraphPoint
          ? [...prev.graphData, nextPoint].slice(-120)
          : prev.graphData,
      }));

      // Reset per-interval counters after processing
      intervalKeystrokesRef.current = 0;
      intervalBackspacesRef.current = 0;

      // Save every 60 seconds once minimum typing time threshold is met.
      if (now - lastSavedAtRef.current >= AUTO_SAVE_INTERVAL_MS) {
        persistSessionData(sessionSec, fScore, prod);
      }
    }, GRAPH_UPDATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [persistSessionData]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const now = Date.now();
      const sessionSec = (now - sessionStartRef.current) / 1000;
      const fScore = calculateFocusScore(typingTimeRef.current, now - sessionStartRef.current);
      const totalBackspaceRate = keystrokesRef.current > 0
        ? Math.round((backspacesRef.current / keystrokesRef.current) * 100)
        : 0;
      const prod = calculateProductivity(fScore, totalBackspaceRate);

      persistSessionData(sessionSec, fScore, prod);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [persistSessionData]);

  return { state, handleKeyDown };
}
