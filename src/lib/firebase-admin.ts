import { cert, getApps, getApp, initializeApp, type App, applicationDefault } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getMessaging } from "firebase-admin/messaging";

let cachedAdminApp: App | null = null;

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }
}

export function getFirebaseAdminApp(): App {
  if (cachedAdminApp) return cachedAdminApp;
  if (getApps().length > 0) {
    cachedAdminApp = getApp();
    return cachedAdminApp;
  }

  const serviceAccount = getServiceAccount();
  cachedAdminApp = initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    databaseURL:
      process.env.FIREBASE_DATABASE_URL ||
      "https://filmshare-72c31-default-rtdb.asia-southeast1.firebasedatabase.app",
  });

  return cachedAdminApp;
}

export function getFirebaseAdminDatabase() {
  return getDatabase(getFirebaseAdminApp());
}

export function getFirebaseAdminMessaging() {
  return getMessaging(getFirebaseAdminApp());
}
