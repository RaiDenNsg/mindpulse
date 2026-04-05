import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./config";

export function signInWithGoogle() {
  if (!auth) {
    throw new Error("Firebase Auth is only available in the browser.");
  }
  return signInWithPopup(auth, googleProvider);
}

export function signOutUser() {
  if (!auth) {
    throw new Error("Firebase Auth is only available in the browser.");
  }
  return signOut(auth);
}

export function subscribeToAuthState(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}
