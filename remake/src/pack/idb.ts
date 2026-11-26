import type { ImagePack } from "./types.ts";
import { DEFAULT_BUILTIN_KEY, userPackKey } from "./catalog.ts";

const DB_NAME = "penpad-remake";
const DB_VERSION = 2;
const STORE = "packs";
const V1_ACTIVE_KEY = "active-user-pack";
export const META_KEY = "__meta__";

export interface StoredUserPack {
  key: string;
  savedAt: number;
  config: ImagePack;
  /** path -> { mime, bytes } */
  files: Record<string, { mime: string; bytes: ArrayBuffer }>;
}

interface PackMeta {
  key: typeof META_KEY;
  activeKey: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
      const tx = req.transaction;
      if (!tx) return;
      const store = tx.objectStore(STORE);
      const get = store.get(V1_ACTIVE_KEY);
      get.onsuccess = () => {
        const old = get.result as StoredUserPack | undefined;
        if (!old?.config || !old.files) return;
        const key = userPackKey(old.config.id);
        store.put({ key, savedAt: old.savedAt ?? Date.now(), config: old.config, files: old.files } satisfies StoredUserPack);
        store.put({ key: META_KEY, activeKey: key } satisfies PackMeta);
        if (key !== V1_ACTIVE_KEY) store.delete(V1_ACTIVE_KEY);
      };
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore, resolve: (v: T) => void, reject: (e: unknown) => void) => void): Promise<T> {
  return (async () => {
    const db = await openDb();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        tx.onerror = () => reject(tx.error ?? new Error("indexedDB transaction failed"));
        fn(tx.objectStore(STORE), resolve, reject);
      });
    } finally {
      db.close();
    }
  })();
}

export async function saveUserPack(config: ImagePack, files: Record<string, { mime: string; bytes: ArrayBuffer }>, key = userPackKey(config.id)): Promise<string> {
  const rec: StoredUserPack = { key, savedAt: Date.now(), config, files };
  await withStore<void>("readwrite", (store, resolve, reject) => {
    store.put(rec);
    store.put({ key: META_KEY, activeKey: key } satisfies PackMeta);
    const tx = store.transaction;
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB write failed"));
  });
  return key;
}

export async function listUserPacks(): Promise<StoredUserPack[]> {
  const rows = await withStore<StoredUserPack[]>("readonly", (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as Array<StoredUserPack | PackMeta>).filter((r) => r.key !== META_KEY && "config" in r && "files" in r) as StoredUserPack[]);
    req.onerror = () => reject(req.error ?? new Error("indexedDB list failed"));
  });
  return rows.sort((a, b) => b.savedAt - a.savedAt);
}

export async function loadUserPack(key?: string): Promise<StoredUserPack | null> {
  if (key) {
    return withStore<StoredUserPack | null>("readonly", (store, resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => {
        const rec = req.result as StoredUserPack | PackMeta | undefined;
        resolve(rec && rec.key !== META_KEY && "config" in rec ? rec : null);
      };
      req.onerror = () => reject(req.error ?? new Error("indexedDB read failed"));
    });
  }
  const active = await getActiveKey();
  if (!active.startsWith("user:")) return null;
  return loadUserPack(active);
}

export async function getActiveKey(): Promise<string> {
  const meta = await withStore<PackMeta | StoredUserPack | undefined>("readonly", (store, resolve, reject) => {
    const req = store.get(META_KEY);
    req.onsuccess = () => resolve(req.result as PackMeta | undefined);
    req.onerror = () => reject(req.error ?? new Error("indexedDB read failed"));
  });
  if (meta && "activeKey" in meta && typeof meta.activeKey === "string" && meta.activeKey) return meta.activeKey;
  // Un-migrated v1 record.
  const legacy = await withStore<StoredUserPack | undefined>("readonly", (store, resolve, reject) => {
    const req = store.get(V1_ACTIVE_KEY);
    req.onsuccess = () => resolve(req.result as StoredUserPack | undefined);
    req.onerror = () => reject(req.error ?? new Error("indexedDB read failed"));
  });
  if (legacy?.config) return userPackKey(legacy.config.id);
  return DEFAULT_BUILTIN_KEY;
}

export async function setActiveKey(key: string): Promise<void> {
  await withStore<void>("readwrite", (store, resolve, reject) => {
    store.put({ key: META_KEY, activeKey: key } satisfies PackMeta);
    const tx = store.transaction;
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB write failed"));
  });
}

export async function deleteUserPack(key: string): Promise<void> {
  if (!key.startsWith("user:")) return;
  const active = await getActiveKey();
  await withStore<void>("readwrite", (store, resolve, reject) => {
    store.delete(key);
    if (active === key) store.put({ key: META_KEY, activeKey: DEFAULT_BUILTIN_KEY } satisfies PackMeta);
    const tx = store.transaction;
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB delete failed"));
  });
}

/** Drop every uploaded pack and point the active key at the default built-in pack. */
export async function clearUserPack(): Promise<void> {
  const rows = await listUserPacks();
  await withStore<void>("readwrite", (store, resolve, reject) => {
    for (const row of rows) store.delete(row.key);
    store.delete(V1_ACTIVE_KEY);
    store.put({ key: META_KEY, activeKey: DEFAULT_BUILTIN_KEY } satisfies PackMeta);
    const tx = store.transaction;
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB delete failed"));
  });
}

export function mimeForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "svg") return "image/svg+xml";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "yaml" || ext === "yml") return "text/yaml";
  if (ext === "json") return "application/json";
  return "application/octet-stream";
}
