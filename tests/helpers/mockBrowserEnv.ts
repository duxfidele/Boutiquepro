import crypto from "node:crypto";
import {
  clearLastStorageError,
  OFFLINE_DB_NAME,
  resetCachedDBConnection,
  STORE_PENDING_SALES_V1,
} from "@/lib/offlineDb";
import { reportNetworkSuccess } from "@/lib/networkMonitor";
import { supabase } from "@/lib/supabase";

export type QueryOp = "select" | "upsert" | "update" | "insert" | "delete";

export interface TableQueryContext {
  table: string;
  op: QueryOp;
  columns?: string;
  payload?: unknown;
  filters: Array<{ kind: "eq" | "neq" | "gte"; col: string; val: unknown }>;
  singleMode: "none" | "maybeSingle" | "single";
}

export interface RpcCallLog {
  fn: string;
  params: Record<string, unknown>;
}

export interface TableCallLog extends TableQueryContext {}

export interface SupabaseResponse<T = unknown> {
  data: T;
  error: unknown;
}

export type RpcHandler = (
  params: Record<string, unknown>,
  fn: string
) => Promise<SupabaseResponse> | SupabaseResponse;

export type TableHandler = (
  ctx: TableQueryContext
) => Promise<SupabaseResponse> | SupabaseResponse;

interface MockIndexDef {
  name: string;
  keyPath: string | string[];
  unique: boolean;
}

interface MockStoreBacking {
  name: string;
  keyPath: string | string[];
  records: Map<string, unknown>;
  indexes: Map<string, MockIndexDef>;
}

interface MockDbBacking {
  name: string;
  version: number;
  stores: Map<string, MockStoreBacking>;
}

function cloneData<T>(value: T): T {
  if (value === undefined) return value;
  return structuredClone(value);
}

function getKeyProp(obj: unknown, keyPath: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = keyPath.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function extractKey(record: unknown, keyPath: string | string[]): unknown {
  if (Array.isArray(keyPath)) {
    return keyPath.map((kp) => getKeyProp(record, kp));
  }
  return getKeyProp(record, keyPath);
}

function compareKeys(a: unknown, b: unknown): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const cmp = compareKeys(a[i], b[i]);
      if (cmp !== 0) return cmp;
    }
    return a.length - b.length;
  }
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  if (typeof a === "number" && typeof b === "number") {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

class MockIDBKeyRangeImpl {
  readonly lower: unknown;
  readonly upper: unknown;
  readonly lowerOpen: boolean;
  readonly upperOpen: boolean;

  constructor(
    lower: unknown,
    upper: unknown,
    lowerOpen = false,
    upperOpen = false
  ) {
    this.lower = lower;
    this.upper = upper;
    this.lowerOpen = lowerOpen;
    this.upperOpen = upperOpen;
  }

  static bound(
    lower: unknown,
    upper: unknown,
    lowerOpen = false,
    upperOpen = false
  ): MockIDBKeyRangeImpl {
    return new MockIDBKeyRangeImpl(lower, upper, lowerOpen, upperOpen);
  }

  static only(value: unknown): MockIDBKeyRangeImpl {
    return new MockIDBKeyRangeImpl(value, value, false, false);
  }

  static lowerBound(lower: unknown, open = false): MockIDBKeyRangeImpl {
    return new MockIDBKeyRangeImpl(lower, undefined, open, true);
  }

  static upperBound(upper: unknown, open = false): MockIDBKeyRangeImpl {
    return new MockIDBKeyRangeImpl(undefined, upper, true, open);
  }

  includes(key: unknown): boolean {
    if (this.lower !== undefined) {
      const cmpLower = compareKeys(key, this.lower);
      if (this.lowerOpen ? cmpLower <= 0 : cmpLower < 0) return false;
    }
    if (this.upper !== undefined) {
      const cmpUpper = compareKeys(key, this.upper);
      if (this.upperOpen ? cmpUpper >= 0 : cmpUpper > 0) return false;
    }
    return true;
  }
}

function matchesQuery(key: unknown, query?: unknown): boolean {
  if (query === undefined || query === null) return true;
  if (query instanceof MockIDBKeyRangeImpl) {
    return query.includes(key);
  }
  return compareKeys(key, query) === 0;
}

interface MockEnvState {
  dbs: Map<string, MockDbBacking>;
  localMap: Map<string, string>;
  sessionMap: Map<string, string>;
  injectedPutErrors: Map<string, Error[]>;
  navigatorOnline: boolean;
  quotaBytes: number;
  usageBytes: number;
  persisted: boolean;
  webLocksEnabled: boolean;
  activeWebLocks: Set<string>;
  broadcastChannels: Map<string, Set<MockBroadcastChannelImpl>>;
  windowListeners: Map<string, Set<EventListenerOrEventListenerObject>>;
  documentListeners: Map<string, Set<EventListenerOrEventListenerObject>>;
  visibilityState: DocumentVisibilityState;
  rpcHandlers: Map<string, RpcHandler>;
  defaultRpcHandler: RpcHandler;
  tableHandlers: Map<string, TableHandler>;
  defaultTableHandler: TableHandler;
  tableData: Map<string, Array<Record<string, unknown>>>;
  rpcCalls: RpcCallLog[];
  tableCalls: TableCallLog[];
}

function createInitialState(): MockEnvState {
  const state: MockEnvState = {
    dbs: new Map(),
    localMap: new Map(),
    sessionMap: new Map(),
    injectedPutErrors: new Map(),
    navigatorOnline: true,
    quotaBytes: 100 * 1024 * 1024,
    usageBytes: 2 * 1024 * 1024,
    persisted: true,
    webLocksEnabled: true,
    activeWebLocks: new Set(),
    broadcastChannels: new Map(),
    windowListeners: new Map(),
    documentListeners: new Map(),
    visibilityState: "visible",
    rpcHandlers: new Map(),
    defaultRpcHandler: async () => ({ data: null, error: null }),
    tableHandlers: new Map(),
    defaultTableHandler: async (ctx) => {
      const rows = cloneData(state.tableData.get(ctx.table) || []);
      const filtered = rows.filter((row) =>
        ctx.filters.every((f) => {
          const val = row[f.col];
          if (f.kind === "eq") return val === f.val;
          if (f.kind === "neq") return val !== f.val;
          if (f.kind === "gte") return String(val || "") >= String(f.val || "");
          return true;
        })
      );
      if (ctx.singleMode === "maybeSingle") {
        return { data: filtered[0] ?? null, error: null };
      }
      if (ctx.singleMode === "single") {
        return filtered[0]
          ? { data: filtered[0], error: null }
          : { data: null, error: { code: "PGRST116", message: "Not found" } };
      }
      return { data: filtered, error: null };
    },
    tableData: new Map(),
    rpcCalls: [],
    tableCalls: [],
  };
  return state;
}

class MockBroadcastChannelImpl {
  readonly name: string;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  private closed = false;
  private readonly registry: Map<string, Set<MockBroadcastChannelImpl>>;

  constructor(
    name: string,
    registry: Map<string, Set<MockBroadcastChannelImpl>>
  ) {
    this.name = name;
    this.registry = registry;
    const set = registry.get(name) || new Set();
    set.add(this);
    registry.set(name, set);
  }

  postMessage(data: unknown): void {
    if (this.closed) return;
    const peers = this.registry.get(this.name);
    if (!peers) return;
    for (const peer of Array.from(peers)) {
      if (peer === this || peer.closed || !peer.onmessage) continue;
      const cloned = cloneData(data);
      queueMicrotask(() => {
        if (!peer.closed && peer.onmessage) {
          peer.onmessage({ data: cloned } as MessageEvent);
        }
      });
    }
  }

  close(): void {
    this.closed = true;
    const peers = this.registry.get(this.name);
    peers?.delete(this);
  }
}

function makeStorage(backing: Map<string, string>): Storage {
  return {
    get length() {
      return backing.size;
    },
    clear() {
      backing.clear();
    },
    getItem(key: string) {
      return backing.has(key) ? backing.get(key)! : null;
    },
    key(index: number) {
      return Array.from(backing.keys())[index] ?? null;
    },
    removeItem(key: string) {
      backing.delete(key);
    },
    setItem(key: string, value: string) {
      backing.set(key, String(value));
    },
  };
}

class MockDOMStringList {
  private readonly list: () => string[];

  constructor(listFn: () => string[]) {
    this.list = listFn;
  }

  get length(): number {
    return this.list().length;
  }

  contains(name: string): boolean {
    return this.list().includes(name);
  }

  item(index: number): string | null {
    return this.list()[index] ?? null;
  }

  [Symbol.iterator](): IterableIterator<string> {
    return this.list()[Symbol.iterator]();
  }
}

interface InternalIDBRequest<T = unknown> {
  result: T;
  error: DOMException | Error | null;
  onsuccess: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  transaction: InternalIDBTransaction | null;
  readyState: "pending" | "done";
}

interface InternalIDBTransaction {
  mode: IDBTransactionMode;
  db: unknown;
  error: DOMException | Error | null;
  oncomplete: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onabort: ((ev: Event) => void) | null;
  objectStore: (name: string) => unknown;
  abort: () => void;
  _scheduleOp: <T>(fn: () => T) => InternalIDBRequest<T>;
}

function createMockIDBFactory(env: MockEnvState): IDBFactory {
  const buildDbView = (backing: MockDbBacking) => {
    const dbView: Record<string, unknown> = {
      name: backing.name,
      version: backing.version,
      onversionchange: null,
      onclose: null,
      objectStoreNames: new MockDOMStringList(() =>
        Array.from(backing.stores.keys())
      ),
      close: () => {
        const fn = dbView.onclose as (() => void) | null;
        if (fn) fn();
      },
      createObjectStore: (
        name: string,
        opts?: IDBObjectStoreParameters
      ) => {
        if (!backing.stores.has(name)) {
          backing.stores.set(name, {
            name,
            keyPath: (opts?.keyPath as string | string[]) || "id",
            records: new Map(),
            indexes: new Map(),
          });
        }
        return makeStoreView(backing.stores.get(name)!, null);
      },
      deleteObjectStore: (name: string) => {
        backing.stores.delete(name);
      },
      transaction: (
        storeNames: string | string[],
        mode: IDBTransactionMode = "readonly"
      ) => {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        for (const n of names) {
          if (!backing.stores.has(n)) {
            throw new Error(`NotFoundError: ObjectStore '${n}' introuvable`);
          }
        }
        return createTx(mode);
      },
    };

    const makeIndexView = (
      storeBacking: MockStoreBacking,
      indexDef: MockIndexDef,
      tx: InternalIDBTransaction | null
    ) => {
      const exec = <T>(fn: () => T) => {
        if (!tx) throw new Error("Transaction required");
        return tx._scheduleOp(fn);
      };

      const matchingRecords = (query?: unknown): unknown[] => {
        const out: unknown[] = [];
        for (const rec of Array.from(storeBacking.records.values())) {
          const idxKey = extractKey(rec, indexDef.keyPath);
          if (matchesQuery(idxKey, query)) {
            out.push(cloneData(rec));
          }
        }
        return out;
      };

      return {
        name: indexDef.name,
        keyPath: indexDef.keyPath,
        unique: indexDef.unique,
        getAll: (query?: unknown) => exec(() => matchingRecords(query)),
        count: (query?: unknown) => exec(() => matchingRecords(query).length),
        get: (query?: unknown) => exec(() => matchingRecords(query)[0]),
      };
    };

    const makeStoreView = (
      storeBacking: MockStoreBacking,
      tx: InternalIDBTransaction | null
    ) => {
      const exec = <T>(fn: () => T) => {
        if (!tx) throw new Error("Transaction required");
        return tx._scheduleOp(fn);
      };

      return {
        name: storeBacking.name,
        keyPath: storeBacking.keyPath,
        indexNames: new MockDOMStringList(() =>
          Array.from(storeBacking.indexes.keys())
        ),
        createIndex: (
          name: string,
          keyPath: string | string[],
          opts?: IDBIndexParameters
        ) => {
          const def: MockIndexDef = {
            name,
            keyPath,
            unique: Boolean(opts?.unique),
          };
          storeBacking.indexes.set(name, def);
          return makeIndexView(storeBacking, def, tx);
        },
        index: (name: string) => {
          const def = storeBacking.indexes.get(name);
          if (!def) {
            throw new Error(`NotFoundError: Index '${name}' introuvable`);
          }
          return makeIndexView(storeBacking, def, tx);
        },
        put: (value: unknown) =>
          exec(() => {
            const errQueue = env.injectedPutErrors.get(storeBacking.name);
            if (errQueue && errQueue.length > 0) {
              const injected = errQueue.shift()!;
              throw injected;
            }
            const cloned = cloneData(value);
            const pk = extractKey(cloned, storeBacking.keyPath);
            const keyStr = JSON.stringify(pk);
            storeBacking.records.set(keyStr, cloned);
            return pk as IDBValidKey;
          }),
        get: (key: IDBValidKey) =>
          exec(() => {
            const val = storeBacking.records.get(JSON.stringify(key));
            return val !== undefined ? cloneData(val) : undefined;
          }),
        getAll: (query?: unknown) =>
          exec(() => {
            const out: unknown[] = [];
            for (const rec of Array.from(storeBacking.records.values())) {
              const pk = extractKey(rec, storeBacking.keyPath);
              if (matchesQuery(pk, query)) {
                out.push(cloneData(rec));
              }
            }
            return out;
          }),
        getAllKeys: () =>
          exec(() => {
            const out: IDBValidKey[] = [];
            for (const rec of Array.from(storeBacking.records.values())) {
              out.push(extractKey(rec, storeBacking.keyPath) as IDBValidKey);
            }
            return out;
          }),
        delete: (key: IDBValidKey) =>
          exec(() => {
            storeBacking.records.delete(JSON.stringify(key));
            return undefined;
          }),
        clear: () =>
          exec(() => {
            storeBacking.records.clear();
            return undefined;
          }),
        count: (query?: unknown) =>
          exec(() => {
            if (query === undefined || query === null) {
              return storeBacking.records.size;
            }
            let c = 0;
            for (const rec of Array.from(storeBacking.records.values())) {
              const pk = extractKey(rec, storeBacking.keyPath);
              if (matchesQuery(pk, query)) c += 1;
            }
            return c;
          }),
      };
    };

    const createTx = (mode: IDBTransactionMode): InternalIDBTransaction => {
      let pendingOps = 0;
      let finished = false;
      let commitTimer: ReturnType<typeof setTimeout> | null = null;

      const scheduleCommitCheck = () => {
        if (finished) return;
        if (commitTimer) clearTimeout(commitTimer);
        commitTimer = setTimeout(() => {
          commitTimer = null;
          if (!finished && pendingOps === 0) {
            finished = true;
            tx.oncomplete?.({ target: tx } as unknown as Event);
          }
        }, 0);
      };

      const tx: InternalIDBTransaction = {
        mode,
        db: dbView,
        error: null,
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore: (name: string) => {
          const sb = backing.stores.get(name);
          if (!sb) throw new Error(`NotFoundError: ObjectStore '${name}'`);
          return makeStoreView(sb, tx);
        },
        abort: () => {
          if (finished) return;
          finished = true;
          if (commitTimer) clearTimeout(commitTimer);
          tx.onabort?.({ target: tx } as unknown as Event);
        },
        _scheduleOp: <T>(fn: () => T): InternalIDBRequest<T> => {
          pendingOps += 1;
          const req: InternalIDBRequest<T> = {
            result: undefined as unknown as T,
            error: null,
            onsuccess: null,
            onerror: null,
            transaction: tx,
            readyState: "pending",
          };

          queueMicrotask(() => {
            if (finished) {
              pendingOps = Math.max(0, pendingOps - 1);
              return;
            }
            try {
              req.result = fn();
              req.readyState = "done";
              req.onsuccess?.({ target: req } as unknown as Event);
            } catch (err) {
              req.error = err as Error;
              req.readyState = "done";
              tx.error = err as Error;
              finished = true;
              if (commitTimer) clearTimeout(commitTimer);
              req.onerror?.({ target: req } as unknown as Event);
              tx.onerror?.({ target: tx } as unknown as Event);
            } finally {
              pendingOps = Math.max(0, pendingOps - 1);
              if (!finished) {
                scheduleCommitCheck();
              }
            }
          });

          return req;
        },
      };

      scheduleCommitCheck();
      return tx;
    };

    return { dbView, createTx };
  };

  return {
    open(name: string, version?: number): IDBOpenDBRequest {
      const targetVersion = version ?? 1;
      const req = {
        result: undefined as unknown as IDBDatabase,
        error: null as DOMException | null,
        transaction: null as IDBTransaction | null,
        onupgradeneeded: null as ((ev: IDBVersionChangeEvent) => void) | null,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
        onblocked: null as ((ev: Event) => void) | null,
      };

      queueMicrotask(() => {
        try {
          let backing = env.dbs.get(name);
          const oldVersion = backing ? backing.version : 0;
          const needsUpgrade = !backing || oldVersion < targetVersion;

          if (!backing) {
            backing = {
              name,
              version: targetVersion,
              stores: new Map(),
            };
            env.dbs.set(name, backing);
          } else if (needsUpgrade) {
            backing.version = targetVersion;
          }

          const { dbView, createTx } = buildDbView(backing);
          req.result = dbView as unknown as IDBDatabase;

          if (needsUpgrade) {
            const upgradeTx = createTx("versionchange");
            // Expose upgrade transaction so createObjectStore / index creation runs synchronously inside onupgradeneeded
            const syncDbView = {
              ...dbView,
            };
            req.result = syncDbView as unknown as IDBDatabase;
            req.transaction = upgradeTx as unknown as IDBTransaction;
            req.onupgradeneeded?.({
              target: req,
              oldVersion,
              newVersion: targetVersion,
            } as unknown as IDBVersionChangeEvent);
            req.transaction = null;
          }

          req.onsuccess?.({ target: req } as unknown as Event);
        } catch (err) {
          req.error = err as DOMException;
          req.onerror?.({ target: req } as unknown as Event);
        }
      });

      return req as unknown as IDBOpenDBRequest;
    },
    deleteDatabase(name: string) {
      env.dbs.delete(name);
      const req = { onsuccess: null as (() => void) | null };
      queueMicrotask(() => req.onsuccess?.());
      return req as unknown as IDBOpenDBRequest;
    },
    cmp: compareKeys,
    databases: async () =>
      Array.from(env.dbs.values()).map((d) => ({
        name: d.name,
        version: d.version,
      })),
  } as IDBFactory;
}

export interface TestHarness {
  env: MockEnvState;
  reset: () => void;
  simulatePageReload: () => void;
  setOnline: (online: boolean) => void;
  setQuotaEstimate: (quotaBytes: number, usageBytes: number) => void;
  setWebLocksEnabled: (enabled: boolean) => void;
  injectNextPutError: (storeName: string, err: Error) => void;
  seedV1DatabaseWithPendingSales: (items: unknown[]) => void;
  setRpcHandler: (fnName: string, handler: RpcHandler) => void;
  setDefaultRpcHandler: (handler: RpcHandler) => void;
  setTableHandler: (table: string, handler: TableHandler) => void;
  setTableRows: (table: string, rows: Array<Record<string, unknown>>) => void;
  clearCallLogs: () => void;
  getRpcCalls: () => RpcCallLog[];
  getTableCalls: () => TableCallLog[];
}

let activeHarness: TestHarness | null = null;

export function installTestHarness(): TestHarness {
  if (activeHarness) {
    activeHarness.reset();
    return activeHarness;
  }

  const env = createInitialState();
  const localStorageObj = makeStorage(env.localMap);
  const sessionStorageObj = makeStorage(env.sessionMap);
  const idbFactory = createMockIDBFactory(env);

  const g = globalThis as unknown as Record<string, unknown>;

  if (!g.crypto || typeof (g.crypto as Crypto).randomUUID !== "function") {
    g.crypto = crypto.webcrypto;
  }

  g.IDBKeyRange = MockIDBKeyRangeImpl;
  g.indexedDB = idbFactory;

  g.BroadcastChannel = class BroadcastChannelShim extends MockBroadcastChannelImpl {
    constructor(name: string) {
      super(name, env.broadcastChannels);
    }
  };

  const mockWindow = {
    localStorage: localStorageObj,
    sessionStorage: sessionStorageObj,
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject
    ) => {
      const set = env.windowListeners.get(type) || new Set();
      set.add(listener);
      env.windowListeners.set(type, set);
    },
    removeEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject
    ) => {
      env.windowListeners.get(type)?.delete(listener);
    },
    dispatchEvent: (ev: { type: string }) => {
      const set = env.windowListeners.get(ev.type);
      if (set) {
        for (const fn of Array.from(set)) {
          if (typeof fn === "function") fn(ev as Event);
          else fn.handleEvent(ev as Event);
        }
      }
      return true;
    },
  };

  const mockDocument = {
    get visibilityState() {
      return env.visibilityState;
    },
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject
    ) => {
      const set = env.documentListeners.get(type) || new Set();
      set.add(listener);
      env.documentListeners.set(type, set);
    },
    removeEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject
    ) => {
      env.documentListeners.get(type)?.delete(listener);
    },
  };

  const mockNavigator = {
    get onLine() {
      return env.navigatorOnline;
    },
    storage: {
      estimate: async () => ({
        quota: env.quotaBytes,
        usage: env.usageBytes,
      }),
      persist: async () => env.persisted,
      persisted: async () => env.persisted,
    },
    get locks() {
      if (!env.webLocksEnabled) return undefined;
      return {
        request: async (
          name: string,
          optsOrCb:
            | { mode?: "exclusive" | "shared"; ifAvailable?: boolean }
            | ((lock: { name: string } | null) => Promise<unknown>),
          maybeCb?: (lock: { name: string } | null) => Promise<unknown>
        ) => {
          const opts = typeof optsOrCb === "function" ? {} : optsOrCb;
          const cb = typeof optsOrCb === "function" ? optsOrCb : maybeCb!;

          if (env.activeWebLocks.has(name)) {
            if (opts.ifAvailable) {
              return cb(null);
            }
            while (env.activeWebLocks.has(name)) {
              await new Promise((r) => setTimeout(r, 5));
            }
          }

          env.activeWebLocks.add(name);
          try {
            return await cb({ name });
          } finally {
            env.activeWebLocks.delete(name);
          }
        },
      };
    },
  };

  g.window = mockWindow;
  g.document = mockDocument;
  Object.defineProperty(globalThis, "navigator", {
    value: mockNavigator,
    configurable: true,
    writable: true,
  });

  // Monkey-patch singleton supabase.rpc and supabase.from cleanly
  const sbAny = supabase as unknown as {
    rpc: (fn: string, params?: Record<string, unknown>) => PromiseLike<SupabaseResponse>;
    from: (table: string) => unknown;
  };

  sbAny.rpc = (fn: string, params: Record<string, unknown> = {}) => {
    const pClone = cloneData(params);
    env.rpcCalls.push({ fn, params: pClone });
    const handler = env.rpcHandlers.get(fn) || env.defaultRpcHandler;
    return Promise.resolve().then(() => handler(pClone, fn));
  };

  sbAny.from = (table: string) => {
    const ctx: TableQueryContext = {
      table,
      op: "select",
      filters: [],
      singleMode: "none",
    };

    const builder: Record<string, unknown> = {
      select: (columns?: string) => {
        if (ctx.op === "select") ctx.columns = columns;
        return builder;
      },
      upsert: (payload: unknown) => {
        ctx.op = "upsert";
        ctx.payload = cloneData(payload);
        return builder;
      },
      insert: (payload: unknown) => {
        ctx.op = "insert";
        ctx.payload = cloneData(payload);
        return builder;
      },
      update: (payload: unknown) => {
        ctx.op = "update";
        ctx.payload = cloneData(payload);
        return builder;
      },
      delete: () => {
        ctx.op = "delete";
        return builder;
      },
      eq: (col: string, val: unknown) => {
        ctx.filters.push({ kind: "eq", col, val });
        return builder;
      },
      neq: (col: string, val: unknown) => {
        ctx.filters.push({ kind: "neq", col, val });
        return builder;
      },
      gte: (col: string, val: unknown) => {
        ctx.filters.push({ kind: "gte", col, val });
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => {
        ctx.singleMode = "maybeSingle";
        return builder;
      },
      single: () => {
        ctx.singleMode = "single";
        return builder;
      },
      then: (
        onFulfilled?: (v: SupabaseResponse) => unknown,
        onRejected?: (err: unknown) => unknown
      ) => {
        const snapshotCtx: TableQueryContext = cloneData(ctx);
        env.tableCalls.push(snapshotCtx);
        const handler = env.tableHandlers.get(table) || env.defaultTableHandler;
        return Promise.resolve()
          .then(() => handler(snapshotCtx))
          .then(onFulfilled, onRejected);
      },
    };

    return builder;
  };

  const harness: TestHarness = {
    env,
    reset: () => {
      resetCachedDBConnection();
      clearLastStorageError();
      env.dbs.clear();
      env.localMap.clear();
      env.sessionMap.clear();
      env.injectedPutErrors.clear();
      env.navigatorOnline = true;
      env.quotaBytes = 100 * 1024 * 1024;
      env.usageBytes = 2 * 1024 * 1024;
      env.persisted = true;
      env.webLocksEnabled = true;
      env.activeWebLocks.clear();
      env.broadcastChannels.clear();
      env.rpcHandlers.clear();
      env.defaultRpcHandler = async () => ({ data: null, error: null });
      env.tableHandlers.clear();
      env.tableData.clear();
      env.rpcCalls = [];
      env.tableCalls = [];
      reportNetworkSuccess(15);
    },
    simulatePageReload: () => {
      resetCachedDBConnection();
      env.activeWebLocks.clear();
    },
    setOnline: (online: boolean) => {
      env.navigatorOnline = online;
    },
    setQuotaEstimate: (quotaBytes: number, usageBytes: number) => {
      env.quotaBytes = quotaBytes;
      env.usageBytes = usageBytes;
    },
    setWebLocksEnabled: (enabled: boolean) => {
      env.webLocksEnabled = enabled;
    },
    injectNextPutError: (storeName: string, err: Error) => {
      const q = env.injectedPutErrors.get(storeName) || [];
      q.push(err);
      env.injectedPutErrors.set(storeName, q);
    },
    seedV1DatabaseWithPendingSales: (items: unknown[]) => {
      resetCachedDBConnection();
      const records = new Map<string, unknown>();
      for (const item of items) {
        const rec = item as { id: string };
        records.set(JSON.stringify(rec.id), cloneData(item));
      }
      const v1Store: MockStoreBacking = {
        name: STORE_PENDING_SALES_V1,
        keyPath: "id",
        records,
        indexes: new Map([
          ["storeId", { name: "storeId", keyPath: "storeId", unique: false }],
          ["createdAt", { name: "createdAt", keyPath: "createdAt", unique: false }],
        ]),
      };
      env.dbs.set(OFFLINE_DB_NAME, {
        name: OFFLINE_DB_NAME,
        version: 1,
        stores: new Map([[STORE_PENDING_SALES_V1, v1Store]]),
      });
    },
    setRpcHandler: (fnName: string, handler: RpcHandler) => {
      env.rpcHandlers.set(fnName, handler);
    },
    setDefaultRpcHandler: (handler: RpcHandler) => {
      env.defaultRpcHandler = handler;
    },
    setTableHandler: (table: string, handler: TableHandler) => {
      env.tableHandlers.set(table, handler);
    },
    setTableRows: (table: string, rows: Array<Record<string, unknown>>) => {
      env.tableData.set(table, cloneData(rows));
    },
    clearCallLogs: () => {
      env.rpcCalls = [];
      env.tableCalls = [];
    },
    getRpcCalls: () => cloneData(env.rpcCalls),
    getTableCalls: () => cloneData(env.tableCalls),
  };

  activeHarness = harness;
  return harness;
}

