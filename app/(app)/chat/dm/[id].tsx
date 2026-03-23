import { useLocalSearchParams } from "expo-router";
import { DirectChat } from "@/features/chat/DirectChat";

export default function DMRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DirectChat connectionId={id} />;
}
