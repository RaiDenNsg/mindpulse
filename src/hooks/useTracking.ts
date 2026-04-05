import { useState, useRef, useCallback, useEffect } from "react";
import {
  calculateCognitiveLoad,
  detectFocusState,
  calculateFocusScore,
  calculateProductivity,
  getInsightMessage,
  type FocusState,
} from "@/utils/cognitiveLogic";
import { saveSession, getTodayKey } from "@/utils/storage";

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

    if (key === "Backspace") {
      backspacesRef.current++;
      intervalBackspacesRef.current++;
    }
  }, []);

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
        ? Math.round((intervalKeystrokesRef.current / 5) * 12) // keystrokes per minute in this period
        : 0;
      const periodBRate = intervalKeystrokesRef.current > 0
        ? Math.round((intervalBackspacesRef.current / intervalKeystrokesRef.current) * 100)
        : 0;

      // Calculate cognitive load based on current period activity
      const load = calculateCognitiveLoad(intervalBackspacesRef.current, idleSec, periodSpeed);
      const focus = detectFocusState(periodSpeed, periodBRate, idleSec);
      const fScore = calculateFocusScore(typingTimeRef.current, sessionMs);
      const prod = calculateProductivity(fScore, periodBRate);
      const insight = getInsightMessage(focus, periodBRate, idleSec, load);
      const nextPoint = { time: Math.round(sessionSec), load: Math.round(load) };
      
      // Add to graph if there's been any typing activity in this period or overall
      const hasTypingActivity = intervalKeystrokesRef.current > 0 || keystrokesRef.current > 0;

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
        graphData: hasTypingActivity
          ? [...prev.graphData, nextPoint].slice(-120)
          : prev.graphData,
      }));

      // Reset per-interval counters after processing
      intervalKeystrokesRef.current = 0;
      intervalBackspacesRef.current = 0;

      // Auto-save session
      const avgLoad = cognitiveLoadsRef.current.length > 0
        ? cognitiveLoadsRef.current.reduce((a, b) => a + b, 0) / cognitiveLoadsRef.current.length
        : 0;

      saveSession({
        date: getTodayKey(),
        avgCognitiveLoad: Math.round(avgLoad),
        focusScore: fScore,
        productivity: prod,
        backspaceRate: keystrokesRef.current > 0
          ? Math.round((backspacesRef.current / keystrokesRef.current) * 100)
          : 0,
        sessionDuration: Math.round(sessionSec),
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return { state, handleKeyDown };
}
