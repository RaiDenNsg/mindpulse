export interface SessionData {
  date: string;
  avgCognitiveLoad: number;
  focusScore: number;
  productivity: number;
  backspaceRate: number;
  sessionDuration: number;
}

const STORAGE_KEY = "mindpulse_sessions";

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
  all[data.date] = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getSession(date: string): SessionData | null {
  return getAll()[date] ?? null;
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
