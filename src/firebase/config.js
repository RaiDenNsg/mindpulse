import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBeXhjubogCTS4cmEu66F6cmLh9Fn9e9xs",
  authDomain: "mindpulse-a017a.firebaseapp.com",
  projectId: "mindpulse-a017a",
  storageBucket: "mindpulse-a017a.firebasestorage.app",
  messagingSenderId: "948762227393",
  appId: "1:948762227393:web:cf187395c4c99b5a441a40",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = typeof window !== "undefined" ? getAuth(app) : null;
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);

export { app, auth, db, googleProvider, firebaseConfig };
