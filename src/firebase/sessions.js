import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./config";

const SESSIONS_COLLECTION = "sessions";

function getDateKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split("T")[0];
}

function normalizeDateKey(value) {
  if (typeof value !== "string" || value.length === 0) {
    return getDateKey();
  }

  const normalized = value.includes("T") ? value.split("T")[0] : value;
  return normalized || getDateKey();
}

export async function saveSession(userId, sessionData) {
  if (!userId) {
    throw new Error("userId is required to save a session");
  }

  const date = normalizeDateKey(sessionData?.date);
  const documentId = `${userId}_${date}`;

  const payload = {
    userId,
    ...sessionData,
    date,
    updatedAt: serverTimestamp(),
  };

  return setDoc(doc(collection(db, SESSIONS_COLLECTION), documentId), payload, { merge: true });
}

export async function getUserSessions(userId) {
  if (!userId) {
    return [];
  }

  const sessionsQuery = query(
    collection(db, SESSIONS_COLLECTION),
    where("userId", "==", userId)
  );

  const snapshot = await getDocs(sessionsQuery);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })).sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
}

export async function getYesterdaySession(userId) {
  if (!userId) {
    return null;
  }

  const yesterday = getDateKey(-1);
  const yesterdayQuery = query(
    collection(db, SESSIONS_COLLECTION),
    where("userId", "==", userId),
    where("date", "==", yesterday),
    limit(1)
  );

  const snapshot = await getDocs(yesterdayQuery);
  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  };
}
