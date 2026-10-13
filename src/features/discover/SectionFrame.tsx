import { View, Text } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Btn } from "@/components/Btn";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs } from "@/utils/scale";
import { SectionSkeleton, type SkeletonShape } from "./SectionSkeleton";

interface Props {
  title: string;
  /** False hides the whole section — header included. */
  visible: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSeeAll?: () => void;
  /** Shape the first-load placeholder borrows from this section. */
  skeleton: SkeletonShape;
  children: React.ReactNode;
}

export function SectionFrame({
  title, visible, loading, error, onRetry, onSeeAll, skeleton, children,
}: Props) {
  const { tokens: { C } } = useTheme();

  // Nothing to say — render nothing at all, not an empty placeholder.
  if (!visible && !loading && !error) return null;

  return (
    <View style={{ marginBottom: vs(16) }}>
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: s(20), marginBottom: vs(8),
      }}>
        <Text
          accessibilityRole="header"
          style={{
            color: C.purpleL, fontFamily: FONT.bold, fontSize: fs(10),
            letterSpacing: 1.1, textTransform: "uppercase",
          }}
        >
          {title}
        </Text>
        {onSeeAll && (
          <Btn
            onPress={onSeeAll}
            hitSlop={12}
            accessibilityLabel={`See all ${title}`}
            style={{ padding: s(4) }}
          >
            <ChevronRight size={s(16)} color={C.textFaint} />
          </Btn>
        )}
      </View>

      {loading && <SectionSkeleton shape={skeleton} />}

      {error && (
        <View style={{
          marginHorizontal: s(20), padding: s(12), borderRadius: s(12),
          borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s(10),
        }}>
          <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12), flex: 1 }}>
            {error}
          </Text>
          <Btn
            onPress={onRetry}
            accessibilityLabel={`Retry loading ${title}`}
            style={{
              paddingHorizontal: s(12), paddingVertical: vs(6), borderRadius: s(9),
              borderWidth: 1, borderColor: C.borderBright,
            }}
          >
            <Text style={{ color: C.purpleL, fontFamily: FONT.bold, fontSize: fs(11) }}>Retry</Text>
          </Btn>
        </View>
      )}

      {!loading && !error && children}
    </View>
  );
}
