import { renderWithProviders } from "@/test/renderWithProviders";
import { PulseStrip } from "./PulseStrip";
import type { PulseItem } from "../types";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const item: PulseItem = {
  id: "e1", created_at: "2026-10-04T10:00:00Z", event_type: "committed", project_id: "p1",
  project_title: "Solar Boat", actor_id: "u2", actor_name: "Aoife Byrne", actor_avatar_url: null,
};

test("a commitment reads as committing to the project", () => {
  const { getByLabelText } = renderWithProviders(<PulseStrip items={[item]} />);
  expect(getByLabelText("Aoife Byrne committed to Solar Boat")).toBeTruthy();
});
