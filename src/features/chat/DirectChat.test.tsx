import { Image } from "react-native";
import { fireEvent } from "@testing-library/react-native";

jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);
jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);
const mockAuth = { user: { id: "me" } };
jest.mock("@/features/auth/AuthContext", () => ({ useAuth: () => mockAuth }));

import { DirectChat } from "./DirectChat";
import { renderWithProviders } from "@/test/renderWithProviders";
import { db } from "@/test/supabaseMock";
import { mockRouter, routerState } from "@/test/routerMock";

function world({ iAmRequester = true, avatar = "https://img.example/ana.png" as string | null } = {}) {
  db.respond((c) => {
    if (c.table === "connections") {
      // The mock ignores the select string, so honour it here: a profile only
      // carries avatar_url if the query asked for it, as PostgREST would do.
      const asked = (c.columns ?? "").includes("avatar_url");
      const me = { full_name: "Mia Member", ...(asked && { avatar_url: null }) };
      const ana = { full_name: "Ana Lee", ...(asked && { avatar_url: avatar }) };
      return {
        data: iAmRequester
          ? { requester_id: "me", recipient_id: "ana", requester: me, recipient: ana }
          : { requester_id: "ana", recipient_id: "me", requester: ana, recipient: me },
      };
    }
    if (c.table === "direct_messages") return c.op === "select" ? { data: [] } : {};
    return {};
  });
}

const renderDm = () => renderWithProviders(<DirectChat connectionId="c1" />);

beforeEach(() => {
  db.reset();
  routerState.reset();
  routerState.setPathname("/chat/dm/c1");
});

test("the header shows the other person's photo", async () => {
  world();
  const screen = renderDm();
  await screen.findByLabelText("View Ana Lee's profile");
  // Avatar has no testID; finding the Image by its source is the observable fact.
  const uris = screen.UNSAFE_getAllByType(Image).map((img) => img.props.source?.uri);
  expect(uris).toContain("https://img.example/ana.png");
});

test("without a photo the header falls back to initials", async () => {
  world({ avatar: null });
  expect(await renderDm().findByText("AL")).toBeTruthy();
});

test("tapping the header opens their profile, with this conversation as the way back", async () => {
  world();
  fireEvent.press(await renderDm().findByLabelText("View Ana Lee's profile"));
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: "/(app)/users/[id]",
    params: { id: "ana", from: "/chat/dm/c1" },
  });
});

test("the other person is resolved from whichever side of the pair you are not", async () => {
  world({ iAmRequester: false });
  fireEvent.press(await renderDm().findByLabelText("View Ana Lee's profile"));
  expect(mockRouter.push).toHaveBeenCalledWith(
    expect.objectContaining({ params: expect.objectContaining({ id: "ana" }) })
  );
});
