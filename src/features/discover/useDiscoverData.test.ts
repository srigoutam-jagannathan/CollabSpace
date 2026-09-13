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
  mocked.fetchPulse.mockResolvedValue({ data: [], error: null });
  mocked.fetchNeeds.mockResolvedValue({ data: [], error: null });
  mocked.fetchActive.mockResolvedValue({ data: [], error: null });
  mocked.fetchPeople.mockResolvedValue({ data: [], error: null });
}

beforeEach(() => {
  jest.clearAllMocks();
  stubAll();
});

test("loads every section in parallel and clears loading", async () => {
  const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
  await waitFor(() => expect(result.current.people.loading).toBe(false));
  expect(mocked.fetchPulse).toHaveBeenCalledTimes(1);
  expect(mocked.fetchNeeds).toHaveBeenCalledTimes(1);
  expect(mocked.fetchActive).toHaveBeenCalledTimes(1);
  expect(mocked.fetchPeople).toHaveBeenCalledTimes(1);
});

test("one failing section does not affect the others", async () => {
  mocked.fetchActive.mockResolvedValue({ data: [], error: "Couldn't load active projects." });
  mocked.fetchPeople.mockResolvedValue({
    data: [{ id: "p1", full_name: "Ana", avatar_url: null, department: "CS", university: "qub", pvs_score: 5 }],
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
    data: [{ id: "p1", full_name: "Ana", avatar_url: null, department: "CS", university: "qub", pvs_score: 5 }],
    error: null,
  });

  const { result } = renderHook(() => useDiscoverData(["Design"], "CS"));
  await waitFor(() => expect(result.current.people.data).toHaveLength(1));

  await act(async () => { result.current.refresh(); });
  expect(result.current.people.data).toHaveLength(1);
});

test("a failed refetch does not wipe the last good data", async () => {
  mocked.fetchPeople.mockResolvedValueOnce({
    data: [{ id: "p1", full_name: "Ana", avatar_url: null, department: "CS", university: "qub", pvs_score: 5 }],
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
  expect(mocked.fetchPulse).not.toHaveBeenCalled();
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
  expect(mocked.fetchPulse).toHaveBeenCalledTimes(1);

  // A brand new array instance with the same contents — this is the
  // realistic shape of the bug: identity changes, value doesn't.
  rerender({ skills: ["Design"] });

  // Give any runaway effect chain a chance to fire before asserting.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mocked.fetchNeeds).toHaveBeenCalledTimes(1);
  expect(mocked.fetchPulse).toHaveBeenCalledTimes(1);
  expect(mocked.fetchActive).toHaveBeenCalledTimes(1);
  expect(mocked.fetchPeople).toHaveBeenCalledTimes(1);
});
