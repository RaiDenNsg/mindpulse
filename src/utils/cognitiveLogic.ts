export type FocusState = "Deep Focus" | "Struggling" | "Distracted" | "Idle" | "Neutral";

export function calculateCognitiveLoad(
  backspaceCount: number,
  idleTime: number,
  typingSpeed: number
): number {
  // Reweighted formula to prevent 0 values during normal typing
  // typingSpeed is normalized (divide by 50 to scale from absolute keystrokes to ~0-2 range)
  const normalizedSpeed = Math.max(0, Math.min(2, typingSpeed / 50));
  const raw = (backspaceCount * 3) + (idleTime * 2) - (normalizedSpeed * 5);
  return Math.max(0, Math.min(60, Math.round(raw)));
}

export function detectFocusState(
  typingSpeed: number,
  backspaceRate: number,
  idleTime: number
): FocusState {
  if (idleTime > 10) return "Idle";
  if (idleTime > 5) return "Distracted";
  if (backspaceRate > 30 && typingSpeed < 30) return "Struggling";
  if (typingSpeed > 60 && backspaceRate < 15 && idleTime < 3) return "Deep Focus";
  return "Neutral";
}

export function calculateFocusScore(typingTime: number, totalTime: number): number {
  // Focus score: percentage of time actively typing (not idle)
  // If idle time is > totalTime, focus score should be 0
  if (totalTime === 0) return 0;
  // Only count actual active typing time, ensure it doesn't exceed total time
  const activeTime = Math.min(typingTime, totalTime);
  const rawScore = Math.round((activeTime / totalTime) * 100);
  return Math.max(0, Math.min(100, rawScore));
}

export function calculateProductivity(focusScore: number, backspaceRate: number): number {
  return Math.max(0, Math.min(100, Math.round(focusScore - backspaceRate)));
}

export function getInsightMessage(state: FocusState, backspaceRate: number, idleTime: number, cognitiveLoad: number): string {
  if (state === "Idle") return "You've been idle for a while — cognitive load dropping 💤";
  if (state === "Deep Focus") return "You're in deep focus mode — keep it up! 🚀";
  if (state === "Struggling") return "High correction rate — you might be stuck on something 🤔";
  if (state === "Distracted") return "Idle time increasing — possible distraction detected 👀";
  if (cognitiveLoad < 10) return "Session is going well, low cognitive load ✨";
  if (backspaceRate > 25) return "Lots of corrections — consider taking a step back 💭";
  return "Neutral state — start typing to enter flow 🎯";
}

export function getFocusColor(state: FocusState): string {
  switch (state) {
    case "Deep Focus": return "text-focus-green";
    case "Struggling": return "text-struggle-red";
    case "Distracted":
    case "Idle": return "text-neutral-yellow";
    default: return "text-muted-foreground";
  }
}

export function getFocusGlow(state: FocusState): string {
  switch (state) {
    case "Deep Focus": return "glow-green";
    case "Struggling": return "glow-red";
    case "Distracted":
    case "Idle": return "glow-yellow";
    default: return "";
  }
}
