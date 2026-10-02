import { Text } from "react-native";
import { act, render, waitFor } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";

jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);
jest.mock("expo-auth-session", () => ({ makeRedirectUri: () => "collabspace://auth/callback" }));
jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(),
  maybeCompleteAuthSession: jest.fn(),
}));

import { AuthProvider, useAuth } from "./AuthContext";
import { db, supabase } from "@/test/supabaseMock";

function session(email: string) {
  return {
    access_token: "token",
    user: { id: "u1", email, user_metadata: { full_name: "Ana Lee" } },
  };
}

function signedInAs(email: string) {
  supabase.auth.getSession.mockResolvedValue({ data: { session: session(email) }, error: null });
}

function Probe() {
  const { status, university, restrictedEmail } = useAuth();
  return <Text>{`${status}|${university ?? "-"}|${restrictedEmail ?? "-"}`}</Text>;
}

const renderProbe = () => render(<AuthProvider><Probe /></AuthProvider>);

async function renderAndCapture() {
  const captured: { current?: ReturnType<typeof useAuth> } = {};
  function Capture() {
    captured.current = useAuth();
    return null;
  }
  render(<AuthProvider><Capture /></AuthProvider>);
  await waitFor(() => expect(captured.current?.status).not.toBe("loading"));
  return captured.current!;
}

beforeEach(() => db.reset());

test("no stored session means unauthenticated", async () => {
  expect(await renderProbe().findByText("unauthenticated|-|-")).toBeTruthy();
});

test("a qub.ac.uk session is accepted as QUB", async () => {
  signedInAs("ana@qub.ac.uk");
  expect(await renderProbe().findByText("authenticated|qub|-")).toBeTruthy();
});

test("an ulster.ac.uk session is accepted as Ulster", async () => {
  signedInAs("ana@ulster.ac.uk");
  expect(await renderProbe().findByText("authenticated|ulster|-")).toBeTruthy();
});

test("a non-university session is revoked server-side, not just hidden", async () => {
  signedInAs("ana@gmail.com");
  // Real supabase-js emits SIGNED_OUT to the listener from inside signOut();
  // the lock must still end on access_restricted, with the address shown.
  supabase.auth.signOut.mockImplementation(async () => {
    await supabase.auth.onAuthStateChange.mock.calls[0][0]("SIGNED_OUT", null);
    return { error: null };
  });
  expect(await renderProbe().findByText("access_restricted|-|ana@gmail.com")).toBeTruthy();
  expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  // A rejected user must never get a profile row.
  expect(db.callsTo("profiles")).toHaveLength(0);
});

test("if the server sign-out fails, the rejected session is still dropped locally", async () => {
  signedInAs("ana@gmail.com");
  // supabase-js returns { error } on a network failure and keeps the session
  // stored, so the client would go on sending the rejected user's token.
  supabase.auth.signOut.mockResolvedValueOnce({ error: new Error("Network request failed") });
  expect(await renderProbe().findByText("access_restricted|-|ana@gmail.com")).toBeTruthy();
  expect(supabase.auth.signOut).toHaveBeenCalledTimes(2);
  expect(supabase.auth.signOut).toHaveBeenLastCalledWith({ scope: "local" });
});

test("a lookalike domain is treated as non-university", async () => {
  signedInAs("ana@qub.ac.uk.evil.com");
  expect(await renderProbe().findByText("access_restricted|-|ana@qub.ac.uk.evil.com")).toBeTruthy();
  expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
});

test("an accepted session upserts the profile without overwriting avatar_url", async () => {
  signedInAs("ana@qub.ac.uk");
  await renderProbe().findByText("authenticated|qub|-");
  await waitFor(() => expect(db.callsTo("profiles")).toHaveLength(1));
  const [call] = db.callsTo("profiles");
  expect(call.op).toBe("upsert");
  expect(call.payload).toMatchObject({ id: "u1", full_name: "Ana Lee", university: "qub" });
  // avatar_url is the user's to manage in edit-profile; OAuth metadata must not clobber it.
  expect(call.payload).not.toHaveProperty("avatar_url");
});

test("a failed session restore falls through to sign-in instead of hanging on the spinner", async () => {
  supabase.auth.getSession.mockRejectedValue(new Error("storage unavailable"));
  expect(await renderProbe().findByText("unauthenticated|-|-")).toBeTruthy();
});

test("a sign-out reported by the auth listener returns to unauthenticated", async () => {
  signedInAs("ana@qub.ac.uk");
  const screen = renderProbe();
  await screen.findByText("authenticated|qub|-");
  const listener = supabase.auth.onAuthStateChange.mock.calls[0][0];
  await act(async () => {
    await listener("SIGNED_OUT", null);
  });
  expect(await screen.findByText("unauthenticated|-|-")).toBeTruthy();
});

test("a non-university session arriving via the auth listener is revoked", async () => {
  signedInAs("ana@qub.ac.uk");
  const screen = renderProbe();
  await screen.findByText("authenticated|qub|-");
  const listener = supabase.auth.onAuthStateChange.mock.calls[0][0];
  const eve = { access_token: "token-eve", user: { id: "u2", email: "eve@gmail.com", user_metadata: {} } };
  await act(async () => {
    await listener("SIGNED_IN", eve);
  });
  expect(await screen.findByText("access_restricted|-|eve@gmail.com")).toBeTruthy();
  expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
});

test("a different session arriving mid-validation is still checked", async () => {
  signedInAs("ana@qub.ac.uk");
  const eve = { access_token: "token-eve", user: { id: "u2", email: "eve@gmail.com", user_metadata: {} } };
  let fired = false;
  db.respond((call) => {
    if (call.table === "profiles" && call.op === "upsert" && !fired) {
      fired = true;
      // Lands while the qub session is still awaiting its profile upsert.
      void supabase.auth.onAuthStateChange.mock.calls[0][0]("SIGNED_IN", eve);
    }
    return undefined;
  });
  const screen = renderProbe();
  expect(await screen.findByText("access_restricted|-|eve@gmail.com")).toBeTruthy();
  expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
});

test("sign-up refuses a non-university address before contacting Supabase", async () => {
  const auth = await renderAndCapture();
  await expect(auth.signUp("ana@gmail.com", "pw", "Ana")).rejects.toThrow(
    "Only @qub.ac.uk and @ulster.ac.uk email addresses are allowed."
  );
  expect(supabase.auth.signUp).not.toHaveBeenCalled();
});

test("sign-up passes the full name through as user metadata", async () => {
  const auth = await renderAndCapture();
  await auth.signUp("ana@qub.ac.uk", "pw", "Ana Lee");
  expect(supabase.auth.signUp).toHaveBeenCalledWith({
    email: "ana@qub.ac.uk",
    password: "pw",
    options: { data: { full_name: "Ana Lee" } },
  });
});

test("password sign-in surfaces Supabase's error", async () => {
  supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: new Error("Invalid login credentials") });
  const auth = await renderAndCapture();
  await expect(auth.signInWithPassword("ana@qub.ac.uk", "wrong")).rejects.toThrow("Invalid login credentials");
});

test("Microsoft sign-in forces the account picker and opens the browser", async () => {
  supabase.auth.signInWithOAuth.mockResolvedValue({
    data: { url: "https://login.microsoftonline.com/authorize" },
    error: null,
  });
  const auth = await renderAndCapture();
  await auth.signInWithMicrosoft();
  expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: "azure",
      // Without this, a personal Microsoft account can sign in silently.
      options: expect.objectContaining({ queryParams: { prompt: "select_account" } }),
    })
  );
  expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
    "https://login.microsoftonline.com/authorize",
    "collabspace://auth/callback"
  );
});

test("sign-out calls Supabase", async () => {
  const auth = await renderAndCapture();
  await act(async () => {
    await auth.signOut();
  });
  expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
});

test("useAuth outside the provider fails loudly", () => {
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(() => render(<Probe />)).toThrow("useAuth must be used within <AuthProvider>");
  } finally {
    spy.mockRestore();
  }
});

test("a rejected session whose sign-out is slow cannot overwrite a newer valid session", async () => {
  signedInAs("eve@gmail.com");
  let finishSignOut!: (r: { error: unknown }) => void;
  supabase.auth.signOut.mockImplementationOnce(
    () => new Promise((resolve) => { finishSignOut = resolve; })
  );
  const screen = renderProbe();
  await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalledTimes(1));

  const ana = { access_token: "token-ana", user: { id: "u3", email: "ana@qub.ac.uk", user_metadata: {} } };
  await act(async () => {
    await supabase.auth.onAuthStateChange.mock.calls[0][0]("SIGNED_IN", ana);
  });
  expect(await screen.findByText("authenticated|qub|-")).toBeTruthy();

  await act(async () => {
    finishSignOut({ error: null });
  });
  expect(screen.getByText("authenticated|qub|-")).toBeTruthy();
});

test("a stale rejection does not fall back to a local sign-out over the newer session", async () => {
  signedInAs("eve@gmail.com");
  let finishSignOut!: (r: { error: unknown }) => void;
  supabase.auth.signOut.mockImplementationOnce(
    () => new Promise((resolve) => { finishSignOut = resolve; })
  );
  const screen = renderProbe();
  await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalledTimes(1));

  const ana = { access_token: "token-ana", user: { id: "u3", email: "ana@qub.ac.uk", user_metadata: {} } };
  await act(async () => {
    await supabase.auth.onAuthStateChange.mock.calls[0][0]("SIGNED_IN", ana);
  });
  await act(async () => {
    finishSignOut({ error: new Error("Network request failed") });
  });
  expect(screen.getByText("authenticated|qub|-")).toBeTruthy();
  // A local sign-out now would delete ana's stored session, not eve's.
  expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
});
