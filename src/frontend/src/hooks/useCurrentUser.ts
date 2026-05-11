import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { UserProfile } from "../types";
import { useAuthenticatedBackend } from "./useAuthenticatedBackend";

export type UserStatus =
  | "initializing"
  | "unauthenticated"
  | "registering"
  | "authenticated";

const PASSWORD_AUTH_KEY = "passwordAuthUserId";
const ZAREN_USER_ID_KEY = "zaren_userId";
const ZAREN_SESSION_KEY = "zaren_session";
const SESSION_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Persisted password session — stored as a serialised Principal string */
function getStoredPasswordSession(): string | null {
  try {
    // Check legacy key first, fall back to new keys
    const legacy = localStorage.getItem(PASSWORD_AUTH_KEY);
    if (legacy) return legacy;
    // Check zaren_userId with session validity
    const zarenUserId = localStorage.getItem(ZAREN_USER_ID_KEY);
    const zarenSession = localStorage.getItem(ZAREN_SESSION_KEY);
    if (zarenUserId && zarenSession) {
      const sessionAge = Date.now() - Number(zarenSession);
      if (sessionAge < SESSION_VALIDITY_MS) return zarenUserId;
      // Session expired — clear
      localStorage.removeItem(ZAREN_USER_ID_KEY);
      localStorage.removeItem(ZAREN_SESSION_KEY);
    }
    return null;
  } catch {
    return null;
  }
}

function setStoredPasswordSession(userId: string): void {
  try {
    localStorage.setItem(PASSWORD_AUTH_KEY, userId);
    // Also set the zaren_userId / zaren_session keys for compatibility
    localStorage.setItem(ZAREN_USER_ID_KEY, userId);
    localStorage.setItem(ZAREN_SESSION_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function clearStoredPasswordSession(): void {
  try {
    localStorage.removeItem(PASSWORD_AUTH_KEY);
    localStorage.removeItem(ZAREN_USER_ID_KEY);
    localStorage.removeItem(ZAREN_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Build a minimal stub UserProfile to keep the user session alive when the backend is slow */
function makeStubProfile(
  userId: import("@icp-sdk/core/principal").Principal,
  username: string,
): UserProfile {
  return {
    id: userId,
    username,
    bio: "",
    isVerified: false,
    isOfficialPage: false,
    visibility: { everyone: null } as unknown as import("../types").Visibility,
    followerCount: 0n,
    followingCount: 0n,
    postCount: 0n,
    profilePhotoUrl: null,
    coverPhotoUrl: null,
    createdAt: BigInt(Date.now() * 1_000_000),
  } as unknown as UserProfile;
}

/** Flag so we only call ensureOwnerAccount once per app session */
let ownerAccountEnsured = false;

export function useCurrentUser() {
  const { identity, isInitializing, clear: clearII } = useInternetIdentity();
  const { actor, isFetching } = useAuthenticatedBackend();
  const queryClient = useQueryClient();

  // ── Password session state ────────────────────────────────────────────────
  // null  = not checked yet
  // false = no password session
  // UserProfile = password-authenticated user
  const [passwordProfile, setPasswordProfile] = useState<
    UserProfile | null | false
  >(null);
  const [passwordSessionChecked, setPasswordSessionChecked] = useState(false);

  // On startup: ensure owner account exists (restores it after canister reinstall)
  // Retry up to 3 times with 2s delay
  useEffect(() => {
    if (ownerAccountEnsured || !actor || isFetching) return;
    ownerAccountEnsured = true;
    const tryEnsure = async (attempts = 0): Promise<void> => {
      try {
        await actor.ensureOwnerAccount("NarzineOwnerSecure2024!", null);
      } catch {
        if (attempts < 2) {
          await new Promise((r) => setTimeout(r, 2000));
          await tryEnsure(attempts + 1);
        }
        /* non-blocking — owner creation failure must not crash the app */
      }
    };
    void tryEnsure();
  }, [actor, isFetching]);

  // On mount: check if there's a stored password session
  useEffect(() => {
    const stored = getStoredPasswordSession();
    if (!stored) {
      setPasswordProfile(false);
      setPasswordSessionChecked(true);
      return;
    }

    // We need an actor to call getUserProfile. Poll until actor is ready.
    // The actor may use anonymous identity for loginWithPasswordOnly — it works.
    // For getUserProfile we can use the same actor once it's available.
    // We'll handle the actual fetch in a separate effect once actor is ready.
  }, []);

  // Once actor is available and we have a stored session id, fetch the profile
  useEffect(() => {
    if (passwordSessionChecked) return;
    if (!actor || isFetching) return;

    const stored = getStoredPasswordSession();
    if (!stored) {
      setPasswordProfile(false);
      setPasswordSessionChecked(true);
      return;
    }

    // We have a stored userId — try to fetch their profile
    void (async () => {
      try {
        // The stored value is the principal text from the userId
        const { Principal } = await import("@icp-sdk/core/principal");
        const userId = Principal.fromText(stored);
        const profile = await actor.getUserProfile(userId);
        if (profile) {
          setPasswordProfile(profile);
        } else {
          // Profile no longer exists — but only clear if session timestamp says > 7 days
          // Network errors return null too; do NOT log out on network hiccups.
          const zarenSession = localStorage.getItem(ZAREN_SESSION_KEY);
          const sessionAge = zarenSession
            ? Date.now() - Number(zarenSession)
            : SESSION_VALIDITY_MS + 1;
          if (sessionAge > SESSION_VALIDITY_MS) {
            // Genuinely expired
            clearStoredPasswordSession();
            setPasswordProfile(false);
          } else {
            // Keep session alive — backend may be slow (IC0508)
            // Create a minimal stub profile so the app doesn't log out
            setPasswordProfile(makeStubProfile(userId, stored.slice(0, 8)));
          }
        }
      } catch (err) {
        // Check if this is a network/canister error (IC0508) vs genuine session expiry
        const msg = err instanceof Error ? err.message : "";
        const isNetworkError =
          msg.includes("IC0508") ||
          msg.includes("canister") ||
          msg.includes("503") ||
          msg.includes("network") ||
          msg.includes("fetch") ||
          msg.includes("unavailable") ||
          msg.includes("timeout");
        const zarenSession = localStorage.getItem(ZAREN_SESSION_KEY);
        const sessionAge = zarenSession
          ? Date.now() - Number(zarenSession)
          : SESSION_VALIDITY_MS + 1;
        if (isNetworkError && sessionAge < SESSION_VALIDITY_MS) {
          // Keep the user logged in — backend is slow, NOT an auth failure
          // We'll mark as checked without clearing the session
          setPasswordProfile(false); // This will force re-check but at least not lose data
          // Actually: set a minimal profile from the stored ID to keep them in
          try {
            const { Principal } = await import("@icp-sdk/core/principal");
            const userId = Principal.fromText(stored);
            setPasswordProfile(makeStubProfile(userId, "..."));
          } catch {
            setPasswordProfile(false);
          }
        } else {
          // Genuine error or expired session — log out
          clearStoredPasswordSession();
          setPasswordProfile(false);
        }
      } finally {
        setPasswordSessionChecked(true);
      }
    })();
  }, [actor, isFetching, passwordSessionChecked]);

  // ── II profile query (only when logged in via II) ──────────────────────────
  const { data: iiProfile, isLoading: isProfileLoading } =
    useQuery<UserProfile | null>({
      queryKey: ["myProfile"],
      queryFn: async () => {
        if (!actor) return null;
        try {
          return await actor.getMyProfile();
        } catch {
          return null;
        }
      },
      enabled: !!actor && !isFetching && !!identity,
      retry: 1,
    });

  // ── Registration mutations ─────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: async ({
      username,
      bio,
    }: { username: string; bio: string }) => {
      if (!actor) throw new Error("Not authenticated");
      return actor.register(username, bio);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myProfile"] });
    },
  });

  const registerWithPasswordMutation = useMutation({
    mutationFn: async ({
      username,
      password,
      email,
      bio,
    }: { username: string; password: string; email?: string; bio: string }) => {
      if (!actor) throw new Error("Not authenticated");
      const result = await actor.registerWithPassword(
        username,
        password,
        bio,
        email ?? null,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myProfile"] });
    },
  });

  // ── Password-only login ────────────────────────────────────────────────────
  const loginWithPasswordMutation = useMutation({
    mutationFn: async ({
      username,
      password,
    }: { username: string; password: string }) => {
      if (!actor) throw new Error("Backend not ready");
      const result = await actor.loginWithPasswordOnly(username, password);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok; // { userId: Principal, profile: UserProfile }
    },
    onSuccess: (data) => {
      // Store the userId as text for session restoration
      const userIdText = data.userId.toText();
      setStoredPasswordSession(userIdText);
      // Batch these updates together — React 18 batches setState calls
      // in event handlers and async callbacks, so these fire in one render
      setPasswordProfile(data.profile);
      setPasswordSessionChecked(true);
      // Invalidate queries so the rest of the app sees fresh data
      queryClient.invalidateQueries({ queryKey: ["myProfile"] });
    },
  });

  // ── Standalone registration (no II) + auto-login ──────────────────────────
  const registerWithPasswordOnlyMutation = useMutation({
    mutationFn: async ({
      username,
      password,
      email,
      bio,
    }: { username: string; password: string; email?: string; bio: string }) => {
      if (!actor) throw new Error("Backend not ready");
      // Register
      const regResult = await actor.registerWithPassword(
        username,
        password,
        bio,
        email ?? null,
      );
      if (regResult.__kind__ === "err") throw new Error(regResult.err);
      // Auto-login after registration
      const loginResult = await actor.loginWithPasswordOnly(username, password);
      if (loginResult.__kind__ === "err") throw new Error(loginResult.err);
      return loginResult.ok;
    },
    onSuccess: (data) => {
      const userIdText = data.userId.toText();
      setStoredPasswordSession(userIdText);
      setPasswordProfile(data.profile);
      setPasswordSessionChecked(true);
      queryClient.invalidateQueries({ queryKey: ["myProfile"] });
    },
  });

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearStoredPasswordSession();
    setPasswordProfile(false);
    setPasswordSessionChecked(true);
    if (clearII) clearII();
    queryClient.clear();
  }, [clearII, queryClient]);

  // ── Derive status ─────────────────────────────────────────────────────────
  let status: UserStatus = "initializing";

  const isPasswordAuthenticated =
    passwordSessionChecked &&
    passwordProfile !== null &&
    passwordProfile !== false;

  if (!passwordSessionChecked || isInitializing || isFetching) {
    status = "initializing";
  } else if (isPasswordAuthenticated) {
    // Password session takes priority — user is fully authenticated
    status = "authenticated";
  } else if (!identity) {
    status = "unauthenticated";
  } else if (isProfileLoading) {
    status = "initializing";
  } else if (iiProfile === null || iiProfile === undefined) {
    status = "registering";
  } else {
    status = "authenticated";
  }

  // Active profile: password session or II profile
  const profile: UserProfile | null = isPasswordAuthenticated
    ? (passwordProfile as UserProfile)
    : (iiProfile ?? null);

  return {
    status,
    profile,
    identity,
    isPasswordSession: isPasswordAuthenticated,

    // II registration
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,

    // II + password registration (used when II is active, status=registering)
    registerWithPassword: registerWithPasswordMutation.mutateAsync,
    isRegisteringWithPassword: registerWithPasswordMutation.isPending,
    registerWithPasswordError: registerWithPasswordMutation.error,

    // Password-only login (no II needed)
    loginWithPassword: loginWithPasswordMutation.mutateAsync,
    isLoggingInWithPassword: loginWithPasswordMutation.isPending,
    loginWithPasswordError: loginWithPasswordMutation.error,

    // Password-only registration + auto-login (no II needed)
    registerWithPasswordOnly: registerWithPasswordOnlyMutation.mutateAsync,
    isRegisteringWithPasswordOnly: registerWithPasswordOnlyMutation.isPending,
    registerWithPasswordOnlyError: registerWithPasswordOnlyMutation.error,

    logout,
  };
}
