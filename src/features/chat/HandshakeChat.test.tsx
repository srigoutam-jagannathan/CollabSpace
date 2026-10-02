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

/** The project's owner and its member rows; `removal` is what a member delete returns. */
function world({ owner, members, removal = "removes" }: {
  owner: string;
  members: string[];
  removal?: "removes" | "silently-refused";
}) {
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
      const me = mockAuth.user.id;
      return { data: members.includes(me) ? { id: "m-me", project_id: P, user_id: me, mou_accepted: false } : null };
    }
    if (c.table === "project_members") {
      return {
        data: members.map((id) => ({
          user_id: id, role: "Designer", mou_accepted: false,
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
  test("is there for a member", async () => {
    world({ owner: "owner", members: ["me"] });
    expect(await renderChat().findByPlaceholderText("Message…")).toBeTruthy();
  });

  test("is there for the owner, who has no membership row", async () => {
    mockAuth.user = { id: "owner" };
    world({ owner: "owner", members: ["ana"] });
    expect(await renderChat().findByPlaceholderText("Message…")).toBeTruthy();
  });

  test("is replaced by an explanation once you are not a member", async () => {
    world({ owner: "owner", members: ["ana"] });
    const screen = renderChat();
    expect(await screen.findByText("You left this project. Rejoin to send messages.")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Message…")).toBeNull();
  });
});
