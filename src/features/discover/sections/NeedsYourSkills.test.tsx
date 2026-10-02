import { fireEvent } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/renderWithProviders";
import { NeedsYourSkills } from "./NeedsYourSkills";
import type { NeedsItem } from "../types";

const item: NeedsItem = {
  id: "p1", title: "Aurora", description: "AR wayfinding.",
  looking_for: ["Backend Dev", "Marketing"], tags: ["AR"],
  university_scope: "qub", commitment_hours: 6, member_count: 3,
  matched_roles: ["Backend Dev"],
};

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => mockPush.mockClear());

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
    getByLabelText("Aurora. Needs a Backend Dev, which matches your skills. 3 of 5 roles filled. Opens the project.")
  ).toBeTruthy();
});

test("uses a plural callout when more than one role matches", () => {
  const multi: NeedsItem = { ...item, id: "p2", matched_roles: ["Backend Dev", "AI"] };
  const { getByText } = renderWithProviders(<NeedsYourSkills items={[multi]} />);
  expect(getByText("Matches Backend Dev + AI")).toBeTruthy();
});

test("a project with no declared roles reports team size, not capacity", () => {
  const noRoles: NeedsItem = {
    ...item, id: "p3", looking_for: [], matched_roles: [], member_count: 3,
  };
  const { getByText, queryByText } = renderWithProviders(<NeedsYourSkills items={[noRoles]} />);
  expect(getByText("3 collaborators")).toBeTruthy();
  expect(queryByText("3 of 3 roles filled")).toBeNull();
});

test("renders the metadata pills", () => {
  const { getByText } = renderWithProviders(<NeedsYourSkills items={[item]} />);
  expect(getByText("Backend Dev open")).toBeTruthy();
  expect(getByText("QUB")).toBeTruthy();
  expect(getByText("6h/wk")).toBeTruthy();
});

test("Ask to join goes to the join form, not the project preview", () => {
  const { getByLabelText } = renderWithProviders(<NeedsYourSkills items={[item]} />);
  fireEvent.press(getByLabelText("Ask to join Aurora"));
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/(app)/projects/[id]/join",
    params: { id: "p1" },
  });
});

test("tapping the card body opens the project preview", () => {
  const { getByLabelText } = renderWithProviders(<NeedsYourSkills items={[item]} />);
  fireEvent.press(getByLabelText(/^Aurora\./));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/(app)/projects/[id]/preview",
    params: { id: "p1" },
  });
});
