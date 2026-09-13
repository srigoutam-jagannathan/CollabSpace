import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { rankActive, rankPeople, selectNeeds, type NeedsMode } from "./ranking";
import {
  fetchActive, fetchMemberProjectIds, fetchNeeds, fetchPeople, fetchPulse,
} from "./queries";
import type { ActiveItem, NeedsItem, PersonItem, PulseItem, SectionState } from "./types";

function initial<T>(): SectionState<T> {
  return { data: [], loading: true, error: null };
}

export interface DiscoverData {
  pulse: SectionState<PulseItem>;
  needs: SectionState<NeedsItem>;
  /** Whether the hero is showing skill matches or the recent-projects fallback. */
  needsMode: NeedsMode;
  active: SectionState<ActiveItem>;
  people: SectionState<PersonItem>;
  refreshing: boolean;
  /** Refetch every section. Existing data stays on screen throughout. */
  refresh: () => Promise<void>;
  /** Refetch one section, for its inline Retry. */
  retry: (key: "pulse" | "needs" | "active" | "people") => Promise<void>;
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

  const [pulse, setPulse] = useState<SectionState<PulseItem>>(initial);
  const [needs, setNeeds] = useState<SectionState<NeedsItem>>(initial);
  const [active, setActive] = useState<SectionState<ActiveItem>>(initial);
  const [people, setPeople] = useState<SectionState<PersonItem>>(initial);
  const [needsMode, setNeedsMode] = useState<NeedsMode>("matched");
  const [refreshing, setRefreshing] = useState(false);

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

  const loadPulse = useCallback(async () => {
    const { data, error } = await fetchPulse();
    if (!alive.current) return;
    // On failure keep the previous data and surface the error alongside it.
    setPulse(prev => ({ data: error ? prev.data : data, loading: false, error }));
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

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadPulse(), loadNeeds(), loadActive(), loadPeople()]);
    if (alive.current) setRefreshing(false);
  }, [loadPulse, loadNeeds, loadActive, loadPeople]);

  const retry = useCallback(async (key: "pulse" | "needs" | "active" | "people") => {
    const runner = { pulse: loadPulse, needs: loadNeeds, active: loadActive, people: loadPeople }[key];
    await runner();
  }, [loadPulse, loadNeeds, loadActive, loadPeople]);

  useEffect(() => { refresh(); }, [refresh]);

  return { pulse, needs, needsMode, active, people, refreshing, refresh, retry };
}
