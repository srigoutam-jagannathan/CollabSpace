import { formatRelativeTime, getInitials } from "./text";

const NOW = Date.parse("2026-10-01T12:00:00Z");
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe("formatRelativeTime", () => {
  test.each([
    [0, "just now"],
    [59, "just now"],
    [60, "1m ago"],
    [59 * 60, "59m ago"],
    [60 * 60, "1h ago"],
    [23 * 3600, "23h ago"],
    [24 * 3600, "1d ago"],
    [6 * 86400, "6d ago"],
    [7 * 86400, "1w ago"],
    [30 * 86400, "4w ago"],
  ])("%ss ago reads %s", (seconds, expected) => {
    expect(formatRelativeTime(ago(seconds), NOW)).toBe(expected);
  });

  test("a timestamp slightly ahead of the clock reads as just now", () => {
    expect(formatRelativeTime(ago(-5), NOW)).toBe("just now");
  });
});

describe("getInitials", () => {
  test.each([
    ["Ana Lee", "AL"],
    ["Ana Maria Lee", "AL"],
    ["ana lee", "AL"],
    ["  Ana  Lee  ", "AL"],
    ["Ana", "AN"],
    ["A", "A"],
  ])("%s -> %s", (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });
});
