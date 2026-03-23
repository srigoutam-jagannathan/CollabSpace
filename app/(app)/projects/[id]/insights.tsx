import { useLocalSearchParams } from "expo-router";
import ProjectInsights from "@/features/projects/ProjectInsights";

export default function InsightsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProjectInsights projectId={id} />;
}
