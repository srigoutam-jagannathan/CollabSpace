import { Alert } from "react-native";
import { act, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);
jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
const mockAuth = { user: { id: "me" } };
jest.mock("@/features/auth/AuthContext", () => ({ useAuth: () => mockAuth }));

import HandshakeChat from "./HandshakeChat";
import { renderWithProviders } from "@/test/renderWithProviders";
import { db, has, supabase } from "@/test/supabaseMock";
import { mockRouter, routerState } from "@/test/routerMock";

const P = "p1";
const NAMES: Record<string, string> = { owner: "Olive Owner", me: "Mia Member", ana: "Ana Lee", ben: "Ben Pending" };

/**
 * The project's owner and its member rows. Members are approved unless
 * listed in `pending`.
 */
function world({ owner, members, pending = [] }: {
  owner: string;
  members: string[];
  pending?: string[];
}) {
  const status = (id: string) => (pending.includes(id) ? "pending" : "approved");
  db.respond((c) => {
    if (c.table === "projects") {
      return { data: { id: P, owner_id: owner, title: "Lumen", description: "", chat_icon_url: null } };
    }
    if (c.table === "chat_messages") return c.op === "select" ? { data: [] } : {};
    if (c.table === "project_members" && c.single) {
      // Answer for whoever the query actually asked about, so a membership
      // load that isn't scoped to the current user can't pass by accident.
      const me = members.find((id) => has(c, "eq", "user_id", id));
      return {
        data: me ? { id: "m-me", project_id: P, user_id: me, mou_accepted: false, status: status(me) } : null,
      };
    }
    if (c.table === "project_members") {
      // Honour a status filter the way the database would.
      const wanted = c.filters.find(([m, col]) => m === "eq" && col === "status")?.[2];
      return {
        data: members.filter((id) => wanted === undefined || status(id) === wanted).map((id) => ({
          user_id: id, role: "Designer", mou_accepted: false, status: status(id),
          profile: { full_name: NAMES[id], avatar_url: null },
        })),
      };
    }
    if (c.table === "profiles" && c.columns?.includes("avatar_url")) {
      return { data: { id: owner, full_name: NAMES[owner], avatar_url: null } };
    }
    if (c.table === "profiles") return { data: { full_name: NAMES[mockAuth.user.id] } };
    return {};
  });
}

const renderChat = () => renderWithProviders(<HandshakeChat projectId={P} />);

beforeEach(() => {
  db.reset();
  routerState.reset();
  mockAuth.user = { id: "me" };
});

describe("the composer", () => {
  test("is there for an approved member", async () => {
    world({ owner: "owner", members: ["me"] });
    expect(await renderChat().findByPlaceholderText("Message…")).toBeTruthy();
  });

  test("is there for the owner, who has no membership row", async () => {
    mockAuth.user = { id: "owner" };
    world({ owner: "owner", members: ["ana"] });
    expect(await renderChat().findByPlaceholderText("Message…")).toBeTruthy();
  });

  test("is replaced by a waiting note while the owner has not approved you", async () => {
    world({ owner: "owner", members: ["me"], pending: ["me"] });
    const screen = renderChat();
    expect(await screen.findByText("Waiting for the owner to approve you")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Message…")).toBeNull();
  });

  test("is replaced by an explanation once you are not a member", async () => {
    world({ owner: "owner", members: ["ana"] });
    const screen = renderChat();
    expect(await screen.findByText("You left this project. Rejoin to send messages.")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Message…")).toBeNull();
  });
});

describe("the members list", () => {
  test("shows approved members only; pending requests are for Notifications", async () => {
    mockAuth.user = { id: "owner" };
    world({ owner: "owner", members: ["ana", "ben"], pending: ["ben"] });
    const screen = renderChat();
    fireEvent.press(await screen.findByText("Lumen"));
    expect(await screen.findByText("Members · 2")).toBeTruthy();
    expect(screen.getByText("Ana Lee")).toBeTruthy();
    expect(screen.queryByText("Ben Pending")).toBeNull();
  });
});

describe("removing a member", () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });
  afterEach(() => alertSpy.mockRestore());

  /** The destructive button's handler from the alert titled `title`. */
  function destructiveAction(title: string) {
    const call = alertSpy.mock.calls.find(([t]) => t === title);
    const button = (call?.[2] as { style?: string; onPress?: () => unknown }[] | undefined)?.find(
      (b) => b.style === "destructive"
    );
    if (!button?.onPress) throw new Error(`No destructive button on alert "${title}"`);
    return button.onPress;
  }

  async function openMembers(screen: ReturnType<typeof renderChat>) {
    fireEvent.press(await screen.findByText("Lumen"));
    await screen.findByText("Members · 2");
  }

  test("the owner gets a remove control for each member, but not for themselves", async () => {
    mockAuth.user = { id: "owner" };
    world({ owner: "owner", members: ["ana"] });
    const screen = renderChat();
    await openMembers(screen);
    expect(screen.getByLabelText("Remove Ana Lee from the project")).toBeTruthy();
    expect(screen.queryByLabelText("Remove Olive Owner from the project")).toBeNull();
  });

  test("a member gets no remove controls at all", async () => {
    world({ owner: "owner", members: ["me"] });
    const screen = renderChat();
    fireEvent.press(await screen.findByText("Lumen"));
    await screen.findByText("Members · 2");
    expect(screen.queryAllByLabelText(/^Remove /)).toHaveLength(0);
  });

  test("confirming removes them through remove_member", async () => {
    mockAuth.user = { id: "owner" };
    world({ owner: "owner", members: ["ana"] });
    const screen = renderChat();
    await openMembers(screen);

    fireEvent.press(screen.getByLabelText("Remove Ana Lee from the project"));
    await act(async () => {
      await destructiveAction("Remove Ana Lee?")();
    });

    await waitFor(() => expect(screen.queryByLabelText("Remove Ana Lee from the project")).toBeNull());

    // One transaction, server-side: the row, the event and the chat message.
    expect(supabase.rpc).toHaveBeenCalledWith("remove_member", { p_project: P, p_user: "ana" });
    expect(db.callsTo("project_members").filter((c) => c.op === "delete")).toHaveLength(0);
    expect(db.callsTo("collaboration_events").filter((c) => c.op === "insert")).toHaveLength(0);
    expect(db.callsTo("chat_messages").filter((c) => c.op === "insert")).toHaveLength(0);
  });

  test("a removal the RPC refuses is reported, not treated as success", async () => {
    mockAuth.user = { id: "owner" };
    world({ owner: "owner", members: ["ana"] });
    supabase.rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "no such membership" } });
    const screen = renderChat();
    await openMembers(screen);

    fireEvent.press(screen.getByLabelText("Remove Ana Lee from the project"));
    await act(async () => {
      await destructiveAction("Remove Ana Lee?")();
    });

    expect(alertSpy).toHaveBeenCalledWith("Error", "Could not remove Ana Lee. Please try again.");
    expect(screen.getByLabelText("Remove Ana Lee from the project")).toBeTruthy();
    expect(db.callsTo("collaboration_events").filter((c) => c.op === "insert")).toHaveLength(0);
    expect(db.callsTo("chat_messages").filter((c) => c.op === "insert")).toHaveLength(0);
  });
});

describe("quitting the project", () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });
  afterEach(() => alertSpy.mockRestore());

  async function quit(screen: ReturnType<typeof renderChat>) {
    fireEvent.press(await screen.findByText("Lumen"));
    fireEvent.press(await screen.findByText("Quit Project"));
    fireEvent.press(await screen.findByLabelText("Confirm leaving the project"));
  }

  test("goes through leave_project, tells the owner, and moves on", async () => {
    world({ owner: "owner", members: ["me"] });
    const screen = renderChat();
    await quit(screen);

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/(app)/projects"));
    expect(supabase.rpc).toHaveBeenCalledWith("leave_project", { p_project: P });
    expect(db.callsTo("project_members").filter((c) => c.op === "delete")).toHaveLength(0);
    expect(db.callsTo("collaboration_events").filter((c) => c.op === "insert")).toHaveLength(0);
    expect(db.callsTo("chat_messages").filter((c) => c.op === "insert")).toHaveLength(0);
    expect(supabase.functions.invoke).toHaveBeenCalledWith("notify-owner", expect.anything());
  });

  test("a leave the RPC refuses is reported, and nothing else happens", async () => {
    world({ owner: "owner", members: ["me"] });
    supabase.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "not a member" } });
    const screen = renderChat();
    await quit(screen);

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("Error", "Could not leave the project. Please try again.")
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });
});
