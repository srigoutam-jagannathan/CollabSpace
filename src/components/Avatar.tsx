import { View, Text, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s } from "@/utils/scale";

type Props = {
  url?: string | null;
  initials: string;
  size: number;        // already-scaled diameter (e.g. pass s(96))
  ring?: boolean;      // gradient ring (own profile view)
  bgColor?: string;    // custom bg when no image; defaults vary by ring
  hasUnread?: boolean; // pink dot for chat list
};

export function Avatar({ url, initials, size, ring = false, bgColor, hasUnread = false }: Props) {
  const { tokens: { C, GRADIENT } } = useTheme();
  const radius = size / 2;
  const innerSize = ring ? size - 6 : size;
  const innerRadius = ring ? radius - 3 : radius;
  const fontSize = Math.round(size * 0.3);
  const bg = bgColor ?? (ring ? C.bgMid : C.avatarBg);

  const face = (
    <View style={{
      width: innerSize,
      height: innerSize,
      borderRadius: innerRadius,
      backgroundColor: bg,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    }}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: innerSize, height: innerSize }} />
      ) : (
        <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize }}>{initials}</Text>
      )}
    </View>
  );

  return (
    <View style={{ position: "relative" }}>
      {ring ? (
        <LinearGradient
          colors={GRADIENT.cta}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: size, height: size, borderRadius: radius, padding: 3 }}
        >
          {face}
        </LinearGradient>
      ) : (
        face
      )}
      {hasUnread && (
        <View style={{
          position: "absolute", top: 1, right: 1,
          width: s(11), height: s(11), borderRadius: s(6),
          backgroundColor: C.pink, borderWidth: 2, borderColor: "#120908",
        }} />
      )}
    </View>
  );
}
