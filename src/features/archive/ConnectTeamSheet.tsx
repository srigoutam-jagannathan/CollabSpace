import { useEffect, useState, useCallback } from "react";
import { View, Text, Modal, Animated, ScrollView, ActivityIndicator } from "react-native";
import { supabase } from "@/lib/supabaseClient";
import { requestConnection } from "@/lib/requestConnection";
import { SheetBackdrop, SheetSurface } from "@/components/SheetBackdrop";
import { Avatar } from "@/components/Avatar";
import { Btn } from "@/components/Btn";
import { useAuth } from "@/features/auth/AuthContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { FONT } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { s, vs, fs, H } from "@/utils/scale";
import { fetchTeam } from "./queries";
import type { ArchiveMember } from "./types";

function initials(name: string | null): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

type Status = "none" | "pending" | "accepted" | "declined" | "sending" | "failed";

/**
 * The archive's primary action: connect with the people who shipped it.
 *
 * Each member gets their own button rather than one bulk "connect with all",
 * because a connection request is a message to a person and sending five
 * identical ones in a single tap is how a network gets a spam reputation.
 */
export function ConnectTeamSheet({
  visible, projectId, projectTitle, onClose,
}: {
  visible: boolean;
  projectId: string;
  projectTitle: string;
  onClose: () => void;
}) {
  const { tokens: { C } } = useTheme();
  const { user } = useAuth();
  const reducedMotion = useReducedMotion();
  const [slideAnim] = useState(() => new Animated.Value(H));

  const [team, setTeam] = useState<ArchiveMember[]>([]);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (reducedMotion) {
      slideAnim.setValue(visible ? 0 : H);
      return;
    }
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 24, stiffness: 220 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: H, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible, reducedMotion, slideAnim]);

  const load = useCallback(async () => {
    if (!visible || !user?.id) return;
    setLoading(true);
    setNotice(null);

    const members = (await fetchTeam(projectId)).filter(m => m.id !== user.id);
    const { data: connections } = await supabase
      .from("connections")
      .select("requester_id, recipient_id, status")
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .limit(500);

    const existing: Record<string, Status> = {};
    (connections ?? []).forEach((c: any) => {
      const other = c.requester_id === user.id ? c.recipient_id : c.requester_id;
      if (c.status === "accepted" || c.status === "pending") existing[other] = c.status;
    });

    setTeam(members);
    setStatuses(existing);
    setLoading(false);
  }, [visible, user?.id, projectId]);

  useEffect(() => { load(); }, [load]);

  async function connect(memberId: string) {
    if (!user?.id) return;
    setStatuses(prev => ({ ...prev, [memberId]: "sending" }));
    setNotice(null);

    // Same RPC as the profile screen's connect, deliberately.
    const result = await requestConnection(memberId);

    const next: Status = result.ok ? "pending"
      : result.reason === "exists" ? "pending"
      : result.reason === "too_soon" ? "declined"
      : "failed";
    setStatuses(prev => ({ ...prev, [memberId]: next }));
    if (!result.ok && result.reason !== "failed") setNotice(result.message);
  }

  function labelFor(status: Status): string {
    if (status === "accepted") return "Connected";
    if (status === "pending") return "Requested";
    if (status === "declined") return "Declined";
    if (status === "sending") return "Sending…";
    if (status === "failed") return "Try again";
    return "Connect";
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}
           statusBarTranslucent navigationBarTranslucent>
      <SheetBackdrop onPress={onClose} />

      <Animated.View
        style={{
          transform: [{ translateY: slideAnim }],
          maxHeight: H * 0.7,
        }}
      >
        <SheetSurface
          contentStyle={{ paddingHorizontal: s(20), paddingTop: vs(18), paddingBottom: vs(34) }}
        >
        <Text accessibilityRole="header" style={{
          color: C.white, fontFamily: FONT.extraBold, fontSize: fs(17), marginBottom: vs(3),
        }}>
          The team behind {projectTitle}
        </Text>
        <Text style={{
          color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12), marginBottom: vs(14),
        }}>
          Connect with them individually.
        </Text>

        {notice && (
          <Text style={{
            color: C.danger, fontFamily: FONT.regular, fontSize: fs(12), marginBottom: vs(10),
          }}>
            {notice}
          </Text>
        )}

        {loading ? (
          <View style={{ paddingVertical: vs(30) }}>
            <ActivityIndicator size="small" color={C.purpleL} />
          </View>
        ) : team.length === 0 ? (
          <Text style={{
            color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13),
            paddingVertical: vs(24), textAlign: "center",
          }}>
            No one else is listed on this project.
          </Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {team.map(member => {
              const status = statuses[member.id] ?? "none";
              const settled = status === "accepted" || status === "pending" || status === "declined";
              return (
                <View
                  key={member.id}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: s(12),
                    paddingVertical: vs(9),
                  }}
                >
                  <Avatar url={member.avatar_url} initials={initials(member.full_name)} size={s(40)} />
                  <Text style={{
                    flex: 1, color: C.white, fontFamily: FONT.bold, fontSize: fs(13),
                  }} numberOfLines={1}>
                    {member.full_name ?? "Unknown"}
                  </Text>
                  <Btn
                    onPress={() => connect(member.id)}
                    disabled={settled || status === "sending"}
                    accessibilityLabel={`${labelFor(status)} — ${member.full_name ?? "this person"}`}
                    style={{
                      minHeight: 44, justifyContent: "center",
                      paddingHorizontal: s(14), borderRadius: s(10),
                      borderWidth: 1,
                      borderColor: settled ? C.border : C.borderBright,
                    }}
                  >
                    <Text style={{
                      color: settled ? C.textFaint : C.purpleL,
                      fontFamily: FONT.bold, fontSize: fs(11.5),
                    }}>
                      {labelFor(status)}
                    </Text>
                  </Btn>
                </View>
              );
            })}
          </ScrollView>
        )}
        </SheetSurface>
      </Animated.View>
    </Modal>
  );
}
