import { cert, getApps, getApp, initializeApp, type App, applicationDefault, type ServiceAccount } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getMessaging } from "firebase-admin/messaging";

let cachedAdminApp: App | null = null;

type ServiceAccountShape = ServiceAccount & {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizeServiceAccount(candidate: ServiceAccountShape) {
  if (!candidate || typeof candidate !== "object") {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON did not parse into an object.");
  }

  if (!candidate.project_id || !candidate.client_email || !candidate.private_key) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is missing required Firebase service account fields."
    );
  }

  return {
    ...candidate,
    private_key: candidate.private_key.replace(/\\n/g, "\n"),
  };
}

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    return normalizeServiceAccount(JSON.parse(stripWrappingQuotes(raw)));
  } catch (error) {
    try {
      const decoded = Buffer.from(stripWrappingQuotes(raw), "base64").toString("utf8");
      return normalizeServiceAccount(JSON.parse(decoded));
    } catch {
      const reason = error instanceof Error ? error.message : "Unknown parse error.";
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. ${reason}`);
    }
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
