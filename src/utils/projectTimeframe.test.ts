import { describeTimeframe } from "./projectTimeframe";

test("start and end dates read as a month range, with weekly hours", () => {
  expect(describeTimeframe({ start_date: "2026-10-03", end_date: "2026-12-25", commitment_hours: 5 }))
    .toBe("Oct 2026 – Dec 2026 · 5 hrs a week");
});

test("a range inside one month names the month once", () => {
  expect(describeTimeframe({ start_date: "2026-10-03", end_date: "2026-10-28" })).toBe("Oct 2026");
});

test("only a start or only an end date", () => {
  expect(describeTimeframe({ start_date: "2026-10-03" })).toBe("From Oct 2026");
  expect(describeTimeframe({ end_date: "2027-01-10" })).toBe("Until Jan 2027");
});

test("hours alone, singular and plural", () => {
  expect(describeTimeframe({ commitment_hours: 1 })).toBe("1 hr a week");
  expect(describeTimeframe({ commitment_hours: 10 })).toBe("10 hrs a week");
});

test("zero hours and missing fields say nothing", () => {
  expect(describeTimeframe({ commitment_hours: 0 })).toBeNull();
  expect(describeTimeframe({})).toBeNull();
});

test("an end before the start is treated as start only", () => {
  expect(describeTimeframe({ start_date: "2026-12-01", end_date: "2026-10-01" })).toBe("From Dec 2026");
});

test("months 00 and 13 are ignored", () => {
  expect(describeTimeframe({ start_date: "2026-13-01", commitment_hours: 5 })).toBe("5 hrs a week");
  expect(describeTimeframe({ start_date: "2026-00-10", commitment_hours: 5 })).toBe("5 hrs a week");
});

test("negative hours say nothing", () => {
  expect(describeTimeframe({ commitment_hours: -2 })).toBeNull();
});

test("a bad start with a valid end reads as until", () => {
  expect(describeTimeframe({ start_date: "garbage", end_date: "2027-01-10" })).toBe("Until Jan 2027");
});

test("a malformed date is ignored rather than printed", () => {
  expect(describeTimeframe({ start_date: "not a date", commitment_hours: 5 })).toBe("5 hrs a week");
});

test("a duration bucket is used instead of dates", () => {
  expect(describeTimeframe({ duration: "3_6_months", start_date: "2026-10-03", commitment_hours: 10 }))
    .toBe("3–6 months · 10 hrs a week");
});

test("a project with no duration falls back to its dates", () => {
  expect(describeTimeframe({ duration: null, start_date: "2026-10-03" })).toBe("From Oct 2026");
});
