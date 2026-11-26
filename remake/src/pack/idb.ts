import type { ImagePack } from "./types.ts";

const DB_NAME = "penpad-remake";
const DB_VERSION = 1;
const STORE = "packs";
const ACTIVE_KEY = "active-user-pack";

export interface StoredUserPack {
  key: typeof ACTIVE_KEY;
  savedAt: number;
  config: ImagePack;
  /** path -> { mime, bytes } */
  files: Record<string, { mime: string; bytes: ArrayBuffer }>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

export async function saveUserPack(config: ImagePack, files: Record<string, { mime: string; bytes: ArrayBuffer }>): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("indexedDB write failed"));
      tx.objectStore(STORE).put({ key: ACTIVE_KEY, savedAt: Date.now(), config, files } satisfies StoredUserPack);
    });
  } finally {
    db.close();
  }
}

export async function loadUserPack(): Promise<StoredUserPack | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(ACTIVE_KEY);
      req.onsuccess = () => resolve((req.result as StoredUserPack | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("indexedDB read failed"));
    });
  } finally {
    db.close();
  }
}

export async function clearUserPack(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("indexedDB delete failed"));
      tx.objectStore(STORE).delete(ACTIVE_KEY);
    });
  } finally {
    db.close();
  }
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
