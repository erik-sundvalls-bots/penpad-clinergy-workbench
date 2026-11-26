import { PATIENTS, type Patient } from "./patients.ts";

export interface RecordEntry {
  id: string;
  /** ISO date of the session (local calendar day). */
  date: string;
  topic: string;
  sentences: string[];
  comment?: string;
}

export interface PatientStore {
  records: RecordEntry[];
}

export interface RemakeStore {
  version: 1;
  currentPatientId: Patient["id"];
  patients: Record<string, PatientStore>;
}

const KEY = "penpad-remake-v1";

export function emptyStore(): RemakeStore {
  const patients: Record<string, PatientStore> = {};
  for (const p of PATIENTS) patients[p.id] = { records: [] };
  return { version: 1, currentPatientId: "pat:lars", patients };
}

export function loadStore(): RemakeStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as RemakeStore;
    if (parsed.version !== 1 || !parsed.patients) return emptyStore();
    const base = emptyStore();
    for (const p of PATIENTS) {
      const saved = parsed.patients[p.id];
      if (saved && Array.isArray(saved.records)) base.patients[p.id] = { records: saved.records };
    }
    if (parsed.currentPatientId === "pat:lars" || parsed.currentPatientId === "pat:eva") {
      base.currentPatientId = parsed.currentPatientId;
    }
    return base;
  } catch {
    return emptyStore();
  }
}

export function saveStore(store: RemakeStore): void {
  localStorage.setItem(KEY, JSON.stringify(store));
}

/** Reset demo: wipe saved records for both patients. Distinct from per-form Reset. */
export function resetDemo(): RemakeStore {
  const store = emptyStore();
  saveStore(store);
  return store;
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function newRecordId(): string {
  return `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
