import { renderHook, waitFor, act } from "@testing-library/react-native";
import { useDiscoverData } from "./useDiscoverData";
import * as queries from "./queries";

// jest.mock("./queries") below is a bare automock (no factory), which means
// Jest still has to `require` the *real* queries.ts once to learn its shape
// before it can replace every export with a jest.fn(). queries.ts imports
// the real "@/lib/supabaseClient", which throws at module-eval time when
// EXPO_PUBLIC_SUPABASE_URL/ANON_KEY aren't set — true under plain `jest`
// (nothing loads .env.local the way Expo's dev/build tooling does). This
// test has no business touching real Supabase credentials anyway, so the
// client is stubbed out here to keep the automock's one-time real-module
// load side-effect-free.
jest.mock("@/lib/supabaseClient", () => ({ supabase: {} }));
jest.mock("./queries");
jest.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: "viewer-1" } }),
}));

const mocked = queries as jest.Mocked<typeof queries>;

function stubAll() {
  mocked.fetchMemberProjectIds.mockResolvedValue([]);
  mocked.fetchViewerProjectNeeds.mockResolvedValue([]);
  mocked.fetchNeeds.mockResolvedValue({ data: [], error: null });
  mocked.fetchActive.mockResolvedValue({ data: [], error: null });
  mocked.fetchPeople.mockResolvedValue({ data: [], error: null });
  mocked.fetchShipped.mockResolvedValue({ data: [], error: null });
}

beforeEach(() => {
  jest.clearAllMocks();
  stubAll();
});

test("loads every section in parallel and clears loading", async () => {
  const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
  await waitFor(() => expect(result.current.people.loading).toBe(false));
  expect(mocked.fetchNeeds).toHaveBeenCalledTimes(1);
  expect(mocked.fetchActive).toHaveBeenCalledTimes(1);
  expect(mocked.fetchPeople).toHaveBeenCalledTimes(1);
});

test("People to know is matched against what your own projects need", async () => {
  mocked.fetchViewerProjectNeeds.mockResolvedValue(["UX Designer", "Legal"]);
  const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
  await waitFor(() => expect(result.current.people.loading).toBe(false));
  expect(mocked.fetchViewerProjectNeeds).toHaveBeenCalledWith("viewer-1");
  expect(mocked.fetchPeople).toHaveBeenCalledWith("viewer-1", ["UX Designer", "Legal"]);
});

test("one failing section does not affect the others", async () => {
  mocked.fetchActive.mockResolvedValue({ data: [], error: "Couldn't load active projects." });
  mocked.fetchPeople.mockResolvedValue({
    data: [{ id: "p1", full_name: "Ana", avatar_url: null, department: "CS", university: "qub", matched_skills: [] }],
    error: null,
  });

  const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
  await waitFor(() => expect(result.current.people.loading).toBe(false));

  expect(result.current.active.error).toBe("Couldn't load active projects.");
  expect(result.current.people.error).toBeNull();
  expect(result.current.people.data).toHaveLength(1);
});

test("a refetch keeps existing data on screen while it is in flight", async () => {
  mocked.fetchPeople.mockResolvedValue({
    data: [{ id: "p1", full_name: "Ana", avatar_url: null, department: "CS", university: "qub", matched_skills: [] }],
    error: null,
  });

  const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
  await waitFor(() => expect(result.current.people.data).toHaveLength(1));

  await act(async () => { result.current.refresh(); });
  expect(result.current.people.data).toHaveLength(1);
});

test("a failed refetch does not wipe the last good data", async () => {
  mocked.fetchPeople.mockResolvedValueOnce({
    data: [{ id: "p1", full_name: "Ana", avatar_url: null, department: "CS", university: "qub", matched_skills: [] }],
    error: null,
  });
  const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
  await waitFor(() => expect(result.current.people.data).toHaveLength(1));

  mocked.fetchPeople.mockResolvedValueOnce({ data: [], error: "Couldn't load people." });
  await act(async () => { await result.current.refresh(); });

  expect(result.current.people.data).toHaveLength(1);
  expect(result.current.people.error).toBe("Couldn't load people.");
});

test("retry refetches only the named section", async () => {
  const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
  await waitFor(() => expect(result.current.people.loading).toBe(false));
  jest.clearAllMocks();
  stubAll();

  await act(async () => { await result.current.retry("active"); });

  expect(mocked.fetchActive).toHaveBeenCalledTimes(1);
  expect(mocked.fetchPeople).not.toHaveBeenCalled();
});

// Risk: viewerSkills is an array prop. If a caller passes a new array
// identity on every render (very common — `skills ?? []`, a fresh literal,
// a derived array from other state) and loadNeeds depended on that array
// identity, loadNeeds -> refresh -> the mount useEffect would all be
// rebuilt and re-run on every re-render, causing an infinite refetch loop.
// This re-renders with a *new but value-equal* array and asserts the
// section fetchers are not called again.
test("re-rendering with a new-but-equal skills array does not refetch", async () => {
  const { result, rerender } = renderHook(
    (props: { skills: string[] }) => useDiscoverData(props.skills, "CS"),
    { initialProps: { skills: ["Design"] } }
  );
  await waitFor(() => expect(result.current.people.loading).toBe(false));

  expect(mocked.fetchNeeds).toHaveBeenCalledTimes(1);

  // A brand new array instance with the same contents — this is the
  // realistic shape of the bug: identity changes, value doesn't.
  rerender({ skills: ["Design"] });

  // Give any runaway effect chain a chance to fire before asserting.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mocked.fetchNeeds).toHaveBeenCalledTimes(1);
  expect(mocked.fetchActive).toHaveBeenCalledTimes(1);
  expect(mocked.fetchPeople).toHaveBeenCalledTimes(1);
});

describe("stale", () => {
  const person = {
    id: "p1", full_name: "Ana", avatar_url: null,
    department: "CS", university: "qub" as const, matched_skills: [],
  };

  test("is false while every section is healthy", async () => {
    const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
    await waitFor(() => expect(result.current.people.loading).toBe(false));
    expect(result.current.stale).toBe(false);
  });

  test("is true when a refetch fails over data already on screen", async () => {
    mocked.fetchPeople.mockResolvedValue({ data: [person], error: null });
    const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
    await waitFor(() => expect(result.current.people.data).toHaveLength(1));
    expect(result.current.stale).toBe(false);

    // The network drops; the kept payload must not be presented as current.
    mocked.fetchPeople.mockResolvedValue({ data: [], error: "Couldn't load people." });
    await act(async () => { await result.current.refresh(); });

    expect(result.current.people.data).toHaveLength(1);
    expect(result.current.stale).toBe(true);
  });

  test("a section that failed with nothing cached is not stale", async () => {
    // It renders its own inline retry instead, so the banner would double up.
    mocked.fetchPeople.mockResolvedValue({ data: [], error: "Couldn't load people." });
    const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
    await waitFor(() => expect(result.current.people.loading).toBe(false));
    expect(result.current.people.error).toBe("Couldn't load people.");
    expect(result.current.stale).toBe(false);
  });
});

test("a pull drives refreshing, a focus refetch drives revalidating", async () => {
  const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
  await waitFor(() => expect(result.current.people.loading).toBe(false));
  expect(result.current.refreshing).toBe(false);
  expect(result.current.revalidating).toBe(false);

  // revalidate() must never raise refreshing — that would pop the
  // pull-to-refresh spinner on every screen focus.
  let pending: Promise<void>;
  act(() => { pending = result.current.revalidate(); });
  await waitFor(() => expect(result.current.revalidating).toBe(true));
  expect(result.current.refreshing).toBe(false);
  await act(async () => { await pending; });
  expect(result.current.revalidating).toBe(false);
});

test("Discover no longer has a pulse section", async () => {
  const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
  await waitFor(() => expect(result.current.people.loading).toBe(false));
  expect(result.current).not.toHaveProperty("pulse");
});

test("projects that match none of your skills are not shown", async () => {
  mocked.fetchNeeds.mockResolvedValue({
    data: [{
      id: "x", title: "Unrelated", description: "", looking_for: ["Legal"], tags: [],
      university_scope: "both", commitment_hours: null, member_count: 1, matched_roles: [],
    }],
    error: null,
  });
  const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
  await waitFor(() => expect(result.current.needs.loading).toBe(false));
  expect(result.current.needs.data).toEqual([]);
  expect(result.current).not.toHaveProperty("needsMode");
});

test("the shipped rail is topped up with examples", async () => {
  const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
  await waitFor(() => expect(result.current.shipped.loading).toBe(false));
  expect(result.current.shipped.data).toHaveLength(5);
});

describe("needs while the viewer's profile is unknown", () => {
  const row = (id: string, title: string) => ({
    id, title, description: "", looking_for: ["Design"], tags: [],
    university_scope: "both" as const, commitment_hours: null, member_count: 1,
    matched_roles: ["Design"],
  });

  test("null skills mean not loaded yet: no fetch, and needs stays loading", async () => {
    const { result } = renderHook(() => useDiscoverData(null, null));
    await waitFor(() => expect(result.current.people.loading).toBe(false));
    expect(mocked.fetchNeeds).not.toHaveBeenCalled();
    expect(result.current.needs.loading).toBe(true);
    expect(result.current.needs.data).toEqual([]);
  });

  test("a stale needs response that lands last does not overwrite the latest", async () => {
    let resolveFirst!: (v: Awaited<ReturnType<typeof queries.fetchNeeds>>) => void;
    mocked.fetchNeeds
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
      .mockResolvedValueOnce({ data: [row("fresh", "Fresh")], error: null });

    const { result, rerender } = renderHook(
      (props: { skills: string[] }) => useDiscoverData(props.skills, "CS"),
      { initialProps: { skills: [] as string[] } }
    );
    await waitFor(() => expect(mocked.fetchNeeds).toHaveBeenCalledTimes(1));

    rerender({ skills: ["Design"] });
    await waitFor(() => expect(result.current.needs.data.map((n) => n.id)).toEqual(["fresh"]));

    // The request made with the old skills finally answers.
    await act(async () => { resolveFirst({ data: [row("stale", "Stale")], error: null }); });
    expect(result.current.needs.data.map((n) => n.id)).toEqual(["fresh"]);
  });
});

describe("shipped failures", () => {
  test("a first load that fails shows no examples, only the error", async () => {
    mocked.fetchShipped.mockResolvedValue({ data: [], error: "Couldn't load shipped projects." });
    const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
    await waitFor(() => expect(result.current.shipped.loading).toBe(false));
    expect(result.current.shipped.data).toEqual([]);
    expect(result.current.shipped.error).toBe("Couldn't load shipped projects.");
  });

  test("a failed revalidate keeps the five rows already shown", async () => {
    const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
    await waitFor(() => expect(result.current.shipped.data).toHaveLength(5));
    const before = result.current.shipped.data;

    mocked.fetchShipped.mockResolvedValue({ data: [], error: "Couldn't load shipped projects." });
    await act(async () => { await result.current.revalidate(); });

    expect(result.current.shipped.data).toEqual(before);
    expect(result.current.shipped.error).toBe("Couldn't load shipped projects.");
  });
});
