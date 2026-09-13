import { Redirect } from "expo-router";

export default function SignUpRedirect() {
  return <Redirect href="/(auth)/onboarding" />;
}
