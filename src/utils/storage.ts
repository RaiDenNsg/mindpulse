export interface SessionData {
  date: string;
  avgCognitiveLoad: number;
  focusScore: number;
  productivity: number;
  backspaceRate: number;
  sessionDuration: number;
}

const STORAGE_KEY = "mindpulse_sessions";

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sanitizeSession(data: SessionData): SessionData {
  return {
    ...data,
    avgCognitiveLoad: clampPercent(data.avgCognitiveLoad),
    focusScore: clampPercent(data.focusScore),
    productivity: clampPercent(data.productivity),
    backspaceRate: clampPercent(data.backspaceRate),
    sessionDuration: Math.max(0, Math.round(data.sessionDuration)),
  };
}

function getAll(): Record<string, SessionData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSession(data: SessionData): void {
  const all = getAll();
  all[data.date] = sanitizeSession(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getSession(date: string): SessionData | null {
  const session = getAll()[date];
  return session ? sanitizeSession(session) : null;
}

export function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export function getYesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export function getStreak(): number {
  const all = getAll();
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().split("T")[0];
    if (all[key]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function getLastNDaysSessions(days: number): Array<{ date: string; session: SessionData | null }> {
  const all = getAll();
  const result: Array<{ date: string; session: SessionData | null }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    result.push({ date: key, session: all[key] ? sanitizeSession(all[key]) : null });
  }

  return result;
}
