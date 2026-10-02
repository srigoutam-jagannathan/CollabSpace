import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ShieldX } from "lucide-react-native";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Belfast Lock rejection screen.
 * Shown when a user successfully authenticates with Microsoft but
 * their email domain is not on the allowlist.
 */
export default function AccessRestrictedScreen() {
  const { restrictedEmail } = useAuth();
  const router = useRouter();

  return (
    <View className="flex-1 bg-app items-center justify-center px-8">
      <View className="w-20 h-20 rounded-full bg-red-900/30 items-center justify-center mb-6">
        <ShieldX size={40} color="#ef4444" />
      </View>

      <Text className="text-white text-2xl font-bold text-center mb-3">
        Access Restricted
      </Text>

      <Text className="text-slate-400 text-base text-center leading-6 mb-2">
        CollabSpace is currently exclusive to students at Queen&apos;s University Belfast
        and Ulster University.
      </Text>

      {restrictedEmail && (
        <View className="mt-4 px-4 py-3 rounded-lg bg-surface-card border border-surface-border w-full">
          <Text className="text-slate-500 text-xs mb-1">Signed in as</Text>
          <Text className="text-slate-300 text-sm font-medium" numberOfLines={1}>
            {restrictedEmail}
          </Text>
          <Text className="text-red-400 text-xs mt-1">
            This domain is not authorised.
          </Text>
        </View>
      )}

      <Text className="text-slate-500 text-sm text-center mt-6 leading-5">
        Eligible domains: @qub.ac.uk · @ulster.ac.uk
      </Text>

      <Pressable
        onPress={() => router.replace("/(auth)/sign-in")}
        className="mt-8 w-full border border-surface-border rounded-xl py-4 items-center"
      >
        <Text className="text-slate-300 font-medium">Try a different account</Text>
      </Pressable>
    </View>
  );
}
