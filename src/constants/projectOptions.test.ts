import { DURATIONS, PROJECT_TYPES, durationLabel } from "./projectOptions";

test("stored project types are unchanged, because Search filters on them", () => {
  expect(PROJECT_TYPES.map((t) => t.value)).toEqual(["Academic Project", "Side Project", "Startup", "Community"]);
  expect(PROJECT_TYPES.find((t) => t.value === "Side Project")?.label).toBe("Passion project");
});

test("the four duration buckets match the database check", () => {
  expect(DURATIONS.map((d) => d.value)).toEqual(["under_1_month", "1_3_months", "3_6_months", "flexible"]);
});

test("durationLabel names a bucket, and null for anything else", () => {
  expect(durationLabel("1_3_months")).toBe("1–3 months");
  expect(durationLabel(null)).toBeNull();
  expect(durationLabel("forever")).toBeNull();
});
