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
import { db, has } from "@/test/supabaseMock";
import { routerState } from "@/test/routerMock";

const P = "p1";
const NAMES: Record<string, string> = { owner: "Olive Owner", me: "Mia Member", ana: "Ana Lee" };

/**
 * The project's owner and its member rows; `removal` is what a member delete
 * returns. Members are approved unless listed in `pending`.
 */
function world({ owner, members, pending = [], removal = "removes" }: {
  owner: string;
  members: string[];
  pending?: string[];
  removal?: "removes" | "silently-refused";
}) {
  const status = (id: string) => (pending.includes(id) ? "pending" : "approved");
  db.respond((c) => {
    if (c.table === "projects") {
      return { data: { id: P, owner_id: owner, title: "Lumen", description: "", chat_icon_url: null } };
    }
    if (c.table === "chat_messages") return c.op === "select" ? { data: [] } : {};
    if (c.table === "project_members" && c.op === "delete") {
      // With no matching policy, PostgREST answers 200 with zero rows -- not an error.
      return { data: removal === "removes" ? [{ id: "row" }] : [] };
    }
    if (c.table === "project_members" && c.single) {
      // Answer for whoever the query actually asked about, so a membership
      // load that isn't scoped to the current user can't pass by accident.
      const me = members.find((id) => has(c, "eq", "user_id", id));
      return {
        data: me ? { id: "m-me", project_id: P, user_id: me, mou_accepted: false, status: status(me) } : null,
      };
    }
    if (c.table === "project_members") {
      return {
        data: members.map((id) => ({
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

  test("confirming removes them, logs it against them, and tells the chat", async () => {
    mockAuth.user = { id: "owner" };
    world({ owner: "owner", members: ["ana"] });
    const screen = renderChat();
    await openMembers(screen);

    fireEvent.press(screen.getByLabelText("Remove Ana Lee from the project"));
    await act(async () => {
      await destructiveAction("Remove Ana Lee?")();
    });

    await waitFor(() => expect(screen.queryByLabelText("Remove Ana Lee from the project")).toBeNull());

    const removal = db.callsTo("project_members").find((c) => c.op === "delete")!;
    expect(has(removal, "eq", "user_id", "ana")).toBe(true);
    expect(has(removal, "eq", "project_id", P)).toBe(true);
    // .select() is what lets the client tell a real delete from a refused one.
    expect(removal.columns).toBe("id");

    const event = db.callsTo("collaboration_events").find((c) => c.op === "insert")!;
    expect(event.payload).toMatchObject({ user_id: "ana", event_type: "member_removed" });

    const notice = db.callsTo("chat_messages").find((c) => c.op === "insert")!;
    expect(notice.payload).toMatchObject({ type: "member_removed", metadata: { userName: "Ana Lee" } });
  });

  test("a delete the database silently refuses is reported, not treated as success", async () => {
    mockAuth.user = { id: "owner" };
    world({ owner: "owner", members: ["ana"], removal: "silently-refused" });
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
