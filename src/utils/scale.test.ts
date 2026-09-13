import { PixelRatio } from "react-native";
import { s, ts, fs } from "./scale";

describe("ts", () => {
  afterEach(() => jest.restoreAllMocks());

  test("matches s() when the user has not enlarged text", () => {
    jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1);
    expect(ts(100)).toBeCloseTo(s(100));
  });

  test("grows a container in step with the text inside it", () => {
    jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1.5);
    expect(ts(100)).toBeCloseTo(s(100) * 1.5);
  });

  test("clamps at the 200% ceiling the spec names", () => {
    jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(3.5);
    expect(ts(100)).toBeCloseTo(s(100) * 2);
  });

  test("never shrinks a container below its design size", () => {
    jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(0.8);
    expect(ts(100)).toBeCloseTo(s(100));
  });
});

describe("fs", () => {
  test("does not apply the text-size setting a second time", () => {
    // <Text> already scales via allowFontScaling, which nothing overrides.
    // Applying getFontScale() here too would double it.
    const spy = jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(2);
    const atDouble = fs(16);
    spy.mockReturnValue(1);
    expect(fs(16)).toBe(atDouble);
    spy.mockRestore();
  });
});
