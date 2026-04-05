export interface SessionData {
  date: string;
  avgCognitiveLoad: number;
  focusScore: number;
  productivity: number;
  backspaceRate: number;
  sessionDuration: number;
}

export function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export function getYesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}
