import { initializeApp, getApps } from 'firebase/app';
import { getAnalytics, type Analytics } from 'firebase/analytics';
import { getDatabase } from 'firebase/database';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBf8rBDjUsH2uTdDLl262cJzAAeCcleWSM',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'shantanu-8be54.firebaseapp.com',
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    'https://shantanu-8be54-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'shantanu-8be54',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'shantanu-8be54.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '773009660140',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:773009660140:web:a1f03e4ee3b1ed080badc9',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-C2FTZ8CKBL',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
let analytics: Analytics | undefined;

if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch {
    analytics = undefined;
  }
}

const database = getDatabase(app);

export { app, analytics, database, firebaseConfig };
