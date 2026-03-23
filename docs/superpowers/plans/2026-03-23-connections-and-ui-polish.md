# Connections System + UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-to-user connections system with DM chat, fix Discover tab/card spacing, and swap all fonts from Nunito to Lato.

**Architecture:** New `connections` + `direct_messages` Supabase tables back a full connect→approve→DM flow. Connection statuses are fetched at the feed level (single query) and passed to TalentCards. The DM screen (`DirectChat`) is a simplified version of `HandshakeChat` with no project/MOU elements. Font swap is a two-file change (theme + root layout). UI fixes are targeted edits to `DiscoveryFeed`.

**Tech Stack:** Expo Router v3, Supabase (Postgres + Realtime), React Native, `@expo-google-fonts/lato`, FlashList

**Spec:** `docs/superpowers/specs/2026-03-23-connections-and-ui-polish-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260323000003_connections.sql` | Create | `connections` + `direct_messages` tables, RLS, trigger, realtime |
| `src/utils/theme.ts` | Modify | `FONT` constants → Lato names |
| `app/_layout.tsx` | Modify | `useFonts` → Lato, `Text.defaultProps` → Lato |
| `src/features/projects/DiscoveryFeed.tsx` | Modify | Tab fix, card spacing, feed-level connection fetch, Connect button |
| `app/(app)/notifications.tsx` | Modify | Add "Connection Requests" section at top |
| `app/(app)/chat/index.tsx` | Modify | Replace mock individual chats with live connections query |
| `app/(app)/chat/dm/[id].tsx` | Create | DM route wrapper |
| `src/features/chat/DirectChat.tsx` | Create | DM component — bubbles, realtime, input |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260323000003_connections.sql`

**Key design note — canonical ordering + `initiated_by`:**
The `connections` table uses `CHECK (requester_id < recipient_id)` so the pair (A,B) can only exist once regardless of who connected whom. Because the canonical `requester_id` is always the lexicographically smaller UUID (not necessarily the user who clicked "Connect"), a separate `initiated_by` column stores the actual initiator. The INSERT RLS policy allows either canonical position to insert, gated on `initiated_by = auth.uid()`. Notification queries use `initiated_by != user.id` (not `recipient_id = user.id`) to find incoming requests.

- [ ] **Step 1: Write the migration file**

```sql
-- ── Connections ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Canonical: always the lexicographically smaller UUID
  requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  -- Canonical: always the lexicographically larger UUID
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  -- The user who actually clicked Connect (may be either canonical position)
  initiated_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (requester_id < recipient_id),
  UNIQUE (requester_id, recipient_id)
);

CREATE OR REPLACE FUNCTION update_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER connections_updated_at
  BEFORE UPDATE ON connections
  FOR EACH ROW EXECUTE FUNCTION update_connections_updated_at();

ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- Either party can see the connection
CREATE POLICY "connections_select" ON connections FOR SELECT USING (
  auth.uid() = requester_id OR auth.uid() = recipient_id
);
-- The initiator can insert (they may occupy either canonical position)
CREATE POLICY "connections_insert" ON connections FOR INSERT WITH CHECK (
  auth.uid() = initiated_by AND
  (auth.uid() = requester_id OR auth.uid() = recipient_id)
);
-- The non-initiating party (the one who received the request) can update status
CREATE POLICY "connections_update" ON connections FOR UPDATE USING (
  auth.uid() != initiated_by AND
  (auth.uid() = requester_id OR auth.uid() = recipient_id)
);

-- ── Direct Messages ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID REFERENCES connections(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dm_select" ON direct_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM connections c
    WHERE c.id = connection_id
      AND (c.requester_id = auth.uid() OR c.recipient_id = auth.uid())
      AND c.status = 'accepted'
  )
);
CREATE POLICY "dm_insert" ON direct_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM connections c
    WHERE c.id = connection_id
      AND (c.requester_id = auth.uid() OR c.recipient_id = auth.uid())
      AND c.status = 'accepted'
  )
);

ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
```

- [ ] **Step 2: Push migration**

```bash
supabase db push
```

Expected: migration applied. Verify in Supabase dashboard that `connections` and `direct_messages` tables exist with RLS enabled.

---

## Task 2: Font Swap — Nunito → Lato

**Files:**
- Modify: `src/utils/theme.ts`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Install Lato font package**

```bash
npx expo install @expo-google-fonts/lato
```

- [ ] **Step 2: Update `src/utils/theme.ts` FONT constants**

Find (lines 61–67):
```ts
export const FONT = {
  regular:   "Nunito_400Regular",
  medium:    "Nunito_500Medium",
  semiBold:  "Nunito_600SemiBold",
  bold:      "Nunito_700Bold",
  extraBold: "Nunito_800ExtraBold",
} as const;
```

Replace with:
```ts
// Lato weights: 400 Regular, 700 Bold, 900 Black (no 500/600 — medium collapses to regular intentionally)
export const FONT = {
  regular:   "Lato_400Regular",
  medium:    "Lato_400Regular",
  semiBold:  "Lato_700Bold",
  bold:      "Lato_700Bold",
  extraBold: "Lato_900Black",
} as const;
```

- [ ] **Step 3: Update `app/_layout.tsx` font loading**

Replace the Nunito import block:
```ts
import { useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";
```

With:
```ts
import { useFonts, Lato_400Regular, Lato_700Bold, Lato_900Black } from "@expo-google-fonts/lato";
```

Replace the `useFonts` call:
```ts
const [fontsLoaded] = useFonts({
  Lato_400Regular,
  Lato_700Bold,
  Lato_900Black,
});
```

Replace the `Text.defaultProps` line:
```ts
(Text as any).defaultProps.style = { fontFamily: "Lato_400Regular" };
```

- [ ] **Step 4: Verify**

Run `npx expo start --reset-cache`. Text should render in Lato. No "unrecognized font family" warnings.

- [ ] **Step 5: Commit**

```bash
git add src/utils/theme.ts app/_layout.tsx package.json
git commit -m "feat: swap Nunito for Lato across the app"
```

---

## Task 3: UI Fixes — Tab Switcher + Card Spacing

**Files:**
- Modify: `src/features/projects/DiscoveryFeed.tsx`

- [ ] **Step 1: Fix `TabPill` — add `flex: 1` to inner `View`**

Find the `TabPill` component (~line 216). The inner `View` currently has no `flex`:
```tsx
<View style={{
  paddingVertical: vs(9),
  borderRadius: s(14),
  alignItems: "center",
  backgroundColor: active ? C.purple : "transparent",
}}>
```

Add `flex: 1`:
```tsx
<View style={{
  flex: 1,
  paddingVertical: vs(9),
  borderRadius: s(14),
  alignItems: "center",
  backgroundColor: active ? C.purple : "transparent",
}}>
```

- [ ] **Step 2: Fix card spacing**

In `ProjectCard` (~line 78), find:
```tsx
style={{ marginHorizontal: s(14), marginBottom: vs(20) }}
```

Remove `marginBottom: vs(20)`:
```tsx
style={{ marginHorizontal: s(14) }}
```

In the Projects `FlashList` (~line 324), add `ItemSeparatorComponent` and `estimatedItemSize`:
```tsx
<FlashList
  data={projects}
  renderItem={({ item }) => <ProjectCard project={item as DiscoveryProject} currentUserId={user?.id} />}
  keyExtractor={(item) => (item as DiscoveryProject).id}
  ItemSeparatorComponent={() => <View style={{ height: vs(12) }} />}
  estimatedItemSize={200}
  contentContainerStyle={{ paddingTop: vs(12), paddingBottom: vs(32) }}
  showsVerticalScrollIndicator={false}
  ListEmptyComponent={...}
/>
```

- [ ] **Step 3: Verify**

Reload. Discover Projects/Talents tabs fill equally. Project cards have a consistent gap.

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/DiscoveryFeed.tsx
git commit -m "fix: tab switcher flex, project card spacing in Discover"
```

---

## Task 4: TalentCard — Connect Button (Feed-Level Status Fetch)

**Files:**
- Modify: `src/features/projects/DiscoveryFeed.tsx`

- [ ] **Step 1: Add `connectionStatuses` state to `DiscoveryFeed`**

After existing state declarations in `DiscoveryFeed`:
```tsx
const [connectionStatuses, setConnectionStatuses] = useState<Map<string, "pending" | "accepted" | "rejected">>(new Map());
```

- [ ] **Step 2: Add `fetchConnectionStatuses` function**

After `fetchTalents`:
```tsx
const fetchConnectionStatuses = useCallback(async () => {
  if (!user) return;
  const { data } = await supabase
    .from("connections")
    .select("requester_id, recipient_id, status")
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);

  const map = new Map<string, "pending" | "accepted" | "rejected">();
  (data ?? []).forEach((c: any) => {
    const otherId = c.requester_id === user.id ? c.recipient_id : c.requester_id;
    map.set(otherId, c.status);
  });
  setConnectionStatuses(map);
}, [user]);
```

- [ ] **Step 3: Call `fetchConnectionStatuses` with talents**

Update `handleTabChange`:
```tsx
function handleTabChange(tab: "projects" | "talents") {
  setActiveTab(tab);
  if (tab === "talents" && talents.length === 0) {
    fetchTalents();
    fetchConnectionStatuses();
  }
}
```

- [ ] **Step 4: Update Talents FlashList to pass status + onConnect**

```tsx
renderItem={({ item }) => (
  <TalentCard
    talent={item as TalentProfile}
    connectionStatus={connectionStatuses.get((item as TalentProfile).id)}
    onConnect={async () => {
      if (!user) return;
      const ids = [user.id, (item as TalentProfile).id].sort();
      const { error } = await supabase.from("connections").insert({
        requester_id: ids[0],
        recipient_id: ids[1],
        initiated_by: user.id,
      });
      if (!error) {
        setConnectionStatuses((prev) => new Map(prev).set((item as TalentProfile).id, "pending"));
      }
    }}
  />
)}
```

- [ ] **Step 5: Update `TalentCard` component signature**

Add props to `TalentCard`:
```tsx
function TalentCard({
  talent,
  connectionStatus,
  onConnect,
}: {
  talent: TalentProfile;
  connectionStatus?: "pending" | "accepted" | "rejected";
  onConnect?: () => void;
}) {
```

At the bottom of the card `View` (after skills chips), add:
```tsx
{/* Connect button */}
<View style={{ marginTop: vs(12) }}>
  {connectionStatus === "accepted" ? (
    <View style={{ alignSelf: "flex-start", backgroundColor: "rgba(52,211,153,0.15)", borderRadius: s(14), paddingHorizontal: s(14), paddingVertical: vs(6), borderWidth: 1, borderColor: "rgba(52,211,153,0.3)" }}>
      <Text style={{ color: C.success, fontFamily: FONT.semiBold, fontSize: fs(12) }}>Connected</Text>
    </View>
  ) : connectionStatus === "pending" ? (
    <View style={{ alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: s(14), paddingHorizontal: s(14), paddingVertical: vs(6), borderWidth: 1, borderColor: C.border }}>
      <Text style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(12) }}>Pending</Text>
    </View>
  ) : (
    <Btn onPress={onConnect} pressScale={0.93} style={{ alignSelf: "flex-start" }}>
      <View style={{ backgroundColor: C.purple, borderRadius: s(14), paddingHorizontal: s(14), paddingVertical: vs(6) }}>
        <Text style={{ color: C.white, fontFamily: FONT.semiBold, fontSize: fs(12) }}>Connect</Text>
      </View>
    </Btn>
  )}
</View>
```

- [ ] **Step 6: Verify**

Talents tab: cards show correct button state. Tapping "Connect" changes to "Pending" immediately.

- [ ] **Step 7: Commit**

```bash
git add src/features/projects/DiscoveryFeed.tsx
git commit -m "feat: add Connect button to talent cards with feed-level status fetch"
```

---

## Task 5: Notifications — Connection Requests Section

**Files:**
- Modify: `app/(app)/notifications.tsx`

- [ ] **Step 1: Add `ConnectionRequest` type**

After the existing `MyApproval` type:
```tsx
type ConnectionRequest = {
  id: string;
  requesterId: string;
  requesterName: string | null;   // null if profile missing
  createdAt: string;
};
```

- [ ] **Step 2: Add state**

```tsx
const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);
const [respondingId, setRespondingId] = useState<string | null>(null);
```

- [ ] **Step 3: Fetch connection requests inside `fetchAll`**

After the approvals section, before `setLoading(false)`:
```tsx
// ── Section 3: incoming connection requests ─────────────────────────────
const { data: connReqs } = await supabase
  .from("connections")
  .select("id, requester_id, recipient_id, initiated_by, created_at, requester:profiles!requester_id(full_name), recipient:profiles!recipient_id(full_name)")
  .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
  .neq("initiated_by", user.id)   // only incoming — not ones I sent
  .eq("status", "pending")
  .order("created_at", { ascending: false });

const parsedConnReqs: ConnectionRequest[] = (connReqs ?? []).map((c: any) => {
  // The initiator's name (the person who sent the request to me)
  const isInitiatorRequester = c.initiated_by === c.requester_id;
  const initiatorProfile = isInitiatorRequester ? c.requester : c.recipient;
  return {
    id: c.id,
    requesterId: c.initiated_by,
    requesterName: initiatorProfile?.full_name ?? null,
    createdAt: c.created_at,
  };
});
setConnectionRequests(parsedConnReqs);
```

- [ ] **Step 4: Add `handleConnectionResponse` function**

```tsx
async function handleConnectionResponse(connId: string, accept: boolean) {
  setRespondingId(connId);
  await supabase
    .from("connections")
    .update({ status: accept ? "accepted" : "rejected" })
    .eq("id", connId);
  setConnectionRequests((prev) => prev.filter((c) => c.id !== connId));
  setRespondingId(null);
}
```

- [ ] **Step 5: Add Connection Requests section to ScrollView**

Update `hasContent`:
```tsx
const hasContent = requests.length > 0 || myApprovals.length > 0 || connectionRequests.length > 0;
```

Inside `ScrollView`, add BEFORE "My Updates":
```tsx
{/* ── Connection Requests ───────────────────────────────────────── */}
{connectionRequests.length > 0 && (
  <View style={{ marginBottom: vs(8) }}>
    <Text style={{ color: C.textMuted, fontFamily: FONT.semiBold, fontSize: fs(12), paddingHorizontal: s(20), marginBottom: vs(8), textTransform: "uppercase", letterSpacing: 0.6 }}>
      Connection Requests
    </Text>
    {connectionRequests.map((conn) => {
      const displayName = conn.requesterName ?? "Unknown User";
      const initials = getInitials(displayName);
      const isResponding = respondingId === conn.id;
      const isUnknown = conn.requesterName === null;
      return (
        <View
          key={conn.id}
          style={{
            backgroundColor: C.surface,
            borderRadius: s(16),
            marginHorizontal: s(20),
            marginBottom: vs(10),
            padding: s(16),
            borderWidth: 1,
            borderColor: C.border,
            flexDirection: "row",
            alignItems: "center",
            gap: s(12),
          }}
        >
          <View style={{ width: s(44), height: s(44), borderRadius: s(22), backgroundColor: C.purple, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(15) }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(14) }}>
              {displayName}
            </Text>
            <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(13), marginTop: vs(2) }}>
              wants to connect with you
            </Text>
            <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(11), marginTop: vs(4) }}>
              {formatRelativeTime(conn.createdAt)}
            </Text>
          </View>
          <View style={{ gap: vs(8) }}>
            {/* Hide Approve for unknown/deleted profiles */}
            {!isUnknown && (
              <Btn onPress={() => handleConnectionResponse(conn.id, true)} pressScale={0.92} disabled={isResponding}>
                <View style={{ backgroundColor: C.success, borderRadius: s(12), paddingHorizontal: s(12), paddingVertical: vs(6) }}>
                  <Text style={{ color: "#0a1a10", fontFamily: FONT.bold, fontSize: fs(12) }}>
                    {isResponding ? "..." : "Approve"}
                  </Text>
                </View>
              </Btn>
            )}
            <Btn onPress={() => handleConnectionResponse(conn.id, false)} pressScale={0.92} disabled={isResponding}>
              <View style={{ borderWidth: 1, borderColor: C.danger, borderRadius: s(12), paddingHorizontal: s(12), paddingVertical: vs(6) }}>
                <Text style={{ color: C.danger, fontFamily: FONT.semiBold, fontSize: fs(12) }}>Reject</Text>
              </View>
            </Btn>
          </View>
        </View>
      );
    })}
  </View>
)}
```

- [ ] **Step 6: Verify**

Send a connection request as User A. Log in as User B → Notifications shows the request. Approving removes it. Unknown profiles show only Reject.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/notifications.tsx"
git commit -m "feat: add connection requests section to notifications"
```

---

## Task 6: Individual Chats Tab — Real Data

**Files:**
- Modify: `app/(app)/chat/index.tsx`

- [ ] **Step 1: Remove mock data and add types + state**

Delete the `MOCK_INDIVIDUAL` array (lines 20–27).

Add a type after imports:
```tsx
type ConnectionConvo = {
  id: string;
  otherUserId: string;
  otherUserName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
};
```

Add state in `MessagesScreen`:
```tsx
const [connections, setConnections] = useState<ConnectionConvo[]>([]);
const [loadingConnections, setLoadingConnections] = useState(true);
```

- [ ] **Step 2: Add `fetchConnections`**

```tsx
const fetchConnections = useCallback(async () => {
  if (!user) return;
  setLoadingConnections(true);
  const { data } = await supabase
    .from("connections")
    .select(`
      id, requester_id, recipient_id,
      requester:profiles!requester_id(id, full_name),
      recipient:profiles!recipient_id(id, full_name),
      direct_messages(content, created_at)
    `)
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .eq("status", "accepted")
    .order("created_at", { referencedTable: "direct_messages", ascending: false })
    .limit(1, { referencedTable: "direct_messages" });

  const convos: ConnectionConvo[] = (data ?? []).map((c: any) => {
    const isRequester = c.requester_id === user.id;
    const other = isRequester ? c.recipient : c.requester;
    const lastMsg = c.direct_messages?.[0] ?? null;
    return {
      id: c.id,
      otherUserId: other?.id ?? "",
      otherUserName: other?.full_name ?? "Unknown",
      lastMessage: lastMsg?.content ?? null,
      lastMessageAt: lastMsg?.created_at ?? null,
    };
  });
  setConnections(convos);
  setLoadingConnections(false);
}, [user]);
```

- [ ] **Step 3: Add to `useFocusEffect`**

```tsx
useFocusEffect(
  useCallback(() => {
    fetchJoinedProjects();
    fetchConnections();
  }, [fetchJoinedProjects, fetchConnections])
);
```

- [ ] **Step 4: Update filtered individual and replace FlatList with FlashList**

Remove `filteredIndividual`. Add:
```tsx
const filteredConnections = searchQuery.trim()
  ? connections.filter((c) =>
      c.otherUserName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.lastMessage ?? "").toLowerCase().includes(searchQuery.toLowerCase())
    )
  : connections;
```

Add FlashList import at top:
```tsx
import { FlashList } from "@shopify/flash-list";
```

Replace the individual tab block (was `<FlatList data={filteredIndividual} ...>`):
```tsx
{activeTab === "individual" ? (
  loadingConnections ? (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" color="#7c3aed" />
    </View>
  ) : filteredConnections.length === 0 ? (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: s(32) }}>
      <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: fs(15), textAlign: "center" }}>
        No connections yet.{"\n"}Connect with talent in the Discover tab!
      </Text>
    </View>
  ) : (
    <FlashList
      data={filteredConnections}
      keyExtractor={(item) => item.id}
      estimatedItemSize={72}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: vs(100) }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push({ pathname: "/(app)/chat/dm/[id]", params: { id: item.id } })}
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: s(20), paddingVertical: vs(14), borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" }}
        >
          <AvatarCircle initials={getInitials(item.otherUserName)} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#ffffff", fontWeight: "600", fontSize: fs(14), marginBottom: vs(2) }}>
              {item.otherUserName}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: fs(13) }} numberOfLines={1}>
              {item.lastMessage ?? "Start a conversation"}
            </Text>
          </View>
        </Pressable>
      )}
    />
  )
) : /* group tab — unchanged */ ...}
```

Remove unused `ScrollView` import if it's no longer used.

- [ ] **Step 5: Verify**

Individual Chats tab is empty with empty-state message for accounts with no accepted connections. After approving a connection, it shows that user with "Start a conversation".

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/chat/index.tsx"
git commit -m "feat: replace mock individual chats with live accepted connections"
```

---

## Task 7: DM Screen

**Files:**
- Create: `app/(app)/chat/dm/[id].tsx`
- Create: `src/features/chat/DirectChat.tsx`

- [ ] **Step 1: Create the DM route wrapper**

Create `app/(app)/chat/dm/[id].tsx`:
```tsx
import { useLocalSearchParams } from "expo-router";
import { DirectChat } from "@/features/chat/DirectChat";

export default function DMRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DirectChat connectionId={id} />;
}
```

- [ ] **Step 2: Create `DirectChat` component**

Create `src/features/chat/DirectChat.tsx`:

```tsx
import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Send } from "lucide-react-native";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/AuthContext";
import { C, FONT } from "@/utils/theme";
import { s, vs, fs } from "@/utils/scale";

type DM = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export function DirectChat({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<DM[]>([]);
  const [otherName, setOtherName] = useState("Chat");
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user || !connectionId) return;
    async function init() {
      const [{ data: conn }, { data: msgs }] = await Promise.all([
        supabase
          .from("connections")
          .select("requester_id, recipient_id, initiated_by, requester:profiles!requester_id(full_name), recipient:profiles!recipient_id(full_name)")
          .eq("id", connectionId)
          .single(),
        supabase
          .from("direct_messages")
          .select("id, sender_id, content, created_at")
          .eq("connection_id", connectionId)
          .order("created_at", { ascending: true }),
      ]);

      if (conn) {
        const isRequester = conn.requester_id === user!.id;
        const other = isRequester ? (conn as any).recipient : (conn as any).requester;
        setOtherName(other?.full_name ?? "Chat");
      }
      setMessages((msgs as DM[]) ?? []);
      setLoading(false);
    }
    init();
  }, [connectionId, user]);

  useEffect(() => {
    const channel = supabase
      .channel(`dm:${connectionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `connection_id=eq.${connectionId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as DM]);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [connectionId]);

  const sendMessage = useCallback(async () => {
    const content = inputText.trim();
    if (!content || !user || sending) return;
    setSending(true);
    setInputText("");
    await supabase.from("direct_messages").insert({
      connection_id: connectionId,
      sender_id: user.id,
      content,
    });
    setSending(false);
  }, [inputText, user, connectionId, sending]);

  function formatTime(dateString: string) {
    return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const avatarInitials = otherName.trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: s(16), paddingVertical: vs(12),
          borderBottomWidth: 1, borderBottomColor: C.border,
        }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: s(12) }}>
            <ArrowLeft size={s(22)} color={C.white} />
          </Pressable>
          <View style={{ width: s(36), height: s(36), borderRadius: s(18), backgroundColor: C.purple, alignItems: "center", justifyContent: "center", marginRight: s(10) }}>
            <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(13) }}>{avatarInitials}</Text>
          </View>
          <Text style={{ color: C.white, fontFamily: FONT.bold, fontSize: fs(16), flex: 1 }} numberOfLines={1}>
            {otherName}
          </Text>
        </View>

        {/* Messages */}
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={C.pink} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: s(16), paddingVertical: vs(16), flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: vs(80) }}>
                <Text style={{ color: C.textMuted, fontFamily: FONT.regular, fontSize: fs(14), textAlign: "center" }}>
                  Send your first message to {otherName} 👋
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isOwn = item.sender_id === user?.id;
              return (
                <View style={{ alignItems: isOwn ? "flex-end" : "flex-start", marginBottom: vs(10) }}>
                  <View style={{
                    maxWidth: "78%",
                    backgroundColor: isOwn ? C.purple : C.surface,
                    borderRadius: s(16),
                    borderBottomRightRadius: isOwn ? s(4) : s(16),
                    borderBottomLeftRadius: isOwn ? s(16) : s(4),
                    paddingHorizontal: s(14),
                    paddingVertical: vs(10),
                    borderWidth: isOwn ? 0 : 1,
                    borderColor: C.border,
                  }}>
                    <Text style={{ color: C.white, fontFamily: FONT.regular, fontSize: fs(14), lineHeight: vs(20) }}>
                      {item.content}
                    </Text>
                  </View>
                  <Text style={{ color: C.textFaint, fontFamily: FONT.regular, fontSize: fs(10), marginTop: vs(3), marginHorizontal: s(4) }}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              );
            }}
          />
        )}

        {/* Input bar */}
        <View style={{
          flexDirection: "row", alignItems: "flex-end",
          paddingHorizontal: s(16), paddingVertical: vs(12),
          borderTopWidth: 1, borderTopColor: C.border,
          backgroundColor: "rgba(10,1,32,0.95)",
        }}>
          <TextInput
            style={{
              flex: 1, color: C.white, fontFamily: FONT.regular,
              fontSize: fs(14), backgroundColor: C.surface,
              borderRadius: s(20), borderWidth: 1, borderColor: C.border,
              paddingHorizontal: s(16), paddingVertical: vs(10),
              maxHeight: vs(100), marginRight: s(10),
            }}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message..."
            placeholderTextColor={C.textFaint}
            multiline
            maxLength={1000}
          />
          <Pressable
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
            style={{
              width: s(44), height: s(44), borderRadius: s(22),
              backgroundColor: inputText.trim() ? C.purple : "rgba(255,255,255,0.08)",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Send size={s(18)} color={inputText.trim() ? C.white : C.textFaint} strokeWidth={2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Verify**

1. Individual Chats → tap a connection → DM screen opens with name in header
2. No messages → empty state shown
3. Send a message → bubble appears immediately
4. Open same conversation on second device → realtime sync works
5. Back button returns to chat list

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/chat/dm/[id].tsx" src/features/chat/DirectChat.tsx
git commit -m "feat: add direct messaging screen for connected users"
```

---

## Final Verification Checklist

- [ ] Lato renders everywhere (no system font fallback)
- [ ] Discover Projects/Talents tabs fill equally (50/50 split)
- [ ] Project cards have consistent `vs(12)` gap between them
- [ ] Talent cards show Connect / Pending / Connected correctly
- [ ] Tapping Connect sends a connection request and updates button to Pending
- [ ] Notifications shows Connection Requests section for recipient
- [ ] Unknown/deleted profiles show only Reject button (no Approve)
- [ ] Approving removes the card optimistically
- [ ] Individual Chats tab shows live accepted connections (no mocks)
- [ ] Empty state shows for accounts with no connections
- [ ] Tapping a connection opens the DM screen
- [ ] Empty state message appears on first open
- [ ] Sending a message appears in real-time on both sides
- [ ] Back button from DM returns to Messages tab
