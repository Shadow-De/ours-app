// Firebase client-side configuration
// NOTE: These are public/client-safe Firebase config values only
// Refresh tokens and secrets are NEVER stored here — see src/lib/server/tokens.ts

import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, getFirestore, memoryLocalCache, disableNetwork, enableNetwork } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "dummy_api_key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dummy_auth_domain",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dummy_project_id",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dummy_storage_bucket",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "dummy_sender_id",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "dummy_app_id",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Singleton pattern — safe for Next.js hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
// Use memory cache; guard against Next.js hot-reload calling this twice
let db: ReturnType<typeof getFirestore>;
let isNewDbInstance = false;
try {
  db = initializeFirestore(app, { 
    localCache: memoryLocalCache(),
    experimentalForceLongPolling: true 
  });
  isNewDbInstance = true;
} catch {
  db = getFirestore(app);
}

// Force a reconnect cycle to clear any stale "Database not found" WebChannel state.
// Only run on the first initialization (not on hot-reload re-use).
if (isNewDbInstance && typeof window !== "undefined") {
  setTimeout(async () => {
    try {
      await disableNetwork(db);
      await enableNetwork(db);
    } catch {
      // Ignore — best-effort reconnect
    }
  }, 500);
}

export { db };

// Google OAuth provider configured with Calendar scope
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/calendar.events");
googleProvider.setCustomParameters({
  access_type: "offline",  // Request refresh token
  prompt: "consent",        // Force consent to always get refresh token
});

export default app;
