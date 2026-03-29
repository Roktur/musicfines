import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Try to load from environment variables first (best practice for GitHub)
// Fallback to the JSON config file if environment variables are not set
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID
};

// Check if we have at least the critical fields from env
const isEnvConfigured = !!import.meta.env.VITE_FIREBASE_API_KEY;

let finalConfig = firebaseConfig;

if (!isEnvConfigured) {
  try {
    // @ts-ignore - Fallback for local development
    const config = await import('../firebase-applet-config.json');
    finalConfig = config.default || config;
  } catch (e) {
    console.warn('Firebase environment variables not found, and firebase-applet-config.json is missing.');
  }
}

const app = initializeApp(finalConfig);
export const db = getFirestore(app, finalConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const signIn = () => signInWithPopup(auth, googleProvider);
export const signOut = () => auth.signOut();
