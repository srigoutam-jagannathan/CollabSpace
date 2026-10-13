jest.mock("expo-router", () => require("@/test/routerMock").expoRouterModule);

import { renderWithProviders } from "@/test/renderWithProviders";
import { PeopleToKnow } from "./PeopleToKnow";

const ana = { id: "u2", full_name: "Ana Lee", avatar_url: null, department: "Art", university: "qub" as const };

test("a match says which of your needs they can fill", () => {
  const screen = renderWithProviders(<PeopleToKnow items={[{ ...ana, matched_skills: ["UX Designer", "Marketer"] }]} />);
  expect(screen.getByText("Can fill UX Designer +1")).toBeTruthy();
  expect(screen.getByLabelText(/Can fill UX Designer and Marketer/)).toBeTruthy();
});

test("without a match it shows department and university", () => {
  const screen = renderWithProviders(<PeopleToKnow items={[{ ...ana, matched_skills: [] }]} />);
  expect(screen.getByText("Art · QUB")).toBeTruthy();
});
