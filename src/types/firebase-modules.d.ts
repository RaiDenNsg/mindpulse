declare module "@/firebase/sessions" {
  export function saveSession(userId: string, sessionData: Record<string, unknown>): Promise<unknown>;
  export function getUserSessions(userId: string): Promise<Array<Record<string, unknown>>>;
  export function getYesterdaySession(userId: string): Promise<Record<string, unknown> | null>;
  export function cleanupDuplicateSessions(userId: string): Promise<{ mergedDates: number; deletedDocs: number }>;
}

declare module "@/firebase/auth" {
  interface AuthUser {
    uid: string;
  }

  export function signInWithGoogle(): Promise<unknown>;
  export function signOutUser(): Promise<void>;
  export function subscribeToAuthState(callback: (user: AuthUser | null) => void): () => void;
}

declare module "@/firebase/config" {
  interface FirebaseAuthLike {
    currentUser?: { uid: string } | null;
  }

  export const auth: FirebaseAuthLike | null;
}
