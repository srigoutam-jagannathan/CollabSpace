jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);

const mockArrayBuffer = jest.fn();
jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((uri: string) => ({ uri, arrayBuffer: mockArrayBuffer })),
}));

import { File } from "expo-file-system";
import { supabase } from "@/test/supabaseMock";
import { uploadJpeg } from "./uploadImage";

const upload = jest.fn();
const getPublicUrl = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockArrayBuffer.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
  upload.mockResolvedValue({ data: { path: "u1.jpg" }, error: null });
  getPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn/avatars/u1.jpg" } });
  supabase.storage.from.mockReturnValue({ upload, getPublicUrl });
});

test("uploads the picked file's bytes, not a React Native FormData part", async () => {
  // Expo SDK 57's fetch cannot serialise { uri, name, type } FormData parts
  // ("Unsupported FormDataPart implementation"), so the bytes go up directly.
  await uploadJpeg("avatars", "u1.jpg", "file:///cache/picked.jpg");
  expect(File).toHaveBeenCalledWith("file:///cache/picked.jpg");
  expect(supabase.storage.from).toHaveBeenCalledWith("avatars");
  const [path, body, options] = upload.mock.calls[0];
  expect(path).toBe("u1.jpg");
  expect(body).toBeInstanceOf(ArrayBuffer);
  expect(new Uint8Array(body)).toEqual(new Uint8Array([1, 2, 3]));
  expect(options).toEqual({ contentType: "image/jpeg", upsert: true });
});

test("returns the public URL with a cache-busting stamp", async () => {
  const url = await uploadJpeg("avatars", "u1.jpg", "file:///cache/picked.jpg");
  expect(getPublicUrl).toHaveBeenCalledWith("u1.jpg");
  expect(url).toMatch(/^https:\/\/cdn\/avatars\/u1\.jpg\?t=\d+$/);
});

test("surfaces a storage error instead of returning a URL", async () => {
  upload.mockResolvedValue({ data: null, error: new Error("new row violates row-level security policy") });
  await expect(uploadJpeg("avatars", "u1.jpg", "file:///x.jpg")).rejects.toThrow("row-level security");
  expect(getPublicUrl).not.toHaveBeenCalled();
});
