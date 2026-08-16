"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Space, UserDoc, Role } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  userDoc: UserDoc | null;
  space: Space | null;
  role: Role | null;
  spaceId: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
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

  const supabase = createClient();

  // Supabase auth listener
  useEffect(() => {
    let mounted = true;

    async function fetchUserData(userId: string) {
      try {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        if (userError || !userData) {
          if (mounted) {
            setUserDoc(null);
            setSpace(null);
            setLoading(false);
          }
          return;
        }

        const ud: UserDoc = {
          spaceId: userData.space_id,
          role: userData.role as Role,
          googleCalendarConnected: userData.google_calendar_connected,
        };

        if (mounted) setUserDoc(ud);

        if (userData.space_id) {
          const { data: spaceData, error: spaceError } = await supabase
            .from("spaces")
            .select("*")
            .eq("id", userData.space_id)
            .single();

          if (!spaceError && spaceData) {
            const mappedSpace: Space = {
              status: spaceData.status as any,
              partnerA: {
                uid: spaceData.partner_a_uid,
                realName: spaceData.partner_a_real_name,
                colorHex: spaceData.partner_a_color_hex,
              },
              partnerB: spaceData.partner_b_uid ? {
                uid: spaceData.partner_b_uid,
                realName: spaceData.partner_b_real_name,
                colorHex: spaceData.partner_b_color_hex,
              } : null,
              nicknames: {
                forA: spaceData.nickname_for_a || "",
                forB: spaceData.nickname_for_b || "",
              },
              createdAt: spaceData.created_at,
            };
            // Ignore ID in the interface to keep types simple, or add it if needed
            (mappedSpace as any).id = spaceData.id;
            
            if (mounted) setSpace(mappedSpace);
          }
        } else {
          if (mounted) setSpace(null);
        }
      } catch (e) {
        console.error("Error fetching user data:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserData(session.user.id);
      } else {
        setUser(null);
        setUserDoc(null);
        setSpace(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Real-time space listener
  useEffect(() => {
    if (!userDoc?.spaceId) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'spaces',
          filter: `id=eq.${userDoc.spaceId}`
        },
        (payload) => {
          const spaceData = payload.new;
          const mappedSpace: Space = {
            status: spaceData.status as any,
            partnerA: {
              uid: spaceData.partner_a_uid,
              realName: spaceData.partner_a_real_name,
              colorHex: spaceData.partner_a_color_hex,
            },
            partnerB: spaceData.partner_b_uid ? {
              uid: spaceData.partner_b_uid,
              realName: spaceData.partner_b_real_name,
              colorHex: spaceData.partner_b_color_hex,
            } : null,
            nicknames: {
              forA: spaceData.nickname_for_a || "",
              forB: spaceData.nickname_for_b || "",
            },
            createdAt: spaceData.created_at,
          };
          (mappedSpace as any).id = spaceData.id;
          setSpace(mappedSpace);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userDoc?.spaceId]);

  const signInWithGoogle = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: "https://www.googleapis.com/auth/calendar.events",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
    } catch (err) {
      console.error("Google sign-in error:", err);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
