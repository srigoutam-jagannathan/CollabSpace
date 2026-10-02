import { File } from "expo-file-system";
import { supabase } from "@/lib/supabaseClient";

/**
 * Uploads a picked JPEG to Supabase Storage, replacing any object already at
 * `path`, and returns its public URL with a cache-busting stamp.
 *
 * The bytes are read and sent directly. Expo SDK 57 replaces the global fetch
 * with expo/fetch, which cannot serialise React Native's `{ uri, name, type }`
 * FormData parts and throws "Unsupported FormDataPart implementation".
 */
export async function uploadJpeg(bucket: string, path: string, localUri: string): Promise<string> {
  const bytes = await new File(localUri).arrayBuffer();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
