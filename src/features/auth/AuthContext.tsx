import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { resolveUniversity } from "./constants";
import type { University } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthStatus =
  | "loading"
  | "unauthenticated"
  | "authenticated"
  | "access_restricted"; // Belfast Lock rejection

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  university: University | null;
  signInWithMicrosoft: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Set when status === "access_restricted" */
  restrictedEmail: string | null;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [university, setUniversity] = useState<University | null>(null);
  const [restrictedEmail, setRestrictedEmail] = useState<string | null>(null);

  // Token of the session currently being validated. Skips only an exact
  // duplicate -- getSession() and the INITIAL_SESSION event both deliver the
  // same session at startup. A *different* session arriving mid-validation
  // must still be checked: a plain boolean here dropped it, so a
  // non-university session that landed during the profile upsert was never
  // revoked.
  const validatingToken = useRef<string | null>(null);

  // Bumped for every non-null session that starts validating. A rejection
  // awaiting signOut() checks it afterwards: if a newer session has arrived
  // meanwhile, that session owns the state and the rejection must not touch
  // it. Null sessions do not bump it -- our own signOut() emits SIGNED_OUT
  // with null mid-rejection, and that must not cancel the rejection.
  // A successful global revoke still clears whatever session is stored
  // (auth-js removes the stored session), so this guard keeps the newer
  // session's *state* from being overwritten; only on the error path does the
  // newer session itself survive.
  const generation = useRef(0);

  // ── Belfast Lock ────────────────────────────────────────────────────────────
  /**
   * Called every time a session is established.
   * If the email domain is not on the allowlist, the session is revoked immediately.
   */
  const validateAndApplySession = useCallback(async (incoming: Session | null) => {
    if (!incoming) {
      setSession(null);
      setUniversity(null);
      setRestrictedEmail(null);
      setStatus("unauthenticated");
      return;
    }

    if (validatingToken.current === incoming.access_token) return;
    validatingToken.current = incoming.access_token;
    const gen = ++generation.current;
    const superseded = () => gen !== generation.current;

    try {
      const email = incoming.user.email ?? "";
      const uni = resolveUniversity(email);

      if (!uni) {
        // ── DOMAIN NOT ALLOWED — revoke immediately ──────────────────────────
        // Sign out from Supabase so the token is invalidated server-side
        const { error } = await supabase.auth.signOut();
        if (superseded()) return;
        // On a network failure supabase-js keeps the session stored and goes
        // on sending its token. A local sign-out always clears it.
        if (error) await supabase.auth.signOut({ scope: "local" });
        if (superseded()) return;
        // Set after signOut: its own SIGNED_OUT event resets restrictedEmail.
        setRestrictedEmail(email);
        setSession(null);
        setUniversity(null);
        setStatus("access_restricted");
        return;
      }

      // ── DOMAIN VALID ────────────────────────────────────────────────────────
      setSession(incoming);
      setUniversity(uni);
      setRestrictedEmail(null);
      setStatus("authenticated");

      // Upsert the profile row so it always exists for new sign-ins.
      // avatar_url is intentionally excluded — it's managed by the user via
      // edit-profile and must not be overwritten from OAuth metadata on each login.
      await supabase.from("profiles").upsert(
        {
          id: incoming.user.id,
          full_name:
            incoming.user.user_metadata?.full_name ??
            incoming.user.user_metadata?.name ??
            null,
          university: uni,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    } finally {
      if (validatingToken.current === incoming.access_token) validatingToken.current = null;
    }
  }, []);

  // ── Bootstrap: restore session on mount ─────────────────────────────────────
  useEffect(() => {
    // The catch matters: status starts at "loading" and only ever leaves it
    // through validateAndApplySession. If this rejects -- AsyncStorage
    // unavailable, storage quota, a corrupt persisted session -- an unhandled
    // rejection would leave the app on its spinner forever with no way out.
    // Treat any bootstrap failure as "not signed in" and let the user log in.
    supabase.auth
      .getSession()
      .then(({ data }) => validateAndApplySession(data.session))
      .catch(() => validateAndApplySession(null));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      validateAndApplySession(newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [validateAndApplySession]);

  // ── Sign in ──────────────────────────────────────────────────────────────────
  const signInWithMicrosoft = useCallback(async () => {
    const redirectUri = makeRedirectUri({ scheme: "collabspace", path: "auth/callback" });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "email profile openid",
        redirectTo: redirectUri,
        queryParams: {
          // Prompt account selection so users aren't silently signed into a
          // non-university personal Microsoft account
          prompt: "select_account",
        },
      },
    });

    if (error) throw error;
    if (!data.url) throw new Error("No OAuth URL returned from Supabase.");

    await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
  }, []);

  // ── Email/password sign-in ───────────────────────────────────────────────────
  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Belfast Lock fires via onAuthStateChange
  }, []);

  // ── Email/password sign-up ───────────────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const uni = resolveUniversity(email);
    if (!uni) {
      throw new Error("Only @qub.ac.uk and @ulster.ac.uk email addresses are allowed.");
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
  }, []);

  // ── Sign out ─────────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        status,
        session,
        user: session?.user ?? null,
        university,
        signInWithMicrosoft,
        signInWithPassword,
        signUp,
        signOut,
        restrictedEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
