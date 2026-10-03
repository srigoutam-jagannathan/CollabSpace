import { fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);
jest.mock("@/features/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));

import { ShareProfileSheet } from "./ShareProfileSheet";
import { renderWithProviders } from "@/test/renderWithProviders";
import { db, has } from "@/test/supabaseMock";

beforeEach(() => {
  db.reset();
  db.respond(() => ({ data: [] }));
});

test("offers the group chats of projects you are an approved member of", async () => {
  const screen = renderWithProviders(
    <ShareProfileSheet
      visible
      profileId="someone"
      profileName="Some One"
      avatarUrl={null}
      university={null}
      department={null}
      skills={[]}
      onClose={() => {}}
    />
  );
  fireEvent.press(screen.getByText("Send in Chat"));
  await waitFor(() => expect(db.callsTo("project_members")).toHaveLength(1));
  const call = db.callsTo("project_members")[0];
  expect(has(call, "eq", "user_id", "me")).toBe(true);
  // Approval is the owner's call; mou_accepted only records that you committed.
  expect(has(call, "eq", "status", "approved")).toBe(true);
  expect(call.filters.some(([, column]) => column === "mou_accepted")).toBe(false);
});
