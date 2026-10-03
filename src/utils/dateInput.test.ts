import { formatDateInput, ddmmyyyyToIso } from "./dateInput";

/** Types `keys` one character at a time, the way a keyboard drives onChangeText. */
function type(keys: string, start = ""): string {
  let value = start;
  for (const k of keys) value = formatDateInput(value + k, value);
  return value;
}

describe("formatDateInput", () => {
  test("adds the slashes after the day and the month as you type", () => {
    expect(type("1")).toBe("1");
    expect(type("12")).toBe("12/");
    expect(type("1210")).toBe("12/10/");
    expect(type("12102026")).toBe("12/10/2026");
  });

  test("a slash typed by hand is not doubled", () => {
    expect(type("12/10/2026")).toBe("12/10/2026");
  });

  test("stops at eight digits", () => {
    expect(type("121020261")).toBe("12/10/2026");
  });

  test("ignores anything that is not a digit", () => {
    expect(type("1a2-1.0")).toBe("12/10/");
  });

  test("backspacing over an auto-added slash removes it instead of putting it back", () => {
    expect(formatDateInput("12", "12/")).toBe("12");
    expect(formatDateInput("12/10", "12/10/")).toBe("12/10");
  });

  test("a pasted date is formatted whole", () => {
    expect(formatDateInput("12102026", "")).toBe("12/10/2026");
  });
});

describe("ddmmyyyyToIso", () => {
  test("converts to the YYYY-MM-DD the database expects", () => {
    // Postgres reads 03/10/2026 month-first (10 March), so it must never be sent raw.
    expect(ddmmyyyyToIso("03/10/2026")).toBe("2026-10-03");
    expect(ddmmyyyyToIso("25/12/2026")).toBe("2026-12-25");
  });

  test("accepts a leap day only in a leap year", () => {
    expect(ddmmyyyyToIso("29/02/2028")).toBe("2028-02-29");
    expect(ddmmyyyyToIso("29/02/2027")).toBeNull();
  });

  test("rejects dates that do not exist", () => {
    expect(ddmmyyyyToIso("31/04/2026")).toBeNull();
    expect(ddmmyyyyToIso("00/10/2026")).toBeNull();
    expect(ddmmyyyyToIso("12/13/2026")).toBeNull();
  });

  test("rejects anything incomplete", () => {
    expect(ddmmyyyyToIso("12/10/")).toBeNull();
    expect(ddmmyyyyToIso("12/10/26")).toBeNull();
    expect(ddmmyyyyToIso("")).toBeNull();
  });
});
