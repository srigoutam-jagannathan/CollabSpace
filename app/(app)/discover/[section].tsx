import { useLocalSearchParams } from "expo-router";
import { SectionListScreen } from "@/features/discover/SectionListScreen";

export default function DiscoverSectionRoute() {
  const { section } = useLocalSearchParams<{ section: string }>();
  return <SectionListScreen section={section ?? "needs"} />;
}
