import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Copy the web app configuration from Firebase Console -> Project settings.
 * Firebase web configuration is public; authorization is enforced by Firestore rules.
 * Leaving these values blank keeps the existing local-only game operational.
 */
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: ''
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
