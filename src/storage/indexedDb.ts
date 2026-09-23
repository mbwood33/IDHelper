import { cloneKnowledgeState, isKnowledgeState } from "./bundle";
import { EMPTY_KNOWLEDGE_STATE, type KnowledgeState } from "./types";

/** Browser-local database namespace; changing it would intentionally isolate old data. */
const DATABASE_NAME = "idhelper";
/** IndexedDB schema revision used to trigger object-store creation upgrades. */
const DATABASE_VERSION = 1;
/** Object store containing the application's single serialized knowledge state. */
const STORE_NAME = "knowledge";
/** Singleton record key because IDHelper stores one current knowledge document. */
const STATE_KEY = "current";

/**
 * Opens (and, on first run, creates) the application's IndexedDB database.
 *
 * @returns A live database connection which callers must close.
 * @throws {Error} When IndexedDB is blocked, unavailable, or cannot be opened.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    // This event runs only while opening a new database version. The conditional
    // makes the operation safe if a browser retries or upgrades an existing DB.
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open IDHelper storage."));
  });
}

/**
 * Reads the singleton knowledge record from IndexedDB.
 *
 * @returns A defensive copy of the saved state, or a fresh empty state if no
 * valid record exists. Returning a copy prevents UI mutations from bypassing
 * validation and persistence.
 * @throws {Error} When the database cannot be opened or read.
 */
export async function loadKnowledgeState(): Promise<KnowledgeState> {
  const db = await openDatabase();
  try {
    return await new Promise<KnowledgeState>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess = () => resolve(isKnowledgeState(request.result) ? cloneKnowledgeState(request.result) : cloneKnowledgeState(EMPTY_KNOWLEDGE_STATE));
      request.onerror = () => reject(request.error ?? new Error("Could not read IDHelper storage."));
    });
  } finally {
    db.close();
  }
}

/**
 * Atomically replaces the singleton local knowledge record.
 *
 * @param state Validated state to persist. The function clones it before
 * writing so callers cannot mutate the stored object by reference.
 * @throws {TypeError} When `state` fails runtime schema validation.
 * @throws {Error} When IndexedDB cannot be opened or written.
 */
export async function saveKnowledgeState(state: KnowledgeState): Promise<void> {
  if (!isKnowledgeState(state)) throw new TypeError("Cannot save invalid knowledge state.");
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(cloneKnowledgeState(state), STATE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Could not save IDHelper storage."));
    });
  } finally {
    db.close();
  }
}

/**
 * Replaces all local feedback and overrides with a fresh empty state.
 * This is recoverable only if the user previously exported their knowledge.
 */
export async function resetKnowledgeState(): Promise<void> {
  await saveKnowledgeState(EMPTY_KNOWLEDGE_STATE);
}
