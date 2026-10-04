const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Sends one push through the Expo Push API and returns its JSON reply. */
export async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  fetchFn: typeof fetch = fetch,
): Promise<unknown> {
  const res = await fetchFn(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: token, title, body, sound: "default" }),
  });
  return await res.json();
}
