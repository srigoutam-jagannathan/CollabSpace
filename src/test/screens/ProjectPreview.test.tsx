import { Alert } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);
jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);
const mockAuth = { user: { id: "me" } };
jest.mock("@/features/auth/AuthContext", () => ({ useAuth: () => mockAuth }));

// Route files live under app/. Tests may not: Expo Router would register them as routes.
import ProjectPreviewScreen from "../../../app/(app)/projects/[id]/preview";
import { renderWithProviders } from "@/test/renderWithProviders";
import { db, has, supabase } from "@/test/supabaseMock";
import { mockRouter, routerState } from "@/test/routerMock";

function world({ member, leave = "removes" }: { member: boolean; leave?: "removes" | "silently-refused" }) {
  db.respond((c) => {
    if (c.table === "projects") {
      return {
        data: {
          id: "p1", owner_id: "owner", title: "Version 2.0 of sidequest", description: "",
          tags: [], looking_for: [], owner: { full_name: "Olive Owner" },
        },
      };
    }
    if (c.table === "project_members" && c.op === "delete") {
      return { data: leave === "removes" ? [{ id: "m1" }] : [] };
    }
    if (c.table === "project_members") return { data: member ? { id: "m1" } : null };
    if (c.table === "profiles") return { data: { full_name: "Mia Member" } };
    return {};
  });
}

const renderPreview = () => renderWithProviders(<ProjectPreviewScreen />);

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  db.reset();
  routerState.reset();
  routerState.setParams({ id: "p1", from: "/search" });
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});
afterEach(() => alertSpy.mockRestore());

async function leave(screen: ReturnType<typeof renderPreview>) {
  fireEvent.press(await screen.findByLabelText("Leave Project"));
  fireEvent.press(await screen.findByLabelText("Confirm leaving the project"));
}

test("back pops back to where the preview was opened from", async () => {
  world({ member: false });
  const screen = renderPreview();
  fireEvent.press(await screen.findByText("Back"));
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockRouter.navigate).not.toHaveBeenCalled();
});

test("a non-member is offered Join, not Leave", async () => {
  world({ member: false });
  const screen = renderPreview();
  expect(await screen.findByText("Join Project")).toBeTruthy();
  expect(screen.queryByLabelText("Leave Project")).toBeNull();
});

test("leaving removes the membership, logs it, tells the owner, and moves on", async () => {
  world({ member: true });
  const screen = renderPreview();
  await leave(screen);

  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/(app)/projects"));
  const del = db.callsTo("project_members").find((c) => c.op === "delete")!;
  expect(del.columns).toBe("id");
  expect(has(del, "eq", "project_id", "p1")).toBe(true);
  expect(has(del, "eq", "user_id", "me")).toBe(true);
  expect(db.callsTo("collaboration_events").find((c) => c.op === "insert")!.payload).toMatchObject({
    event_type: "member_quit",
  });
  expect(supabase.functions.invoke).toHaveBeenCalledWith(
    "notify-owner",
    expect.anything()
  );
});

test("a leave the database silently refuses is reported, and nothing else happens", async () => {
  world({ member: true, leave: "silently-refused" });
  const screen = renderPreview();
  await leave(screen);

  await waitFor(() =>
    expect(alertSpy).toHaveBeenCalledWith("Error", "Could not leave the project. Please try again.")
  );
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(db.callsTo("collaboration_events").filter((c) => c.op === "insert")).toHaveLength(0);

  expect(supabase.functions.invoke).not.toHaveBeenCalled();
  expect(db.callsTo("chat_messages").filter((c) => c.op === "insert")).toHaveLength(0);
});
