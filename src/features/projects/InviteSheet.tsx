import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { X, ChevronDown } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { SheetBackdrop, SheetSurface } from "@/components/SheetBackdrop";
import { useAuth } from "@/features/auth/AuthContext";
import { GradientBtn } from "@/components/GradientBtn";
import { Btn } from "@/components/Btn";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs, H } from "@/utils/scale";

type OwnedProject = {
  id: string;
  title: string;
  project_type: string | null;
  status: string;
};

type Props = {
  visible: boolean;
  talent: { id: string; full_name: string | null } | null;
  onClose: () => void;
  onSent: () => void;
};

export function InviteSheet({ visible, talent, onClose, onSent }: Props) {
  const { tokens: { C, GLASS } } = useTheme();
  const { user } = useAuth();
  const [slideAnim] = useState(() => new Animated.Value(H));

  const [ownedProjects, setOwnedProjects] = useState<OwnedProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingProjects, setFetchingProjects] = useState(false);

  const fetchOwnedProjects = useCallback(async () => {
    if (!user || !talent) return;
    setFetchingProjects(true);
    const [{ data: projects }, { data: memberships }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, title, project_type, status")
        .eq("owner_id", user.id)
        .eq("status", "recruiting")
        .order("created_at", { ascending: false }),
      supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", talent.id),
    ]);
    const alreadyMember = new Set((memberships ?? []).map((m: any) => m.project_id));
    setOwnedProjects(
      ((projects ?? []) as OwnedProject[]).filter((p) => !alreadyMember.has(p.id))
    );
    setFetchingProjects(false);
  }, [user, talent]);

  useEffect(() => {
    if (visible) {
      fetchOwnedProjects();
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 4,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: H,
        duration: 220,
        useNativeDriver: true,
      }).start();
      setSelectedProjectId(null);
      setRole("");
      setMessage("");
      setOwnedProjects([]);
    }
  }, [visible]);

  async function handleSend() {
    if (!user || !talent || !selectedProjectId || !role.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("collab_invitations").insert({
      project_id: selectedProjectId,
      sender_id: user.id,
      recipient_id: talent.id,
      role: role.trim(),
      message: message.trim(),
    });
    setLoading(false);
    if (error) {
      if (error.code === "23505") {
        Alert.alert("Already Invited", "You've already sent an invitation to this person for this project.");
      } else {
        Alert.alert("Error", error.message);
      }
      return;
    }
    onSent();
    onClose();
  }

  const canSend = !!selectedProjectId && role.trim().length > 0;
  const displayName = talent?.full_name ?? "this talent";

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}
           statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Backdrop */}
        <SheetBackdrop onPress={onClose} />

        <Animated.View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            transform: [{ translateY: slideAnim }],
            maxHeight: H * 0.88,
          }}
        >
          {/* Padding is zeroed: this sheet's sections carry their own. */}
          <SheetSurface contentStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}>
          {/* Drag handle */}
          <View style={{ alignItems: "center", paddingTop: vs(12), paddingBottom: vs(4) }}>
            <View style={{ width: s(36), height: vs(4), borderRadius: s(2), backgroundColor: C.borderSubtle }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: s(20), paddingBottom: vs(16) }}>
            <Text style={{ flex: 1, color: C.white, fontFamily: FONT.bold, fontSize: fs(17) }} numberOfLines={1}>
              Invite {displayName}
            </Text>
            <Btn onPress={onClose} pressScale={0.88} hitSlop={10}>
              <X size={s(20)} color={C.textMuted} strokeWidth={2} />
            </Btn>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: s(20), paddingBottom: vs(32) }}
          >
            {/* ── Select Project ── */}
            <View style={{ backgroundColor: GLASS.card.backgroundColor, borderWidth: 1, borderColor: GLASS.card.borderColor, borderRadius: s(16), padding: s(16), marginBottom: vs(14) }}>
              <Text style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(12), marginBottom: vs(12), textTransform: "uppercase", letterSpacing: 0.5 }}>
                Select Project
              </Text>

              {fetchingProjects ? (
                <ActivityIndicator size="small" color={C.purple} />
              ) : ownedProjects.length === 0 ? (
                <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13), textAlign: "center", paddingVertical: vs(8) }}>
                  No recruiting projects available.{"\n"}Create a project first.
                </Text>
              ) : (
                <View style={{ gap: vs(8) }}>
                  {ownedProjects.map((project) => {
                    const selected = project.id === selectedProjectId;
                    return (
                      <Btn
                        key={project.id}
                        onPress={() => setSelectedProjectId(project.id)}
                        pressScale={0.97}
                      >
                        <View style={{
                          borderRadius: s(12),
                          borderWidth: selected ? 2 : 1,
                          borderColor: selected ? C.purple : GLASS.chip.borderColor,
                          backgroundColor: selected ? "rgba(192,133,82,0.18)" : GLASS.chip.backgroundColor,
                          padding: s(12),
                          flexDirection: "row",
                          alignItems: "center",
                          gap: s(10),
                        }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: C.white, fontFamily: selected ? FONT.bold : FONT.semiBold, fontSize: fs(14) }} numberOfLines={1}>
                              {project.title}
                            </Text>
                            {project.project_type ? (
                              <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12), marginTop: vs(2) }}>
                                {project.project_type}
                              </Text>
                            ) : null}
                          </View>
                          {selected && (
                            <View style={{ width: s(18), height: s(18), borderRadius: s(9), backgroundColor: C.purple, alignItems: "center", justifyContent: "center" }}>
                              <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: C.white }} />
                            </View>
                          )}
                        </View>
                      </Btn>
                    );
                  })}
                </View>
              )}
            </View>

            {/* ── Role ── */}
            <View style={{ backgroundColor: GLASS.card.backgroundColor, borderWidth: 1, borderColor: GLASS.card.borderColor, borderRadius: s(16), padding: s(16), marginBottom: vs(14) }}>
              <Text style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(12), marginBottom: vs(10), textTransform: "uppercase", letterSpacing: 0.5 }}>
                Role <Text style={{ color: C.pink }}>*</Text>
              </Text>
              <TextInput
                value={role}
                onChangeText={setRole}
                placeholder="e.g. Backend Developer, Legal Advisor…"
                placeholderTextColor={C.textFaint}
                style={{
                  backgroundColor: C.inputBg,
                  borderRadius: s(10),
                  borderWidth: 1,
                  borderColor: role.trim() ? C.purple : C.borderSubtle,
                  color: C.white,
                  fontFamily: FONT.regular,
                  fontSize: fs(14),
                  paddingHorizontal: s(14),
                  paddingVertical: vs(11),
                }}
              />
            </View>

            {/* ── Message ── */}
            <View style={{ backgroundColor: GLASS.card.backgroundColor, borderWidth: 1, borderColor: GLASS.card.borderColor, borderRadius: s(16), padding: s(16), marginBottom: vs(24) }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: vs(10) }}>
                <Text style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(12), textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Message <Text style={{ color: C.textFaint, fontFamily: FONT.regular, textTransform: "none", letterSpacing: 0, fontSize: fs(11) }}>(optional)</Text>
                </Text>
                <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(11) }}>
                  {message.length}/300
                </Text>
              </View>
              <TextInput
                value={message}
                onChangeText={(t) => setMessage(t.slice(0, 300))}
                placeholder="Tell them why you'd love them on your team…"
                placeholderTextColor={C.textFaint}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: C.inputBg,
                  borderRadius: s(10),
                  borderWidth: 1,
                  borderColor: message.trim() ? C.purple : C.borderSubtle,
                  color: C.white,
                  fontFamily: FONT.regular,
                  fontSize: fs(14),
                  paddingHorizontal: s(14),
                  paddingVertical: vs(11),
                  minHeight: vs(100),
                  textAlignVertical: "top",
                }}
              />
            </View>

            <GradientBtn
              label={loading ? "Sending…" : "Send Invitation"}
              onPress={handleSend}
              disabled={!canSend || loading}
            />
          </ScrollView>
          </SheetSurface>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
