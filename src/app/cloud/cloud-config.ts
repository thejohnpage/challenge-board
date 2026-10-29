import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Copy the web app configuration from Firebase Console -> Project settings.
 * Firebase web configuration is public; authorization is enforced by Firestore rules.
 * Leaving these values blank keeps the existing local-only game operational.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyAOys--4E1daX28SMKot2qKSVS_OEo9e40",
  authDomain: "mmci-challenge-board.firebaseapp.com",
  projectId: "mmci-challenge-board",
  storageBucket: "mmci-challenge-board.firebasestorage.app",
  messagingSenderId: "28809022149",
  appId: "1:28809022149:web:bf82914137a52836cd3eac",
  measurementId: "G-0D064M2JXF"
};

export function cloudEnabled(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}
let cached: { app: FirebaseApp; auth: Auth; db: Firestore } | undefined;
export function cloudClient() {
  if (!cloudEnabled()) return null;
  if (!cached) {
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    cached = { app, auth: getAuth(app), db: getFirestore(app) };
  }
  return cached;
}
