import { renderWithProviders } from "@/test/renderWithProviders";
import ArchiveDeck from "./ArchiveDeck";
import { fetchCompleted } from "./queries";

jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);
jest.mock("@/lib/supabaseClient", () => ({ supabase: {} }));
jest.mock("./queries", () => ({ ...jest.requireActual("./queries"), fetchCompleted: jest.fn() }));

test("a failed fetch shows the error and Retry, and no example projects", async () => {
  (fetchCompleted as jest.Mock).mockResolvedValue({ data: [], error: "Couldn't load the archive." });
  const screen = renderWithProviders(<ArchiveDeck />);
  expect(await screen.findByText("Couldn't load the archive.")).toBeTruthy();
  expect(screen.getByLabelText("Retry loading the archive")).toBeTruthy();
  expect(screen.queryByText("EXAMPLE")).toBeNull();
});
