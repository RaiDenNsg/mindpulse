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
const MIN_TYPING_BEFORE_SAVE_MS = 10000;
const SESSION_SAVED_EVENT = "mindpulse:session-saved";
const GRAPH_STORAGE_KEY = "mindpulse_graph_data";

type GraphPoint = { time: number; load: number };

function loadPersistedGraphData(): GraphPoint[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(GRAPH_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as { date?: string; points?: GraphPoint[] };
    const today = getTodayKey();
    if (parsed?.date !== today || !Array.isArray(parsed?.points)) {
      localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify({ date: today, points: [] }));
      return [];
    }

    return parsed.points
      .filter((point) => typeof point?.time === "number" && typeof point?.load === "number")
      .slice(-120);
  } catch {
    return [];
  }
}

function persistGraphData(points: GraphPoint[], dateKey: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify({
      date: dateKey,
      points: points.slice(-120),
    }));
  } catch {
    // Ignore storage failures so tracking UI remains functional.
  }
}

function clearPersistedGraphData(dateKey: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify({ date: dateKey, points: [] }));
  } catch {
    // Ignore storage failures so tracking UI remains functional.
  }
}

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
  debugMetrics: {
    backspaceCount: number;
    idleTime: number;
    typingSpeed: number;
    cognitiveLoad: number;
  };
}

export function useTracking() {
  // Always start with empty graph on mount - no stale data from previous sessions
  // Previous session data is preserved in Firestore (Daily Report, History)
  // Graph persistence is only for mid-session refreshes (current session data)
  const initialGraphData: GraphPoint[] = [];

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
    graphData: initialGraphData,
    debugMetrics: {
      backspaceCount: 0,
      idleTime: 0,
      typingSpeed: 0,
      cognitiveLoad: 0,
    },
  });

  const keystrokesRef = useRef(0);
  const backspacesRef = useRef(0);
  const lastKeypressRef = useRef(Date.now());
  const firstKeystrokeTimeRef = useRef<number | null>(null);
  const sessionStartRef = useRef(Date.now());
  const typingTimeRef = useRef(0);
  const cognitiveLoadsRef = useRef<number[]>([]);
  const intervalKeystrokesRef = useRef(0);
  const intervalBackspacesRef = useRef(0);
  const lastSavedAtRef = useRef(0);
  const hasStartedTypingRef = useRef(initialGraphData.length > 0);
  const currentGraphDateRef = useRef(getTodayKey());

  const handleKeyDown = useCallback((key: string) => {
    const now = Date.now();
    
    // Track first keystroke time
    if (firstKeystrokeTimeRef.current === null) {
      firstKeystrokeTimeRef.current = now;
      lastKeypressRef.current = now;
    }
    
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
      const todayKey = getTodayKey();

      if (todayKey !== currentGraphDateRef.current) {
        currentGraphDateRef.current = todayKey;
        cognitiveLoadsRef.current = [];
        hasStartedTypingRef.current = false;
        firstKeystrokeTimeRef.current = null;

        setState((prev) => ({
          ...prev,
          graphData: [],
        }));

        clearPersistedGraphData(todayKey);
      }

      // CRITICAL: If user hasn't typed anything yet, don't calculate any metrics
      // Everything stays at 0 until first keypress
      if (!hasStartedTypingRef.current) {
        // Reset interval counters and return early
        intervalKeystrokesRef.current = 0;
        intervalBackspacesRef.current = 0;
        return;
      }

      const sessionMs = now - sessionStartRef.current;
      const sessionSec = sessionMs / 1000;
      
      // Only calculate duration and speed if user has started typing
      // Duration and speed are relative to first keystroke, not session start
      let sessionMin = 0;
      if (firstKeystrokeTimeRef.current !== null) {
        const activeSessionMs = now - firstKeystrokeTimeRef.current;
        sessionMin = activeSessionMs / 60000;
      }
      
      // Idle time: only count after typing starts
      const idleSec = (now - lastKeypressRef.current) / 1000;

      // Use period-based metrics for more responsive cognitive load calculation
      // This reflects current activity instead of session-wide averages
      const periodSpeed = intervalKeystrokesRef.current > 0
        ? intervalKeystrokesRef.current
        : 0;
      const periodBRate = intervalKeystrokesRef.current > 0
        ? Math.round((intervalBackspacesRef.current / intervalKeystrokesRef.current) * 100)
        : 0;

      // Calculate cognitive load (already guarded by typing check above)
      const load = calculateCognitiveLoad(intervalBackspacesRef.current, idleSec, periodSpeed);
      
      console.log("Cognitive debug", {
        hasStartedTyping: hasStartedTypingRef.current,
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
      const shouldAppendGraphPoint = true;

      // Only track cognitive loads after typing has started
      cognitiveLoadsRef.current.push(load);

      let nextGraphData: GraphPoint[] = [];

      setState(prev => {
        nextGraphData = shouldAppendGraphPoint
          ? [...prev.graphData, nextPoint].slice(-120)
          : prev.graphData;

        return {
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
          graphData: nextGraphData,
          debugMetrics: {
            backspaceCount: intervalBackspacesRef.current,
            idleTime: Number(idleSec.toFixed(2)),
            typingSpeed: periodSpeed,
            cognitiveLoad: Math.round(load),
          },
        };
      });

      persistGraphData(nextGraphData, currentGraphDateRef.current);

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
