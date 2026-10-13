import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { rankActive, rankPeople, selectNeeds, type NeedsMode } from "./ranking";
import {
  fetchActive, fetchMemberProjectIds, fetchNeeds, fetchPeople, fetchShipped,
} from "./queries";
import type { ActiveItem, NeedsItem, PersonItem, SectionState, ShippedItem } from "./types";

function initial<T>(): SectionState<T> {
  return { data: [], loading: true, error: null };
}

export interface DiscoverData {
  needs: SectionState<NeedsItem>;
  /** Whether the hero is showing skill matches or the recent-projects fallback. */
  needsMode: NeedsMode;
  active: SectionState<ActiveItem>;
  people: SectionState<PersonItem>;
  shipped: SectionState<ShippedItem>;
  /** A user-initiated pull is in flight — drives RefreshControl only. */
  refreshing: boolean;
  /**
   * A background refetch is in flight (mount, focus) with content already on
   * screen. Kept separate from `refreshing` because RefreshControl does not
   * reveal its spinner unless the user actually pulled, so a focus refetch
   * driven by it is invisible. This drives the progress line instead.
   */
  revalidating: boolean;
  /**
   * At least one section is showing data it could not confirm is current —
   * the fetch failed and the previous payload was kept. The screen says so
   * rather than presenting stale content as live.
   */
  stale: boolean;
  /** Refetch every section as a user pull. Existing data stays on screen. */
  refresh: () => Promise<void>;
  /** Refetch every section in the background, without the pull spinner. */
  revalidate: () => Promise<void>;
  /** Refetch one section, for its inline Retry. */
  retry: (key: "needs" | "active" | "people" | "shipped") => Promise<void>;
}

export function useDiscoverData(
  viewerSkills: string[],
  viewerDepartment: string | null
): DiscoverData {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;

  // Callers commonly pass a freshly-allocated array each render (a `?? []`
  // fallback, a derived literal, etc). Depending on `viewerSkills` itself in
  // a useCallback dep array would rebuild loadNeeds -> refresh -> re-fire the
  // mount effect on every render even when the *contents* never changed,
  // causing an infinite refetch loop. Depending on this stable string
  // serialisation instead means loadNeeds only changes when the actual
  // skill set changes. See the "new-but-equal array" test in
  // useDiscoverData.test.ts, which fails without this.
  const viewerSkillsKey = viewerSkills.join("|");

  const [needs, setNeeds] = useState<SectionState<NeedsItem>>(initial);
  const [active, setActive] = useState<SectionState<ActiveItem>>(initial);
  const [people, setPeople] = useState<SectionState<PersonItem>>(initial);
  const [shipped, setShipped] = useState<SectionState<ShippedItem>>(initial);
  const [needsMode, setNeedsMode] = useState<NeedsMode>("matched");
  const [refreshing, setRefreshing] = useState(false);
  const [revalidating, setRevalidating] = useState(false);

  // Guards against setting state after unmount during a slow refetch. Reset
  // to true at the top of the mount effect (not just false on cleanup) so
  // that if this hook is ever mounted under <React.StrictMode> (it isn't
  // anywhere in this app today, but this keeps the hook correct if that
  // changes) the mount -> cleanup -> remount cycle doesn't leave the ref
  // permanently false and the screen stuck on its skeleton.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const loadNeeds = useCallback(async () => {
    if (!viewerId) return;
    const memberIds = await fetchMemberProjectIds(viewerId);
    const { data, error } = await fetchNeeds(viewerId, viewerSkills, memberIds);
    if (!alive.current) return;
    if (!error) {
      const { items, mode } = selectNeeds(data);
      setNeedsMode(mode);
      setNeeds({ data: items, loading: false, error: null });
    } else {
      setNeeds(prev => ({ data: prev.data, loading: false, error }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- viewerSkillsKey is the stable proxy for viewerSkills
  }, [viewerId, viewerSkillsKey]);

  const loadActive = useCallback(async () => {
    const { data, error } = await fetchActive();
    if (!alive.current) return;
    setActive(prev => ({
      data: error ? prev.data : rankActive(data),
      loading: false,
      error,
    }));
  }, []);

  const loadPeople = useCallback(async () => {
    if (!viewerId) return;
    const { data, error } = await fetchPeople(viewerId);
    if (!alive.current) return;
    setPeople(prev => ({
      data: error ? prev.data : rankPeople(data, viewerDepartment),
      loading: false,
      error,
    }));
  }, [viewerId, viewerDepartment]);

  const loadShipped = useCallback(async () => {
    const { data, error } = await fetchShipped();
    if (!alive.current) return;
    setShipped(prev => ({ data: error ? prev.data : data, loading: false, error }));
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadNeeds(), loadActive(), loadPeople(), loadShipped()]);
  }, [loadNeeds, loadActive, loadPeople, loadShipped]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    if (alive.current) setRefreshing(false);
  }, [loadAll]);

  const revalidate = useCallback(async () => {
    setRevalidating(true);
    await loadAll();
    if (alive.current) setRevalidating(false);
  }, [loadAll]);

  const retry = useCallback(async (key: "needs" | "active" | "people" | "shipped") => {
    const runner = {
      needs: loadNeeds, active: loadActive,
      people: loadPeople, shipped: loadShipped,
    }[key];
    await runner();
  }, [loadNeeds, loadActive, loadPeople, loadShipped]);

  useEffect(() => { revalidate(); }, [revalidate]);

  // Stale means "kept, unconfirmed" — a section that errored with nothing
  // cached shows its own inline retry instead and is not counted here.
  const stale =
    (!!needs.error && needs.data.length > 0) ||
    (!!active.error && active.data.length > 0) ||
    (!!people.error && people.data.length > 0) ||
    (!!shipped.error && shipped.data.length > 0);

  return {
    needs, needsMode, active, people, shipped,
    refreshing, revalidating, stale, refresh, revalidate, retry,
  };
}
