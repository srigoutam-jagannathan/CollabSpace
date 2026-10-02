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
 *
 * Unanswered queries resolve to { data: null, error: null } unless the test
 * calls db.strict(), which makes them reject with the query's description --
 * use it when a test must prove the code issued no query it did not expect.
 * Code that catches errors can swallow that rejection, so each unanswered
 * query is also recorded in db.unanswered: when the code under test catches
 * errors, assert `expect(db.unanswered).toEqual([])`.
 *
 * A resolver that throws models a network failure and resolves with an error.
 * To model a query that rejects, return rejectWith(error): real postgrest-js
 * only rejects under throwOnError() or on a bug, so use it for that case.
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
  /** It was maybeSingle(): zero rows is not an error. */
  maybe: boolean;
};

export type QueryResult = { data?: unknown; error?: unknown; count?: number | null };
// status/statusText are omitted on purpose: the app never reads them.
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
let strict = false;
const unanswered: string[] = [];

const REJECT = Symbol("rejectWith");

/** Answer a query by rejecting with `error`, as postgrest-js does under throwOnError() or on a bug. */
export function rejectWith(error: unknown): QueryResult {
  return { [REJECT]: error } as unknown as QueryResult;
}
const calls: QueryCall[] = [];

/**
 * What single()/maybeSingle() do to an array of rows. Non-array data is
 * passed through, so tests that answer a single read with an object keep working.
 */
function singleRow(call: QueryCall, result: FullResult): FullResult {
  if (!call.single || !Array.isArray(result.data) || result.error) return result;
  const rows = result.data;
  if (rows.length === 1) return { ...result, data: rows[0] };
  if (rows.length === 0 && call.maybe) return { ...result, data: null };
  const n = rows.length;
  const error = call.maybe
    ? {
        code: "PGRST116",
        message: "JSON object requested, multiple (or no) rows returned",
        details: `Results contain ${n} rows, application/vnd.pgrst.object+json requires 1 row`,
        hint: null,
      }
    : {
        code: "PGRST116",
        message: "Cannot coerce the result to a single JSON object",
        details: `The result contains ${n} rows`,
        hint: null,
      };
  return { ...result, data: null, error, count: null };
}

function query(table: string): QueryChain {
  const call: QueryCall = { table, op: "select", filters: [], single: false, maybe: false };
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
    call.maybe = true;
    return chain;
  };

  chain.then = ((onFulfilled, onRejected) => {
    calls.push(call);
    let result: Promise<FullResult>;
    try {
      let answer: QueryResult | undefined;
      try {
        answer = resolver(call);
      } catch (e) {
        // postgrest-js catches fetch failures and resolves with this shape;
        // it only rejects when throwOnError() is used, which the app never does.
        const err = e as Error;
        answer = {
          data: null,
          error: { message: `${err.name ?? "FetchError"}: ${err.message}`, details: err.stack ?? "", hint: "", code: "" },
        };
      }
      if (answer && REJECT in answer) throw (answer as unknown as Record<symbol, unknown>)[REJECT];
      if (answer === undefined && strict) {
        const description = `Unanswered query: ${call.op} ${call.table} ${JSON.stringify(call.filters)}`;
        unanswered.push(description);
        throw new Error(description);
      }
      result = Promise.resolve(singleRow(call, { data: null, error: null, count: null, ...answer } as FullResult));
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
  updateUser: jest.fn(),
};

export const supabase = {
  from: jest.fn((table: string) => query(table)),
  auth,
  functions: { invoke: jest.fn() },
  rpc: jest.fn(),
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
  auth.updateUser.mockReset().mockResolvedValue({ data: { user: null }, error: null });
  supabase.rpc.mockReset().mockResolvedValue({ data: null, error: null });
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
  /** From now until reset(): a query the resolver returns undefined for rejects, naming it. */
  unanswered,
  strict() {
    strict = true;
  },
  reset() {
    resolver = () => undefined;
    strict = false;
    unanswered.length = 0;
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
