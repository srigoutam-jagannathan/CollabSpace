import { Alert, Linking } from "react-native";
import { openLink } from "./openLink";

afterEach(() => jest.restoreAllMocks());

test("a bare domain gets https://", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  await openLink("  ana.dev ");
  expect(open).toHaveBeenCalledWith("https://ana.dev");
});

test("a URL with a scheme is left unchanged", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  await openLink("https://x.io");
  expect(open).toHaveBeenCalledWith("https://x.io");
});

test("a rejected openURL shows an alert and does not throw", async () => {
  jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("nope"));
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await expect(openLink("https://x.io")).resolves.toBeUndefined();
  expect(alert).toHaveBeenCalledWith("Can't open this link", "https://x.io");
});
