import { initializeApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getDatabase, Database } from "firebase/database";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyC_RylgN_XYnCFcUo-n9vSNWddwHHzwqqU",
  authDomain: "filmshare-72c31.firebaseapp.com",
  projectId: "filmshare-72c31",
  databaseURL: "https://filmshare-72c31-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "filmshare-72c31.appspot.com",
  messagingSenderId: "203083828735",
  appId: "1:203083828735:web:aa6b5aee894df6d39febca"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth: Auth = getAuth(app);

// Initialize Realtime Database
export const db: Database = getDatabase(app);

// Initialize Cloud Storage
export const storage: FirebaseStorage = getStorage(app);

export default app;
