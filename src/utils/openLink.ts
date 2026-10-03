import { Alert, Linking } from "react-native";

/** Open a user-typed URL. A bare "ana.dev" gets https://; failures show an alert instead of rejecting. */
export async function openLink(url: string): Promise<void> {
  let u = url.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = `https://${u}`;
  try {
    await Linking.openURL(u);
  } catch {
    Alert.alert("Can't open this link", u);
  }
}
