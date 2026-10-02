/**
 * Rule-based stand-in for the Supabase client, for tests.
 *
 * Supabase queries are chains -- from(table).select(...).eq(...).single() --
 * and awaiting the chain is what runs it. This mock records each awaited chain
 * as a QueryCall and answers it with whatever the test's resolver returns. A
 * test describes the database by rule ("join events on p1 return these rows")
 * instead of by the order the code under test happens to issue its queries,
 * so reordering a Promise.all does not break it.
 *
 * Wire it into a test file with:
 *
 *   jest.mock("@/lib/supabaseClient", () => require("@/test/supabaseMock").supabaseModule);
 *   import { db, has } from "@/test/supabaseMock";
 *   beforeEach(() => db.reset());
 *
 * The require() inside the factory and the import resolve to the same module
 * instance, so the test and the code under test share one client.
 */

const FILTER_METHODS = [
  "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in",
  "contains", "or", "not", "filter", "match", "order", "limit", "range",
] as const;

type FilterMethod = (typeof FILTER_METHODS)[number];
export type Op = "select" | "insert" | "update" | "delete" | "upsert";
export type Filter = [method: FilterMethod, ...args: unknown[]];

export type QueryCall = {
  table: string;
  op: Op;
  /** What was passed to insert/update/upsert. */
  payload?: unknown;
  /** The select() argument: columns read, or for a write, the columns returned. */
  columns?: string;
  filters: Filter[];
  /** single() or maybeSingle() was called. */
  single: boolean;
};

export type QueryResult = { data?: unknown; error?: unknown; count?: number | null };
type FullResult = { data: unknown; error: unknown; count: number | null };
export type Resolver = (call: QueryCall) => QueryResult | undefined;

export type QueryChain = PromiseLike<FullResult> &
  { [M in FilterMethod]: (...args: unknown[]) => QueryChain } & {
    select(columns?: string, options?: unknown): QueryChain;
    insert(payload: unknown, options?: unknown): QueryChain;
    update(payload: unknown, options?: unknown): QueryChain;
    upsert(payload: unknown, options?: unknown): QueryChain;
    delete(options?: unknown): QueryChain;
    single(): QueryChain;
    maybeSingle(): QueryChain;
  };

let resolver: Resolver = () => undefined;
const calls: QueryCall[] = [];

function query(table: string): QueryChain {
  const call: QueryCall = { table, op: "select", filters: [], single: false };
  const chain = {} as QueryChain;

  for (const method of FILTER_METHODS) {
    chain[method] = (...args: unknown[]) => {
      call.filters.push([method, ...args]);
      return chain;
    };
  }
  chain.select = (columns?: string) => {
    call.columns = columns;
    return chain;
  };
  chain.insert = (payload: unknown) => {
    call.op = "insert";
    call.payload = payload;
    return chain;
  };
  chain.update = (payload: unknown) => {
    call.op = "update";
    call.payload = payload;
    return chain;
  };
  chain.upsert = (payload: unknown) => {
    call.op = "upsert";
    call.payload = payload;
    return chain;
  };
  chain.delete = () => {
    call.op = "delete";
    return chain;
  };
  chain.single = () => {
    call.single = true;
    return chain;
  };
  chain.maybeSingle = () => {
    call.single = true;
    return chain;
  };

  chain.then = ((onFulfilled, onRejected) => {
    calls.push(call);
    let result: Promise<FullResult>;
    try {
      result = Promise.resolve({ data: null, error: null, count: null, ...resolver(call) } as FullResult);
    } catch (e) {
      result = Promise.reject(e);
    }
    return result.then(onFulfilled, onRejected);
  }) as QueryChain["then"];

  return chain;
}

type Channel = { on: () => Channel; subscribe: () => Channel; unsubscribe: jest.Mock };

function channel(): Channel {
  const ch: Channel = { on: () => ch, subscribe: () => ch, unsubscribe: jest.fn() };
  return ch;
}

const auth = {
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(),
  signOut: jest.fn(),
  signInWithPassword: jest.fn(),
  signUp: jest.fn(),
  signInWithOAuth: jest.fn(),
};

export const supabase = {
  from: jest.fn((table: string) => query(table)),
  auth,
  functions: { invoke: jest.fn() },
  channel: jest.fn(() => channel()),
  removeChannel: jest.fn(),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: "" } })),
    })),
  },
};

/** What jest.mock("@/lib/supabaseClient", ...) should return. */
export const supabaseModule = { supabase };

function restoreDefaults() {
  auth.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  auth.onAuthStateChange
    .mockReset()
    .mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  auth.signOut.mockReset().mockResolvedValue({ error: null });
  auth.signInWithPassword.mockReset().mockResolvedValue({ data: {}, error: null });
  auth.signUp.mockReset().mockResolvedValue({ data: {}, error: null });
  auth.signInWithOAuth.mockReset().mockResolvedValue({ data: { url: null }, error: null });
  supabase.functions.invoke.mockReset().mockResolvedValue({ data: null, error: null });
  supabase.from.mockClear();
  supabase.channel.mockClear();
  supabase.removeChannel.mockClear();
}

export const db = {
  /** Every awaited query, in the order it ran. */
  calls,
  /** Every awaited query against one table, in the order it ran. */
  callsTo: (table: string) => calls.filter((c) => c.table === table),
  /** Decide how the database answers. Replaces any previous resolver. */
  respond(fn: Resolver) {
    resolver = fn;
  },
  reset() {
    resolver = () => undefined;
    calls.length = 0;
    restoreDefaults();
  },
};

/** True when the chain applied `method` with these leading arguments (compared by value). */
export function has(call: QueryCall, method: FilterMethod, ...args: unknown[]): boolean {
  return call.filters.some(
    ([m, ...applied]) =>
      m === method && args.every((arg, i) => JSON.stringify(applied[i]) === JSON.stringify(arg))
  );
}

restoreDefaults();
