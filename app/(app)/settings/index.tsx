import { useState, useCallback } from "react";
import type { ReactNode } from "react";
import {
  View, Text, ScrollView, Switch, Alert, Linking, ActivityIndicator, Pressable, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import {
  ChevronLeft, ChevronRight,
  Pencil, Code2, KeyRound, Link,
  UserPlus, MessageCircle, Briefcase, Users,
  BadgeCheck, Eye,
  Info, Shield, FileText, Bug,
  LogOut, Trash2,
  Sun, DoorOpen,
} from "lucide-react-native";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { QuitProjectSheet } from "@/components/QuitProjectSheet";
import { Btn } from "@/components/Btn";
import { FONT } from "@/utils/theme";
import { s, vs, fs } from "@/utils/scale";
import { useTheme } from "@/contexts/ThemeContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifPrefs = {
  connectionRequests: boolean;
  newMessages: boolean;
  projectUpdates: boolean;
  joinRequests: boolean;
};

type PrivacyPrefs = {
  profileVisibility: "public" | "university_only" | "private";
  showUniversityBadge: boolean;
};

const NOTIF_DEFAULTS: NotifPrefs = {
  connectionRequests: true,
  newMessages: true,
  projectUpdates: true,
  joinRequests: true,
};

const PRIVACY_DEFAULTS: PrivacyPrefs = {
  profileVisibility: "public",
  showUniversityBadge: true,
};

const NOTIF_KEY = "notif_prefs";
const PRIVACY_KEY = "privacy_prefs";

function isEmailPasswordUser(user: any): boolean {
  return user?.identities?.some((id: any) => id.provider === "email") ?? false;
}

// ─── SettingsSection ──────────────────────────────────────────────────────────

function SettingsSection({ label, children }: { label: string; children: ReactNode }) {
  const { tokens: { C } } = useTheme();
  return (
    <View style={{ marginBottom: vs(24) }}>
      <Text style={{
        color: C.textMuted,
        fontFamily: FONT.semiBold,
        fontSize: fs(11),
        textTransform: "uppercase",
        letterSpacing: 0.8,
        paddingHorizontal: s(20),
        marginBottom: vs(8),
      }}>
        {label}
      </Text>
      <View style={{
        marginHorizontal: s(16),
        backgroundColor: C.surface,
        borderRadius: s(16),
        borderWidth: 1,
        borderColor: C.border,
        overflow: "hidden",
      }}>
        {children}
      </View>
    </View>
  );
}

// ─── SettingsRow ──────────────────────────────────────────────────────────────

type RowBase = { label: string; icon: ReactNode; iconBg: string; isLast?: boolean };
type NavRow    = RowBase & { kind: "nav";    onPress: () => void; navValue?: string };
type ToggleRow = RowBase & { kind: "toggle"; value: boolean; onToggle: (v: boolean) => void };
type InfoRow   = RowBase & { kind: "info";   value: string };
type RowProps  = NavRow | ToggleRow | InfoRow;

function SettingsRow(props: RowProps) {
  const { tokens: { C } } = useTheme();
  const inner = (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: s(16),
      paddingVertical: vs(13),
      borderBottomWidth: props.isLast ? 0 : 1,
      borderBottomColor: C.border,
    }}>
      <View style={{
        width: s(32), height: s(32), borderRadius: s(8),
        backgroundColor: props.iconBg,
        alignItems: "center", justifyContent: "center",
        marginRight: s(12),
      }}>
        {props.icon}
      </View>

      <Text style={{ flex: 1, color: C.white, fontFamily: FONT.regular, fontSize: fs(15) }}>
        {props.label}
      </Text>

      {props.kind === "nav" && (
        <>
          {props.navValue != null && (
            <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13), marginRight: s(6) }}>
              {props.navValue}
            </Text>
          )}
          <ChevronRight size={s(16)} color={C.textMuted} strokeWidth={1.8} />
        </>
      )}
      {props.kind === "toggle" && (
        <Switch
          value={props.value}
          onValueChange={props.onToggle}
          trackColor={{ false: C.switchTrackOff, true: C.purple }}
          thumbColor={C.white}
          ios_backgroundColor={C.switchTrackOff}
        />
      )}
      {props.kind === "info" && (
        <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13) }}>
          {props.value}
        </Text>
      )}
    </View>
  );

  if (props.kind === "nav") {
    return <Btn onPress={props.onPress} pressScale={0.97}>{inner}</Btn>;
  }
  return inner;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type OwnedProject = { id: string; title: string };
type MemberProject = { projectId: string; role: string; title: string };

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { mode, setMode, tokens: { C } } = useTheme();
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(NOTIF_DEFAULTS);
  const [privacyPrefs, setPrivacyPrefs] = useState<PrivacyPrefs>(PRIVACY_DEFAULTS);
  const [deleting, setDeleting] = useState(false);
  const [ownedProjects, setOwnedProjects] = useState<OwnedProject[]>([]);
  const [memberProjects, setMemberProjects] = useState<MemberProject[]>([]);
  const [quitTarget, setQuitTarget] = useState<MemberProject | null>(null);
  const [myFullName, setMyFullName] = useState("");

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const emailPw = isEmailPasswordUser(user);

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        AsyncStorage.getItem(NOTIF_KEY),
        AsyncStorage.getItem(PRIVACY_KEY),
      ]).then(([notifRaw, privacyRaw]) => {
        if (notifRaw) setNotifPrefs({ ...NOTIF_DEFAULTS, ...JSON.parse(notifRaw) });
        if (privacyRaw) setPrivacyPrefs({ ...PRIVACY_DEFAULTS, ...JSON.parse(privacyRaw) });
      });

      if (!user) return;
      Promise.all([
        supabase.from("projects").select("id, title").eq("owner_id", user.id),
        supabase
          .from("project_members")
          .select("project_id, role, projects(id, title)")
          .eq("user_id", user.id),
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      ]).then(([ownedRes, memberRes, profileRes]) => {
        setOwnedProjects(
          (ownedRes.data ?? []).map((p: any) => ({ id: p.id, title: p.title }))
        );
        setMemberProjects(
          (memberRes.data ?? []).map((m: any) => ({
            projectId: m.project_id,
            role: m.role ?? "Member",
            title: (m.projects as any)?.title ?? "Unknown Project",
          }))
        );
        if (profileRes.data) setMyFullName(profileRes.data.full_name ?? "");
      });
    }, [user])
  );

  async function updateNotif<K extends keyof NotifPrefs>(key: K, value: boolean) {
    const next = { ...notifPrefs, [key]: value };
    setNotifPrefs(next);
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(next));
  }

  async function updatePrivacy<K extends keyof PrivacyPrefs>(key: K, value: PrivacyPrefs[K]) {
    const next = { ...privacyPrefs, [key]: value };
    setPrivacyPrefs(next);
    await AsyncStorage.setItem(PRIVACY_KEY, JSON.stringify(next));
  }

  function handleSignOut() {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: () => signOut() },
      ]
    );
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all associated data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => Alert.alert(
            "Final Confirmation",
            "Your account, projects, and collaboration history will be permanently deleted.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete My Account",
                style: "destructive",
                onPress: async () => {
                  setDeleting(true);
                  try {
                    const { error } = await supabase.functions.invoke("delete-account");
                    if (error) throw error;
                    await signOut();
                  } catch {
                    Alert.alert("Error", "Account deletion is not yet available. Please contact support@collabspace.app.");
                  } finally {
                    setDeleting(false);
                  }
                },
              },
            ]
          ),
        },
      ]
    );
  }

  const visibilityOptions: { label: string; value: PrivacyPrefs["profileVisibility"] }[] = [
    { label: "Public", value: "public" },
    { label: "University", value: "university_only" },
    { label: "Private", value: "private" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      {deleting && (
        <View style={{
          position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center", justifyContent: "center",
          zIndex: 100,
        }}>
          <ActivityIndicator size="large" color={C.pink} />
        </View>
      )}

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: s(20), paddingTop: vs(8), paddingBottom: vs(20) }}>
        <Btn onPress={() => router.back()} pressScale={0.9} hitSlop={12}>
          <ChevronLeft size={s(22)} color={C.textMuted} strokeWidth={2} />
        </Btn>
        <Text style={{ color: C.white, fontFamily: FONT.extraBold, fontSize: fs(22), marginLeft: s(12) }}>
          Settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: vs(48) }} showsVerticalScrollIndicator={false}>

        {/* APPEARANCE */}
        <SettingsSection label="Appearance">
          <SettingsRow
            kind="toggle"
            label="Light Mode"
            icon={<Sun size={s(16)} color={C.white} strokeWidth={1.8} />}
            iconBg="rgba(192,133,82,0.70)"
            value={mode === "light"}
            onToggle={(v) => setMode(v ? "light" : "dark")}
            isLast
          />
        </SettingsSection>

        {/* MY ACCOUNT */}
        <SettingsSection label="My Account">
          <SettingsRow
            kind="nav" label="Edit Profile"
            icon={<Pencil size={s(16)} color={C.white} strokeWidth={1.8} />}
            iconBg="rgba(192,133,82,0.70)"
            onPress={() => router.push("/(app)/settings/edit-profile")}
          />
          <SettingsRow
            kind="nav" label="Edit Skills"
            icon={<Code2 size={s(16)} color={C.white} strokeWidth={1.8} />}
            iconBg="rgba(140,90,60,0.70)"
            onPress={() => router.push({ pathname: "/(app)/settings/skills", params: { from: "settings" } })}
          />
          <SettingsRow
            kind="nav" label="Portfolio Links"
            icon={<Link size={s(16)} color={C.white} strokeWidth={1.8} />}
            iconBg="rgba(140,90,60,0.55)"
            onPress={() => router.push("/(app)/settings/portfolio-links" as any)}
            isLast={!emailPw}
          />
          {emailPw && (
            <SettingsRow
              kind="nav" label="Change Password"
              icon={<KeyRound size={s(16)} color={C.white} strokeWidth={1.8} />}
              iconBg="rgba(192,133,82,0.55)"
              onPress={() => router.push("/(app)/settings/change-password")}
              isLast
            />
          )}
        </SettingsSection>

        {/* NOTIFICATIONS */}
        <SettingsSection label="Notifications">
          <SettingsRow
            kind="toggle" label="Connection Requests"
            icon={<UserPlus size={s(16)} color={C.white} strokeWidth={1.8} />}
            iconBg="rgba(192,133,82,0.70)"
            value={notifPrefs.connectionRequests}
            onToggle={(v) => updateNotif("connectionRequests", v)}
          />
          <SettingsRow
            kind="toggle" label="New Messages"
            icon={<MessageCircle size={s(16)} color={C.white} strokeWidth={1.8} />}
            iconBg="rgba(192,133,82,0.55)"
            value={notifPrefs.newMessages}
            onToggle={(v) => updateNotif("newMessages", v)}
          />
          <SettingsRow
            kind="toggle" label="Project Updates"
            icon={<Briefcase size={s(16)} color={C.white} strokeWidth={1.8} />}
            iconBg="rgba(140,90,60,0.70)"
            value={notifPrefs.projectUpdates}
            onToggle={(v) => updateNotif("projectUpdates", v)}
          />
          <SettingsRow
            kind="toggle" label="Join Requests"
            icon={<Users size={s(16)} color={C.white} strokeWidth={1.8} />}
            iconBg="rgba(140,90,60,0.70)"
            value={notifPrefs.joinRequests}
            onToggle={(v) => updateNotif("joinRequests", v)}
            isLast
          />
        </SettingsSection>

        {/* PRIVACY */}
        <SettingsSection label="Privacy">
          <View style={{ paddingHorizontal: s(16), paddingTop: vs(14), paddingBottom: vs(12), borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(11), textTransform: "uppercase", letterSpacing: 0.6, marginBottom: vs(10) }}>
              Profile Visibility
            </Text>
            <View style={{ flexDirection: "row", gap: s(6), backgroundColor: C.fieldBg, borderRadius: s(12), padding: s(5) }}>
              {visibilityOptions.map((opt) => {
                const active = privacyPrefs.profileVisibility === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => updatePrivacy("profileVisibility", opt.value)}
                    style={{ flex: 1 }}
                  >
                    <View style={{
                      paddingVertical: vs(11),
                      borderRadius: s(9),
                      alignItems: "center",
                      backgroundColor: active ? C.purple : "transparent",
                    }}>
                      <Text style={{
                        color: active ? C.white : C.textMuted,
                        fontFamily: active ? FONT.bold : FONT.regular,
                        fontSize: fs(13),
                      }}>
                        {opt.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <SettingsRow
            kind="toggle" label="Show University Badge"
            icon={<BadgeCheck size={s(16)} color={C.white} strokeWidth={1.8} />}
            iconBg="rgba(192,133,82,0.70)"
            value={privacyPrefs.showUniversityBadge}
            onToggle={(v) => updatePrivacy("showUniversityBadge", v)}
            isLast
          />
        </SettingsSection>

        {/* ABOUT */}
        <SettingsSection label="About">
          <SettingsRow
            kind="info" label="App Version"
            icon={<Info size={s(16)} color={C.white} strokeWidth={1.8} />}
            iconBg="rgba(75,46,43,0.70)"
            value={`v${appVersion}`}
          />
          <SettingsRow
            kind="nav" label="Privacy Policy"
            icon={<Shield size={s(16)} color={C.white} strokeWidth={1.8} />}
            iconBg="rgba(75,46,43,0.70)"
            onPress={() => Linking.openURL("https://collabspace.app/privacy")}
          />
          <SettingsRow
            kind="nav" label="Terms of Service"
            icon={<FileText size={s(16)} color={C.white} strokeWidth={1.8} />}
            iconBg="rgba(75,46,43,0.70)"
            onPress={() => Linking.openURL("https://collabspace.app/terms")}
          />
          <SettingsRow
            kind="nav" label="Report a Bug"
            icon={<Bug size={s(16)} color={C.white} strokeWidth={1.8} />}
            iconBg="rgba(75,46,43,0.70)"
            onPress={() => Linking.openURL("mailto:support@collabspace.app?subject=Bug%20Report")}
            isLast
          />
        </SettingsSection>

        {/* MY PROJECTS */}
        {(ownedProjects.length > 0 || memberProjects.length > 0) && (
          <View style={{ marginBottom: vs(24) }}>
            <Text style={{
              color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(11),
              textTransform: "uppercase", letterSpacing: 0.8,
              paddingHorizontal: s(20), marginBottom: vs(8),
            }}>
              My Projects
            </Text>
            <View style={{ marginHorizontal: s(16), backgroundColor: C.surface, borderRadius: s(16), borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
              {ownedProjects.map((p, i) => (
                <Btn
                  key={p.id}
                  onPress={() => router.push({ pathname: "/(app)/projects/[id]/preview", params: { id: p.id } })}
                  pressScale={0.97}
                >
                  <View style={{
                    flexDirection: "row", alignItems: "center",
                    paddingHorizontal: s(16), paddingVertical: vs(13),
                    borderBottomWidth: (i < ownedProjects.length - 1 || memberProjects.length > 0) ? 1 : 0,
                    borderBottomColor: C.border,
                  }}>
                    <View style={{ width: s(32), height: s(32), borderRadius: s(8), backgroundColor: "rgba(107,79,160,0.25)", alignItems: "center", justifyContent: "center", marginRight: s(12) }}>
                      <Briefcase size={s(15)} color={C.purpleL} strokeWidth={1.8} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.white, fontFamily: FONT.regular, fontSize: fs(15) }}>{p.title}</Text>
                      <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12), marginTop: vs(1) }}>Owner</Text>
                    </View>
                    <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13), marginRight: s(4) }}>Manage</Text>
                    <ChevronRight size={s(16)} color={C.textMuted} strokeWidth={1.8} />
                  </View>
                </Btn>
              ))}
              {memberProjects.map((m, i) => (
                <View
                  key={m.projectId}
                  style={{
                    flexDirection: "row", alignItems: "center",
                    paddingHorizontal: s(16), paddingVertical: vs(13),
                    borderBottomWidth: i < memberProjects.length - 1 ? 1 : 0,
                    borderBottomColor: C.border,
                  }}
                >
                  <View style={{ width: s(32), height: s(32), borderRadius: s(8), backgroundColor: "rgba(107,79,160,0.12)", alignItems: "center", justifyContent: "center", marginRight: s(12) }}>
                    <Users size={s(15)} color={C.textMuted} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.white, fontFamily: FONT.regular, fontSize: fs(15) }}>{m.title}</Text>
                    <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(12), marginTop: vs(1) }}>{m.role}</Text>
                  </View>
                  <Pressable
                    onPress={() => setQuitTarget(m)}
                    hitSlop={12}
                  >
                    <Text style={{ color: C.danger, fontFamily: FONT.semiBold, fontSize: fs(13) }}>Quit</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        <QuitProjectSheet
          visible={!!quitTarget}
          projectTitle={quitTarget?.title ?? ""}
          onClose={() => setQuitTarget(null)}
          onQuit={async () => {
            if (!quitTarget || !user) return;
            await supabase.from("project_members").delete()
              .eq("project_id", quitTarget.projectId).eq("user_id", user.id);
            await supabase.from("collaboration_events").insert({
              project_id: quitTarget.projectId, user_id: user.id, event_type: "member_quit",
            });
            await supabase.from("chat_messages").insert({
              project_id: quitTarget.projectId, sender_id: user.id,
              type: "member_left", content: "",
              metadata: { userName: myFullName || "A user" },
              read_by: [],
            });
            await supabase.functions.invoke("notify-owner", {
              body: {
                projectId: quitTarget.projectId,
                title: `${myFullName || "A member"} left ${quitTarget.title}`,
                body: `${myFullName || "A member"} has left the project.`,
              },
            });
            setQuitTarget(null);
            setMemberProjects((prev) => prev.filter((p) => p.projectId !== quitTarget.projectId));
          }}
        />

        {/* ACCOUNT ACTIONS */}
        <SettingsSection label="Account">
          <SettingsRow
            kind="nav" label="Sign Out"
            icon={<LogOut size={s(16)} color={C.danger} strokeWidth={1.8} />}
            iconBg="rgba(248,113,113,0.12)"
            onPress={handleSignOut}
          />
          <SettingsRow
            kind="nav" label="Delete Account"
            icon={<Trash2 size={s(16)} color={C.danger} strokeWidth={1.8} />}
            iconBg="rgba(248,113,113,0.12)"
            onPress={handleDeleteAccount}
            isLast
          />
        </SettingsSection>

      </ScrollView>
    </SafeAreaView>
  );
}
