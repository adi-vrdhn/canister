import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  ref,
  set,
  get,
} from "firebase/database";
import { User as DBUser } from "@/types";

export async function signUp(
  email: string,
  password: string,
  username: string,
  name: string
) {
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
      username: username.toLowerCase(),
      name: name,
      createdAt: new Date().toISOString(),
    });
  } catch (profileError) {
    console.warn("Profile creation failed, but auth succeeded:", profileError);
    // Don't fail signup if profile creation fails
  }

  return userCredential;
}

export async function signIn(email: string, password: string) {
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
          resolve({
            id: userData.id,
            username: userData.username,
            name: userData.name,
            avatar_url: userData.avatar_url || null,
            created_at: userData.createdAt || new Date().toISOString(),
          });
          return;
        }

        // Fallback: create user object from auth data if profile doesn't exist
        resolve({
          id: firebaseUser.uid,
          username: firebaseUser.email?.split("@")[0] || "user",
          name: firebaseUser.displayName || firebaseUser.email || "User",
          avatar_url: null,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("Database query failed, using auth data:", err);
        // Fallback to auth data if query fails
        resolve({
          id: firebaseUser.uid,
          username: firebaseUser.email?.split("@")[0] || "user",
          name: firebaseUser.displayName || firebaseUser.email || "User",
          avatar_url: null,
          created_at: new Date().toISOString(),
        });
      }
    });
  });
}

export async function checkUsernameAvailability(username: string) {
  try {
    const usersRef = ref(db, "users");
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      return true;
    }

    const users = snapshot.val() as Record<string, { username?: string }>;
    const usernameTaken = Object.values(users).some((user) =>
      Boolean(user.username && user.username.toLowerCase() === username.toLowerCase())
    );

    return !usernameTaken;
  } catch (err) {
    console.warn("Username check failed:", err);
    return true; // Allow signup to proceed if check fails
  }
}
