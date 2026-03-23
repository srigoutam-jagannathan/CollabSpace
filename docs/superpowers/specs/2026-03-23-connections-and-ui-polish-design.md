# Design Spec: Connections System + UI Polish
**Date:** 2026-03-23
**Status:** Approved (v2 — post spec-review)

---

## 1. Scope

Four changes in one release:

1. **Tab switcher fix** — Projects/Talents pills equally split in Discover screen
2. **Card spacing fix** — Consistent vertical gap between project cards in Discover
3. **Font swap** — Replace Nunito with Lato throughout the app
4. **Connections system** — Connect with talent users, approve/reject via notifications, DM approved connections

---

## 2. UI Fixes

### 2a. Tab Switcher (DiscoveryFeed)

`TabPill` has `flex: 1` on the outer `Btn`, but `Btn` wraps children in an `Animated.View` that shrinks to content width. Fix: add `style={{ flex: 1 }}` to the inner `View` inside `TabPill` directly:

```tsx
// TabPill inner View
<View style={{ flex: 1, paddingVertical: vs(9), borderRadius: s(14), alignItems: "center", ... }}>
```

No changes to the container layout needed.

### 2b. Card Spacing (DiscoveryFeed)

`ProjectCard` sets `marginBottom: vs(20)` on the outer `Btn`'s style prop (line 79 of DiscoveryFeed.tsx). Remove that. Add `ItemSeparatorComponent` to the Projects FlashList:

```tsx
ItemSeparatorComponent={() => <View style={{ height: vs(12) }} />}
```

### 2c. Font: Nunito → Lato

Install:
```bash
npx expo install @expo-google-fonts/lato
```

Lato available weights: 400 Regular, 700 Bold, 900 Black. No 500 or 600 weight exists.

**Weight mapping** (intentional collapse of medium/semiBold since Lato has no intermediate weights):

| FONT key | Old | New |
|---|---|---|
| `regular` | Nunito_400Regular | Lato_400Regular |
| `medium` | Nunito_500Medium | Lato_400Regular ← collapsed, intentional |
| `semiBold` | Nunito_600SemiBold | Lato_700Bold |
| `bold` | Nunito_700Bold | Lato_700Bold |
| `extraBold` | Nunito_800ExtraBold | Lato_900Black |

**Two places to update:**

1. `src/utils/theme.ts` — update `FONT` constant values to Lato names
2. `app/_layout.tsx` — swap `useFonts` import and call:
   ```ts
   import { useFonts, Lato_400Regular, Lato_700Bold, Lato_900Black } from "@expo-google-fonts/lato";
   // ...
   const [fontsLoaded] = useFonts({ Lato_400Regular, Lato_700Bold, Lato_900Black });
   ```
   Update `Text.defaultProps` to `{ fontFamily: "Lato_400Regular" }`.

---

## 3. Connections System

### 3a. Database Schema

**Migration file:** `supabase/migrations/20260323000003_connections.sql`

```sql
-- ── Connections ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Canonical ordering prevents (A→B) and (B→A) coexisting
  CHECK (requester_id < recipient_id),
  UNIQUE (requester_id, recipient_id)
);

-- updated_at auto-refresh trigger
CREATE OR REPLACE FUNCTION update_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER connections_updated_at
  BEFORE UPDATE ON connections
  FOR EACH ROW EXECUTE FUNCTION update_connections_updated_at();

ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- Only parties to the connection can see it
CREATE POLICY "connections_select" ON connections FOR SELECT USING (
  auth.uid() = requester_id OR auth.uid() = recipient_id
);
-- The requester inserts; canonical ordering enforced by CHECK
CREATE POLICY "connections_insert" ON connections FOR INSERT WITH CHECK (
  auth.uid() = requester_id
);
-- Only the recipient can approve/reject
CREATE POLICY "connections_update" ON connections FOR UPDATE USING (
  auth.uid() = recipient_id
);

-- ── Direct Messages ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID REFERENCES connections(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Only parties in the accepted connection can read messages
CREATE POLICY "dm_select" ON direct_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM connections c
    WHERE c.id = connection_id
      AND (c.requester_id = auth.uid() OR c.recipient_id = auth.uid())
      AND c.status = 'accepted'
  )
);
-- Sender must be a party to the accepted connection
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

**Canonical ordering note:** Because of `CHECK (requester_id < recipient_id)`, the application layer must always insert with `min(meId, theirId)` as `requester_id` and `max(meId, theirId)` as `recipient_id`. The "requester" label becomes structural (not semantic), so the notifications query must check both sides when determining who initiated.

Track initiation separately by storing the real initiator in a separate `initiated_by UUID` column if needed — but for Phase 1, checking which side the current user is on is sufficient for UI ("wants to connect with you").

### 3b. TalentCard — Connect Button

**Fetch connection statuses at the feed level** (not per-card) to avoid N+1 queries.

In `DiscoveryFeed`, after `fetchTalents` resolves, also run:

```ts
const { data } = await supabase
  .from("connections")
  .select("requester_id, recipient_id, status")
  .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);
// Build a Map<talentId, status | "none">
```

Pass the status as a prop to each `TalentCard`.

**Button states:**
- `"none"` or rejected → "Connect" (purple)
- `"pending"` → "Pending" (grey, disabled)
- `"accepted"` → "Connected" (green, disabled)

**On press (Connect):**
Insert with canonical ordering:
```ts
const [lo, hi] = [user.id, talent.id].sort();
supabase.from("connections").insert({ requester_id: lo, recipient_id: hi })
```
Optimistically update local `connectionStatuses` map to `"pending"`.

Self-connection is already prevented by the existing `fetchTalents` query (`.neq("id", user.id)`).

### 3c. Notifications Screen — Connection Requests Section

Add a "Connection Requests" section (new third section, rendered first).

**Data fetch** (direct from `connections` table — no separate notifications table):
```ts
supabase
  .from("connections")
  .select("id, requester_id, status, created_at, requester:profiles!requester_id(id, full_name)")
  .eq("recipient_id", user.id)
  .eq("status", "pending")
```

If `requester.full_name` is null (deleted/missing profile), degrade gracefully: show "Unknown User" and hide the Approve button (only show Reject).

**Card layout:**
- Avatar initials circle (purple)
- `"{name} wants to connect with you"`
- Approve (green) → `UPDATE connections SET status = 'accepted'` where `id = connectionId`
- Reject (outlined red/danger) → `UPDATE connections SET status = 'rejected'`
- On either action: remove card from list optimistically

### 3d. Individual Chats Tab — Real Data

Replace hardcoded mock data with live query. Use **FlashList** (consistent with rest of app).

**Query:**
```ts
supabase
  .from("connections")
  .select(`
    id, requester_id, recipient_id, status,
    requester:profiles!requester_id(id, full_name),
    recipient:profiles!recipient_id(id, full_name),
    last_message:direct_messages(content, created_at)
  `)
  .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
  .eq("status", "accepted")
  .order("created_at", { referencedTable: "direct_messages", ascending: false })
  .limit(1, { referencedTable: "direct_messages" })
```

From each row, derive:
- `otherUser` = whichever of `requester` / `recipient` is not `user.id`
- `lastMessage` = `last_message[0]?.content ?? null`
- `lastMessageAt` = `last_message[0]?.created_at ?? null`

Display each item as: avatar initials + name + `"Start a conversation"` (if no messages) or last message preview + timestamp.

**Navigation:** tap → `router.push({ pathname: "/(app)/chat/dm/[id]", params: { id: connection.id } })`

### 3e. DM Screen

**New files:**
- `app/(app)/chat/dm/[id].tsx` — extracts `id` param, renders `<DirectChat connectionId={id} />`
- `src/features/chat/DirectChat.tsx` — the DM component

No `_layout.tsx` needed for `dm/` — the parent `chat/_layout.tsx` Stack covers nested routes.

**DirectChat component:**

- **Header:** Back button + other user's full name
- **Message list:** `FlatList` (inverted) or regular with `ref.scrollToEnd` — own messages right/purple, other left/dark surface. Same bubble style as `HandshakeChat`.
- **Empty state:** `"Send your first message to {name} 👋"` centered in the list area
- **Realtime:** Supabase channel on `direct_messages` filtered by `connection_id = connectionId`, `INSERT` event → append to local state
- **Input bar:** `TextInput` + Send button (same style as HandshakeChat). Send inserts into `direct_messages`
- **Keyboard:** Wrap in `KeyboardAvoidingView` with `behavior={Platform.OS === "ios" ? "padding" : undefined}`, matching `HandshakeChat` pattern
- **No MOU button, no project info, no Insights link**

**Stack registration:** `chat/_layout.tsx` already uses a flat `<Stack screenOptions={{ headerShown: false }} />` which automatically covers `dm/[id]` as a nested segment — no extra config needed.

---

## 4. Files Changed / Created

| File | Change |
|---|---|
| `src/utils/theme.ts` | Update `FONT` constants to Lato |
| `app/_layout.tsx` | Swap Nunito → Lato in `useFonts`, update `Text.defaultProps` |
| `src/features/projects/DiscoveryFeed.tsx` | Tab fix, card spacing, feed-level connection status fetch, Connect button on TalentCard |
| `app/(app)/notifications.tsx` | Add Connection Requests section |
| `app/(app)/chat/index.tsx` | Replace mock individual chats with FlashList of live connections |
| `app/(app)/chat/dm/[id].tsx` | New — DM route wrapper |
| `src/features/chat/DirectChat.tsx` | New — DM component |
| `supabase/migrations/20260323000003_connections.sql` | New — connections + direct_messages tables + RLS + trigger |
