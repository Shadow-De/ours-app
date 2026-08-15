"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  User,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  doc,
  onSnapshot,
  getDoc,
} from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import { Space, UserDoc, Role } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  userDoc: UserDoc | null;
  space: Space | null;
  role: Role | null;
  spaceId: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ code: string; user: User } | null>;
  signOut: () => Promise<void>;
  // Display name helper — nickname if set, else real name
  displayName: (role: Role) => string;
  partnerRole: Role | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);

  // Firebase auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setUserDoc(null);
        setSpace(null);
        setLoading(false);
        return;
      }

      // Fetch user document with a timeout — prevents infinite spinner
      // when Firestore connection is stuck (e.g. cold start, network issue)
      try {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("firestore_timeout")), 6000)
        );
        const userSnap = await Promise.race([getDoc(userDocRef), timeoutPromise]);

        if (!userSnap.exists()) {
          setUserDoc(null);
          setSpace(null);
          setLoading(false);
          return;
        }

        const ud = userSnap.data() as UserDoc;
        setUserDoc(ud);
      } catch (err: any) {
        if (err.message === "firestore_timeout") {
          // Firestore WebChannel offline — fall back to server-side API
          try {
            const idToken = await firebaseUser.getIdToken();
            const res = await fetch("/api/user/me", {
              headers: { Authorization: `Bearer ${idToken}` },
            });
            if (res.ok) {
              const data = await res.json();
              if (data.exists) {
                setUserDoc(data.data as UserDoc);
              } else {
                setUserDoc(null);
                setSpace(null);
              }
            } else {
              setUserDoc(null);
              setSpace(null);
            }
          } catch {
            setUserDoc(null);
            setSpace(null);
          }
        } else {
          console.error("Error fetching user document in auth state change:", err);
          setUserDoc(null);
          setSpace(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, []);

  // Real-time space listener — updates both partners instantly
  useEffect(() => {
    if (!userDoc?.spaceId) {
      setSpace(null);
      return;
    }

    const spaceRef = doc(db, "spaces", userDoc.spaceId);
    const unsub = onSnapshot(spaceRef, (snap) => {
      if (snap.exists()) {
        setSpace({ id: snap.id, ...snap.data() } as unknown as Space);
      }
    });

    return unsub;
  }, [userDoc?.spaceId]);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // The credential includes access token — we pass the auth code to the server
      // to exchange for a refresh token. Firebase doesn't give us the auth code
      // directly; we use the credential's OAuth token approach via the server.
      return { code: "", user: result.user };
    } catch (err) {
      console.error("Google sign-in error:", err);
      return null;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const role = userDoc?.role ?? null;
  const spaceId = userDoc?.spaceId ?? null;

  const displayName = (r: Role): string => {
    if (!space) return r === "a" ? "Partner A" : "Partner B";
    const nickname = r === "a" ? space.nicknames?.forA : space.nicknames?.forB;
    const realName = r === "a" ? space.partnerA?.realName : space.partnerB?.realName;
    return nickname || realName || (r === "a" ? "Partner A" : "Partner B");
  };

  const partnerRole: Role | null = role === "a" ? "b" : role === "b" ? "a" : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        userDoc,
        space,
        role,
        spaceId,
        loading,
        signInWithGoogle,
        signOut,
        displayName,
        partnerRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
