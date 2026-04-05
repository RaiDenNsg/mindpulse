import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "./config";

const SESSIONS_COLLECTION = "sessions";

function getDateKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split("T")[0];
}

export async function saveSession(userId, sessionData) {
  if (!userId) {
    throw new Error("userId is required to save a session");
  }

  const payload = {
    userId,
    ...sessionData,
    date: sessionData?.date ?? getDateKey(),
    updatedAt: serverTimestamp(),
  };

  return addDoc(collection(db, SESSIONS_COLLECTION), payload);
}

export async function getUserSessions(userId) {
  if (!userId) {
    return [];
  }

  const sessionsQuery = query(
    collection(db, SESSIONS_COLLECTION),
    where("userId", "==", userId),
    orderBy("date", "asc")
  );

  const snapshot = await getDocs(sessionsQuery);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
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
