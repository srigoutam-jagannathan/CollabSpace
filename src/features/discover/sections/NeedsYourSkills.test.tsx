import { renderWithProviders } from "@/test/renderWithProviders";
import { NeedsYourSkills } from "./NeedsYourSkills";
import type { NeedsItem } from "../types";

const item: NeedsItem = {
  id: "p1", title: "Aurora", description: "AR wayfinding.",
  looking_for: ["Backend Dev", "Marketing"], tags: ["AR"],
  university_scope: "qub", commitment_hours: 6, member_count: 3,
  matched_roles: ["Backend Dev"],
};

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

test("names the matched role in the callout", () => {
  const { getByText } = renderWithProviders(<NeedsYourSkills items={[item]} />);
  expect(getByText("Backend Dev — that's you")).toBeTruthy();
});

test("shows the role meter as filled of total", () => {
  const { getByText } = renderWithProviders(<NeedsYourSkills items={[item]} />);
  // 3 members + 2 open roles = 5 total
  expect(getByText("3 of 5 roles filled")).toBeTruthy();
});

test("summarises the card for screen readers", () => {
  const { getByLabelText } = renderWithProviders(<NeedsYourSkills items={[item]} />);
  expect(
    getByLabelText("Aurora. Needs a Backend Dev, which matches your skills. 3 of 5 roles filled.")
  ).toBeTruthy();
});

test("uses a plural callout when more than one role matches", () => {
  const multi: NeedsItem = { ...item, id: "p2", matched_roles: ["Backend Dev", "AI"] };
  const { getByText } = renderWithProviders(<NeedsYourSkills items={[multi]} />);
  expect(getByText("Matches Backend Dev + AI")).toBeTruthy();
});
