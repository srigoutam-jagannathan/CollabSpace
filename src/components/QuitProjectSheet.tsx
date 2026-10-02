import { useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  Animated,
} from "react-native";
import { DoorOpen } from "lucide-react-native";
import { FONT } from "@/utils/theme";
import { SheetBackdrop, SheetSurface } from "@/components/SheetBackdrop";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs, H } from "@/utils/scale";

type Props = {
  visible: boolean;
  projectTitle: string;
  onClose: () => void;
  onQuit: () => void | Promise<void>;
};

export function QuitProjectSheet({ visible, projectTitle, onClose, onQuit }: Props) {
  const { tokens: { C } } = useTheme();
  const slideAnim = useRef(new Animated.Value(H)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 24,
        stiffness: 220,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: H,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}
           statusBarTranslucent navigationBarTranslucent>
      <SheetBackdrop onPress={onClose} />

      <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
        <SheetSurface contentStyle={{ gap: vs(16) }}>
          {/* Handle */}
          <View style={{ alignSelf: "center", width: s(36), height: 4, borderRadius: 2, backgroundColor: C.surface, marginBottom: vs(4) }} />

          {/* Icon + headline */}
          <View style={{ alignItems: "center", gap: vs(12) }}>
            <View style={{
              width: s(56), height: s(56), borderRadius: s(16),
              backgroundColor: "rgba(248,113,113,0.10)",
              borderWidth: 1, borderColor: "rgba(248,113,113,0.20)",
              alignItems: "center", justifyContent: "center",
            }}>
              <DoorOpen size={s(24)} color={C.danger} strokeWidth={1.8} />
            </View>

            <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(20), textAlign: "center" }}>
              Leave Project?
            </Text>

            <Text style={{
              color: C.white,
              fontFamily: FONT.bold,
              fontSize: fs(15),
              textAlign: "center",
            }}>
              {projectTitle}
            </Text>

            <Text style={{
              color: C.textMuted,
              fontFamily: FONT.regular,
              fontSize: fs(13),
              textAlign: "center",
              lineHeight: vs(20),
            }}>
              You'll lose access to the chat and collaboration history.
            </Text>
          </View>

          {/* Leave button */}
          <Pressable
            onPress={onQuit}
            accessibilityRole="button"
            accessibilityLabel="Confirm leaving the project"
            style={({ pressed }) => ({
              backgroundColor: pressed ? "rgba(248,113,113,0.20)" : "rgba(248,113,113,0.14)",
              borderWidth: 1,
              borderColor: "rgba(248,113,113,0.35)",
              borderRadius: s(14),
              paddingVertical: vs(15),
              alignItems: "center",
              marginTop: vs(4),
            })}
          >
            <Text style={{ color: C.danger, fontFamily: FONT.bold, fontSize: fs(15) }}>
              Leave Project
            </Text>
          </Pressable>

          {/* Cancel */}
          <Pressable onPress={onClose} style={{ alignItems: "center", paddingVertical: vs(8) }}>
            <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(14) }}>
              Cancel
            </Text>
          </Pressable>
        </SheetSurface>
      </Animated.View>
    </Modal>
  );
}
