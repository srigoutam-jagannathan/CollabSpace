import { useLocalSearchParams } from "expo-router";
import HandshakeChat from "@/features/chat/HandshakeChat";

export default function ChatRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HandshakeChat projectId={id} />;
}
