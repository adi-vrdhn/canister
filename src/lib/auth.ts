import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  setPersistence,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import { get, ref, set } from "firebase/database";
import { User as DBUser } from "@/types";
import { normalizeUserRecord } from "@/lib/users";
import {
  getUsernameValidationError,
  isUsernameAvailable,
  normalizeUsernameKey,
  syncUsernameIndex,
} from "@/lib/username-index";

let persistencePromise: Promise<void> | null = null;

async function ensureAuthPersistence() {
  if (!persistencePromise) {
    persistencePromise = (async () => {
      try {
        await setPersistence(auth, indexedDBLocalPersistence);
      } catch (error) {
        console.warn("IndexedDB auth persistence failed, falling back to browser persistence:", error);
        try {
          await setPersistence(auth, browserLocalPersistence);
        } catch (browserError) {
          console.warn("Browser auth persistence failed, falling back to in-memory persistence:", browserError);
          await setPersistence(auth, inMemoryPersistence);
        }
      }
    })();
  }

  return persistencePromise;
}

export async function signUp(
  email: string,
  password: string,
  username: string,
  name: string
) {
  await ensureAuthPersistence();

  const usernameError = getUsernameValidationError(username);
  if (usernameError) {
    throw new Error(usernameError);
  }

  const normalizedUsername = normalizeUsernameKey(username);
  if (!(await isUsernameAvailable(normalizedUsername))) {
    throw new Error("Username already taken");
  }

  // Sign up with Firebase auth
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  if (!userCredential.user) {
    throw new Error("User creation failed");
  }

  // Send email verification
  await sendEmailVerification(userCredential.user);

  // Create user profile in Realtime Database (non-blocking)
  try {
    await set(ref(db, `users/${userCredential.user.uid}`), {
      id: userCredential.user.uid,
      username: normalizedUsername,
      username_lower: normalizedUsername,
      name: name.trim(),
      name_lower: name.trim().toLowerCase(),
      createdAt: new Date().toISOString(),
    });
    await syncUsernameIndex(userCredential.user.uid, normalizedUsername);
  } catch (profileError) {
    console.warn("Profile creation failed, but auth succeeded:", profileError);
    // Don't fail signup if profile creation fails
  }

  return userCredential;
}

export async function signIn(email: string, password: string) {
  await ensureAuthPersistence();
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential;
}

export async function sendResetPasswordEmail(email: string) {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export async function getCurrentUser(): Promise<DBUser | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribe();

      if (!firebaseUser) {
        resolve(null);
        return;
      }

      // Try to fetch user profile from Realtime Database
      try {
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
          const userData = snapshot.val();
          resolve(
            normalizeUserRecord(firebaseUser.uid, {
              id: userData.id || firebaseUser.uid,
              username: userData.username,
              name: userData.name,
              avatar_url: userData.avatar_url || firebaseUser.photoURL || null,
              created_at: userData.createdAt || userData.created_at || new Date().toISOString(),
            }) as DBUser
          );
          return;
        }

        // Fallback: create user object from auth data if profile doesn't exist
        resolve(
          normalizeUserRecord(firebaseUser.uid, {
            id: firebaseUser.uid,
            username: firebaseUser.email?.split("@")[0] || "user",
            name: firebaseUser.displayName || firebaseUser.email || "User",
            avatar_url: firebaseUser.photoURL || null,
            created_at: new Date().toISOString(),
          }) as DBUser
        );
      } catch (err) {
        console.warn("Database query failed, using auth data:", err);
        // Fallback to auth data if query fails
        resolve(
          normalizeUserRecord(firebaseUser.uid, {
            id: firebaseUser.uid,
            username: firebaseUser.email?.split("@")[0] || "user",
            name: firebaseUser.displayName || firebaseUser.email || "User",
            avatar_url: firebaseUser.photoURL || null,
            created_at: new Date().toISOString(),
          }) as DBUser
        );
      }
    });
  });
}

export async function checkUsernameAvailability(username: string) {
  if (getUsernameValidationError(username)) {
    return false;
  }

  try {
    return await isUsernameAvailable(username);
  } catch (err) {
    console.warn("Username check failed:", err);
    return true; // Allow signup to proceed if check fails
  }
}
